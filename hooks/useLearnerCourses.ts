import { useQuery } from '@tanstack/react-query';

import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface LearnerCourse {
  id: string;
  title: string;
  description: string | null;
  course_code: string | null;
  organization_id: string;
  is_active: boolean;
  created_at?: string;
}

export function useLearnerCourses() {
  const { user, profile } = useAuth();
  const userId = profile?.id ?? user?.id ?? null;

  return useQuery({
    queryKey: ['learner-courses', userId],
    queryFn: async (): Promise<LearnerCourse[]> => {
      // Rely on RLS to restrict this to the courses the current user is allowed to see.
      // (Typically: courses the learner is enrolled in.)
      const { data, error } = await assertSupabase()
        .from('courses')
        .select('id, title, description, course_code, organization_id, is_active, created_at')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as LearnerCourse[];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}



