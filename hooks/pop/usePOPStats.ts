/**
 * usePOPStats Hook
 * Fetches POP upload statistics for dashboard
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { POP_QUERY_KEYS } from './queryKeys';
import type { POPStats } from './types';

export const usePOPStats = (studentId?: string) => {
  return useQuery({
    queryKey: studentId ? POP_QUERY_KEYS.studentStats(studentId) : POP_QUERY_KEYS.stats(),
    queryFn: async (): Promise<POPStats> => {
      const { data, error } = await supabase.rpc('get_pop_upload_stats', {
        target_student_id: studentId || null,
        target_preschool_id: null,
      });
      
      if (error) {
        console.error('Failed to fetch POP stats:', error);
        throw new Error(`Failed to load upload statistics: ${error.message}`);
      }
      
      return data || {
        proof_of_payment: { pending: 0, approved: 0, rejected: 0, recent: 0 },
        picture_of_progress: { pending: 0, approved: 0, rejected: 0, recent: 0 },
        total_pending: 0,
        total_recent: 0,
      };
    },
    refetchInterval: 30000,
  });
};
