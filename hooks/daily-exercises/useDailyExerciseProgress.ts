/**
 * useDailyExerciseProgress
 *
 * Reads the student's accumulated daily exercise progress.
 * Returns React Query's UseQueryResult shape: { data, isLoading, ... }.
 */

import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type {
  DailyExerciseProgress,
  ExerciseStreak,
  DayProgress,
  SubjectAverage,
  DailyExerciseSet,
  SubjectExercise,
  ExerciseQuestion,
  SubjectCode,
} from '@/lib/daily-exercises/types';
import { SUBJECT_OPTIONS } from '@/lib/daily-exercises/types';

// ─── DB row shape ───────────────────────────────────────────────────────────

interface ProgressRow {
  student_id: string;
  current_streak: number;
  best_streak: number;
  total_days_completed: number;
  total_questions_answered: number;
  total_correct: number;
  average_score: number;
  subject_scores: Record<string, { attempts: number; avgScore: number }> | null;
  last_completed_date: string | null;
}

function subjectLabel(code: string): string {
  return SUBJECT_OPTIONS.find((s) => s.code === code)?.label ?? code;
}

function deriveWeekProgress(recentExercises: DailyExerciseSet[]): DayProgress[] {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const days: DayProgress[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayExercise = recentExercises.find((e) => e.date === dateStr);

    let status: DayProgress['status'] = 'pending';
    if (dayExercise) {
      status =
        dayExercise.overallStatus === 'completed'
          ? 'completed'
          : dayExercise.completedSubjects > 0
            ? 'partial'
            : 'pending';
    } else if (dateStr < todayStr) {
      status = 'missed';
    }

    days.push({ date: dateStr, status, score: dayExercise?.overallScore });
  }
  return days;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useDailyExerciseProgress(studentId?: string) {
  return useQuery({
    queryKey: ['daily-exercise-progress', studentId],
    queryFn: async (): Promise<DailyExerciseProgress | null> => {
      if (!studentId) return null;
      const client = assertSupabase();

      const { data: progressRow, error: progErr } = await client
        .from('daily_exercise_progress')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

      if (progErr) {
        logger.error('useDailyExerciseProgress', 'Fetch failed:', progErr.message);
        return null;
      }

      const row = progressRow as unknown as ProgressRow | null;

      const streak: ExerciseStreak = row
        ? { current: row.current_streak, best: row.best_streak, totalDays: row.total_days_completed }
        : { current: 0, best: 0, totalDays: 0 };

      const subjectScoresRaw = row?.subject_scores ?? {};
      const subjectAverages: SubjectAverage[] = Object.entries(subjectScoresRaw).map(
        ([code, stats]) => ({
          subjectCode: code as SubjectCode,
          subjectLabel: subjectLabel(code),
          averageScore: stats.avgScore,
          totalAttempts: stats.attempts,
        }),
      );

      // Fetch recent exercises (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const fromDate = sevenDaysAgo.toISOString().slice(0, 10);

      const { data: recentRows } = await client
        .from('daily_exercises')
        .select('*')
        .eq('student_id', studentId)
        .gte('exercise_date', fromDate)
        .order('exercise_date', { ascending: false });

      const recentByDate = new Map<string, DailyExerciseSet>();
      for (const rawRow of (recentRows ?? []) as Record<string, unknown>[]) {
        const dateVal = rawRow.exercise_date as string;
        const subjectCode = rawRow.subject as SubjectCode;
        const existing = recentByDate.get(dateVal);

        const subjectExercise: SubjectExercise = {
          subjectCode,
          subjectLabel: subjectLabel(subjectCode),
          status: (rawRow.status as string) as SubjectExercise['status'],
          questions: (Array.isArray(rawRow.questions) ? rawRow.questions : []) as ExerciseQuestion[],
          score: rawRow.score != null ? (rawRow.score as number) : undefined,
          correctCount: rawRow.correct_count != null ? (rawRow.correct_count as number) : undefined,
          totalQuestions: (rawRow.total_questions as number) ?? 5,
          completedAt: (rawRow.completed_at as string | null) ?? undefined,
          timeSpentSeconds: (rawRow.time_spent_seconds as number | null) ?? undefined,
        };

        if (existing) {
          existing.subjects.push(subjectExercise);
          existing.completedSubjects = existing.subjects.filter((s) => s.status === 'completed').length;
          existing.totalSubjects = existing.subjects.length;
          existing.overallStatus =
            existing.completedSubjects === existing.totalSubjects
              ? 'completed'
              : existing.completedSubjects > 0
                ? 'in_progress'
                : 'pending';
        } else {
          recentByDate.set(dateVal, {
            id: (rawRow.config_id as string) ?? '',
            studentId,
            date: dateVal,
            subjects: [subjectExercise],
            overallStatus: subjectExercise.status,
            completedSubjects: subjectExercise.status === 'completed' ? 1 : 0,
            totalSubjects: 1,
          });
        }
      }

      const recentExercises = Array.from(recentByDate.values()).sort(
        (a, b) => b.date.localeCompare(a.date),
      );

      return {
        streak,
        weekProgress: deriveWeekProgress(recentExercises),
        subjectAverages,
        recentExercises,
      };
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 3,
  });
}
