/**
 * useLessonApproval Hook
 * 
 * Manages lesson approval workflow
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';

export interface LessonApproval {
  id: string;
  lesson_id: string;
  preschool_id: string;
  submitted_by: string | null;
  reviewed_by: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  rejection_reason: string | null;
  review_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  lesson?: {
    id: string;
    title: string;
    description: string | null;
    subject: string;
  };
}

export function useLessonApproval(preschoolId: string | undefined, filter?: 'all' | 'pending' | 'approved' | 'rejected') {
  const queryClient = useQueryClient();

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['lesson-approvals', preschoolId, filter],
    queryFn: async (): Promise<LessonApproval[]> => {
      if (!preschoolId) return [];

      const supabase = assertSupabase();
      let query = supabase
        .from('lesson_approvals')
        .select(`
          *,
          lesson:lessons(id, title, description, subject)
        `)
        .eq('preschool_id', preschoolId)
        .order('submitted_at', { ascending: false });

      if (filter && filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LessonApproval[];
    },
    enabled: !!preschoolId,
    staleTime: 30000,
  });

  const approveLesson = useMutation({
    mutationFn: async ({ approvalId, userId }: { approvalId: string; userId: string }) => {
      const supabase = assertSupabase();
      
      // Update approval
      const { data: approval, error: approvalError } = await supabase
        .from('lesson_approvals')
        .update({
          status: 'approved',
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', approvalId)
        .select('lesson_id')
        .single();

      if (approvalError) throw approvalError;

      // Update lesson status
      if (approval?.lesson_id) {
        const { error: lessonError } = await supabase
          .from('lessons')
          .update({ status: 'active' })
          .eq('id', approval.lesson_id);

        if (lessonError) throw lessonError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-approvals'] });
    },
  });

  const rejectLesson = useMutation({
    mutationFn: async ({ approvalId, userId, reason }: { approvalId: string; userId: string; reason: string }) => {
      const supabase = assertSupabase();
      const { error } = await supabase
        .from('lesson_approvals')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', approvalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-approvals'] });
    },
  });

  return {
    approvals,
    isLoading,
    approveLesson: approveLesson.mutate,
    rejectLesson: rejectLesson.mutate,
    isApproving: approveLesson.isPending,
    isRejecting: rejectLesson.isPending,
  };
}
