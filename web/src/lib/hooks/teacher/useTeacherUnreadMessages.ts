'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UseTeacherUnreadMessagesReturn {
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get and track unread message count for a teacher user.
 * Subscribes to real-time updates to show new message indicators immediately.
 */
export function useTeacherUnreadMessages(
  userId: string | undefined,
  preschoolId: string | undefined
): UseTeacherUnreadMessagesReturn {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());

  const loadUnreadCount = useCallback(async () => {
    if (!userId || !preschoolId) {
      setLoading(false);
      setUnreadCount(0);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = supabaseRef.current;

      // Get all threads the teacher is a participant in within their preschool
      const { data: threads, error: threadsError } = await supabase
        .from('message_threads')
        .select(`
          id,
          message_participants!inner(user_id, role, last_read_at)
        `)
        .eq('preschool_id', preschoolId);

      if (threadsError) {
        console.error('Error fetching teacher threads:', threadsError);
        setUnreadCount(0);
        return;
      }

      if (!threads || threads.length === 0) {
        setUnreadCount(0);
        return;
      }

      // Filter to threads where user is a participant with role 'teacher'
      const teacherThreads = threads.filter((thread: any) =>
        thread.message_participants?.some(
          (p: any) => p.user_id === userId && p.role === 'teacher'
        )
      );

      if (teacherThreads.length === 0) {
        setUnreadCount(0);
        return;
      }

      // Count unread messages across all threads
      let totalUnread = 0;

      for (const thread of teacherThreads) {
        const teacherParticipant = thread.message_participants?.find(
          (p: any) => p.user_id === userId && p.role === 'teacher'
        );

        if (teacherParticipant) {
          const { count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('thread_id', thread.id)
            .neq('sender_id', userId)
            .gt('created_at', teacherParticipant.last_read_at || '2000-01-01');

          totalUnread += count || 0;
        }
      }

      setUnreadCount(totalUnread);
    } catch (err) {
      console.error('Failed to load teacher unread messages:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId, preschoolId]);

  // Initial load
  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!userId || !preschoolId) return;

    const supabase = supabaseRef.current;

    // Subscribe to new messages across all threads user participates in
    const channel = supabase
      .channel(`teacher-unread-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload: any) => {
          // Check if this message is in a thread the teacher participates in
          // and the teacher is not the sender
          if (payload.new.sender_id !== userId) {
            const { data: participant } = await supabase
              .from('message_participants')
              .select('user_id, role')
              .eq('thread_id', payload.new.thread_id)
              .eq('user_id', userId)
              .eq('role', 'teacher')
              .maybeSingle();

            if (participant) {
              // Teacher is a participant, refresh unread count
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
          // Teacher's participant record was updated (likely last_read_at)
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, preschoolId, loadUnreadCount]);

  return {
    unreadCount,
    loading,
    error,
    refetch: loadUnreadCount,
  };
}
