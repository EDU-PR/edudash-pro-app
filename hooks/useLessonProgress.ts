/**
 * useLessonProgress Hook
 * 
 * Tracks lesson completion and progress for students.
 * Used by both teachers (to view progress) and parents (to monitor children).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';

export interface StudentProgress {
  studentId: string;
  studentName: string;
  totalAssignments: number;
  completedAssignments: number;
  inProgressAssignments: number;
  overdueAssignments: number;
  completionRate: number;
  averageScore: number | null;
  totalTimeSpent: number; // minutes
  lastActivityDate: string | null;
  streak: number;
}

export interface LessonProgressDetail {
  assignmentId: string;
  lessonId: string;
  lessonTitle: string;
  lessonSubject: string;
  assignedAt: string;
  dueDate: string | null;
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue';
  completedAt: string | null;
  score: number | null;
  timeSpentMinutes: number | null;
}

export interface ProgressSummary {
  period: 'week' | 'month' | 'term';
  totalLessons: number;
  completedLessons: number;
  averageScore: number | null;
  totalTimeSpent: number;
  topSubjects: { subject: string; count: number }[];
  improvements: string[];
  areasToWork: string[];
}

interface UseLessonProgressReturn {
  // Single student data
  progress: StudentProgress | null;
  progressDetails: LessonProgressDetail[];
  summary: ProgressSummary | null;
  
  // Multiple students (for teachers/parents with multiple children)
  studentsProgress: StudentProgress[];
  
  // State
  isLoading: boolean;
  error: Error | null;
  
  // Actions
  refetch: () => void;
}

export function useLessonProgress(options: {
  studentId?: string;
  studentIds?: string[];
  preschoolId?: string;
  period?: 'week' | 'month' | 'term';
}): UseLessonProgressReturn {
  const { studentId, studentIds, preschoolId, period = 'month' } = options;
  
  // Fetch single student progress
  const {
    data: progressData,
    isLoading: isLoadingProgress,
    error: progressError,
    refetch: refetchProgress,
  } = useQuery({
    queryKey: ['student-progress', studentId, period],
    queryFn: async () => {
      if (!studentId) return null;
      
      const supabase = assertSupabase();
      
      // Get assignments for this student
      const { data: assignments, error: assignmentError } = await supabase
        .from('lesson_assignments')
        .select(`
          id,
          lesson_id,
          status,
          due_date,
          assigned_at,
          lesson:lessons(id, title, subject, duration_minutes)
        `)
        .eq('student_id', studentId)
        .order('assigned_at', { ascending: false });
      
      if (assignmentError) throw assignmentError;
      
      // Get completions for this student
      const { data: completions, error: completionError } = await supabase
        .from('lesson_completions')
        .select('*')
        .eq('student_id', studentId);
      
      if (completionError) throw completionError;
      
      // Get student info
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('id', studentId)
        .single();
      
      if (studentError) throw studentError;
      
      // Calculate progress
      const totalAssignments = assignments?.length || 0;
      const completedAssignments = assignments?.filter(a => a.status === 'completed').length || 0;
      const inProgressAssignments = assignments?.filter(a => a.status === 'in_progress').length || 0;
      const overdueAssignments = assignments?.filter(a => 
        a.status !== 'completed' && a.due_date && new Date(a.due_date) < new Date()
      ).length || 0;
      
      const completionRate = totalAssignments > 0 
        ? Math.round((completedAssignments / totalAssignments) * 100) 
        : 0;
      
      const scores = completions?.filter(c => c.score !== null).map(c => c.score) || [];
      const averageScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => (a || 0) + (b || 0), 0) / scores.length) 
        : null;
      
      const totalTimeSpent = completions?.reduce((sum, c) => sum + (c.time_spent_minutes || 0), 0) || 0;
      
      const lastCompletion = completions?.sort((a, b) => 
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      )[0];
      
      // Build progress details
      const progressDetails: LessonProgressDetail[] = (assignments || []).map(a => {
        const completion = completions?.find(c => c.assignment_id === a.id);
        return {
          assignmentId: a.id,
          lessonId: a.lesson_id,
          lessonTitle: a.lesson?.title || 'Unknown Lesson',
          lessonSubject: a.lesson?.subject || 'general',
          assignedAt: a.assigned_at,
          dueDate: a.due_date,
          status: a.status as any,
          completedAt: completion?.completed_at || null,
          score: completion?.score || null,
          timeSpentMinutes: completion?.time_spent_minutes || null,
        };
      });
      
      // Calculate summary
      const subjectCounts: Record<string, number> = {};
      (assignments || []).forEach(a => {
        const subject = a.lesson?.subject || 'general';
        subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
      });
      
      const topSubjects = Object.entries(subjectCounts)
        .map(([subject, count]) => ({ subject, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      
      const summary: ProgressSummary = {
        period,
        totalLessons: totalAssignments,
        completedLessons: completedAssignments,
        averageScore,
        totalTimeSpent,
        topSubjects,
        improvements: averageScore && averageScore >= 80 
          ? ['Great progress in completing lessons!'] 
          : [],
        areasToWork: overdueAssignments > 0 
          ? [`${overdueAssignments} overdue assignments need attention`] 
          : [],
      };
      
      return {
        progress: {
          studentId,
          studentName: `${student.first_name} ${student.last_name}`,
          totalAssignments,
          completedAssignments,
          inProgressAssignments,
          overdueAssignments,
          completionRate,
          averageScore,
          totalTimeSpent,
          lastActivityDate: lastCompletion?.completed_at || null,
          streak: 0, // TODO: Calculate streak
        },
        progressDetails,
        summary,
      };
    },
    enabled: !!studentId,
    staleTime: 30000,
  });
  
  // Fetch multiple students progress (for class view or parent with multiple children)
  const {
    data: studentsProgress = [],
    isLoading: isLoadingStudents,
    error: studentsError,
    refetch: refetchStudents,
  } = useQuery({
    queryKey: ['students-progress', studentIds?.join(','), preschoolId],
    queryFn: async () => {
      if (!studentIds?.length && !preschoolId) return [];
      
      const supabase = assertSupabase();
      
      // Get students
      let studentsQuery = supabase
        .from('students')
        .select('id, first_name, last_name')
        .eq('is_active', true);
      
      if (studentIds?.length) {
        studentsQuery = studentsQuery.in('id', studentIds);
      } else if (preschoolId) {
        studentsQuery = studentsQuery.eq('preschool_id', preschoolId);
      }
      
      const { data: students, error: studentsError } = await studentsQuery;
      if (studentsError) throw studentsError;
      if (!students?.length) return [];
      
      const studentIdList = students.map(s => s.id);
      
      // Get all assignments for these students
      const { data: assignments, error: assignmentError } = await supabase
        .from('lesson_assignments')
        .select('id, student_id, status, due_date')
        .in('student_id', studentIdList);
      
      if (assignmentError) throw assignmentError;
      
      // Get all completions
      const { data: completions, error: completionError } = await supabase
        .from('lesson_completions')
        .select('student_id, score, time_spent_minutes, completed_at')
        .in('student_id', studentIdList);
      
      if (completionError) throw completionError;
      
      // Calculate progress for each student
      return students.map(student => {
        const studentAssignments = assignments?.filter(a => a.student_id === student.id) || [];
        const studentCompletions = completions?.filter(c => c.student_id === student.id) || [];
        
        const totalAssignments = studentAssignments.length;
        const completedAssignments = studentAssignments.filter(a => a.status === 'completed').length;
        const inProgressAssignments = studentAssignments.filter(a => a.status === 'in_progress').length;
        const overdueAssignments = studentAssignments.filter(a => 
          a.status !== 'completed' && a.due_date && new Date(a.due_date) < new Date()
        ).length;
        
        const scores = studentCompletions.filter(c => c.score !== null).map(c => c.score);
        const averageScore = scores.length > 0 
          ? Math.round(scores.reduce((a, b) => (a || 0) + (b || 0), 0) / scores.length) 
          : null;
        
        const totalTimeSpent = studentCompletions.reduce((sum, c) => sum + (c.time_spent_minutes || 0), 0);
        
        const lastCompletion = studentCompletions.sort((a, b) => 
          new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
        )[0];
        
        return {
          studentId: student.id,
          studentName: `${student.first_name} ${student.last_name}`,
          totalAssignments,
          completedAssignments,
          inProgressAssignments,
          overdueAssignments,
          completionRate: totalAssignments > 0 
            ? Math.round((completedAssignments / totalAssignments) * 100) 
            : 0,
          averageScore,
          totalTimeSpent,
          lastActivityDate: lastCompletion?.completed_at || null,
          streak: 0,
        };
      });
    },
    enabled: !!(studentIds?.length || preschoolId),
    staleTime: 30000,
  });
  
  const refetch = () => {
    refetchProgress();
    refetchStudents();
  };
  
  return {
    progress: progressData?.progress || null,
    progressDetails: progressData?.progressDetails || [],
    summary: progressData?.summary || null,
    studentsProgress,
    isLoading: isLoadingProgress || isLoadingStudents,
    error: (progressError || studentsError) as Error | null,
    refetch,
  };
}

/**
 * Hook for parents to get progress for all their children
 */
export function useParentProgress(parentId: string | undefined) {
  const {
    data: childrenProgress = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['parent-children-progress', parentId],
    queryFn: async () => {
      if (!parentId) return [];
      
      const supabase = assertSupabase();
      
      // Get all children for this parent
      const { data: children, error: childrenError } = await supabase
        .from('students')
        .select('id, first_name, last_name, grade')
        .eq('parent_id', parentId)
        .eq('is_active', true);
      
      if (childrenError) throw childrenError;
      if (!children?.length) return [];
      
      // Get progress for each child
      const progressPromises = children.map(async child => {
        const { data: assignments } = await supabase
          .from('lesson_assignments')
          .select('id, status, due_date')
          .eq('student_id', child.id);
        
        const { data: completions } = await supabase
          .from('lesson_completions')
          .select('score, time_spent_minutes, completed_at')
          .eq('student_id', child.id);
        
        const totalAssignments = assignments?.length || 0;
        const completedAssignments = assignments?.filter(a => a.status === 'completed').length || 0;
        
        const scores = (completions || []).filter(c => c.score !== null).map(c => c.score);
        const averageScore = scores.length > 0 
          ? Math.round(scores.reduce((a, b) => (a || 0) + (b || 0), 0) / scores.length) 
          : null;
        
        return {
          studentId: child.id,
          studentName: `${child.first_name} ${child.last_name}`,
          grade: child.grade,
          totalAssignments,
          completedAssignments,
          completionRate: totalAssignments > 0 
            ? Math.round((completedAssignments / totalAssignments) * 100) 
            : 0,
          averageScore,
          overdueCount: assignments?.filter(a => 
            a.status !== 'completed' && a.due_date && new Date(a.due_date) < new Date()
          ).length || 0,
        };
      });
      
      return Promise.all(progressPromises);
    },
    enabled: !!parentId,
    staleTime: 30000,
  });
  
  return {
    childrenProgress,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}
