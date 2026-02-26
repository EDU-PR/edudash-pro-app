import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { useThreadPinning } from '@/hooks/messaging/useThreadPinning';
import type { MessageThread } from '@/lib/messaging/types';

/**
 * Hook to get parent's message threads
 */
export const useParentThreads = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['parent', 'threads', user?.id],
    queryFn: async (): Promise<MessageThread[]> => {
      if (!user?.id) {
        logger.warn('useParentThreads', 'User not authenticated');
        return [];
      }

      const client = assertSupabase();

      try {
        logger.debug('useParentThreads', `Fetching threads for user ${user.id}`);

        const { data: participations, error: participationsError } = await client
          .from('message_participants')
          .select('thread_id')
          .eq('user_id', user.id);

        if (participationsError) {
          logger.warn(
            'useParentThreads',
            `Error fetching participations: ${participationsError.message} (code: ${participationsError.code})`
          );
          return [];
        }

        if (!participations || participations.length === 0) {
          logger.debug('useParentThreads', 'No thread participations found for user');
          return [];
        }

        const threadIds = participations.map((participation) => participation.thread_id);
        logger.debug('useParentThreads', `Found ${threadIds.length} threads for user`);

        const { data: threads, error } = await client
          .from('message_threads')
          .select(`
            *,
            student:students(id, first_name, last_name),
            participants:message_participants(
              *,
              user_profile:profiles(first_name, last_name, role, avatar_url)
            )
          `)
          .in('id', threadIds)
          .order('last_message_at', { ascending: false });

        if (error) {
          logger.warn('useParentThreads', `Query error: ${error.message} (code: ${error.code})`);
          return [];
        }

        if (!threads || threads.length === 0) {
          return [];
        }

        // Aggregated per-thread summary (unread_count + last_message) in one RPC to avoid N+1.
        const { data: summaries, error: summaryError } = await client.rpc('get_my_message_threads_summary');
        if (summaryError) {
          logger.warn('useParentThreads', 'get_my_message_threads_summary failed:', summaryError.message);
          return threads as MessageThread[];
        }

        const summaryMap = new Map<string, any>();
        (summaries || []).forEach((row: any) => {
          if (row?.thread_id) summaryMap.set(row.thread_id, row);
        });

        const mapped = (threads || []).map((thread: any) => {
          const summary = summaryMap.get(thread.id);
          const lastMessage =
            summary?.last_message_id && summary?.last_message_content
              ? {
                  content: summary.last_message_content,
                  sender_id: summary.last_message_sender_id || undefined,
                  created_at: summary.last_message_created_at,
                }
              : undefined;

          const participant = (thread.participants || []).find(
            (p: { user_id: string }) => p.user_id === user!.id,
          );

          return {
            ...thread,
            last_message: lastMessage,
            unread_count: typeof summary?.unread_count === 'number' ? summary.unread_count : 0,
            is_pinned: !!participant?.is_pinned,
            pinned_at: participant?.pinned_at ?? null,
          };
        });

        return mapped.sort((a: MessageThread & { is_pinned: boolean }, b: MessageThread & { is_pinned: boolean }) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return 0;
        });
      } catch (err: any) {
        logger.error('useParentThreads', `Error fetching threads: ${err?.message || err}`, {
          userId: user?.id,
          errorCode: err?.code,
        });
        throw err;
      }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
};

/**
 * Hook to get total unread message count for parent dashboard
 */
export const useUnreadMessageCount = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['parent', 'unread-count', user?.id],
    queryFn: async (): Promise<number> => {
      if (!user?.id) return 0;

      const client = assertSupabase();
      const { data: summaries, error } = await client.rpc('get_my_message_threads_summary');
      if (error) {
        logger.warn('useUnreadMessageCount', 'get_my_message_threads_summary failed:', error.message);
        return 0;
      }
      return (summaries || []).reduce((sum: number, row: any) => sum + (row?.unread_count || 0), 0);
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });
};
