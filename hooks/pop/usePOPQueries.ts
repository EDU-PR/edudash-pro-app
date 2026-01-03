/**
 * POP Query Hooks
 * Fetches POP uploads for students and current user
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { POP_QUERY_KEYS } from './queryKeys';
import type { POPUpload, POPUploadFilters } from './types';

/**
 * Fetch POP uploads for a specific student
 */
export const useStudentPOPUploads = (studentId: string, limit = 10) => {
  return useQuery({
    queryKey: POP_QUERY_KEYS.list({ student_id: studentId, limit }),
    queryFn: async (): Promise<POPUpload[]> => {
      const { data, error } = await supabase.rpc('get_student_pop_uploads', {
        target_student_id: studentId,
        limit_count: limit,
      });
      
      if (error) {
        console.error('Failed to fetch student POP uploads:', error);
        throw new Error(`Failed to load uploads: ${error.message}`);
      }
      
      return data || [];
    },
    enabled: !!studentId,
  });
};

/**
 * Fetch all POP uploads for current user (parent view)
 */
export const useMyPOPUploads = (filters: POPUploadFilters = {}) => {
  return useQuery({
    queryKey: POP_QUERY_KEYS.list(filters),
    queryFn: async (): Promise<POPUpload[]> => {
      let query = supabase
        .from('pop_uploads')
        .select(`
          *,
          student:students (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });
      
      if (filters.upload_type) {
        query = query.eq('upload_type', filters.upload_type);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.student_id) {
        query = query.eq('student_id', filters.student_id);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Failed to fetch POP uploads:', error);
        throw new Error(`Failed to load uploads: ${error.message}`);
      }
      
      return (data || []).map(upload => ({
        ...upload,
        reviewer_name: undefined,
      }));
    },
  });
};

/**
 * Get signed URL for file viewing
 */
export { usePOPFileUrl } from './usePOPFileUrl';
