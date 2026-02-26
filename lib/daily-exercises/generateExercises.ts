/**
 * Daily Exercise Generation Engine
 *
 * Generates CAPS-aligned questions for each subject/grade via the
 * ai-proxy edge function, with a static-bank fallback.
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type {
  DifficultyLevel,
  ExerciseQuestion,
  SubjectCode,
} from './types';
import { getFallbackQuestions } from './questionBank';

// ─── Subject display labels ─────────────────────────────────────────────────

const SUBJECT_LABELS: Record<SubjectCode, string> = {
  mathematics: 'Mathematics',
  english_hl: 'English Home Language',
  afrikaans_hl: 'Afrikaans Home Language',
  afrikaans_fal: 'Afrikaans First Additional Language',
  isizulu_hl: 'isiZulu Home Language',
  isizulu_fal: 'isiZulu First Additional Language',
};

// ─── Phase helpers ──────────────────────────────────────────────────────────

type CAPSPhase = 'foundation' | 'intermediate' | 'senior' | 'fet';

function gradeToCAPSPhase(grade: string): CAPSPhase {
  const num = parseInt(grade.replace(/\D/g, ''), 10);
  if (Number.isNaN(num) || num <= 3) return 'foundation';
  if (num <= 6) return 'intermediate';
  if (num <= 9) return 'senior';
  return 'fet';
}

function currentSchoolTerm(): number {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

// ─── Difficulty resolution ──────────────────────────────────────────────────

export interface AdaptiveContext {
  avgScore?: number;
}

function resolveEffectiveDifficulty(
  difficulty: DifficultyLevel,
  adaptive?: AdaptiveContext,
): Exclude<DifficultyLevel, 'adaptive'> {
  if (difficulty !== 'adaptive') return difficulty;
  if (!adaptive?.avgScore) return 'medium';
  if (adaptive.avgScore > 80) return 'hard';
  if (adaptive.avgScore < 50) return 'easy';
  return 'medium';
}

// ─── Prompt builders per subject ────────────────────────────────────────────

function buildMathsPrompt(
  grade: string,
  phase: CAPSPhase,
  count: number,
  diff: string,
  term: number,
  previousTopics: string[],
): string {
  const avoid = previousTopics.length
    ? `\nAvoid these recently-covered topics: ${previousTopics.join(', ')}.`
    : '';

  return `You are a South African CAPS Mathematics question generator for ${grade} (${phase} phase), Term ${term}.
Generate exactly ${count} questions at ${diff} difficulty.
${avoid}
Include a mix of question types: multiple_choice (with 4 options), fill_blank, true_false.
For numerical/algebra questions use LaTeX where appropriate (e.g. $\\frac{3}{4}$).
Progressive difficulty within the set: start easier and end harder.

CAPS topics for ${phase} phase maths include: Number Concepts, Operations, Fractions, Decimals, Patterns, Geometry, Measurement, Data Handling${phase === 'senior' || phase === 'fet' ? ', Algebra, Functions, Trigonometry, Probability, Statistics' : ''}.

Return ONLY a JSON array. Each element must have these fields:
{
  "id": "<unique string>",
  "questionType": "multiple_choice" | "fill_blank" | "true_false",
  "questionText": "<question text, may contain LaTeX in $...$>",
  "options": ["<opt1>", ...] (only for multiple_choice and true_false),
  "correctAnswer": "<exact string matching one of options or the fill value>",
  "explanation": "<brief explanation>",
  "hasLatex": true/false
}`;
}

function buildEnglishPrompt(
  grade: string,
  phase: CAPSPhase,
  count: number,
  diff: string,
  term: number,
  variant: 'hl' | 'fal',
  previousTopics: string[],
): string {
  const level = variant === 'hl' ? 'Home Language' : 'First Additional Language';
  const avoid = previousTopics.length
    ? `\nAvoid these recently-covered topics: ${previousTopics.join(', ')}.`
    : '';
  const fal_note = variant === 'fal'
    ? '\nSince this is First Additional Language, keep sentences simpler and vocabulary accessible.'
    : '';

  return `You are a South African CAPS English ${level} question generator for ${grade} (${phase} phase), Term ${term}.
Generate exactly ${count} questions at ${diff} difficulty.${avoid}${fal_note}

Include a mix of:
- Reading comprehension (short 3-sentence passage + 2 questions)
- Grammar (verb tenses, articles, punctuation, sentence structure)
- Vocabulary (synonyms, antonyms, context clues)

Return ONLY a JSON array with elements matching this schema:
{
  "id": "<unique string>",
  "questionType": "multiple_choice" | "fill_blank" | "true_false",
  "questionText": "<question text>",
  "options": ["<opt1>", ...] (only for multiple_choice and true_false),
  "correctAnswer": "<exact string>",
  "explanation": "<brief explanation>",
  "hasLatex": false
}`;
}

function buildLanguagePrompt(
  grade: string,
  phase: CAPSPhase,
  count: number,
  diff: string,
  term: number,
  language: 'afrikaans' | 'isizulu',
  variant: 'hl' | 'fal',
  previousTopics: string[],
): string {
  const langName = language === 'afrikaans' ? 'Afrikaans' : 'isiZulu';
  const level = variant === 'hl' ? 'Home Language' : 'First Additional Language';
  const avoid = previousTopics.length
    ? `\nAvoid these recently-covered topics: ${previousTopics.join(', ')}.`
    : '';

  return `You are a South African CAPS ${langName} ${level} question generator for ${grade} (${phase} phase), Term ${term}.
Generate exactly ${count} questions at ${diff} difficulty.${avoid}

Include a mix of:
- Vocabulary building (translate, match words)
- Simple reading comprehension (short passage)
- Grammar rules (tense, noun classes${language === 'isizulu' ? ', concordial agreement' : ', spelling rules'})

${variant === 'fal' ? 'Keep language simple and accessible for additional language learners.' : ''}

Return ONLY a JSON array with elements matching this schema:
{
  "id": "<unique string>",
  "questionType": "multiple_choice" | "fill_blank" | "true_false",
  "questionText": "<question text>",
  "options": ["<opt1>", ...] (only for multiple_choice and true_false),
  "correctAnswer": "<exact string>",
  "explanation": "<brief explanation in English>",
  "hasLatex": false
}`;
}

// ─── Build prompt dispatcher ────────────────────────────────────────────────

function buildPromptForSubject(
  subject: SubjectCode,
  grade: string,
  count: number,
  difficulty: string,
  previousTopics: string[],
): string {
  const phase = gradeToCAPSPhase(grade);
  const term = currentSchoolTerm();

  switch (subject) {
    case 'mathematics':
      return buildMathsPrompt(grade, phase, count, difficulty, term, previousTopics);
    case 'english_hl':
      return buildEnglishPrompt(grade, phase, count, difficulty, term, 'hl', previousTopics);
    case 'afrikaans_hl':
      return buildLanguagePrompt(grade, phase, count, difficulty, term, 'afrikaans', 'hl', previousTopics);
    case 'afrikaans_fal':
      return buildLanguagePrompt(grade, phase, count, difficulty, term, 'afrikaans', 'fal', previousTopics);
    case 'isizulu_hl':
      return buildLanguagePrompt(grade, phase, count, difficulty, term, 'isizulu', 'hl', previousTopics);
    case 'isizulu_fal':
      return buildLanguagePrompt(grade, phase, count, difficulty, term, 'isizulu', 'fal', previousTopics);
    default:
      return buildEnglishPrompt(grade, phase, count, difficulty, term, 'hl', previousTopics);
  }
}

// ─── AI response parser ─────────────────────────────────────────────────────

function parseAIResponse(raw: unknown, subject: SubjectCode): ExerciseQuestion[] | null {
  try {
    let text: string | undefined;

    if (typeof raw === 'string') {
      text = raw;
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      text =
        (typeof obj.content === 'string' ? obj.content : undefined) ??
        (typeof obj.text === 'string' ? obj.text : undefined) ??
        (typeof obj.response === 'string' ? obj.response : undefined);

      if (!text && Array.isArray(obj.questions)) {
        return (obj.questions as Record<string, unknown>[]).map((q, i) => normalizeQuestion(q, i, subject));
      }
    }

    if (!text) return null;

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return null;

    return parsed.map((q: Record<string, unknown>, idx: number) => normalizeQuestion(q, idx, subject));
  } catch (err) {
    logger.warn('generateExercises', 'Failed to parse AI response:', err);
    return null;
  }
}

function normalizeQuestion(
  q: Record<string, unknown>,
  idx: number,
  subject: SubjectCode,
): ExerciseQuestion {
  const validTypes: ExerciseQuestion['questionType'][] = ['multiple_choice', 'fill_blank', 'true_false'];
  const rawType = (q.questionType ?? q.question_type ?? q.type) as string;
  const questionType: ExerciseQuestion['questionType'] = validTypes.includes(rawType as ExerciseQuestion['questionType'])
    ? (rawType as ExerciseQuestion['questionType'])
    : 'multiple_choice';

  return {
    id: typeof q.id === 'string' ? q.id : `gen-${idx + 1}`,
    subjectCode: subject,
    questionText: String(q.questionText ?? q.question_text ?? q.question ?? ''),
    questionType,
    options: Array.isArray(q.options) ? q.options.map(String) : undefined,
    correctAnswer: String(q.correctAnswer ?? q.correct_answer ?? ''),
    explanation: String(q.explanation ?? ''),
    hasLatex: q.hasLatex === true || q.has_latex === true,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface GenerateExercisesParams {
  grade: string;
  subject: SubjectCode;
  count: number;
  difficulty: DifficultyLevel;
  previousTopics?: string[];
  adaptiveContext?: AdaptiveContext;
}

/**
 * Generate CAPS-aligned daily exercise questions.
 *
 * Attempts AI generation via the `ai-proxy` edge function first.
 * Falls back to the static question bank on failure.
 */
export async function generateDailyExercises(
  params: GenerateExercisesParams,
): Promise<ExerciseQuestion[]> {
  const {
    grade,
    subject,
    count,
    difficulty,
    previousTopics = [],
    adaptiveContext,
  } = params;

  const effectiveDiff = resolveEffectiveDifficulty(difficulty, adaptiveContext);

  const prompt = buildPromptForSubject(
    subject,
    grade,
    count,
    effectiveDiff,
    previousTopics,
  );

  const systemContext = `You are Dash, an AI tutor for EduDash Pro generating ${SUBJECT_LABELS[subject]} practice questions aligned to the South African CAPS curriculum. Return ONLY valid JSON — no markdown fences, no commentary.`;

  try {
    const client = assertSupabase();

    const { data, error } = await client.functions.invoke('ai-proxy', {
      body: {
        scope: 'parent',
        service_type: 'lesson_generation',
        payload: { prompt, context: systemContext },
        stream: false,
        enable_tools: false,
        metadata: {
          source: 'daily_exercise_generator',
          subject,
          grade,
          difficulty: effectiveDiff,
        },
      },
    });

    if (error) throw error;

    const questions = parseAIResponse(data, subject);

    if (questions && questions.length > 0) {
      logger.info(
        'generateExercises',
        `AI generated ${questions.length} ${subject} questions for ${grade}`,
      );
      return questions.slice(0, count);
    }

    throw new Error('AI returned empty or unparseable questions');
  } catch (err) {
    logger.warn(
      'generateExercises',
      `AI generation failed for ${subject}/${grade}, using fallback bank:`,
      err,
    );

    return getFallbackQuestions(subject, grade, count);
  }
}
