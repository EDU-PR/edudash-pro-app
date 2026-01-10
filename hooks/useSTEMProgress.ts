/**
 * useSTEMProgress Hook
 * 
 * Fetches STEM progress data for a student
 */

import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';

export interface STEMProgress {
  id: string;
  student_id: string;
  preschool_id: string;
  category: 'ai' | 'robotics' | 'computer_literacy';
  lessons_completed: number;
  activities_completed: number;
  homework_submitted: number;
  last_activity_date: string | null;
  engagement_score: number;
  streak_days: number;
  badges_earned: string[];
}

export function useSTEMProgress(studentId: string | undefined) {
  return useQuery({
    queryKey: ['stem-progress', studentId],
    queryFn: async (): Promise<STEMProgress[]> => {
      if (!studentId) return [];
      
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('stem_progress')
        .select('*')
        .eq('student_id', studentId)
        .order('category');
      
      if (error) throw error;
      return (data || []) as STEMProgress[];
    },
    enabled: !!studentId,
    staleTime: 60000,
  });
}
