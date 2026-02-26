/**
 * Offline message queue — outbox pattern for messaging reliability.
 *
 * When the device is offline (or a send fails), messages are queued in
 * AsyncStorage and retried when connectivity returns.
 *
 * Usage:
 *   const queue = OfflineMessageQueue.getInstance();
 *   queue.enqueue(msg);        // queue a message
 *   queue.startProcessing();   // begin retry loop
 *   queue.onSent(callback);    // called when a queued msg is successfully sent
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { logger } from '@/lib/logger';
import type { SendMessageInput } from './types';

const STORAGE_KEY = 'edudash:messaging:offline_queue';
const MAX_RETRIES = 5;
const BASE_RETRY_MS = 2_000;

export interface QueuedMessage {
  /** UUID generated at enqueue time */
  localId: string;
  /** Payload to send */
  payload: SendMessageInput;
  /** Sender user ID */
  senderId: string;
  /** ISO timestamp when enqueued */
  enqueuedAt: string;
  /** Number of retry attempts so far */
  retries: number;
  /** Last error message */
  lastError?: string;
}

type SentCallback = (localId: string, serverId: string) => void;
type FailedCallback = (localId: string, error: string) => void;

export class OfflineMessageQueue {
  private static instance: OfflineMessageQueue;
  private processing = false;
  private sentCallbacks: SentCallback[] = [];
  private failedCallbacks: FailedCallback[] = [];
  private unsubscribeNetInfo: (() => void) | null = null;
  /** injected by the consumer — the actual Supabase insert logic */
  private sendFn:
    | ((payload: SendMessageInput, senderId: string) => Promise<string>)
    | null = null;

  static getInstance(): OfflineMessageQueue {
    if (!OfflineMessageQueue.instance) {
      OfflineMessageQueue.instance = new OfflineMessageQueue();
    }
    return OfflineMessageQueue.instance;
  }

  /** Inject the actual send function (called once from the messaging hook) */
  setSendFunction(fn: (payload: SendMessageInput, senderId: string) => Promise<string>): void {
    this.sendFn = fn;
  }

  /** Register a callback when a queued message is successfully sent */
  onSent(cb: SentCallback): () => void {
    this.sentCallbacks.push(cb);
    return () => {
      this.sentCallbacks = this.sentCallbacks.filter((c) => c !== cb);
    };
  }

  /** Register a callback when a queued message permanently fails */
  onFailed(cb: FailedCallback): () => void {
    this.failedCallbacks.push(cb);
    return () => {
      this.failedCallbacks = this.failedCallbacks.filter((c) => c !== cb);
    };
  }

  /** Add a message to the outbox */
  async enqueue(payload: SendMessageInput, senderId: string): Promise<string> {
    const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const item: QueuedMessage = {
      localId,
      payload,
      senderId,
      enqueuedAt: new Date().toISOString(),
      retries: 0,
    };

    const queue = await this.loadQueue();
    queue.push(item);
    await this.saveQueue(queue);

    logger.debug('OfflineQueue', `Enqueued message ${localId} for thread ${payload.threadId}`);

    // Attempt immediate send
    this.processQueue();

    return localId;
  }

  /** Start listening for connectivity changes and process on reconnect */
  startProcessing(): void {
    if (this.unsubscribeNetInfo) return; // already listening

    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        logger.debug('OfflineQueue', 'Network available — processing queue');
        this.processQueue();
      }
    });

    // Also process immediately on startup
    this.processQueue();
  }

  /** Stop listening */
  stopProcessing(): void {
    this.unsubscribeNetInfo?.();
    this.unsubscribeNetInfo = null;
  }

  /** Get current queue snapshot (for UI display) */
  async getQueue(): Promise<QueuedMessage[]> {
    return this.loadQueue();
  }

  /** Remove a message from the queue (user cancels or manually retries) */
  async remove(localId: string): Promise<void> {
    const queue = await this.loadQueue();
    await this.saveQueue(queue.filter((m) => m.localId !== localId));
  }

  /** Get queued messages for a specific thread */
  async getForThread(threadId: string): Promise<QueuedMessage[]> {
    const queue = await this.loadQueue();
    return queue.filter((m) => m.payload.threadId === threadId);
  }

  /** Flush the entire queue using a provided send function. Returns counts. */
  async flush(
    sendFn: (msg: QueuedMessage) => Promise<boolean>,
  ): Promise<{ sent: number; failed: number }> {
    const queue = await this.loadQueue();
    let sent = 0;
    let failed = 0;
    const remaining: QueuedMessage[] = [];

    for (const item of queue) {
      try {
        const ok = await sendFn(item);
        if (ok) {
          sent += 1;
          this.sentCallbacks.forEach((cb) => cb(item.localId, item.localId));
        } else {
          failed += 1;
          remaining.push(item);
        }
      } catch {
        failed += 1;
        remaining.push(item);
      }
    }

    await this.saveQueue(remaining);
    logger.debug('OfflineQueue', `Flushed: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  /** Remove all messages from the queue */
  async clear(): Promise<void> {
    await this.saveQueue([]);
    logger.debug('OfflineQueue', 'Queue cleared');
  }

  // ─── internals ───

  private async processQueue(): Promise<void> {
    if (this.processing || !this.sendFn) return;
    this.processing = true;

    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        this.processing = false;
        return;
      }

      const queue = await this.loadQueue();
      if (queue.length === 0) {
        this.processing = false;
        return;
      }

      logger.debug('OfflineQueue', `Processing ${queue.length} queued messages`);

      const remaining: QueuedMessage[] = [];

      for (const item of queue) {
        try {
          const serverId = await this.sendFn(item.payload, item.senderId);
          logger.debug('OfflineQueue', `✅ Sent queued message ${item.localId} → ${serverId}`);
          this.sentCallbacks.forEach((cb) => cb(item.localId, serverId));
        } catch (err: any) {
          item.retries += 1;
          item.lastError = err?.message || String(err);

          if (item.retries >= MAX_RETRIES) {
            logger.warn('OfflineQueue', `❌ Permanently failed: ${item.localId} after ${MAX_RETRIES} retries`);
            this.failedCallbacks.forEach((cb) => cb(item.localId, item.lastError!));
          } else {
            remaining.push(item);
            logger.debug(
              'OfflineQueue',
              `Retry ${item.retries}/${MAX_RETRIES} for ${item.localId}`
            );
          }
        }
      }

      await this.saveQueue(remaining);

      // If there are still remaining items, schedule a retry with exponential backoff
      if (remaining.length > 0) {
        const minRetries = Math.min(...remaining.map((m) => m.retries));
        const delay = Math.min(BASE_RETRY_MS * Math.pow(2, minRetries), 30_000);
        setTimeout(() => this.processQueue(), delay);
      }
    } catch (err) {
      logger.error('OfflineQueue', 'Process error:', err);
    } finally {
      this.processing = false;
    }
  }

  private async loadQueue(): Promise<QueuedMessage[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private async saveQueue(queue: QueuedMessage[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (err) {
      logger.error('OfflineQueue', 'Failed to persist queue:', err);
    }
  }
}
