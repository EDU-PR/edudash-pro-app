/**
 * useSchoolAnalytics Hook
 * 
 * Fetches comprehensive school analytics data
 */

import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';

export interface SchoolAnalytics {
  lessonCompletionRate: number;
  homeworkSubmissionRate: number;
  stemEngagement: {
    ai: { lessonsCompleted: number; activitiesCompleted: number; engagementScore: number };
    robotics: { lessonsCompleted: number; activitiesCompleted: number; engagementScore: number };
    computer_literacy: { lessonsCompleted: number; activitiesCompleted: number; engagementScore: number };
  };
  studentProgress: {
    totalStudents: number;
    activeStudents: number;
    averageScore: number;
  };
}

export function useSchoolAnalytics(preschoolId: string | undefined) {
  return useQuery({
    queryKey: ['school-analytics', preschoolId],
    queryFn: async (): Promise<SchoolAnalytics> => {
      if (!preschoolId) {
        throw new Error('Preschool ID is required');
      }

      const supabase = assertSupabase();

      // Load lesson completion data
      const { data: completions } = await supabase
        .from('lesson_completions')
        .select('id, lesson_id, student_id, score')
        .eq('preschool_id', preschoolId);

      // Load assignments
      const { data: assignments } = await supabase
        .from('lesson_assignments')
        .select('id, lesson_id, student_id, status')
        .eq('preschool_id', preschoolId);

      // Load homework submissions
      const { data: homeworkSubmissions } = await supabase
        .from('homework_submissions')
        .select('id, assignment_id, status')
        .eq('preschool_id', preschoolId);

      // Load homework assignments
      const { data: homeworkAssignments } = await supabase
        .from('homework_assignments')
        .select('id')
        .eq('preschool_id', preschoolId);

      // Load STEM progress
      const { data: stemProgress } = await supabase
        .from('stem_progress')
        .select('*')
        .eq('preschool_id', preschoolId);

      // Load students
      const { count: totalStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .eq('is_active', true);

      // Calculate metrics
      const totalAssignments = assignments?.length || 0;
      const completedAssignments = assignments?.filter(a => a.status === 'completed').length || 0;
      const lessonCompletionRate = totalAssignments > 0 
        ? Math.round((completedAssignments / totalAssignments) * 100) 
        : 0;

      const totalHomework = homeworkAssignments?.length || 0;
      const submittedHomework = homeworkSubmissions?.filter(s => s.status === 'submitted' || s.status === 'graded').length || 0;
      const homeworkSubmissionRate = totalHomework > 0
        ? Math.round((submittedHomework / totalHomework) * 100)
        : 0;

      // Calculate STEM engagement
      const stemEngagement = {
        ai: { lessonsCompleted: 0, activitiesCompleted: 0, engagementScore: 0 },
        robotics: { lessonsCompleted: 0, activitiesCompleted: 0, engagementScore: 0 },
        computer_literacy: { lessonsCompleted: 0, activitiesCompleted: 0, engagementScore: 0 },
      };

      if (stemProgress) {
        stemProgress.forEach((progress: any) => {
          const category = progress.category as keyof typeof stemEngagement;
          if (stemEngagement[category]) {
            stemEngagement[category].lessonsCompleted += progress.lessons_completed || 0;
            stemEngagement[category].activitiesCompleted += progress.activities_completed || 0;
            stemEngagement[category].engagementScore = Math.round(
              (stemEngagement[category].lessonsCompleted + stemEngagement[category].activitiesCompleted) / 2
            );
          }
        });
      }

      // Calculate average score
      const scores = completions?.map((c: any) => c.score).filter((s: any) => s !== null) || [];
      const averageScore = scores.length > 0
        ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
        : 0;

      return {
        lessonCompletionRate,
        homeworkSubmissionRate,
        stemEngagement,
        studentProgress: {
          totalStudents: totalStudents || 0,
          activeStudents: totalStudents || 0,
          averageScore,
        },
      };
    },
    enabled: !!preschoolId,
    staleTime: 300000, // 5 minutes
  });
}
