import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { track } from '@/lib/analytics';
import type { Message, MessageThread } from '@/lib/messaging/types';

const aggregateReactions = (
  reactions: Array<{ message_id: string; emoji: string; user_id: string }> | null,
  currentUserId?: string
) => {
  const map = new Map<string, Map<string, { count: number; users: string[] }>>();

  (reactions || []).forEach((reaction) => {
    if (!map.has(reaction.message_id)) map.set(reaction.message_id, new Map());
    const messageReactions = map.get(reaction.message_id)!;
    if (!messageReactions.has(reaction.emoji)) messageReactions.set(reaction.emoji, { count: 0, users: [] });
    const emojiData = messageReactions.get(reaction.emoji)!;
    emojiData.count += 1;
    emojiData.users.push(reaction.user_id);
  });

  return (messageId: string) => {
    const messageReactions = map.get(messageId);
    if (!messageReactions) return [];

    return Array.from(messageReactions.entries()).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      hasReacted: data.users.includes(currentUserId || ''),
    }));
  };
};

/**
 * Hook to get messages for a specific thread
 */
export const useThreadMessages = (threadId: string | null) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!threadId || !user?.id) return;

    const markAsDelivered = async () => {
      try {
        const client = assertSupabase();
        const result = await client.rpc('mark_messages_delivered', {
          p_thread_id: threadId,
          p_user_id: user.id,
        });

        if (result.error) {
          logger.warn('useThreadMessages', 'RPC mark_messages_delivered failed:', result.error.message);
          track('edudash.messaging.receipt_rpc_failed', {
            rpc: 'mark_messages_delivered',
            scope: 'parent',
            code: result.error.code,
            message: result.error.message,
          });
        } else if (result.data && result.data > 0) {
          logger.debug('useThreadMessages', `✅ Marked ${result.data} messages as delivered via RPC`);
        }
      } catch (err) {
        logger.warn('useThreadMessages', 'Failed to mark messages as delivered:', err);
      }
    };

    void markAsDelivered();
  }, [threadId, user?.id]);

  return useQuery({
    queryKey: ['messages', threadId],
    queryFn: async (): Promise<Message[]> => {
      if (!threadId) return [];

      const client = assertSupabase();
      const { data, error } = await client
        .from('messages')
        .select(`
          *,
          sender:profiles(first_name, last_name, role),
          reply_to:messages!reply_to_id(id, content, content_type, sender_id, sender:profiles(first_name, last_name))
        `)
        .eq('thread_id', threadId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messages = (data || []) as Message[];
      const messageIds = messages.map((message) => message.id);
      if (messageIds.length === 0) return messages;

      const { data: reactions } = await client
        .from('message_reactions')
        .select('message_id, emoji, user_id')
        .in('message_id', messageIds);

      const getReactions = aggregateReactions(reactions, user?.id);
      return messages.map((message) => ({
        ...message,
        reactions: getReactions(message.id),
      }));
    },
    enabled: !!threadId && !!user?.id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook to mark thread as read
 */
export const useMarkThreadRead = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ threadId }: { threadId: string }) => {
      if (!user?.id) {
        logger.warn('useMarkThreadRead', 'No user ID');
        return;
      }

      const client = assertSupabase();
      logger.debug('useMarkThreadRead', 'Marking thread as read:', { threadId, userId: user.id });

      const { error } = await client.rpc('mark_thread_messages_as_read', {
        thread_id: threadId,
        reader_id: user.id,
      });

      if (error) {
        logger.error('useMarkThreadRead', 'RPC error:', error);
        throw error;
      }

      logger.debug('useMarkThreadRead', 'Success');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
      queryClient.invalidateQueries({ queryKey: ['parent', 'unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'messages'] });
      logger.debug('useMarkThreadRead', 'Queries invalidated');
    },
    onError: (err) => {
      logger.error('useMarkThreadRead', 'Failed:', err);
    },
  });
};

/**
 * Hook to mark all incoming messages as delivered from conversation list
 */
export const useMarkAllDelivered = (threads: MessageThread[] | undefined) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !threads || threads.length === 0) return;

    const markDelivered = async () => {
      try {
        const client = assertSupabase();
        const threadIds = threads.map((thread) => thread.id);
        let updatedTotal = 0;
        for (const threadId of threadIds) {
          const res = await client.rpc('mark_messages_delivered', {
            p_thread_id: threadId,
            p_user_id: user.id,
          });
          if (res.error) {
            logger.warn('useMarkAllDelivered', 'RPC mark_messages_delivered failed:', res.error.message);
            track('edudash.messaging.receipt_rpc_failed', {
              rpc: 'mark_messages_delivered',
              scope: 'parent',
              code: res.error.code,
              message: res.error.message,
            });
            continue;
          }
          updatedTotal += Number(res.data || 0);
        }

        if (updatedTotal > 0) {
          logger.debug(
            'useMarkAllDelivered',
            `✅ Marked ${updatedTotal} messages as delivered across ${threadIds.length} threads via RPC`
          );
        }
      } catch (err) {
        logger.warn('useMarkAllDelivered', 'Failed to mark messages as delivered:', err);
      }
    };

    void markDelivered();
  }, [user?.id, threads?.length]);
};
