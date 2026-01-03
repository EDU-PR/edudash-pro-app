/**
 * useDeletePOPUpload Hook
 * Handles POP upload deletion
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { POP_QUERY_KEYS } from './queryKeys';

export const useDeletePOPUpload = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (uploadId: string): Promise<void> => {
      const { error } = await supabase
        .from('pop_uploads')
        .delete()
        .eq('id', uploadId);
        
      if (error) {
        throw new Error(`Failed to delete upload: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POP_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['parent_dashboard_data'] });
    },
  });
};
