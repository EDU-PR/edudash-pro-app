/**
 * useTeacherMessagesRealtime — Real-time message updates within a thread
 *
 * Subscribes to:
 *  - INSERT on messages (new messages, banner notifications, haptics)
 *  - UPDATE on messages (delivery/read status changes)
 *  - * on message_reactions (reactions filtered by thread_id)
 *
 * Also handles app-foreground refetch when returning from background.
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from '@/lib/messaging/types';

export const useTeacherMessagesRealtime = (threadId: string | null) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const pathname = usePathname();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const hapticsEnabledRef = useRef(true);

  // Load notification preferences
  useEffect(() => {
    let mounted = true;
    const loadPrefs = async () => {
      try {
        const hapticsPref = await AsyncStorage.getItem('pref_haptics_enabled');
        if (!mounted) return;
        hapticsEnabledRef.current = hapticsPref !== 'false';
      } catch {
        // Keep defaults if storage unavailable
      }
    };
    loadPrefs();
    return () => { mounted = false; };
  }, []);

  // Handle app state changes — refetch messages when returning to foreground
  useEffect(() => {
    if (!threadId) return;
    
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        logger.debug('MessagesRealtime', 'App came to foreground, refetching messages');
        queryClient.invalidateQueries({ queryKey: ['teacher', 'messages', threadId] });
        queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [threadId, queryClient]);

  // Supabase Realtime channels
  useEffect(() => {
    if (!threadId || !user?.id) return;

    const channel = supabase
      .channel(`messages:thread:${threadId}`)
      // ── New messages ──────────────────────────────────────
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        async (payload: any) => {
          logger.debug('MessagesRealtime', 'New message received:', payload.new.id);
          
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, role')
            .eq('id', payload.new.sender_id)
            .single();
          
          const newMessage: any = { ...payload.new, sender: senderProfile };

          // Fetch reply_to content if message is a reply
          if (payload.new.reply_to_id) {
            const { data: replyMsg } = await supabase
              .from('messages')
              .select('id, content, content_type, sender_id')
              .eq('id', payload.new.reply_to_id)
              .single();
            if (replyMsg) {
              const { data: replySender } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('id', replyMsg.sender_id)
                .single();
              newMessage.reply_to = { ...replyMsg, sender: replySender || null };
            }
          }
          
          // Foreground path: avoid local banner duplication.
          // Remote push banners are already handled by the global notification handler.
          if (payload.new.sender_id !== user?.id) {
            try {
              if (AppState.currentState === 'active') {
                const isViewingThread = pathname?.includes(`threadId=${threadId}`) || 
                                       pathname?.includes(`thread=${threadId}`);
                
                if (!isViewingThread) {
                  if (hapticsEnabledRef.current) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  }
                }
              }
            } catch (notifError) {
              logger.warn('MessagesRealtime', 'Failed to trigger foreground haptics:', notifError);
            }

            // Mark as delivered while active
            if (AppState.currentState === 'active') {
              try {
                await supabase.rpc('mark_messages_delivered', {
                  p_thread_id: threadId,
                  p_user_id: user?.id,
                });
              } catch (deliverError) {
                logger.warn('MessagesRealtime', 'Failed to mark messages as delivered:', deliverError);
              }
            }
          }
          
          // Incremental cache update (no full refetch)
          queryClient.setQueryData(
            ['teacher', 'messages', threadId],
            (old: Message[] | undefined) => {
              if (!old) return [newMessage];
              if (old.some(m => m.id === newMessage.id)) return old;
              return [...old, newMessage];
            }
          );
          queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
        }
      )
      // ── Delivery / read status updates ────────────────────
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        (payload: any) => {
          queryClient.setQueryData(
            ['teacher', 'messages', threadId],
            (old: any[] | undefined) => {
              if (!old) return old;
              return old.map(msg =>
                msg.id === payload.new.id 
                  ? { ...msg, delivered_at: payload.new.delivered_at, read_by: payload.new.read_by }
                  : msg
              );
            }
          );
        }
      )
      // ── Reactions (filtered by thread_id) ─────────────────
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions', filter: `thread_id=eq.${threadId}` },
        async (payload: any) => {
          const messageId = payload.new?.message_id || payload.old?.message_id;
          if (!messageId) return;
          
          const { data: reactions } = await supabase
            .from('message_reactions')
            .select('emoji, user_id')
            .eq('message_id', messageId);
          
          const reactionMap = new Map<string, { count: number; users: string[] }>();
          (reactions || []).forEach((r: { emoji: string; user_id: string }) => {
            if (!reactionMap.has(r.emoji)) {
              reactionMap.set(r.emoji, { count: 0, users: [] });
            }
            const emojiData = reactionMap.get(r.emoji)!;
            emojiData.count++;
            emojiData.users.push(r.user_id);
          });
          
          const reactionsArray = Array.from(reactionMap.entries()).map(([emoji, data]) => ({
            emoji,
            count: data.count,
            hasReacted: data.users.includes(user?.id || ''),
            reactedByUserIds: data.users,
          }));
          
          queryClient.setQueryData(
            ['teacher', 'messages', threadId],
            (old: any[] | undefined) => {
              if (!old) return old;
              return old.map(msg => msg.id === messageId ? { ...msg, reactions: reactionsArray } : msg);
            }
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [threadId, user?.id, queryClient, pathname]);
};
