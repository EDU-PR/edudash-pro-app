import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { sendMessagePushNotification } from '@/lib/messaging/pushNotifications';

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
      replyToId,
    }: {
      threadId: string;
      content: string;
      voiceUrl?: string;
      voiceDuration?: number;
      replyToId?: string;
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
          reply_to_id: replyToId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', threadId] });
      queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });

      const client = assertSupabase();
      const { data: participants } = await client
        .from('message_participants')
        .select('user_id')
        .eq('thread_id', threadId);

      const recipientIds = participants?.map((participant: any) => participant.user_id) || [];

      const { data: senderProfile } = await client
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user?.id)
        .single();

      const senderName = senderProfile
        ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim() || 'Someone'
        : 'Someone';

      await sendMessagePushNotification({
        threadId,
        messageId: data.id,
        senderId: user?.id || '',
        senderName,
        messageContent: data.content,
        recipientIds,
      });
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
      const { data, error } = await client.rpc('get_or_create_parent_teacher_thread', {
        p_student_id: studentId,
        p_parent_id: user.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
    },
  });
};
