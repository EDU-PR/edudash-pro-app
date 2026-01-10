/**
 * useAssignedLessons Hook
 * 
 * Fetches lessons assigned to a student
 */

import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';

export interface AssignedLesson {
  id: string;
  lesson_id: string | null;
  interactive_activity_id: string | null;
  student_id: string;
  due_date: string | null;
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  lesson_type: 'standard' | 'interactive' | 'ai_enhanced' | 'robotics' | 'computer_literacy';
  stem_category: 'ai' | 'robotics' | 'computer_literacy' | 'none';
  lesson?: {
    id: string;
    title: string;
    description: string | null;
    duration_minutes: number;
  };
  interactive_activity?: {
    id: string;
    title: string;
    description: string | null;
    activity_type: string;
  };
}

export function useAssignedLessons(studentId: string | undefined) {
  return useQuery({
    queryKey: ['assigned-lessons', studentId],
    queryFn: async (): Promise<AssignedLesson[]> => {
      if (!studentId) return [];
      
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('lesson_assignments')
        .select(`
          id,
          lesson_id,
          interactive_activity_id,
          student_id,
          due_date,
          status,
          priority,
          lesson_type,
          stem_category,
          lesson:lessons(id, title, description, duration_minutes),
          interactive_activity:interactive_activities(id, title, description, activity_type)
        `)
        .eq('student_id', studentId)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('assigned_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as AssignedLesson[];
    },
    enabled: !!studentId,
    staleTime: 30000,
  });
}
