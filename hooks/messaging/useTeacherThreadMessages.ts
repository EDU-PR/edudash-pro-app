/**
 * useTeacherThreadMessages — Fetches messages for a specific thread
 * Marks messages as delivered when thread is opened (WhatsApp-style delivery tracking)
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type { Message } from '@/lib/messaging/types';

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
        
        if (result.error) {
          logger.warn('useTeacherThreadMessages', 'RPC mark_messages_delivered failed:', result.error.message);
          
          const { error: directError, data: updatedCount } = await client
            .from('messages')
            .update({ delivered_at: new Date().toISOString() })
            .eq('thread_id', threadId)
            .neq('sender_id', user.id)
            .is('delivered_at', null)
            .select('id');
          
          if (directError) {
            logger.warn('useTeacherThreadMessages', 'Direct update also failed:', directError.message);
          } else {
            logger.debug('useTeacherThreadMessages', `✅ Marked ${updatedCount?.length || 0} messages as delivered via direct update`);
          }
        } else if (result.data && result.data > 0) {
          logger.debug('useTeacherThreadMessages', `✅ Marked ${result.data} messages as delivered via RPC`);
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
