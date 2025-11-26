'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseUnreadMessagesReturn {
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface ThreadParticipant {
  user_id: string;
  role: string;
  last_read_at: string | null;
}

interface MessageThread {
  id: string;
  message_participants: ThreadParticipant[];
}

interface MessagePayload {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface ThreadData {
  threadId: string;
  lastReadAt: string;
}

interface MessageRecord {
  id: string;
  thread_id: string;
  created_at: string;
}

/**
 * Hook to get and track unread message count for a parent user.
 * Subscribes to real-time updates to show new message indicators immediately.
 */
export function useUnreadMessages(userId: string | undefined, childId: string | null): UseUnreadMessagesReturn {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

  const loadUnreadCount = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setUnreadCount(0);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = supabaseRef.current;

      // Get all threads the user is a participant in with their last_read_at
      const { data: threads, error: threadsError } = await supabase
        .from('message_threads')
        .select(`
          id,
          message_participants!inner(user_id, role, last_read_at)
        `);

      if (threadsError) {
        console.error('Error fetching threads:', threadsError);
        setUnreadCount(0);
        return;
      }

      if (!threads || threads.length === 0) {
        setUnreadCount(0);
        return;
      }

      // Filter to threads where user is a participant and get their last_read_at
      const userThreadsData = threads
        .filter((thread: MessageThread) =>
          thread.message_participants?.some((p: ThreadParticipant) => p.user_id === userId)
        )
        .map((thread: MessageThread) => {
          const userParticipant = thread.message_participants?.find(
            (p: ThreadParticipant) => p.user_id === userId
          );
          return {
            threadId: thread.id,
            lastReadAt: userParticipant?.last_read_at || '2000-01-01',
          };
        });

      if (userThreadsData.length === 0) {
        setUnreadCount(0);
        return;
      }

      // Build a single query to count all unread messages across all threads
      // Using an OR condition for each thread with its specific last_read_at
      let totalUnread = 0;

      // Count unread messages for all threads in one query using RPC
      // Since we can't easily do this with complex filters, we batch by groups
      const threadIds = userThreadsData.map((t: ThreadData) => t.threadId);
      
      // Get all messages from user's threads that they didn't send
      const { data: unreadMessages, error: countError } = await supabase
        .from('messages')
        .select('id, thread_id, created_at')
        .in('thread_id', threadIds)
        .neq('sender_id', userId);

      if (countError) {
        console.error('Error counting unread messages:', countError);
        setUnreadCount(0);
        return;
      }

      // Filter messages by checking if they're newer than the user's last_read_at for that thread
      if (unreadMessages) {
        totalUnread = unreadMessages.filter((msg: MessageRecord) => {
          const threadData = userThreadsData.find((t: ThreadData) => t.threadId === msg.thread_id);
          return threadData && new Date(msg.created_at) > new Date(threadData.lastReadAt);
        }).length;
      }

      setUnreadCount(totalUnread);
    } catch (err) {
      console.error('Failed to load unread messages:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!userId) return;

    const supabase = supabaseRef.current;

    // Subscribe to new messages across all threads user participates in
    const channel = supabase
      .channel(`unread-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload: RealtimePostgresChangesPayload<MessagePayload>) => {
          const newMessage = payload.new as MessagePayload;
          // Check if this message is in a thread the user participates in
          // and the user is not the sender
          if (newMessage.sender_id !== userId) {
            const { data: participant } = await supabase
              .from('message_participants')
              .select('user_id')
              .eq('thread_id', newMessage.thread_id)
              .eq('user_id', userId)
              .maybeSingle();

            if (participant) {
              // User is a participant, refresh unread count
              loadUnreadCount();
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_participants',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // User's participant record was updated (likely last_read_at)
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadUnreadCount]);

  return {
    unreadCount,
    loading,
    error,
    refetch: loadUnreadCount,
  };
}
