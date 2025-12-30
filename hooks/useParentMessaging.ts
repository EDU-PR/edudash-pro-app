import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { usePathname } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

// Types
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
    sender_name: string;
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
 * Hook to get parent's message threads
 */
export const useParentThreads = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['parent', 'threads', user?.id],
    queryFn: async (): Promise<MessageThread[]> => {
      if (!user?.id) {
        logger.warn('useParentThreads', 'User not authenticated');
        throw new Error('User not authenticated');
      }
      
      const client = assertSupabase();
      
      try {
        logger.debug('useParentThreads', `Fetching threads for user ${user.id}`);
        
        // Step 1: Get threads the user participates in via message_participants
        // This is more reliable than relying on RLS to filter message_threads directly
        const { data: participations, error: participationsError } = await client
          .from('message_participants')
          .select('thread_id')
          .eq('user_id', user.id);
        
        if (participationsError) {
          // Check for table not found
          if (participationsError.code === '42P01') {
            logger.warn('useParentThreads', 'message_participants table not found');
            return [];
          }
          logger.error('useParentThreads', `Error fetching participations: ${participationsError.message}`);
          throw participationsError;
        }
        
        // If user has no thread participations, return empty
        if (!participations || participations.length === 0) {
          logger.debug('useParentThreads', 'No thread participations found for user');
          return [];
        }
        
        const threadIds = participations.map(p => p.thread_id);
        logger.debug('useParentThreads', `Found ${threadIds.length} threads for user`);
        
        // Step 2: Get thread details for those threads
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
          // Check if table doesn't exist - return empty array instead of throwing
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            logger.warn('useParentThreads', 'message_threads table not found, returning empty');
            return [];
          }
          // Check for permission/RLS errors
          if (error.code === '42501' || error.message?.includes('permission denied')) {
            logger.warn('useParentThreads', `Permission denied for user ${user.id}: ${error.message}`);
            return []; // Return empty instead of crashing
          }
          logger.error('useParentThreads', `Query error: ${error.message}`, { code: error.code });
          throw error;
        }
        
        // If no threads, return empty array early
        if (!threads || threads.length === 0) {
          return [];
        }
        
        // Get last message and unread count for each thread
        const threadsWithDetails = await Promise.all(
          threads.map(async (thread) => {
            // Get last message - use maybeSingle() to handle empty results gracefully
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
            
            // Get unread count (messages after user's last_read_at)
            const userParticipant = thread.participants?.find((p: any) => p.user_id === user.id);
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
            
            return {
              ...thread,
              last_message: lastMessage ? {
                content: lastMessage.content,
                sender_name: (() => {
                  const s: any = lastMessage?.sender;
                  const sender = Array.isArray(s) ? s[0] : s;
                  return sender ? `${sender.first_name} ${sender.last_name}`.trim() : 'Unknown';
                })(),
                created_at: lastMessage.created_at
              } : undefined,
              unread_count: unreadCount
            };
          })
        );
        
        return threadsWithDetails;
      } catch (err: any) {
        // Log error for debugging but don't crash the app
        logger.error('useParentThreads', `Error fetching threads: ${err?.message || err}`, {
          userId: user?.id,
          errorCode: err?.code,
        });
        throw err;
      }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2, // 2 minutes
    retry: 2, // Retry twice for network issues
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
  });
};

/**
 * Hook to get messages for a specific thread
 */
export const useThreadMessages = (threadId: string | null) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['messages', threadId],
    queryFn: async (): Promise<Message[]> => {
      if (!threadId) return [];
      
      const client = assertSupabase();
      const { data, error } = await client
        .from('messages')
        .select(`
          *,
          sender:profiles(first_name, last_name, role)
        `)
        .eq('thread_id', threadId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      let messagesWithReactions = data || [];
      
      // Fetch reactions for all messages
      const messageIds = messagesWithReactions.map((m) => m.id);
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
        
        messagesWithReactions = messagesWithReactions.map((msg) => {
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
      
      return messagesWithReactions;
    },
    enabled: !!threadId && !!user?.id,
    staleTime: 30 * 1000, // Consider data fresh for 30s
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 min (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch on window focus for messages
  });
};

/**
 * Hook for real-time message and reaction updates in a thread
 * Subscribes to new messages and reactions, updating the query cache incrementally
 */
export const useParentMessagesRealtime = (threadId: string | null) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!threadId || !user?.id) return;

    const channel = assertSupabase()
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
          logger.debug('ParentMessagesRealtime', 'New message received:', payload.new.id);
          
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
                  // Fetch sender name
                  const { data: senderProfile } = await assertSupabase()
                    .from('profiles')
                    .select('first_name, last_name')
                    .eq('id', payload.new.sender_id)
                    .single();
                  
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
                  logger.debug('ParentMessagesRealtime', '✅ Banner notification shown for new message');
                }
              }
            } catch (notifError) {
              logger.warn('ParentMessagesRealtime', 'Failed to show banner notification:', notifError);
            }
          }
          
          // Invalidate to refetch with new message
          queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
          queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
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
          logger.debug('ParentMessagesRealtime', 'Message updated:', payload.new.id);
          
          // Update message in cache with new delivery/read status
          queryClient.setQueryData(
            ['messages', threadId],
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
          logger.debug('ParentMessagesRealtime', 'Reaction change:', payload.eventType, payload.new?.message_id);
          
          // Get the message_id from the reaction
          const messageId = payload.new?.message_id || payload.old?.message_id;
          if (!messageId) return;
          
          // Fetch updated reactions for this specific message
          const { data: reactions } = await assertSupabase()
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
            ['messages', threadId],
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
      assertSupabase().removeChannel(channel);
    };
  }, [threadId, user?.id, queryClient, pathname]);
};

/**
 * Hook to send a message
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
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
      const client = assertSupabase();
      
      const isVoice = !!voiceUrl;
      
      const { data, error } = await client
        .from('messages')
        .insert({
          thread_id: threadId,
          sender_id: user?.id,
          content: content.trim(),
          content_type: isVoice ? 'voice' : 'text',
          voice_url: voiceUrl || null,
          voice_duration: voiceDuration || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { threadId }) => {
      // Invalidate thread messages
      queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
      // Invalidate parent threads to update last message and unread counts
      queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
    },
  });
};

/**
 * Hook to create or get a parent-teacher thread
 */
export const useCreateThread = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ studentId }: { studentId: string }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const client = assertSupabase();
      
      // Call the database function to get or create thread
      const { data, error } = await client.rpc(
        'get_or_create_parent_teacher_thread',
        {
          p_student_id: studentId,
          p_parent_id: user.id
        }
      );
      
      if (error) throw error;
      return data; // Returns thread_id
    },
    onSuccess: () => {
      // Invalidate parent threads to show the new/existing thread
      queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
    },
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
        console.warn('[useMarkThreadRead] No user ID');
        return;
      }
      
      const client = assertSupabase();
      
      console.log('[useMarkThreadRead] Marking thread as read:', { threadId, userId: user.id });
      
      // Use RPC function to mark thread as read (updates both messages and participants)
      const { error } = await client.rpc('mark_thread_messages_as_read', {
        thread_id: threadId,
        reader_id: user.id,
      });
      
      if (error) {
        console.error('[useMarkThreadRead] RPC error:', error);
        throw error;
      }
      
      console.log('[useMarkThreadRead] Success');
    },
    onSuccess: () => {
      // Invalidate parent threads to update unread counts
      queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
      // Invalidate the legacy unread count query
      queryClient.invalidateQueries({ queryKey: ['parent', 'unread-count'] });
      // Invalidate the unified notification context queries
      queryClient.invalidateQueries({ queryKey: ['notifications', 'messages'] });
      console.log('[useMarkThreadRead] Queries invalidated');
    },
    onError: (err) => {
      console.error('[useMarkThreadRead] Failed:', err);
    },
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
      
      // Get all thread IDs for this user
      const { data: participantData } = await client
        .from('message_participants')
        .select('thread_id, last_read_at')
        .eq('user_id', user.id);
      
      if (!participantData || participantData.length === 0) return 0;
      
      // Count unread messages across all threads
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
    staleTime: 1000 * 60, // 1 minute
  });
};