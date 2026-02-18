/**
 * useAIHomeworkGenerator
 *
 * Teacher-facing hook that wraps the generate_homework tool in a
 * convenient React interface. Supports:
 * - AI-powered homework generation with CAPS alignment
 * - Question type selection
 * - Difficulty tiers
 * - Direct save to homework table
 *
 * ≤200 lines per WARP.md
 */

import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { assertSupabase } from '@/lib/supabase';
import { unifiedToolRegistry } from '@/services/tools/UnifiedToolRegistry';

// ─── Types ───────────────────────────────────────────────────────────────────

export type QuestionType =
  | 'multiple_choice'
  | 'short_answer'
  | 'fill_blank'
  | 'true_false'
  | 'matching'
  | 'essay';

export interface HomeworkGenOptions {
  subject: string;
  topic: string;
  grade: string;
  numQuestions?: number;
  questionTypes?: QuestionType[];
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  includeRubric?: boolean;
  includeAnswerKey?: boolean;
}

export interface GeneratedQuestion {
  number: number;
  type: QuestionType;
  question: string;
  options?: string[];
  correct_answer?: string;
  difficulty: string;
  blooms_level?: string;
  marks: number;
  explanation?: string;
}

export interface GeneratedHomework {
  title: string;
  instructions: string;
  estimated_time_minutes: number;
  questions: GeneratedQuestion[];
  rubric?: Record<string, unknown>;
  answer_key?: unknown[];
  caps_alignment?: string;
}

interface UseAIHomeworkGeneratorResult {
  homework: GeneratedHomework | null;
  loading: boolean;
  error: string | null;
  generate: (options: HomeworkGenOptions) => Promise<GeneratedHomework | null>;
  saveToDatabase: (classId: string, dueDate: string) => Promise<string | null>;
  reset: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAIHomeworkGenerator(): UseAIHomeworkGeneratorResult {
  const [homework, setHomework] = useState<GeneratedHomework | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (options: HomeworkGenOptions): Promise<GeneratedHomework | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await unifiedToolRegistry.execute(
          'generate_homework',
          {
            subject: options.subject,
            topic: options.topic,
            grade: options.grade,
            num_questions: options.numQuestions ?? 5,
            question_types: options.questionTypes ?? ['multiple_choice', 'short_answer'],
            difficulty: options.difficulty ?? 'mixed',
            include_rubric: options.includeRubric ?? true,
            include_answer_key: options.includeAnswerKey ?? true,
          },
          { role: 'teacher', tier: 'starter' },
        );

        if (!result.success || !result.result) {
          throw new Error(result.error || 'Generation failed');
        }

        const hw = result.result as GeneratedHomework;
        setHomework(hw);
        return hw;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Homework generation failed';
        setError(msg);
        logger.error('[useAIHomeworkGenerator] generate failed', { error: err });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const saveToDatabase = useCallback(
    async (classId: string, dueDate: string): Promise<string | null> => {
      if (!homework) {
        setError('No homework to save');
        return null;
      }

      try {
        const supabase = assertSupabase();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) throw new Error('Not authenticated');

        const { data, error: insertErr } = await supabase
          .from('homework_assignments')
          .insert({
            title: homework.title,
            description: homework.instructions,
            class_id: classId,
            teacher_id: userData.user.id,
            due_date: dueDate,
            questions: homework.questions,
            rubric: homework.rubric || null,
            answer_key: homework.answer_key || null,
            caps_alignment: homework.caps_alignment || null,
            estimated_time_minutes: homework.estimated_time_minutes,
            ai_generated: true,
          })
          .select('id')
          .single();

        if (insertErr) throw insertErr;
        return data?.id || null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Save failed';
        setError(msg);
        logger.error('[useAIHomeworkGenerator] save failed', { error: err });
        return null;
      }
    },
    [homework],
  );

  const reset = useCallback(() => {
    setHomework(null);
    setError(null);
    setLoading(false);
  }, []);

  return { homework, loading, error, generate, saveToDatabase, reset };
}
