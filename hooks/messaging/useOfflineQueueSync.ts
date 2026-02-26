/**
 * useOfflineQueueSync — bridges the OfflineMessageQueue with the
 * Realtime connection state so queued messages are flushed automatically
 * when the connection is restored.
 *
 * Also exposes the current queued-message list for in-thread pending UI.
 */

import { useState, useEffect, useRef } from 'react';
import { OfflineMessageQueue, type QueuedMessage } from '@/lib/messaging/offlineQueue';
import { useRealtimeConnectionState } from './useRealtimeConnectionState';
import { logger } from '@/lib/logger';

export interface UseOfflineQueueSyncReturn {
  /** Messages currently waiting in the offline queue */
  queuedMessages: QueuedMessage[];
  /** Queued messages for a specific thread */
  getForThread: (threadId: string) => QueuedMessage[];
  /** Manually trigger a flush */
  flushNow: () => Promise<void>;
}

export function useOfflineQueueSync(): UseOfflineQueueSyncReturn {
  const { state: connState } = useRealtimeConnectionState();
  const prevState = useRef(connState);
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const queue = OfflineMessageQueue.getInstance();

  // Refresh snapshot from storage
  const refreshSnapshot = async () => {
    const items = await queue.getQueue();
    setQueuedMessages(items);
  };

  useEffect(() => {
    refreshSnapshot();

    const unsubSent = queue.onSent(() => refreshSnapshot());
    const unsubFailed = queue.onFailed(() => refreshSnapshot());

    return () => {
      unsubSent();
      unsubFailed();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-flush on reconnect
  useEffect(() => {
    if (prevState.current !== 'connected' && connState === 'connected') {
      logger.debug('OfflineQueueSync', 'Connection restored — flushing offline queue');
      queue.startProcessing();
      refreshSnapshot();
    }
    prevState.current = connState;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connState]);

  const getForThread = (threadId: string): QueuedMessage[] =>
    queuedMessages.filter((m) => m.payload.threadId === threadId);

  const flushNow = async () => {
    queue.startProcessing();
    await new Promise((r) => setTimeout(r, 500));
    await refreshSnapshot();
  };

  return { queuedMessages, getForThread, flushNow };
}
