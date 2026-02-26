/**
 * useMessageRetry — manages a queue of failed messages and provides
 * retry / dismiss actions.
 *
 * Failed messages are persisted to AsyncStorage so they survive app restarts.
 * Auto-retries once when the Realtime connection is restored.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/lib/logger';
import { useRealtimeConnectionState } from './useRealtimeConnectionState';

const STORAGE_KEY = '@edudash_failed_messages';
const MAX_RETRIES = 3;

export interface FailedMessage {
  localId: string;
  threadId: string;
  content: string;
  attachments?: string[];
  failedAt: number;
  retryCount: number;
  error: string;
}

type SendFn = (threadId: string, content: string) => Promise<void>;

export interface UseMessageRetryOptions {
  sendFn: SendFn;
}

export interface UseMessageRetryReturn {
  failedMessages: FailedMessage[];
  retryMessage: (localId: string) => Promise<boolean>;
  retryAll: () => Promise<void>;
  dismissFailed: (localId: string) => void;
  addFailed: (msg: Omit<FailedMessage, 'failedAt' | 'retryCount'>) => void;
}

async function loadFailed(): Promise<FailedMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveFailed(msgs: FailedMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
  } catch (err) {
    logger.error('MessageRetry', 'Failed to persist queue:', err);
  }
}

export function useMessageRetry({ sendFn }: UseMessageRetryOptions): UseMessageRetryReturn {
  const [failedMessages, setFailedMessages] = useState<FailedMessage[]>([]);
  const { state: connState } = useRealtimeConnectionState();
  const prevConnState = useRef(connState);
  const sendFnRef = useRef(sendFn);
  sendFnRef.current = sendFn;

  // Load persisted queue on mount
  useEffect(() => {
    loadFailed().then(setFailedMessages);
  }, []);

  const persist = useCallback((next: FailedMessage[]) => {
    setFailedMessages(next);
    saveFailed(next);
  }, []);

  const addFailed = useCallback(
    (msg: Omit<FailedMessage, 'failedAt' | 'retryCount'>) => {
      const entry: FailedMessage = { ...msg, failedAt: Date.now(), retryCount: 0 };
      setFailedMessages((prev) => {
        const next = [...prev, entry];
        saveFailed(next);
        return next;
      });
      logger.debug('MessageRetry', `Queued failed message ${msg.localId}`);
    },
    [],
  );

  const retryMessage = useCallback(
    async (localId: string): Promise<boolean> => {
      const current = await loadFailed();
      const msg = current.find((m) => m.localId === localId);
      if (!msg) return false;

      try {
        await sendFnRef.current(msg.threadId, msg.content);
        const next = current.filter((m) => m.localId !== localId);
        persist(next);
        logger.debug('MessageRetry', `Retry succeeded for ${localId}`);
        return true;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const updated = current.map((m) =>
          m.localId === localId
            ? { ...m, retryCount: m.retryCount + 1, error: errorMsg, failedAt: Date.now() }
            : m,
        );
        persist(updated);
        logger.warn('MessageRetry', `Retry failed for ${localId} (${msg.retryCount + 1}/${MAX_RETRIES})`);
        return false;
      }
    },
    [persist],
  );

  const retryAll = useCallback(async () => {
    const current = await loadFailed();
    const retryable = current.filter((m) => m.retryCount < MAX_RETRIES);
    for (const msg of retryable) {
      await retryMessage(msg.localId);
    }
  }, [retryMessage]);

  const dismissFailed = useCallback(
    (localId: string) => {
      setFailedMessages((prev) => {
        const next = prev.filter((m) => m.localId !== localId);
        saveFailed(next);
        return next;
      });
    },
    [],
  );

  // Auto-retry once when connection is restored
  useEffect(() => {
    if (prevConnState.current !== 'connected' && connState === 'connected') {
      logger.debug('MessageRetry', 'Connection restored — auto-retrying failed messages');
      retryAll();
    }
    prevConnState.current = connState;
  }, [connState, retryAll]);

  return { failedMessages, retryMessage, retryAll, dismissFailed, addFailed };
}
