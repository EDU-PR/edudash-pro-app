/**
 * useTeacherMarkThreadRead — Mutation to mark a thread as read
 * Uses RPC with fallback to direct update
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';

export const useTeacherMarkThreadRead = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    retry: false,
    mutationFn: async (threadId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const client = assertSupabase();
      
      const { error: rpcError } = await client.rpc('mark_thread_messages_as_read', {
        thread_id: threadId,
        reader_id: user.id,
      });
      
      if (rpcError) {
        track('edudash.messaging.receipt_rpc_failed', {
          rpc: 'mark_thread_messages_as_read',
          scope: 'teacher',
          code: rpcError.code,
          message: rpcError.message,
        });
        throw rpcError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'unread-count'] });
    },
  });
};
