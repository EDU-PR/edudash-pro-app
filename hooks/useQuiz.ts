/**
 * useQuiz — React Query hook for quiz sessions
 *
 * Provides quiz generation, session management, answer submission,
 * and progress tracking via DashQuizService.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashQuizService } from '@/services/dash-ai/DashQuizService';
import type {
  QuizConfig,
  QuizGenerationResult,
  AnswerResult,
  SessionResult,
  LearningProgress,
  Achievement,
  ReviewSchedule,
} from '@/lib/types/quiz';

// ============================================
// Query keys
// ============================================

export const quizKeys = {
  all: ['quiz'] as const,
  progress: (userId: string) => [...quizKeys.all, 'progress', userId] as const,
  progressBySubject: (userId: string, subject: string) =>
    [...quizKeys.progress(userId), subject] as const,
  achievements: (userId: string) => [...quizKeys.all, 'achievements', userId] as const,
  reviews: (userId: string) => [...quizKeys.all, 'reviews', userId] as const,
  session: (sessionId: string) => [...quizKeys.all, 'session', sessionId] as const,
} as const;

// ============================================
// Hook
// ============================================

export function useQuiz(userId: string | undefined, organizationId: string | null = null) {
  const queryClient = useQueryClient();

  // -- Learning progress --
  const {
    data: progress = [],
    isLoading: isProgressLoading,
  } = useQuery<LearningProgress[]>({
    queryKey: quizKeys.progress(userId ?? ''),
    queryFn: () => DashQuizService.getLearningProgress(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });

  // -- Achievements --
  const {
    data: achievements = [],
    isLoading: isAchievementsLoading,
  } = useQuery<Achievement[]>({
    queryKey: quizKeys.achievements(userId ?? ''),
    queryFn: () => DashQuizService.getUserAchievements(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });

  // -- Due reviews --
  const {
    data: dueReviews = [],
    isLoading: isReviewsLoading,
  } = useQuery<ReviewSchedule[]>({
    queryKey: quizKeys.reviews(userId ?? ''),
    queryFn: () => DashQuizService.getDueReviews(userId!),
    enabled: !!userId,
    staleTime: 120_000,
  });

  // -- Generate quiz --
  const generateQuizMutation = useMutation<QuizGenerationResult, Error, QuizConfig>({
    mutationFn: (config) =>
      DashQuizService.generateQuiz(userId!, organizationId, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.progress(userId ?? '') });
    },
  });

  // -- Start review session --
  const startReviewMutation = useMutation<QuizGenerationResult, Error, QuizConfig>({
    mutationFn: (config) =>
      DashQuizService.startReviewSession(userId!, organizationId, config),
  });

  // -- Submit answer --
  const submitAnswerMutation = useMutation<
    AnswerResult,
    Error,
    {
      sessionId: string;
      questionId: string;
      userAnswer: string;
      hintsUsed?: number;
      timeTakenSeconds?: number;
    }
  >({
    mutationFn: ({ sessionId, questionId, userAnswer, hintsUsed, timeTakenSeconds }) =>
      DashQuizService.submitAnswer(sessionId, questionId, userAnswer, hintsUsed, timeTakenSeconds),
  });

  // -- Complete session --
  const completeSessionMutation = useMutation<SessionResult, Error, string>({
    mutationFn: (sessionId) => DashQuizService.completeSession(sessionId, userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.progress(userId ?? '') });
      queryClient.invalidateQueries({ queryKey: quizKeys.achievements(userId ?? '') });
      queryClient.invalidateQueries({ queryKey: quizKeys.reviews(userId ?? '') });
    },
  });

  return {
    // Data
    progress,
    achievements,
    dueReviews,

    // Loading states
    isProgressLoading,
    isAchievementsLoading,
    isReviewsLoading,

    // Mutations
    generateQuiz: generateQuizMutation.mutateAsync,
    isGenerating: generateQuizMutation.isPending,
    generationError: generateQuizMutation.error,

    startReview: startReviewMutation.mutateAsync,
    isStartingReview: startReviewMutation.isPending,

    submitAnswer: submitAnswerMutation.mutateAsync,
    isSubmitting: submitAnswerMutation.isPending,
    lastAnswer: submitAnswerMutation.data ?? null,

    completeSession: completeSessionMutation.mutateAsync,
    isCompleting: completeSessionMutation.isPending,
    sessionResult: completeSessionMutation.data ?? null,
  };
}
