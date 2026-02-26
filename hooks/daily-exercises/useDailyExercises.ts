/**
 * useDailyExercises
 *
 * Fetches today's exercise set for a student.
 * If none exist, auto-generates from the active config.
 * Returns React Query's UseQueryResult shape: { data, isLoading, ... }.
 */

import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type {
  DailyExerciseSet,
  SubjectExercise,
  ExerciseQuestion,
  SubjectCode,
  DifficultyLevel,
} from '@/lib/daily-exercises/types';
import { SUBJECT_OPTIONS } from '@/lib/daily-exercises/types';
import { generateDailyExercises } from '@/lib/daily-exercises/generateExercises';

// ─── helpers ────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function subjectLabelFor(code: SubjectCode): string {
  return SUBJECT_OPTIONS.find((s) => s.code === code)?.label ?? code;
}

// ─── DB row type ────────────────────────────────────────────────────────────

interface ExerciseRow {
  id: string;
  config_id: string;
  student_id: string;
  exercise_date: string;
  subject: string;
  grade: string;
  questions: unknown;
  status: string;
  score: number | null;
  correct_count: number | null;
  total_questions: number;
  started_at: string | null;
  completed_at: string | null;
  time_spent_seconds: number | null;
}

function rowsToExerciseSet(
  rows: ExerciseRow[],
  studentId: string,
  date: string,
): DailyExerciseSet {
  const subjects: SubjectExercise[] = rows.map((r) => ({
    subjectCode: r.subject as SubjectCode,
    subjectLabel: subjectLabelFor(r.subject as SubjectCode),
    status: r.status as SubjectExercise['status'],
    questions: (Array.isArray(r.questions) ? r.questions : []) as ExerciseQuestion[],
    score: r.score ?? undefined,
    correctCount: r.correct_count ?? undefined,
    totalQuestions: r.total_questions,
    completedAt: r.completed_at ?? undefined,
    timeSpentSeconds: r.time_spent_seconds ?? undefined,
  }));

  const completedSubjects = subjects.filter((s) => s.status === 'completed').length;
  const overallStatus =
    completedSubjects === subjects.length && subjects.length > 0
      ? 'completed'
      : subjects.some((s) => s.status === 'in_progress' || s.status === 'completed')
        ? 'in_progress'
        : 'pending';

  const completedScores = subjects.filter((s) => s.status === 'completed' && s.score != null);
  const overallScore =
    completedScores.length > 0
      ? Math.round(completedScores.reduce((s, e) => s + (e.score ?? 0), 0) / completedScores.length)
      : undefined;

  return {
    id: rows[0]?.config_id ?? '',
    studentId,
    date,
    subjects,
    overallStatus,
    overallScore,
    completedSubjects,
    totalSubjects: subjects.length,
  };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useDailyExercises(studentId?: string) {
  const { user } = useAuth();
  const parentId = user?.id;
  const targetDate = todayISO();

  return useQuery({
    queryKey: ['daily-exercises', studentId, targetDate],
    queryFn: async (): Promise<DailyExerciseSet | null> => {
      if (!studentId) return null;
      const client = assertSupabase();

      const { data: existingRows, error: fetchErr } = await client
        .from('daily_exercises')
        .select('*')
        .eq('student_id', studentId)
        .eq('exercise_date', targetDate)
        .order('subject');

      if (fetchErr) {
        logger.error('useDailyExercises', 'Fetch failed:', fetchErr.message);
        return null;
      }

      if (existingRows && existingRows.length > 0) {
        return rowsToExerciseSet(existingRows as unknown as ExerciseRow[], studentId, targetDate);
      }

      // Auto-generate if an active config exists
      if (!parentId) return null;

      const { data: configRow } = await client
        .from('daily_exercise_configs')
        .select('*')
        .eq('student_id', studentId)
        .eq('parent_id', parentId)
        .eq('is_active', true)
        .maybeSingle();

      if (!configRow) return null;

      const config = configRow as Record<string, unknown>;
      const allSubjects = [
        ...((config.core_subjects as string[]) ?? []),
        ...((config.optional_subjects as string[]) ?? []),
      ] as SubjectCode[];

      const grade = (config.grade as string) ?? 'grade_4';
      const count = (config.questions_per_subject as number) ?? 5;
      const difficulty = (config.difficulty as DifficultyLevel) ?? 'adaptive';

      let adaptiveAvg: number | undefined;
      if (difficulty === 'adaptive') {
        const { data: progress } = await client
          .from('daily_exercise_progress')
          .select('average_score')
          .eq('student_id', studentId)
          .maybeSingle();
        if (progress) {
          adaptiveAvg = (progress as Record<string, unknown>).average_score as number;
        }
      }

      const insertRows: Record<string, unknown>[] = [];
      for (const subject of allSubjects) {
        const questions = await generateDailyExercises({
          grade,
          subject,
          count,
          difficulty,
          adaptiveContext: adaptiveAvg != null ? { avgScore: adaptiveAvg } : undefined,
        });
        insertRows.push({
          config_id: config.id,
          student_id: studentId,
          exercise_date: targetDate,
          subject,
          grade,
          questions,
          total_questions: questions.length,
          status: 'pending',
        });
      }

      if (insertRows.length === 0) return null;

      const { data: inserted, error: insErr } = await client
        .from('daily_exercises')
        .insert(insertRows)
        .select('*');

      if (insErr) {
        logger.error('useDailyExercises', 'Insert failed:', insErr.message);
        return null;
      }

      logger.info('useDailyExercises', `Generated ${insertRows.length} exercises for ${targetDate}`);
      return rowsToExerciseSet(
        (inserted ?? []) as unknown as ExerciseRow[],
        studentId,
        targetDate,
      );
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 2,
  });
}
