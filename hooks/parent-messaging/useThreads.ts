import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
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
              user_profile:profiles(first_name, last_name, role)
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

        const threadsWithDetails = await Promise.all(
          threads.map(async (thread: any) => {
            const { data: lastMessage } = await client
              .from('messages')
              .select(`
                content,
                created_at,
                sender:profiles(first_name, last_name)
              `)
              .eq('thread_id', thread.id)
              .is('deleted_at', null)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const userParticipant = thread.participants?.find((participant: any) => participant.user_id === user.id);
            let unreadCount = 0;

            if (userParticipant) {
              const { count } = await client
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('thread_id', thread.id)
                .gt('created_at', userParticipant.last_read_at)
                .neq('sender_id', user.id)
                .is('deleted_at', null);

              unreadCount = count || 0;
            }

            const senderData: any = lastMessage?.sender;
            const sender = Array.isArray(senderData) ? senderData[0] : senderData;

            return {
              ...thread,
              last_message: lastMessage
                ? {
                    content: lastMessage.content,
                    sender_name: sender ? `${sender.first_name} ${sender.last_name}`.trim() : 'Unknown',
                    created_at: lastMessage.created_at,
                  }
                : undefined,
              unread_count: unreadCount,
            };
          })
        );

        return threadsWithDetails;
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
      const { data: participantData } = await client
        .from('message_participants')
        .select('thread_id, last_read_at')
        .eq('user_id', user.id);

      if (!participantData || participantData.length === 0) return 0;

      let totalUnread = 0;
      for (const participant of participantData) {
        const { count } = await client
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('thread_id', participant.thread_id)
          .gt('created_at', participant.last_read_at)
          .neq('sender_id', user.id)
          .is('deleted_at', null);

        totalUnread += count || 0;
      }

      return totalUnread;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });
};
