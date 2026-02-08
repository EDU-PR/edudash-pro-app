/**
 * useDashTutorMode Hook
 * 
 * Manages tutor mode (quiz/practice) for Dash AI.
 * Handles question generation, answer grading, and session tracking.
 * 
 * Extracted from useDashAssistant.ts for WARP.md compliance (≤200 lines)
 */

import { useState, useCallback } from 'react';
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
  // State
  tutorSession: TutorSession | null;
  
  // Actions
  startTutorSession: (mode: TutorMode, config?: Partial<TutorSession>) => void;
  endTutorSession: () => void;
  submitAnswer: (answer: string) => GradeResult;
  nextQuestion: (question: string, expectedAnswer?: string) => void;
  
  // Helpers
  detectTutorIntent: (text: string) => TutorMode | null;
  parseGradePayload: (payload: any) => GradeResult | null;
}

export function useDashTutorMode(): UseDashTutorReturn {
  const [tutorSession, setTutorSession] = useState<TutorSession | null>(null);

  /**
   * Detect if user wants tutor mode from their message
   */
  const detectTutorIntent = useCallback((text: string): TutorMode | null => {
    const value = (text || '').toLowerCase();
    if (!value) return null;
    
    // Play mode — preschool interactive play (before formal modes)
    if (/(let.s\s+play|play\s+a\s+game|play\s+with\s+me|fun\s+game|counting\s+game|colour\s+game|shape\s+game|rhyme|story\s+time|animal\s+sound|letter\s+game|silly\s+question)/i.test(value)) return 'play';
    // Only activate tutor mode for EXPLICIT quiz/practice requests
    if (/(quiz\s+me|test\s+me|give\s+me\s+a\s+quiz)/.test(value)) return 'quiz';
    if (/(practice\s+question|drill\s+me)/.test(value)) return 'practice';
    if (/diagnose\s+me|diagnostic\s+test/.test(value)) return 'diagnostic';
    
    return null; // Default: help mode, not quiz mode
  }, []);

  /**
   * Start tutor session
   */
  const startTutorSession = useCallback((mode: TutorMode, config?: Partial<TutorSession>) => {
    const session: TutorSession = {
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
    };
    
    setTutorSession(session);
    logger.info('[DashTutor] Session started', { mode });
  }, []);

  /**
   * End tutor session
   */
  const endTutorSession = useCallback(() => {
    if (tutorSession) {
      logger.info('[DashTutor] Session ended', {
        mode: tutorSession.mode,
        totalQuestions: tutorSession.totalQuestions,
        correctAnswers: tutorSession.correctAnswers,
        score: tutorSession.totalQuestions > 0 
          ? Math.round((tutorSession.correctAnswers / tutorSession.totalQuestions) * 100) 
          : 0,
      });
    }
    setTutorSession(null);
  }, [tutorSession]);

  /**
   * Submit answer and get grading result
   */
  const submitAnswer = useCallback((answer: string): GradeResult => {
    if (!tutorSession) {
      return {
        is_correct: false,
        score: 0,
        feedback: 'No active tutor session.',
      };
    }
    
    // Update session state
    setTutorSession(prev => prev ? {
      ...prev,
      isAwaitingAnswer: false,
    } : null);
    
    // Placeholder - actual grading happens via AI
    return {
      is_correct: false,
      score: 0,
      feedback: 'Answer submitted. Waiting for AI to grade...',
    };
  }, [tutorSession]);

  /**
   * Set next question
   */
  const nextQuestion = useCallback((question: string, expectedAnswer?: string) => {
    setTutorSession(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        totalQuestions: prev.totalQuestions + 1,
        currentQuestion: question,
        expectedAnswer: expectedAnswer || null,
        isAwaitingAnswer: true,
      };
    });
    
    logger.debug('[DashTutor] Next question set', { question: question.substring(0, 50) });
  }, []);

  /**
   * Parse grading payload from AI response
   */
  const parseGradePayload = useCallback((payload: any): GradeResult | null => {
    if (!payload || typeof payload !== 'object') return null;
    
    try {
      // Normalize the grade result
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
      
      // Update session stats
      if (result.is_correct) {
        setTutorSession(prev => prev ? {
          ...prev,
          correctAnswers: prev.correctAnswers + 1,
        } : null);
      }
      
      return result;
    } catch (error) {
      logger.error('[DashTutor] Failed to parse grade payload', { error, payload });
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
  };
}
