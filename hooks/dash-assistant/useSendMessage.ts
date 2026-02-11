/**
 * useSendMessage
 *
 * The core message-sending callback for the Dash AI assistant.
 * Handles attachments, tutor logic, streaming, auto-tool execution,
 * dashboard actions, and post-response processing.
 *
 * @module hooks/dash-assistant/useSendMessage
 * @max-lines 500
 */

import { useCallback, type MutableRefObject } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import type { DashMessage, DashAttachment, DashConversation } from '@/services/dash-ai/types';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import type { AIModelId } from '@/lib/ai/models';
import { checkAIQuota, showQuotaExceededAlert } from '@/lib/ai/guards';
import { assertSupabase } from '@/lib/supabase';
import type { TutorSession, TutorMode } from './tutorTypes';
import type { LearnerContext } from '@/lib/dash-ai/learnerContext';
import type { SharedRefs } from './types';
import {
  buildAttachmentContextInternal,
  buildDashContextOverride,
  prepareAttachmentsForAI,
  sanitizeTutorUserContent,
  wantsLessonGenerator,
} from './assistantHelpers';
import {
  detectPhonicsTutorRequest,
  detectTutorIntent,
  extractLearningContext,
  getInitialPhonicsStage,
  getMaxQuestions,
  buildTutorSystemContext,
  parseTutorPayload,
  buildFallbackTutorEvaluation,
  nextPhonicsStage,
  isTutorStopIntent,
  getTutorPhaseLabel,
} from './tutorUtils';
import { shouldCelebrate } from '@/lib/dash-ai/promptBuilder';
import {
  processTutorStartResponse,
  processTutorEvaluateResponse,
  processTutorFallback,
  validateTutorResponse,
} from './sendMessageHelpers';

interface UseSendMessageParams {
  dashInstance: IDashAIAssistant | null;
  conversation: DashConversation | null;
  profile: any;
  user: any;
  tier: string | undefined;
  learnerContext: LearnerContext | null;
  activeChildId: string | null;
  refs: SharedRefs;
  selectedModel: AIModelId;
  streamingEnabledPref: boolean;
  capsReady: boolean;
  canInteractiveLessons: boolean;
  autoSpeakResponses: boolean;
  voiceEnabled: boolean;
  messages: DashMessage[];
  setters: {
    setMessages: (v: DashMessage[] | ((prev: DashMessage[]) => DashMessage[])) => void;
    setIsLoading: (l: boolean, s?: any) => void;
    setLoadingStatus: (s: any) => void;
    setStatusStartTime: (t: number) => void;
    setStreamingMessageId: (id: string | null) => void;
    setStreamingContent: (c: string) => void;
    setConversation: (c: DashConversation | null) => void;
    setTutorSession: (s: TutorSession | null | ((prev: TutorSession | null) => TutorSession | null)) => void;
    showAlert: (config: any) => void;
  };
  scrollToBottom: (opts?: { animated?: boolean; delay?: number }) => void;
  speakResponse: (message: DashMessage) => Promise<void>;
  resolveActiveConversationId: () => string | null;
  dashAttachments: {
    uploadAttachments: (attachments: DashAttachment[], conversationId: string) => Promise<DashAttachment[]>;
  };
  toolExecution: {
    tryAutoTool: (text: string) => Promise<{ context: string; message: DashMessage } | null>;
  };
  persistence: {
    persistConversationSnapshot: (conv?: DashConversation | null) => Promise<void>;
    normalizeConversationMessages: (items: DashMessage[]) => DashMessage[];
  };
  setLayout: (layout: string) => void;
}

export function useSendMessage(params: UseSendMessageParams) {
  const {
    dashInstance, conversation, profile, user, tier, learnerContext,
    activeChildId, refs, selectedModel, streamingEnabledPref,
    capsReady, canInteractiveLessons, autoSpeakResponses, voiceEnabled,
    messages,
    setters, scrollToBottom, speakResponse, resolveActiveConversationId,
    dashAttachments, toolExecution, persistence, setLayout,
  } = params;

  const logTutorAttempt = useCallback(async (
    session: TutorSession, payload: any, learnerAnswer: string,
  ) => {
    if (!user?.id) return;
    try {
      const studentId = profile?.role === 'parent' ? activeChildId : null;
      await (assertSupabase() as any).from('dash_ai_tutor_attempts').insert({
        user_id: user.id,
        student_id: studentId,
        session_id: session.id,
        mode: session.mode,
        subject: payload.subject || session.subject || null,
        grade: payload.grade || session.grade || null,
        topic: payload.topic || session.topic || null,
        question: session.currentQuestion || null,
        expected_answer: session.expectedAnswer || null,
        learner_answer: learnerAnswer,
        is_correct: payload.is_correct ?? null,
        score: typeof payload.score === 'number' ? payload.score : null,
        feedback: payload.feedback || null,
        correct_answer: payload.correct_answer || null,
        metadata: {
          explanation: payload.explanation || null,
          misconception: payload.misconception || null,
        },
      });
    } catch (error) {
      console.warn('[useSendMessage] Failed to log tutor attempt:', error);
    }
  }, [user?.id, profile?.role, activeChildId]);

  const sendMessageInternal = useCallback(async (text: string, attachments: DashAttachment[]) => {
    if (!dashInstance) return;
    try {
      setters.setIsLoading(true);
      scrollToBottom({ animated: true, delay: 120 });
      setters.setLoadingStatus(attachments.length > 0 ? 'uploading' : 'thinking');
      setters.setStatusStartTime(Date.now());

      let conversationIdForUpload = resolveActiveConversationId();
      if (!conversationIdForUpload) {
        const createdId = await dashInstance.startNewConversation('Chat with Dash');
        dashInstance.setCurrentConversationId?.(createdId);
        conversationIdForUpload = createdId;
        const createdConversation = await dashInstance.getConversation(createdId);
        if (createdConversation) {
          setters.setConversation(createdConversation);
          persistence.persistConversationSnapshot(createdConversation).catch(() => {});
        }
      }

      const uploadedAttachments = await dashAttachments.uploadAttachments(attachments, conversationIdForUpload);
      const hasAttachmentPayload = uploadedAttachments.length > 0 || attachments.length > 0;
      setters.setLoadingStatus(hasAttachmentPayload ? 'analyzing' : 'thinking');
      setters.setStatusStartTime(Date.now());
      scrollToBottom({ animated: true, delay: 120 });

      const userText = text || 'Attached files';
      let outgoingText = userText;
      let displayText = userText;
      let tutorAction: 'start' | 'evaluate' | null = null;
      let tutorModeForMetadata: TutorMode | null = null;
      let tutorContextOverride: string | null = null;
      let sessionForTutorAction: TutorSession | null = null;

      // Build context
      const baseContextOverride = buildDashContextOverride({
        learner: refs.learnerContextRef.current || learnerContext,
        messages,
      });
      const attachmentContextOverride = buildAttachmentContextInternal(uploadedAttachments);
      const messageHistory = messages.map(msg => ({
        role: msg.type === 'task_result' ? 'assistant' : msg.type,
        content: msg.content || '',
      }));
      const needsCelebration = shouldCelebrate(messageHistory);
      const isFirstMessage = messages.length === 0;
      let celebrationHint = '';
      if (needsCelebration && !isFirstMessage) {
        celebrationHint = '\n\n[HINT: The learner just showed understanding or made progress. Celebrate this! Use encouraging phrases like "Great job!", "You got it!", "Nice work!"]';
      }

      // Tutor intent detection
      const activeSession = refs.tutorSessionRef.current;
      const normalizedRole = String(profile?.role || '').toLowerCase();
      const isLearnerRole = ['parent', 'student', 'learner'].includes(normalizedRole);
      const phonicsRequested = isLearnerRole && detectPhonicsTutorRequest(userText);
      const hasLearningAttachment = attachments.some(a => a.kind === 'image' || a.kind === 'document');
      const stopTutor = isTutorStopIntent(userText);
      if (stopTutor && activeSession) dispatch_setTutorSession(null);

      let tutorIntent = isLearnerRole ? detectTutorIntent(userText) : null;
      if (!tutorIntent && isLearnerRole && hasLearningAttachment) tutorIntent = 'diagnostic';

      if (activeSession?.awaitingAnswer && !stopTutor) {
        tutorAction = 'evaluate';
        tutorModeForMetadata = activeSession.mode;
        sessionForTutorAction = activeSession;
        tutorContextOverride = buildTutorSystemContext(activeSession, {
          phase: 'evaluate',
          learnerContext: refs.learnerContextRef.current || learnerContext,
        });
      } else if (tutorIntent && !stopTutor) {
        const context = extractLearningContext(userText, refs.learnerContextRef.current || learnerContext);
        const newSession: TutorSession = {
          id: `tutor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          mode: tutorIntent,
          subject: context.subject,
          grade: context.grade,
          topic: context.topic,
          awaitingAnswer: false,
          currentQuestion: null,
          expectedAnswer: null,
          questionIndex: 0,
          totalQuestions: 0,
          correctCount: 0,
          maxQuestions: getMaxQuestions(tutorIntent),
          difficulty: 1,
          incorrectStreak: 0,
          correctStreak: 0,
          attemptsOnQuestion: 0,
          phonicsMode: phonicsRequested,
          phonicsStage: phonicsRequested ? getInitialPhonicsStage(userText) : null,
          phonicsMastered: [],
        };
        dispatch_setTutorSession(newSession);
        tutorAction = 'start';
        tutorModeForMetadata = newSession.mode;
        sessionForTutorAction = newSession;
        tutorContextOverride = buildTutorSystemContext(newSession, {
          phase: 'start',
          learnerContext: refs.learnerContextRef.current || learnerContext,
        });
      }

      // Auto-tool
      let autoToolContext: string | null = null;
      const autoResult = await toolExecution.tryAutoTool(outgoingText);
      if (autoResult) {
        setters.setMessages(prev => [...prev, autoResult.message]);
        autoToolContext = autoResult.context;
      }

      const mergedContextOverride = [
        baseContextOverride, tutorContextOverride, attachmentContextOverride, celebrationHint,
        autoToolContext ? `TOOL RESULT:\n${autoToolContext}` : null,
      ].filter(Boolean).join('\n\n') || null;

      const aiAttachments = await prepareAttachmentsForAI(uploadedAttachments);
      const localUserMessage: DashMessage = {
        id: `local_user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'user',
        content: displayText,
        timestamp: Date.now(),
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      };
      setters.setMessages(prev => [...prev, localUserMessage]);

      // Streaming
      const envStreamingEnabled =
        process.env.EXPO_PUBLIC_AI_STREAMING_ENABLED === 'true' ||
        process.env.EXPO_PUBLIC_ENABLE_AI_STREAMING === 'true';
      const streamingEnabled = streamingEnabledPref || envStreamingEnabled || true;
      let response: DashMessage;

      if (streamingEnabled) {
        const tempStreamingMsgId = `streaming_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setters.setStreamingMessageId(tempStreamingMsgId);
        setters.setStreamingContent('');
        let accumulatedContent = '';
        setters.setMessages(prev => [...prev, { id: tempStreamingMsgId, type: 'assistant', content: '', timestamp: Date.now() }]);

        response = await dashInstance.sendMessage(
          outgoingText, undefined,
          aiAttachments.length > 0 ? aiAttachments : undefined,
          (chunk: string) => {
            accumulatedContent += chunk;
            const newContent = accumulatedContent;
            setters.setStreamingContent(newContent);
            setters.setMessages(prevMessages =>
              prevMessages.map(msg => msg.id === tempStreamingMsgId ? { ...msg, content: newContent } : msg),
            );
            scrollToBottom({ animated: true, delay: 60 });
          },
          { contextOverride: mergedContextOverride, modelOverride: selectedModel },
        );
        setters.setStreamingMessageId(null);
        setters.setStreamingContent('');
        setters.setMessages(prev => prev.filter(msg => msg.id !== tempStreamingMsgId));
      } else {
        response = await dashInstance.sendMessage(
          outgoingText, undefined,
          aiAttachments.length > 0 ? aiAttachments : undefined,
          undefined,
          { contextOverride: mergedContextOverride, modelOverride: selectedModel },
        );
      }

      // Validate & process tutor
      response = validateTutorResponse(response, tutorAction);
      const rawTutorPayload = parseTutorPayload(response?.content || '');
      const hasTutorQuestion = !!rawTutorPayload?.question;
      const hasTutorEvaluation = typeof rawTutorPayload?.is_correct === 'boolean' || !!rawTutorPayload?.feedback || !!rawTutorPayload?.follow_up_question;
      let tutorPayload = (tutorAction === 'start' && !hasTutorQuestion) || (tutorAction === 'evaluate' && !hasTutorEvaluation) ? null : rawTutorPayload;
      if (!tutorPayload && tutorAction === 'evaluate' && sessionForTutorAction) {
        tutorPayload = buildFallbackTutorEvaluation(sessionForTutorAction, userText);
      }

      if (tutorPayload && tutorAction === 'start' && tutorPayload.question) {
        const result = processTutorStartResponse(response, tutorPayload, tutorModeForMetadata as string | null, refs.tutorOverridesRef);
        if (result) {
          response = result.response;
          const needsContext = tutorPayload.next_step === 'need_context';
          dispatch_setTutorSession_fn(prev => {
            if (!prev) return prev;
            return { ...prev, ...result.sessionPatch, questionIndex: needsContext ? prev.questionIndex : prev.questionIndex + 1 };
          });
        }
      } else if (tutorPayload && tutorAction === 'evaluate' && activeSession) {
        const evalResult = processTutorEvaluateResponse(response, tutorPayload, userText, activeSession, tutorModeForMetadata as string | null, refs.tutorOverridesRef);
        response = evalResult.response;
        await logTutorAttempt(activeSession, evalResult.adjustedPayload, userText);
        dispatch_setTutorSession_fn(prev => {
          if (!prev) return prev;
          const totalQuestions = prev.totalQuestions + 1;
          const correctCount = prev.correctCount + (evalResult.isCorrect ? 1 : 0);
          const followUp = evalResult.adjustedPayload.follow_up_question || null;
          const followExpected = evalResult.adjustedPayload.next_expected_answer || null;
          const completed = totalQuestions >= prev.maxQuestions && !followUp;
          let nextDifficulty = prev.difficulty || 1;
          if (!evalResult.isCorrect && evalResult.nextIncorrectStreak >= 2) nextDifficulty = Math.max(1, nextDifficulty - 1);
          else if (evalResult.isCorrect && evalResult.nextCorrectStreak >= 2) nextDifficulty = Math.min(3, nextDifficulty + 1);
          const advancedPhonicsStage = prev.phonicsMode && evalResult.isCorrect && evalResult.nextCorrectStreak >= 2
            ? nextPhonicsStage(prev.phonicsStage || 'letter_sounds')
            : prev.phonicsStage || 'letter_sounds';
          const masteredToken = String(evalResult.adjustedPayload.correct_answer || prev.expectedAnswer || '').trim().toLowerCase();
          const updatedMastered = prev.phonicsMode && evalResult.isCorrect && masteredToken
            ? Array.from(new Set([...(prev.phonicsMastered || []), masteredToken])).slice(-24)
            : prev.phonicsMastered;
          if (completed) {
            const summary: DashMessage = { id: `tutor_summary_${Date.now()}`, type: 'assistant', content: `Session complete! Score: ${correctCount}/${totalQuestions}.\nI logged your performance so we can track progress over time.`, timestamp: Date.now() };
            setters.setMessages(msgs => [...msgs, summary]);
            return null;
          }
          return {
            ...prev, totalQuestions, correctCount, awaitingAnswer: !!followUp,
            currentQuestion: followUp, expectedAnswer: followExpected,
            incorrectStreak: evalResult.nextIncorrectStreak, correctStreak: evalResult.nextCorrectStreak,
            attemptsOnQuestion: evalResult.attemptsOnQuestion, difficulty: nextDifficulty,
            phonicsStage: prev.phonicsMode ? advancedPhonicsStage : prev.phonicsStage,
            phonicsMastered: updatedMastered,
          };
        });
      } else if (!tutorPayload && tutorAction && sessionForTutorAction) {
        response = processTutorFallback(response, sessionForTutorAction, tutorAction, tutorModeForMetadata as string | null, refs.tutorOverridesRef, hasLearningAttachment);
        dispatch_setTutorSession_fn(prev => {
          if (!prev) return prev;
          return { ...prev, awaitingAnswer: true, currentQuestion: response.content, expectedAnswer: null, questionIndex: tutorAction === 'start' ? prev.questionIndex + 1 : prev.questionIndex };
        });
      }

      // Add response
      setters.setMessages(prev => [...prev, response]);
      setters.setLoadingStatus('responding');
      setters.setStatusStartTime(Date.now());
      scrollToBottom({ animated: true, delay: 120 });

      // Dashboard actions
      if (response.metadata?.dashboard_action?.type === 'switch_layout') {
        const newLayout = response.metadata.dashboard_action.layout;
        if (newLayout && (newLayout === 'classic' || newLayout === 'enhanced')) {
          setLayout(newLayout);
          try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
        }
      } else if (response.metadata?.dashboard_action?.type === 'open_screen') {
        const { route, params: routeParams } = response.metadata.dashboard_action as any;
        if (typeof route === 'string' && route.includes('/screens/ai-lesson-generator')) {
          Alert.alert('Open Lesson Generator?', 'Dash suggests opening the AI Lesson Generator with prefilled details.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open', onPress: () => { try { router.push({ pathname: route, params: routeParams } as any); } catch {} } },
          ]);
        } else {
          try { router.push({ pathname: route, params: routeParams } as any); } catch {}
        }
      }

      // Update from server
      const updatedConv = await dashInstance.getConversation(dashInstance.getCurrentConversationId()!);
      if (updatedConv && Array.isArray(updatedConv.messages) && updatedConv.messages.length > 0) {
        const overrideMap = refs.tutorOverridesRef.current;
        const merged = updatedConv.messages.map(msg => {
          const override = overrideMap[msg.id];
          if (override) return { ...msg, content: override };
          if (msg.type === 'user') { const { content, sanitized } = sanitizeTutorUserContent(msg.content); return sanitized ? { ...msg, content } : msg; }
          return msg;
        });
        setters.setMessages(prev => (merged.length >= prev.length ? merged : prev));
        setters.setConversation(updatedConv);
        scrollToBottom({ animated: true, delay: 150 });
        persistence.persistConversationSnapshot(updatedConv).catch(() => {});
      }

      // Lesson generator intent
      try {
        const intentType = response?.metadata?.user_intent?.primary_intent || '';
        const shouldOpen = intentType === 'create_lesson' || wantsLessonGenerator(userText, response?.content);
        if (shouldOpen) {
          if (!capsReady) { Alert.alert('Please wait', 'Loading your subscription details. Try again in a moment.'); return; }
          if (!canInteractiveLessons) {
            Alert.alert('Upgrade Required', 'Interactive lessons and activities are available on Premium or Pro Plus plans.', [
              { text: 'Cancel', style: 'cancel' }, { text: 'View Plans', onPress: () => router.push('/pricing') },
            ]);
            return;
          }
          if (user?.id) {
            const lessonQuota = await checkAIQuota('lesson_generation', user.id, 1);
            if (!lessonQuota.allowed) {
              showQuotaExceededAlert('lesson_generation', lessonQuota.quotaInfo, {
                customMessages: { title: 'Lesson Generation Limit Reached', message: 'You have used all lesson generation credits for this month.' },
              });
              return;
            }
          }
          Alert.alert('Open Lesson Generator?', 'I can open the AI Lesson Generator with the details we discussed.', [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open', onPress: () => dashInstance.openLessonGeneratorFromContext(userText, response?.content || '') },
          ]);
        }
      } catch {}

      if (autoSpeakResponses && voiceEnabled) speakResponse(response);
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = error instanceof Error ? error.message : '';
      setters.showAlert({
        title: 'Error',
        message: errorMessage || 'Failed to send message. Please try again.',
        type: 'error',
        icon: 'alert-circle-outline',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setters.setIsLoading(false);
      setters.setLoadingStatus(null);
    }
  }, [
    dashInstance, conversation, scrollToBottom, speakResponse,
    autoSpeakResponses, voiceEnabled, streamingEnabledPref,
    learnerContext, capsReady, canInteractiveLessons,
    user?.id, profile?.role, tier, selectedModel,
    setters, refs, dashAttachments, toolExecution, persistence,
    logTutorAttempt, setLayout, resolveActiveConversationId, messages,
  ]);

  // We need a way to do functional setTutorSession updates
  // These use the refs directly to resolve prior state
  function dispatch_setTutorSession(session: TutorSession | null) {
    setters.setTutorSession(session);
  }

  function dispatch_setTutorSession_fn(updater: (prev: TutorSession | null) => TutorSession | null) {
    const current = refs.tutorSessionRef.current;
    const next = updater(current);
    setters.setTutorSession(next);
  }

  return { sendMessageInternal };
}
