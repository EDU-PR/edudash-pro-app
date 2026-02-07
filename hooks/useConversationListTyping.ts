/**
 * useConversationListTyping - Typing indicators for conversation list screens
 *
 * Subscribes to Supabase broadcast channels for the N most-recent threads
 * and exposes a map of { [threadId]: typingText } so that ThreadItem can
 * replace the last-message preview with "typing…" when appropriate.
 *
 * Limits to MAX_CHANNELS threads to avoid overwhelming the Supabase
 * multiplexed WebSocket connection.
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const MAX_CHANNELS = 20;
const TYPING_TIMEOUT_MS = 3500; // Slightly longer than thread-level (3s) to avoid flicker

interface TypingEntry {
  userName: string;
  timestamp: number;
}

export interface ConversationTypingMap {
  /** threadId → display text like "John is typing…" */
  [threadId: string]: string | null;
}

/**
 * Hook that subscribes to typing channels for multiple threads.
 *
 * @param threadIds - array of thread IDs (usually from the threads query)
 * @param userId   - current user's ID (to filter out own events)
 */
export function useConversationListTyping(
  threadIds: string[],
  userId: string | null,
): ConversationTypingMap {
  // threadId → array of currently-typing users
  const [typingMap, setTypingMap] = useState<Record<string, TypingEntry[]>>({});
  const channelsRef = useRef<any[]>([]);
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Only subscribe to the first MAX_CHANNELS threads (most recent)
  const subscribedIds = useMemo(
    () => threadIds.slice(0, MAX_CHANNELS),
    // Intentionally stringify to avoid re-subscribing on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(threadIds.slice(0, MAX_CHANNELS))],
  );

  useEffect(() => {
    if (!userId || subscribedIds.length === 0) return;

    const supabase = assertSupabase();
    const channels: any[] = [];

    for (const tid of subscribedIds) {
      const channel = supabase
        .channel(`typing:${tid}`)
        .on('broadcast', { event: 'typing' }, (payload: any) => {
          const {
            userId: typingUserId,
            userName: typingUserName,
            isTyping,
            timestamp,
          } = payload.payload;

          // Ignore own events
          if (typingUserId === userId) return;

          setTypingMap((prev) => {
            const current = prev[tid] || [];
            if (isTyping) {
              const existing = current.find((e) => e.userName === typingUserName);
              if (existing) {
                return {
                  ...prev,
                  [tid]: current.map((e) =>
                    e.userName === typingUserName ? { ...e, timestamp } : e,
                  ),
                };
              }
              return {
                ...prev,
                [tid]: [...current, { userName: typingUserName, timestamp }],
              };
            } else {
              return {
                ...prev,
                [tid]: current.filter((e) => e.userName !== typingUserName),
              };
            }
          });
        })
        .subscribe();

      channels.push(channel);
    }

    channelsRef.current = channels;

    // Prune stale entries every second
    cleanupIntervalRef.current = setInterval(() => {
      const now = Date.now();
      setTypingMap((prev) => {
        let changed = false;
        const next: Record<string, TypingEntry[]> = {};
        for (const tid of Object.keys(prev)) {
          const filtered = prev[tid].filter(
            (e) => now - e.timestamp < TYPING_TIMEOUT_MS,
          );
          if (filtered.length !== prev[tid].length) changed = true;
          if (filtered.length > 0) next[tid] = filtered;
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => {
      for (const ch of channelsRef.current) {
        try {
          supabase.removeChannel(ch);
        } catch {}
      }
      channelsRef.current = [];
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
      setTypingMap({});
      logger.debug('useConversationListTyping', 'Cleaned up all typing channels');
    };
  }, [subscribedIds, userId]);

  // Convert internal map → display text map
  return useMemo(() => {
    const result: ConversationTypingMap = {};
    for (const tid of Object.keys(typingMap)) {
      const users = typingMap[tid];
      if (!users || users.length === 0) {
        result[tid] = null;
      } else if (users.length === 1) {
        result[tid] = `${users[0].userName} is typing…`;
      } else if (users.length === 2) {
        result[tid] = `${users[0].userName} and ${users[1].userName} are typing…`;
      } else {
        result[tid] = `${users.length} people are typing…`;
      }
    }
    return result;
  }, [typingMap]);
}
