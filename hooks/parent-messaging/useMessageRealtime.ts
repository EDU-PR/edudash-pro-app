import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
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
  const soundEnabledRef = useRef(true);

  useEffect(() => {
    let mounted = true;

    const loadPrefs = async () => {
      try {
        const [hapticsPref, soundPref] = await Promise.all([
          AsyncStorage.getItem('pref_haptics_enabled'),
          AsyncStorage.getItem('pref_sound_enabled'),
        ]);
        if (!mounted) return;
        hapticsEnabledRef.current = hapticsPref !== 'false';
        soundEnabledRef.current = soundPref !== 'false';
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
              const senderName = senderProfile
                ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim() || 'Someone'
                : 'Someone';
              const messagePreview = payload.new.content?.length > 50
                ? `${payload.new.content.substring(0, 47)}...`
                : payload.new.content || 'New message';

              await Notifications.scheduleNotificationAsync({
                identifier: `message-${payload.new.id}`,
                content: {
                  title: `💬 ${senderName}`,
                  body: messagePreview,
                  data: {
                    type: 'message',
                    thread_id: threadId,
                    message_id: payload.new.id,
                    sender_id: payload.new.sender_id,
                    sender_name: senderName,
                  },
                  sound: soundEnabledRef.current ? 'default' : undefined,
                },
                trigger: null,
              });

              if (hapticsEnabledRef.current) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }
            } catch (notifError) {
              logger.warn('ParentMessagesRealtime', 'Failed to show banner notification:', notifError);
            }
          }

          if (!isOwnMessage && isForeground) {
            try {
              await client.rpc('mark_messages_delivered', { p_thread_id: threadId, p_user_id: user.id });
            } catch (deliverError) {
              logger.warn('ParentMessagesRealtime', 'Failed to mark messages as delivered:', deliverError);
            }
          }

          // Fetch reply_to content if message is a reply
          let replyTo = null;
          if (payload.new.reply_to_id) {
            const { data: replyMsg } = await client
              .from('messages')
              .select('id, content, content_type, sender_id, sender:profiles(first_name, last_name)')
              .eq('id', payload.new.reply_to_id)
              .single();
            if (replyMsg) replyTo = replyMsg;
          }

          const newMessage = { ...payload.new, sender: senderProfile || null, reactions: [], reply_to: replyTo } as Message;
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
