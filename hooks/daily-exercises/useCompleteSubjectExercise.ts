/**
 * useCompleteSubjectExercise
 *
 * Mutation hook that marks a subject exercise as completed,
 * updates score/time, and refreshes progress.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { SubjectCode } from '@/lib/daily-exercises/types';

interface CompleteSubjectPayload {
  studentId: string;
  exerciseSetId: string;
  subjectCode: SubjectCode;
  score: number;
  timeSpentSeconds: number;
}

export function useCompleteSubjectExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CompleteSubjectPayload) => {
      const client = assertSupabase();
      const today = new Date().toISOString().slice(0, 10);

      const { data: exerciseRow, error: fetchErr } = await client
        .from('daily_exercises')
        .select('id, correct_count, total_questions')
        .eq('student_id', payload.studentId)
        .eq('exercise_date', today)
        .eq('subject', payload.subjectCode)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!exerciseRow) throw new Error('Exercise not found');

      const row = exerciseRow as Record<string, unknown>;
      const totalQ = (row.total_questions as number) ?? 5;
      const correctCount = Math.round((payload.score / 100) * totalQ);

      const { error: updateErr } = await client
        .from('daily_exercises')
        .update({
          status: 'completed',
          score: payload.score,
          correct_count: correctCount,
          completed_at: new Date().toISOString(),
          time_spent_seconds: payload.timeSpentSeconds,
        })
        .eq('id', row.id as string);

      if (updateErr) throw updateErr;

      await updateProgress(
        client,
        payload.studentId,
        payload.score,
        correctCount,
        totalQ,
        payload.subjectCode,
      );
    },
    onSuccess: (_data, variables) => {
      const today = new Date().toISOString().slice(0, 10);
      queryClient.invalidateQueries({
        queryKey: ['daily-exercises', variables.studentId, today],
      });
      queryClient.invalidateQueries({
        queryKey: ['daily-exercise-progress', variables.studentId],
      });
    },
    onError: (err) => {
      logger.error('useCompleteSubjectExercise', 'Complete failed:', err);
    },
  });
}

// ─── progress updater (internal) ────────────────────────────────────────────

async function updateProgress(
  client: ReturnType<typeof assertSupabase>,
  studentId: string,
  score: number,
  correctCount: number,
  totalQuestions: number,
  subject: SubjectCode,
): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const { data: existing } = await client
      .from('daily_exercise_progress')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle();

    if (existing) {
      const row = existing as Record<string, unknown>;
      const totalDays = ((row.total_days_completed as number) ?? 0) + 1;
      const totalAnswered = ((row.total_questions_answered as number) ?? 0) + totalQuestions;
      const totalCorrectAll = ((row.total_correct as number) ?? 0) + correctCount;
      const prevDays = (row.total_days_completed as number) ?? 0;
      const avgScore = prevDays > 0
        ? Math.round(((((row.average_score as number) ?? 0) * prevDays) + score) / totalDays)
        : score;

      const lastDate = row.last_completed_date as string | null;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const streakContinues = lastDate === yesterdayStr || lastDate === today;
      const currentStreak = streakContinues
        ? ((row.current_streak as number) ?? 0) + (lastDate === today ? 0 : 1)
        : 1;
      const bestStreak = Math.max(currentStreak, (row.best_streak as number) ?? 0);

      const subjectScores: Record<string, { attempts: number; avgScore: number }> =
        (typeof row.subject_scores === 'object' && row.subject_scores !== null
          ? row.subject_scores
          : {}) as Record<string, { attempts: number; avgScore: number }>;

      const prev = subjectScores[subject] ?? { attempts: 0, avgScore: 0 };
      subjectScores[subject] = {
        attempts: prev.attempts + 1,
        avgScore: Math.round((prev.avgScore * prev.attempts + score) / (prev.attempts + 1)),
      };

      await client
        .from('daily_exercise_progress')
        .update({
          current_streak: currentStreak,
          best_streak: bestStreak,
          total_days_completed: totalDays,
          total_questions_answered: totalAnswered,
          total_correct: totalCorrectAll,
          average_score: avgScore,
          subject_scores: subjectScores,
          last_completed_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', studentId);
    } else {
      await client.from('daily_exercise_progress').insert({
        student_id: studentId,
        current_streak: 1,
        best_streak: 1,
        total_days_completed: 1,
        total_questions_answered: totalQuestions,
        total_correct: correctCount,
        average_score: score,
        subject_scores: { [subject]: { attempts: 1, avgScore: score } },
        last_completed_date: today,
      });
    }
  } catch (err) {
    logger.warn('updateProgress', 'Progress update failed:', err);
  }
}
