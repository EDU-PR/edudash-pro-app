/**
 * Auth Event Queue
 *
 * Serialises Supabase auth state-change events (SIGNED_IN, SIGNED_OUT,
 * TOKEN_REFRESHED, etc.) so they are processed one-at-a-time in FIFO order.
 *
 * Without this, rapid sign-out-then-sign-in can cause overlapping profile
 * fetches, partial state clears, and stale navigations.
 *
 * Usage (inside AuthContext):
 *   const queue = authEventQueue;
 *   supabase.auth.onAuthStateChange((event, session) => {
 *     queue.enqueue(event, session, async (ev, s) => { ... });
 *   });
 */

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

type EventHandler = (
  event: AuthChangeEvent,
  session: Session | null
) => Promise<void>;

interface QueueItem {
  event: AuthChangeEvent;
  session: Session | null;
  handler: EventHandler;
  enqueuedAt: number;
}

/** Maximum time (ms) a single handler is allowed to run. */
const HANDLER_TIMEOUT_MS = 15_000;

class AuthEventQueue {
  private queue: QueueItem[] = [];
  private processing = false;

  /**
   * Add an event to the queue and kick off processing if idle.
   */
  enqueue(
    event: AuthChangeEvent,
    session: Session | null,
    handler: EventHandler
  ): void {
    // Collapse redundant SIGNED_OUT — keep only the latest
    if (event === 'SIGNED_OUT') {
      this.queue = this.queue.filter((q) => q.event !== 'SIGNED_OUT');
    }

    this.queue.push({ event, session, handler, enqueuedAt: Date.now() });
    this.processNext();
  }

  /** Number of items waiting (including the one currently running). */
  get length(): number {
    return this.queue.length + (this.processing ? 1 : 0);
  }

  /** Discard all pending items (used during forced resets). */
  clear(): void {
    this.queue = [];
  }

  // ── internal ──

  private async processNext(): Promise<void> {
    if (this.processing) return;
    const item = this.queue.shift();
    if (!item) return;

    this.processing = true;
    const label = `${item.event}@${item.enqueuedAt}`;

    try {
      await Promise.race([
        item.handler(item.event, item.session),
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error(`AuthEventQueue: handler timed out (${label})`)),
            HANDLER_TIMEOUT_MS
          )
        ),
      ]);
    } catch (err) {
      logger.error('AuthEventQueue', `Error processing ${label}:`, err);
    } finally {
      this.processing = false;
      // Process next item (if any)
      if (this.queue.length > 0) {
        // Use microtask to avoid deep recursion
        queueMicrotask(() => this.processNext());
      }
    }
  }
}

/** Singleton queue — shared by AuthContext. */
export const authEventQueue = new AuthEventQueue();
