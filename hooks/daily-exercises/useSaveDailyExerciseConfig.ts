/**
 * useSaveDailyExerciseConfig
 *
 * Mutation hook for creating / updating daily exercise configuration.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type { SubjectConfig, DifficultyLevel, SubjectCode } from '@/lib/daily-exercises/types';

interface SaveConfigPayload {
  studentId: string;
  subjects: SubjectConfig[];
  questionsPerSubject: number;
  difficulty: DifficultyLevel;
  reminderEnabled: boolean;
  reminderTime: string;
  reminderDays: boolean[];
}

export function useSaveDailyExerciseConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SaveConfigPayload) => {
      const parentId = user?.id;
      if (!parentId) throw new Error('Not authenticated');

      const client = assertSupabase();

      const coreSubjects: SubjectCode[] = payload.subjects
        .filter((s) => s.enabled && (s.code === 'mathematics' || s.code === 'english_hl'))
        .map((s) => s.code);

      const optionalSubjects: SubjectCode[] = payload.subjects
        .filter((s) => s.enabled && s.code !== 'mathematics' && s.code !== 'english_hl')
        .map((s) => s.code);

      const alertDays = payload.reminderDays
        .map((enabled, idx) => (enabled ? idx : -1))
        .filter((d) => d >= 0);

      const row = {
        student_id: payload.studentId,
        parent_id: parentId,
        core_subjects: coreSubjects,
        optional_subjects: optionalSubjects,
        questions_per_subject: payload.questionsPerSubject,
        difficulty: payload.difficulty,
        alert_enabled: payload.reminderEnabled,
        alert_time: payload.reminderTime,
        alert_days: alertDays,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await client
        .from('daily_exercise_configs')
        .select('id')
        .eq('student_id', payload.studentId)
        .eq('parent_id', parentId)
        .maybeSingle();

      if (existing) {
        const { error } = await client
          .from('daily_exercise_configs')
          .update(row)
          .eq('id', (existing as Record<string, unknown>).id as string);
        if (error) throw error;
      } else {
        const { error } = await client
          .from('daily_exercise_configs')
          .insert({ ...row, grade: 'grade_4' });
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['daily-exercise-config', variables.studentId],
      });
    },
    onError: (err) => {
      logger.error('useSaveDailyExerciseConfig', 'Save failed:', err);
    },
  });
}
