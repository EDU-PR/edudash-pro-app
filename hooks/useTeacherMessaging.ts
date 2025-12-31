import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { usePathname } from 'expo-router';
import { assertSupabase, supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

// Types (shared with parent messaging)
export interface MessageThread {
  id: string;
  preschool_id: string;
  type: 'parent-teacher' | 'parent-principal' | 'general';
  student_id: string | null;
  subject: string;
  created_by: string;
  last_message_at: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  student?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  participants?: MessageParticipant[];
  last_message?: {
    content: string;
    sender_id: string;
    created_at: string;
  };
  unread_count?: number;
}

export interface MessageParticipant {
  id: string;
  thread_id: string;
  user_id: string;
  role: 'parent' | 'teacher' | 'principal' | 'admin';
  joined_at: string;
  is_muted: boolean;
  last_read_at: string;
  // Joined data
  user_profile?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  content_type: 'text' | 'system' | 'voice' | 'image';
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  delivered_at?: string | null;
  read_by?: string[];
  voice_url?: string | null;
  voice_duration?: number | null;
  // Joined data
  sender?: {
    first_name: string;
    last_name: string;
    role: string;
  };
}

/**
 * Hook to get teacher's message threads
 * Fetches all threads where the teacher is a participant
 */
export const useTeacherThreads = () => {
  const { user, profile } = useAuth();
  const organizationId = (profile as any)?.organization_id || (profile as any)?.preschool_id;
  
  return useQuery({
    queryKey: ['teacher', 'threads', user?.id, organizationId],
    queryFn: async (): Promise<MessageThread[]> => {
      if (!user?.id) throw new Error('User not authenticated');
      if (!organizationId) {
        logger.warn('useTeacherThreads', 'No organization ID, returning empty');
        return [];
      }
      
      const client = assertSupabase();
      
      try {
        // First, get threads where teacher is a participant
        const { data: threads, error: threadsError } = await client
          .from('message_threads')
          .select(`
            id,
            type,
            subject,
            student_id,
            preschool_id,
            last_message_at,
            created_at,
            student:students(id, first_name, last_name),
            message_participants!inner(
              user_id,
              role,
              last_read_at
            )
          `)
          .eq('preschool_id', organizationId)
          .order('last_message_at', { ascending: false });
        
        if (threadsError) {
          if (threadsError.code === '42P01' || threadsError.message?.includes('does not exist')) {
            logger.warn('useTeacherThreads', 'message_threads table not found');
            return [];
          }
          throw threadsError;
        }
        
        if (!threads || threads.length === 0) return [];
        
        // Filter to only threads where teacher is a participant
        const teacherThreads = threads.filter((thread: any) =>
          thread.message_participants?.some((p: any) => 
            p.user_id === user.id && p.role === 'teacher'
          )
        );
        
        // Get all unique user IDs from participants
        const allUserIds = new Set<string>();
        teacherThreads.forEach((thread: any) => {
          (thread.message_participants || []).forEach((p: any) => {
            if (p.user_id) allUserIds.add(p.user_id);
          });
        });
        
        // Fetch profiles for all participants
        const { data: profiles } = await client
          .from('profiles')
          .select('id, first_name, last_name, role')
          .in('id', Array.from(allUserIds));
        
        const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        
        // Enrich threads with profile data and fetch last message
        const enrichedThreads = await Promise.all(
          teacherThreads.map(async (thread: any) => {
            // Fetch last message
            const { data: lastMessage } = await client
              .from('messages')
              .select('content, created_at, sender_id')
              .eq('thread_id', thread.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            // Calculate unread count
            const teacherParticipant = thread.message_participants?.find(
              (p: any) => p.user_id === user.id && p.role === 'teacher'
            );
            
            let unreadCount = 0;
            if (teacherParticipant) {
              const lastReadAt = teacherParticipant.last_read_at || '2000-01-01';
              const { count } = await client
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('thread_id', thread.id)
                .neq('sender_id', user.id)
                .gt('created_at', lastReadAt);
              
              unreadCount = count || 0;
            }
            
            // Enrich participants with profiles
            const participants = (thread.message_participants || []).map((p: any) => ({
              ...p,
              user_profile: profilesMap.get(p.user_id) || null,
            }));
            
            return {
              ...thread,
              participants,
              last_message: lastMessage,
              unread_count: unreadCount,
            };
          })
        );
        
        // Deduplicate by contact (keep most recent thread per parent)
        const uniqueThreadMap = new Map<string, MessageThread>();
        enrichedThreads.forEach((thread) => {
          const otherParticipant = thread.participants?.find(
            (p: any) => p.user_id !== user.id
          );
          const key = otherParticipant?.user_id || thread.id;
          
          const existing = uniqueThreadMap.get(key);
          if (!existing || new Date(thread.last_message_at) > new Date(existing.last_message_at)) {
            uniqueThreadMap.set(key, thread);
          }
        });
        
        return Array.from(uniqueThreadMap.values()).sort(
          (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        );
        
      } catch (error) {
        logger.error('useTeacherThreads', 'Error:', error);
        throw error;
      }
    },
    enabled: !!user?.id && !!organizationId,
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook to get messages for a specific thread
 * Also marks messages as delivered when thread is opened (WhatsApp-style delivery tracking)
 */
export const useTeacherThreadMessages = (threadId: string | null) => {
  const { user } = useAuth();
  
  // Mark messages as delivered when thread is opened
  useEffect(() => {
    if (!threadId || !user?.id) return;
    
    const markAsDelivered = async () => {
      try {
        const client = assertSupabase();
        const result = await client.rpc('mark_messages_delivered', {
          p_thread_id: threadId,
          p_user_id: user.id,
        });
        if (result.data && result.data > 0) {
          logger.debug('useTeacherThreadMessages', `✅ Marked ${result.data} messages as delivered`);
        }
      } catch (err) {
        logger.warn('useTeacherThreadMessages', 'Failed to mark messages as delivered:', err);
      }
    };
    
    markAsDelivered();
  }, [threadId, user?.id]);
  
  return useQuery({
    queryKey: ['teacher', 'messages', threadId],
    queryFn: async (): Promise<Message[]> => {
      if (!threadId || !user?.id) return [];
      
      const client = assertSupabase();
      
      const { data, error } = await client
        .from('messages')
        .select(`
          id,
          thread_id,
          sender_id,
          content,
          content_type,
          created_at,
          delivered_at,
          read_by,
          deleted_at,
          voice_url,
          voice_duration
        `)
        .eq('thread_id', threadId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Fetch sender profiles
      const senderIds = [...new Set((data || []).map((m: any) => m.sender_id))];
      const { data: senderProfiles } = await client
        .from('profiles')
        .select('id, first_name, last_name, role')
        .in('id', senderIds);
      
      const profileMap = new Map((senderProfiles || []).map((p: any) => [p.id, p]));
      
      let messagesWithDetails = (data || []).map((msg: any) => ({
        ...msg,
        sender: profileMap.get(msg.sender_id) || null,
      }));
      
      // Fetch reactions for all messages
      const messageIds = messagesWithDetails.map((m: any) => m.id);
      if (messageIds.length > 0) {
        const { data: reactions } = await client
          .from('message_reactions')
          .select('message_id, emoji, user_id')
          .in('message_id', messageIds);
        
        // Group reactions by message and emoji
        const reactionMap = new Map<string, Map<string, { count: number; users: string[] }>>();
        (reactions || []).forEach((r: { message_id: string; emoji: string; user_id: string }) => {
          if (!reactionMap.has(r.message_id)) {
            reactionMap.set(r.message_id, new Map());
          }
          const msgReactions = reactionMap.get(r.message_id)!;
          if (!msgReactions.has(r.emoji)) {
            msgReactions.set(r.emoji, { count: 0, users: [] });
          }
          const emojiData = msgReactions.get(r.emoji)!;
          emojiData.count++;
          emojiData.users.push(r.user_id);
        });
        
        messagesWithDetails = messagesWithDetails.map((msg: any) => {
          const msgReactions = reactionMap.get(msg.id);
          if (!msgReactions) return { ...msg, reactions: [] };
          
          const reactionsArray = Array.from(msgReactions.entries()).map(([emoji, data]) => ({
            emoji,
            count: data.count,
            hasReacted: data.users.includes(user?.id || ''),
          }));
          
          return { ...msg, reactions: reactionsArray };
        });
      }
      
      return messagesWithDetails;
    },
    enabled: !!threadId && !!user?.id,
    staleTime: 10_000,
  });
};

/**
 * Hook to send a message in a thread
 */
export const useTeacherSendMessage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      threadId, 
      content,
      voiceUrl,
      voiceDuration,
    }: { 
      threadId: string; 
      content: string;
      voiceUrl?: string;
      voiceDuration?: number;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const client = assertSupabase();
      
      const isVoice = !!voiceUrl;
      
      const { data, error } = await client
        .from('messages')
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          content,
          content_type: isVoice ? 'voice' : 'text',
          voice_url: voiceUrl || null,
          voice_duration: voiceDuration || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update thread's last_message_at
      await client
        .from('message_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', threadId);
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'messages', variables.threadId] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
    },
  });
};

/**
 * Hook to mark thread as read
 */
export const useTeacherMarkThreadRead = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (threadId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const client = assertSupabase();
      
      // Try using the RPC function first
      const { error: rpcError } = await client.rpc('mark_thread_messages_as_read', {
        thread_id: threadId,
        reader_id: user.id,
      });
      
      if (rpcError) {
        // Fallback: update last_read_at directly
        await client
          .from('message_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('thread_id', threadId)
          .eq('user_id', user.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
      // Also invalidate unread count for badge updates
      queryClient.invalidateQueries({ queryKey: ['teacher', 'unread-count'] });
    },
  });
};

/**
 * Hook for real-time message updates in a thread
 * Subscribes to new messages and updates the query cache incrementally
 * Also handles app state changes to refetch messages when returning from background
 */
export const useTeacherMessagesRealtime = (threadId: string | null) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const pathname = usePathname();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Handle app state changes - refetch messages when returning to foreground
  useEffect(() => {
    if (!threadId) return;
    
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // Only refetch when transitioning FROM background/inactive TO active
      if (
        appStateRef.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        logger.debug('MessagesRealtime', 'App came to foreground, refetching messages');
        // Refetch messages to get any delivery/read status updates that happened while backgrounded
        queryClient.invalidateQueries({ queryKey: ['teacher', 'messages', threadId] });
        queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [threadId, queryClient]);

  useEffect(() => {
    if (!threadId || !user?.id) return;

    const channel = supabase
      .channel(`messages:thread:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload: any) => {
          logger.debug('MessagesRealtime', 'New message received:', payload.new.id);
          
          // Fetch sender profile for the new message
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, role')
            .eq('id', payload.new.sender_id)
            .single();
          
          const newMessage = {
            ...payload.new,
            sender: senderProfile,
          };
          
          // Show banner notification if message is from someone else and app is in foreground
          // Only show if user is not currently viewing this thread
          if (payload.new.sender_id !== user?.id) {
            try {
              // Check if app is in foreground
              const appState = AppState.currentState;
              if (appState === 'active') {
                // Check if user is viewing this thread (check pathname)
                const isViewingThread = pathname?.includes(`threadId=${threadId}`) || 
                                       pathname?.includes(`thread=${threadId}`);
                
                if (!isViewingThread) {
                  const senderName = senderProfile 
                    ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim() || 'Someone'
                    : 'Someone';
                  
                  const messagePreview = payload.new.content?.length > 50 
                    ? payload.new.content.substring(0, 47) + '...'
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
                      sound: 'default',
                    },
                    trigger: null, // Show immediately
                  });
                  logger.debug('MessagesRealtime', '✅ Banner notification shown for new message');
                }
              }
            } catch (notifError) {
              logger.warn('MessagesRealtime', 'Failed to show banner notification:', notifError);
            }
          }
          
          // Update query cache incrementally (no full refetch)
          queryClient.setQueryData(
            ['teacher', 'messages', threadId],
            (old: Message[] | undefined) => {
              if (!old) return [newMessage];
              // Avoid duplicates
              if (old.some(m => m.id === newMessage.id)) return old;
              return [...old, newMessage];
            }
          );
          
          // Also update threads list to reflect new last_message
          queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
        }
      )
      // Subscribe to message UPDATE events for delivery and read status changes
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload: any) => {
          logger.debug('MessagesRealtime', 'Message updated:', payload.new.id);
          
          // Update message in cache with new delivery/read status
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
      // Subscribe to message_reactions changes for real-time reaction updates
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        async (payload: any) => {
          logger.debug('MessagesRealtime', 'Reaction change:', payload.eventType, payload.new?.message_id);
          
          // Get the message_id from the reaction
          const messageId = payload.new?.message_id || payload.old?.message_id;
          if (!messageId) return;
          
          // Fetch updated reactions for this specific message
          const { data: reactions } = await supabase
            .from('message_reactions')
            .select('emoji, user_id')
            .eq('message_id', messageId);
          
          // Aggregate reactions by emoji
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
          }));
          
          // Update message in cache with new reactions
          queryClient.setQueryData(
            ['teacher', 'messages', threadId],
            (old: any[] | undefined) => {
              if (!old) return old;
              return old.map(msg => 
                msg.id === messageId 
                  ? { ...msg, reactions: reactionsArray }
                  : msg
              );
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, user?.id, queryClient, pathname]);
};

/**
 * Hook for real-time thread list updates
 * Subscribes to thread changes (new threads, last_message_at updates)
 */
export const useTeacherThreadsRealtime = (organizationId: string | null) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!organizationId || !user?.id) return;

    const channel = supabase
      .channel(`threads:org:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'message_threads',
          filter: `preschool_id=eq.${organizationId}`,
        },
        (payload) => {
          logger.debug('ThreadsRealtime', 'Thread changed:', payload.eventType);
          // Invalidate threads query to refetch
          queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, user?.id, queryClient]);
};
