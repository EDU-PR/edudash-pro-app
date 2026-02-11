/**
 * Send-Message Helpers
 *
 * Pure (side-effect-free) helper functions for tutor processing, dashboard
 * actions, and message enrichment — extracted from the sendMessageInternal
 * mega-callback.
 *
 * @module hooks/dash-assistant/sendMessageHelpers
 * @max-lines 200
 */

import type { DashMessage, DashAttachment } from '@/services/dash-ai/types';
import type { TutorSession } from './tutorTypes';
import type { TutorPayload } from './tutorTypes';
import type { LearnerContext } from '@/lib/dash-ai/learnerContext';
import {
  buildTutorDisplayContent,
  buildFallbackTutorEvaluation,
  reconcileTutorEvaluation,
  applyTutorHints,
  extractTutorQuestionFromText,
  getTutorPhaseLabel,
  parseTutorPayload,
} from './tutorUtils';

// ---------------------------------------------------------------------------
// Tutor start response processing
// ---------------------------------------------------------------------------
export function processTutorStartResponse(
  response: DashMessage,
  tutorPayload: TutorPayload,
  tutorModeForMetadata: string | null,
  tutorOverridesRef: React.MutableRefObject<Record<string, string>>,
): { response: DashMessage; sessionPatch: Partial<TutorSession> } | null {
  if (!tutorPayload.question) return null;
  const displayContent = buildTutorDisplayContent(tutorPayload, true);
  if (!displayContent) return null;

  tutorOverridesRef.current[response.id] = displayContent;
  const patchedResponse: DashMessage = {
    ...response,
    content: displayContent,
    metadata: {
      ...(response.metadata || {}),
      tutor_phase: tutorModeForMetadata
        ? getTutorPhaseLabel(tutorModeForMetadata as any)
        : getTutorPhaseLabel('diagnostic'),
      tutor_question: true,
      tutor_question_text: tutorPayload.question,
    },
  };

  const needsContext = tutorPayload.next_step === 'need_context';
  const sessionPatch: Partial<TutorSession> = {
    subject: tutorPayload.subject || undefined,
    grade: tutorPayload.grade || undefined,
    topic: tutorPayload.topic || undefined,
    difficulty:
      typeof tutorPayload.difficulty === 'number' ? tutorPayload.difficulty : undefined,
    awaitingAnswer: true,
    currentQuestion: tutorPayload.question || undefined,
    expectedAnswer: tutorPayload.expected_answer || undefined,
  };

  return { response: patchedResponse, sessionPatch };
}

// ---------------------------------------------------------------------------
// Tutor evaluate response processing
// ---------------------------------------------------------------------------
export function processTutorEvaluateResponse(
  response: DashMessage,
  rawPayload: TutorPayload,
  userText: string,
  activeSession: TutorSession,
  tutorModeForMetadata: string | null,
  tutorOverridesRef: React.MutableRefObject<Record<string, string>>,
) {
  const basePayload = reconcileTutorEvaluation(rawPayload, userText, activeSession);
  const isCorrect = basePayload.is_correct === true;
  const nextIncorrectStreak = isCorrect ? 0 : (activeSession.incorrectStreak || 0) + 1;
  const nextCorrectStreak = isCorrect ? (activeSession.correctStreak || 0) + 1 : 0;
  const attemptsOnQuestion = isCorrect ? 0 : (activeSession.attemptsOnQuestion || 0) + 1;

  const adjustedPayload = !isCorrect
    ? applyTutorHints(basePayload, {
        session: activeSession,
        incorrectStreak: nextIncorrectStreak,
      })
    : basePayload;

  const displayContent = buildTutorDisplayContent(adjustedPayload, false);
  let patchedResponse = response;
  if (displayContent) {
    tutorOverridesRef.current[response.id] = displayContent;
    patchedResponse = {
      ...response,
      content: displayContent,
      metadata: {
        ...(response.metadata || {}),
        tutor_phase: tutorModeForMetadata
          ? getTutorPhaseLabel(tutorModeForMetadata as any)
          : getTutorPhaseLabel('practice'),
        tutor_question: !!adjustedPayload.follow_up_question,
        tutor_question_text: adjustedPayload.follow_up_question || undefined,
      },
    };
  }

  return {
    response: patchedResponse,
    adjustedPayload,
    isCorrect,
    nextIncorrectStreak,
    nextCorrectStreak,
    attemptsOnQuestion,
  };
}

// ---------------------------------------------------------------------------
// Tutor fallback (no valid payload from AI)
// ---------------------------------------------------------------------------
export function processTutorFallback(
  response: DashMessage,
  sessionForTutorAction: TutorSession,
  tutorAction: 'start' | 'evaluate',
  tutorModeForMetadata: string | null,
  tutorOverridesRef: React.MutableRefObject<Record<string, string>>,
  hasLearningAttachment: boolean,
): DashMessage {
  const fallbackFromResponse = extractTutorQuestionFromText(response?.content || '');
  const fallbackQuestion =
    fallbackFromResponse ||
    (() => {
      if (!sessionForTutorAction.grade) return 'What grade are you in?';
      if (!sessionForTutorAction.subject) return 'Which subject is this?';
      if (hasLearningAttachment) return 'Please type the exact question from the attachment.';
      return 'What exact question do you need help with?';
    })();

  tutorOverridesRef.current[response.id] = fallbackQuestion;
  return {
    ...response,
    content: fallbackQuestion,
    metadata: {
      ...(response.metadata || {}),
      tutor_phase: tutorModeForMetadata
        ? getTutorPhaseLabel(tutorModeForMetadata as any)
        : getTutorPhaseLabel(sessionForTutorAction.mode as any),
      tutor_question: true,
      tutor_question_text: fallbackQuestion,
    },
  };
}

// ---------------------------------------------------------------------------
// Validate payload from AI (prevent prompt leaks)
// ---------------------------------------------------------------------------
export function validateTutorResponse(
  response: DashMessage,
  tutorAction: 'start' | 'evaluate' | null,
): DashMessage {
  if (!tutorAction || !response?.content) return response;
  const promptLeak =
    /return only json|tutor_payload|you are dash, an interactive tutor|tutor mode override/i.test(
      response.content,
    );
  if (promptLeak && !parseTutorPayload(response.content)) {
    return {
      ...response,
      content:
        'I had a hiccup setting up the tutor. Please try again or tell me the topic and grade.',
    };
  }
  return response;
}
