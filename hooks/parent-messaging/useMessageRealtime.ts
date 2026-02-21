import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppState, AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type { Message } from '@/lib/messaging/types';

const updateMessageCache = (
  oldMessages: Message[] | undefined,
  message: Message
): Message[] => {
  if (!oldMessages) return [message];
  if (oldMessages.some((existing) => existing.id === message.id)) return oldMessages;
  return [...oldMessages, message];
};

/**
 * Hook for real-time message and reaction updates in a thread
 */
export const useParentMessagesRealtime = (threadId: string | null) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const pathname = usePathname();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const hapticsEnabledRef = useRef(true);

  useEffect(() => {
    let mounted = true;

    const loadPrefs = async () => {
      try {
        const hapticsPref = await AsyncStorage.getItem('pref_haptics_enabled');
        if (!mounted) return;
        hapticsEnabledRef.current = hapticsPref !== 'false';
      } catch {
        // Keep defaults
      }
    };

    void loadPrefs();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!threadId) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        logger.debug('ParentMessagesRealtime', 'App came to foreground, refetching messages');
        queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
        queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [threadId, queryClient]);

  useEffect(() => {
    if (!threadId || !user?.id) return;

    const client = assertSupabase();
    const channel = client
      .channel(`messages:thread:${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        async (payload: any) => {
          logger.debug('ParentMessagesRealtime', 'New message received:', payload.new.id);

          const isOwnMessage = payload.new.sender_id === user.id;
          const isViewingThread = pathname?.includes(`threadId=${threadId}`) || pathname?.includes(`thread=${threadId}`);
          const isForeground = AppState.currentState === 'active';

          const { data: senderProfile } = await client
            .from('profiles')
            .select('first_name, last_name, role')
            .eq('id', payload.new.sender_id)
            .single();

          if (!isOwnMessage && isForeground && !isViewingThread) {
            try {
              if (hapticsEnabledRef.current) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }
            } catch (notifError) {
              logger.warn('ParentMessagesRealtime', 'Failed to trigger foreground haptics:', notifError);
            }
          }

          if (!isOwnMessage && isForeground) {
            try {
              await client.rpc('mark_messages_delivered', { p_thread_id: threadId, p_user_id: user.id });
            } catch (deliverError) {
              logger.warn('ParentMessagesRealtime', 'Failed to mark messages as delivered:', deliverError);
            }
          }

          // Fetch reply_to content if message is a reply (normalize reply_to shape for rendering)
          let replyTo: Message['reply_to'] = null;
          if (payload.new.reply_to_id) {
            const { data: replyMsg } = await client
              .from('messages')
              .select('id, thread_id, sender_id, content, content_type, created_at, edited_at, deleted_at')
              .eq('id', payload.new.reply_to_id)
              .single();

            if (replyMsg) {
              const { data: replySenderProfile } = await client
                .from('profiles')
                .select('first_name, last_name, role')
                .eq('id', replyMsg.sender_id)
                .single();

              replyTo = {
                id: replyMsg.id,
                thread_id: replyMsg.thread_id,
                content: replyMsg.content,
                content_type: (replyMsg.content_type || 'text') as Message['content_type'],
                sender_id: replyMsg.sender_id,
                created_at: replyMsg.created_at,
                edited_at: replyMsg.edited_at ?? null,
                deleted_at: replyMsg.deleted_at ?? null,
                sender: replySenderProfile
                  ? {
                      first_name: replySenderProfile.first_name,
                      last_name: replySenderProfile.last_name,
                      role: replySenderProfile.role,
                    }
                  : undefined,
              };
            }
          }

          const newMessage = {
            ...payload.new,
            sender: senderProfile || null,
            reactions: [],
            reply_to: replyTo,
          } as Message;
          queryClient.setQueryData(['messages', threadId], (old: Message[] | undefined) => updateMessageCache(old, newMessage));
          queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        async (payload: any) => {
          queryClient.setQueryData(['messages', threadId], (old: Message[] | undefined) => {
            if (!old) return old;
            return old.map((message) =>
              message.id === payload.new.id
                ? { ...message, delivered_at: payload.new.delivered_at, read_by: payload.new.read_by }
                : message
            );
          });
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, async (payload: any) => {
        const messageId = payload.new?.message_id || payload.old?.message_id;
        if (!messageId) return;

        const { data: reactions } = await client
          .from('message_reactions')
          .select('emoji, user_id')
          .eq('message_id', messageId);

        const grouped = new Map<string, { count: number; users: string[] }>();
        (reactions || []).forEach((reaction: { emoji: string; user_id: string }) => {
          if (!grouped.has(reaction.emoji)) grouped.set(reaction.emoji, { count: 0, users: [] });
          const item = grouped.get(reaction.emoji)!;
          item.count += 1;
          item.users.push(reaction.user_id);
        });

        const reactionsArray = Array.from(grouped.entries()).map(([emoji, data]) => ({
          emoji,
          count: data.count,
          hasReacted: data.users.includes(user.id),
          reactedByUserIds: data.users,
        }));

        queryClient.setQueryData(['messages', threadId], (old: Message[] | undefined) => {
          if (!old) return old;
          return old.map((message) => (message.id === messageId ? { ...message, reactions: reactionsArray } : message));
        });
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [threadId, user?.id, queryClient, pathname]);
};
