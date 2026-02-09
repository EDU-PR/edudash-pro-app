/**
 * useTeacherMarkThreadRead — Mutation to mark a thread as read
 * Uses RPC with fallback to direct update
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export const useTeacherMarkThreadRead = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (threadId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const client = assertSupabase();
      
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
      queryClient.invalidateQueries({ queryKey: ['teacher', 'unread-count'] });
    },
  });
};
