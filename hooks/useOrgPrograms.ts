import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface Program {
  id: string;
  title: string;
  description: string | null;
  course_code: string | null;
  is_active: boolean;
  max_students: number | null;
  start_date: string | null;
  end_date: string | null;
  instructor: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  enrollment_count: number;
}

export function useOrgPrograms() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id || (profile as any)?.preschool_id;

  return useQuery({
    queryKey: ['org-programs', orgId],
    queryFn: async (): Promise<Program[]> => {
      if (!orgId) return [];

      const supabase = assertSupabase();

      // Fetch programs with instructor info and enrollment counts
      const { data: programs, error } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          description,
          course_code,
          is_active,
          max_students,
          start_date,
          end_date,
          instructor:profiles!instructor_id(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch programs:', error);
        return [];
      }

      // Get enrollment counts for each program
      const programsWithEnrollments = await Promise.all(
        (programs || []).map(async (program) => {
          const { count } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', program.id)
            .eq('is_active', true);

          return {
            ...program,
            enrollment_count: count || 0,
          } as unknown as Program;
        })
      );

      return programsWithEnrollments;
    },
    enabled: !!orgId,
    staleTime: 30000,
  });
}

