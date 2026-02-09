/**
 * useTeacherSendMessage — Mutation to send a message in a thread
 * Supports text and voice messages, sends push notifications to recipients
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { sendMessagePushNotification } from '@/lib/messaging/pushNotifications';

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
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'messages', variables.threadId] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
      
      const client = assertSupabase();
      const { data: participants } = await client
        .from('message_participants')
        .select('user_id')
        .eq('thread_id', variables.threadId);

      const recipientIds = participants?.map((p: any) => p.user_id) || [];

      const { data: senderProfile } = await client
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user?.id)
        .single();

      const senderName = senderProfile 
        ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim() || 'Teacher'
        : 'Teacher';

      await sendMessagePushNotification({
        threadId: variables.threadId,
        messageId: data.id,
        senderId: user?.id || '',
        senderName,
        messageContent: data.content,
        recipientIds,
      });
    },
  });
};
