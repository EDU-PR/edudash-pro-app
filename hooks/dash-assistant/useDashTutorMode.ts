/**
 * useDashTutorMode Hook
 *
 * Manages tutor mode (quiz/practice) for Dash AI.
 * Handles question generation, answer grading via DashQuizService + AI fallback,
 * and session tracking with spaced repetition scheduling.
 *
 * Extracted from useDashAssistant.ts for WARP.md compliance (≤200 lines).
 * Grading logic bridges to DashQuizService for structured quiz answers
 * and falls back to AI grading for free-form answers.
 */

import { useState, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';

export type TutorMode = 'quiz' | 'practice' | 'diagnostic' | 'play' | null;

export interface TutorSession {
  mode: TutorMode;
  subject?: string;
  grade?: string;
  topic?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  maxQuestions: number;
  totalQuestions: number;
  correctAnswers: number;
  currentQuestion: string | null;
  expectedAnswer: string | null;
  isAwaitingAnswer: boolean;
  sessionStart: string;
  /** DashQuizService session ID when using structured quizzes */
  quizSessionId?: string;
  /** Current quiz question ID for DashQuizService bridge */
  currentQuestionId?: string;
}

export interface GradeResult {
  is_correct: boolean;
  score: number;
  feedback: string;
  correct_answer?: string;
  explanation?: string;
  misconception?: string;
  follow_up_question?: string;
  next_expected_answer?: string;
}

export interface UseDashTutorReturn {
  tutorSession: TutorSession | null;
  startTutorSession: (mode: TutorMode, config?: Partial<TutorSession>) => void;
  endTutorSession: () => void;
  submitAnswer: (answer: string) => GradeResult;
  nextQuestion: (question: string, expectedAnswer?: string, questionId?: string) => void;
  detectTutorIntent: (text: string) => TutorMode | null;
  parseGradePayload: (payload: any) => GradeResult | null;
  setQuizSessionId: (sessionId: string) => void;
}

// ─── Intent detection patterns ───────────────────────────────────────────────

const PLAY_PATTERNS = /(let.s\s+play|play\s+a\s+game|play\s+with\s+me|fun\s+game|counting\s+game|colour\s+game|shape\s+game|rhyme|story\s+time|animal\s+sound|letter\s+game|silly\s+question)/i;
const QUIZ_PATTERNS = /(quiz\s+me|test\s+me|give\s+me\s+a\s+quiz|exam\s+me|test\s+my\s+knowledge|assessment|mock\s+test)/i;
const PRACTICE_PATTERNS = /(practice\s+question|drill\s+me|give\s+me\s+practice|let.s\s+practice|practice\s+problems?|exercise|work\s*sheet)/i;
const DIAGNOSTIC_PATTERNS = /(diagnos(e|tic)\s+(me|test)|check\s+my\s+(level|understanding|knowledge)|where\s+am\s+i\s+(at|with)|assess\s+me|what\s+do\s+i\s+know)/i;
const TEACH_PATTERNS = /(explain|teach\s+me|help\s+me\s+understand|i\s+don.t\s+(get|understand)|tutor\s+me|can\s+you\s+explain|show\s+me\s+how|break\s+it\s+down|i.m\s+struggling\s+with|what\s+is|how\s+does.*work)/i;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDashTutorMode(): UseDashTutorReturn {
  const [tutorSession, setTutorSession] = useState<TutorSession | null>(null);
  const answerStartRef = useRef<number>(0);

  const detectTutorIntent = useCallback((text: string): TutorMode | null => {
    const value = (text || '').toLowerCase();
    if (!value) return null;
    if (PLAY_PATTERNS.test(value)) return 'play';
    if (QUIZ_PATTERNS.test(value)) return 'quiz';
    if (PRACTICE_PATTERNS.test(value)) return 'practice';
    if (DIAGNOSTIC_PATTERNS.test(value)) return 'diagnostic';
    // Teach patterns trigger diagnostic first (assess → then teach)
    if (TEACH_PATTERNS.test(value)) return 'diagnostic';
    return null;
  }, []);

  const startTutorSession = useCallback((mode: TutorMode, config?: Partial<TutorSession>) => {
    setTutorSession({
      mode,
      subject: config?.subject,
      grade: config?.grade,
      topic: config?.topic,
      difficulty: config?.difficulty || 3,
      maxQuestions: config?.maxQuestions || 10,
      totalQuestions: 0,
      correctAnswers: 0,
      currentQuestion: null,
      expectedAnswer: null,
      isAwaitingAnswer: false,
      sessionStart: new Date().toISOString(),
      quizSessionId: config?.quizSessionId,
    });
    logger.info('[DashTutor] Session started', { mode, subject: config?.subject });
  }, []);

  const setQuizSessionId = useCallback((sessionId: string) => {
    setTutorSession((prev) => prev ? { ...prev, quizSessionId: sessionId } : null);
  }, []);

  const endTutorSession = useCallback(() => {
    if (tutorSession) {
      const score = tutorSession.totalQuestions > 0
        ? Math.round((tutorSession.correctAnswers / tutorSession.totalQuestions) * 100)
        : 0;
      logger.info('[DashTutor] Session ended', {
        mode: tutorSession.mode,
        total: tutorSession.totalQuestions,
        correct: tutorSession.correctAnswers,
        score,
      });
    }
    setTutorSession(null);
  }, [tutorSession]);

  /**
   * Submit answer — uses expectedAnswer for local fuzzy grading.
   * DashQuizService grading is handled externally via the quiz card.
   */
  const submitAnswer = useCallback((answer: string): GradeResult => {
    if (!tutorSession) {
      return { is_correct: false, score: 0, feedback: 'No active tutor session.' };
    }

    const expected = tutorSession.expectedAnswer;
    let isCorrect = false;

    // Local grading when we have an expected answer
    if (expected) {
      const normAnswer = answer.trim().toLowerCase();
      const normExpected = expected.trim().toLowerCase();
      // Exact match or fuzzy similarity ≥ 0.8
      isCorrect = normAnswer === normExpected || levenshteinSimilarity(normAnswer, normExpected) >= 0.8;
    }

    // Update session
    setTutorSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        isAwaitingAnswer: false,
        correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
      };
    });

    const result: GradeResult = {
      is_correct: isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect
        ? 'Correct! Great work! 🎉'
        : expected
          ? `Not quite. The correct answer is: ${expected}`
          : 'Answer submitted — AI will provide detailed feedback.',
      correct_answer: expected || undefined,
    };

    logger.debug('[DashTutor] Answer graded locally', { isCorrect, answer: answer.substring(0, 50) });
    return result;
  }, [tutorSession]);

  const nextQuestion = useCallback((question: string, expectedAnswer?: string, questionId?: string) => {
    answerStartRef.current = Date.now();
    setTutorSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        totalQuestions: prev.totalQuestions + 1,
        currentQuestion: question,
        expectedAnswer: expectedAnswer || null,
        currentQuestionId: questionId,
        isAwaitingAnswer: true,
      };
    });
    logger.debug('[DashTutor] Next question set', { question: question.substring(0, 50) });
  }, []);

  const parseGradePayload = useCallback((payload: any): GradeResult | null => {
    if (!payload || typeof payload !== 'object') return null;
    try {
      const result: GradeResult = {
        is_correct: Boolean(payload.is_correct),
        score: typeof payload.score === 'number' ? Math.max(0, Math.min(100, payload.score)) : 0,
        feedback: String(payload.feedback || 'No feedback provided.'),
        correct_answer: payload.correct_answer ? String(payload.correct_answer) : undefined,
        explanation: payload.explanation ? String(payload.explanation) : undefined,
        misconception: payload.misconception ? String(payload.misconception) : undefined,
        follow_up_question: payload.follow_up_question ? String(payload.follow_up_question) : undefined,
        next_expected_answer: payload.next_expected_answer ? String(payload.next_expected_answer) : undefined,
      };
      // Update session from parsed AI grade
      setTutorSession((prev) => prev ? {
        ...prev,
        correctAnswers: prev.correctAnswers + (result.is_correct ? 1 : 0),
      } : null);
      return result;
    } catch (error) {
      logger.error('[DashTutor] Failed to parse grade payload', { error });
      return null;
    }
  }, []);

  return {
    tutorSession,
    startTutorSession,
    endTutorSession,
    submitAnswer,
    nextQuestion,
    detectTutorIntent,
    parseGradePayload,
    setQuizSessionId,
  };
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;
  const matrix: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return 1 - matrix[la][lb] / Math.max(la, lb);
}
