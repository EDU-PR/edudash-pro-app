/**
 * useDailyExerciseConfig
 *
 * Fetches the per-student daily exercise configuration.
 * Returns React Query's UseQueryResult shape: { data, isLoading, ... }.
 */

import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type { DailyExerciseConfig, SubjectCode, DifficultyLevel, SubjectConfig } from '@/lib/daily-exercises/types';
import { SUBJECT_OPTIONS } from '@/lib/daily-exercises/types';

// ─── DB row shape ───────────────────────────────────────────────────────────

interface ConfigRow {
  id: string;
  student_id: string;
  parent_id: string;
  organization_id: string | null;
  grade: string;
  core_subjects: string[];
  optional_subjects: string[];
  questions_per_subject: number;
  difficulty: string;
  alert_enabled: boolean;
  alert_time: string;
  alert_days: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function rowToConfig(row: ConfigRow): DailyExerciseConfig {
  const enabledSubjects = new Set<SubjectCode>([
    ...(row.core_subjects as SubjectCode[]),
    ...(row.optional_subjects as SubjectCode[]),
  ]);

  const subjects: SubjectConfig[] = SUBJECT_OPTIONS.map((opt) => ({
    ...opt,
    enabled: enabledSubjects.has(opt.code),
  }));

  const alertDaysBool: boolean[] = [false, false, false, false, false, false, false];
  for (const day of row.alert_days) {
    if (day >= 0 && day <= 6) alertDaysBool[day] = true;
  }

  return {
    id: row.id,
    studentId: row.student_id,
    subjects,
    questionsPerSubject: row.questions_per_subject,
    difficulty: row.difficulty as DifficultyLevel,
    reminderEnabled: row.alert_enabled,
    reminderTime: row.alert_time,
    reminderDays: alertDaysBool,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useDailyExerciseConfig(studentId?: string) {
  const { user } = useAuth();
  const parentId = user?.id;

  return useQuery({
    queryKey: ['daily-exercise-config', studentId],
    queryFn: async (): Promise<DailyExerciseConfig | null> => {
      if (!studentId || !parentId) return null;
      const client = assertSupabase();
      const { data, error } = await client
        .from('daily_exercise_configs')
        .select('*')
        .eq('student_id', studentId)
        .eq('parent_id', parentId)
        .maybeSingle();

      if (error) {
        logger.error('useDailyExerciseConfig', 'Fetch failed:', error.message);
        return null;
      }
      return data ? rowToConfig(data as unknown as ConfigRow) : null;
    },
    enabled: !!studentId && !!parentId,
    staleTime: 1000 * 60 * 5,
  });
}
