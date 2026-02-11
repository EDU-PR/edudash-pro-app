/**
 * Dispatch Setters
 *
 * Wraps useReducer dispatch into memoised setter callbacks so the rest of the
 * hook family can call e.g. `setInputText('hello')` instead of
 * `dispatch({ type: 'SET_INPUT', text: 'hello' })`.
 *
 * @module hooks/dash-assistant/useDispatchSetters
 * @max-lines 200
 */

import { useCallback, type Dispatch } from 'react';
import type {
  DashAction,
  DashAssistantState,
  AlertState,
  ChatPrefs,
} from './state';
import type { DashMessage, DashConversation } from '@/services/dash-ai/types';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import type { TutorSession } from './tutorTypes';
import type { LearnerContext } from '@/lib/dash-ai/learnerContext';
import type { SharedRefs } from './types';

export function useDispatchSetters(
  dispatch: Dispatch<DashAction>,
  refs: Pick<SharedRefs, 'messagesRef' | 'streamingMessageIdRef'>,
) {
  const setMessages = useCallback(
    (v: DashMessage[] | ((prev: DashMessage[]) => DashMessage[])) => {
      const resolved = typeof v === 'function' ? v(refs.messagesRef.current) : v;
      dispatch({ type: 'SET_MESSAGES', messages: resolved });
    },
    [dispatch, refs],
  );

  const setInputText = useCallback(
    (text: string) => dispatch({ type: 'SET_INPUT', text }),
    [dispatch],
  );

  const setIsLoading = useCallback(
    (isLoading: boolean, status?: DashAssistantState['loadingStatus']) =>
      dispatch({ type: 'SET_LOADING', isLoading, status }),
    [dispatch],
  );

  const setLoadingStatus = useCallback(
    (status: DashAssistantState['loadingStatus']) =>
      dispatch({ type: 'SET_LOADING', isLoading: true, status }),
    [dispatch],
  );

  const setStatusStartTime = useCallback((_v: number) => {
    // statusStartTime is set via SET_LOADING — no-op setter for compat
  }, []);

  const setStreamingMessageId = useCallback(
    (messageId: string | null) => dispatch({ type: 'SET_STREAMING', messageId }),
    [dispatch],
  );

  const setStreamingContent = useCallback(
    (content: string) =>
      dispatch({
        type: 'SET_STREAMING',
        messageId: refs.streamingMessageIdRef.current,
        content,
      }),
    [dispatch, refs],
  );

  const setConversation = useCallback(
    (conversation: DashConversation | null) =>
      dispatch({ type: 'SET_CONVERSATION', conversation }),
    [dispatch],
  );

  const setDashInstance = useCallback(
    (instance: IDashAIAssistant | null, initialized?: boolean) =>
      dispatch({ type: 'SET_INSTANCE', instance, initialized }),
    [dispatch],
  );

  const setIsInitialized = useCallback(
    (v: boolean) => dispatch({ type: 'SET_INSTANCE', initialized: v }),
    [dispatch],
  );

  const setEnterToSend = useCallback(
    (v: boolean) => dispatch({ type: 'SET_CHAT_PREFS', prefs: { enterToSend: v } }),
    [dispatch],
  );

  const setVoiceEnabled = useCallback(
    (v: boolean) => dispatch({ type: 'SET_CHAT_PREFS', prefs: { voiceEnabled: v } }),
    [dispatch],
  );

  const setAutoSpeakResponses = useCallback(
    (v: boolean) => dispatch({ type: 'SET_CHAT_PREFS', prefs: { autoSpeakResponses: v } }),
    [dispatch],
  );

  const setIsSpeaking = useCallback(
    (isSpeaking: boolean, messageId?: string | null) =>
      dispatch({ type: 'SET_SPEAKING', isSpeaking, messageId }),
    [dispatch],
  );

  const setSpeakingMessageId = useCallback(
    (id: string | null) => dispatch({ type: 'SET_SPEAKING', isSpeaking: !!id, messageId: id }),
    [dispatch],
  );

  const setIsRecording = useCallback(
    (isRecording: boolean, transcript?: string) =>
      dispatch({ type: 'SET_RECORDING', isRecording, transcript }),
    [dispatch],
  );

  const setPartialTranscript = useCallback(
    (transcript: string) => dispatch({ type: 'SET_RECORDING', isRecording: true, transcript }),
    [dispatch],
  );

  const setShowTypingIndicator = useCallback(
    (v: boolean) =>
      dispatch({ type: 'SET_CHAT_PREFS', prefs: { showTypingIndicator: v } }),
    [dispatch],
  );

  const setAutoSuggestQuestions = useCallback(
    (v: boolean) =>
      dispatch({ type: 'SET_CHAT_PREFS', prefs: { autoSuggestQuestions: v } }),
    [dispatch],
  );

  const setContextualHelp = useCallback(
    (v: boolean) => dispatch({ type: 'SET_CHAT_PREFS', prefs: { contextualHelp: v } }),
    [dispatch],
  );

  const setStreamingEnabledPref = useCallback(
    (v: boolean) =>
      dispatch({ type: 'SET_CHAT_PREFS', prefs: { streamingEnabledPref: v } }),
    [dispatch],
  );

  const setIsNearBottom = useCallback(
    (value: boolean) => dispatch({ type: 'SET_NEAR_BOTTOM', value }),
    [dispatch],
  );

  const setUnreadCount = useCallback(
    (count: number) => dispatch({ type: 'SET_UNREAD', count }),
    [dispatch],
  );

  const setTutorSession = useCallback(
    (session: TutorSession | null | ((prev: TutorSession | null) => TutorSession | null)) => {
      if (typeof session === 'function') {
        // For functional updates — the reducer doesn't support this natively,
        // but we can read via ref from the caller. For now we accept direct values only.
        // The orchestrator must resolve the function before calling.
        dispatch({ type: 'SET_TUTOR_SESSION', session: null });
      } else {
        dispatch({ type: 'SET_TUTOR_SESSION', session });
      }
    },
    [dispatch],
  );

  const setModelPrefLoaded = useCallback(
    (loaded: boolean) => dispatch({ type: 'SET_MODEL_PREF_LOADED', loaded }),
    [dispatch],
  );

  const setActiveChildId = useCallback(
    (id: string | null) => dispatch({ type: 'SET_ACTIVE_CHILD', id }),
    [dispatch],
  );

  const setLearnerContext = useCallback(
    (context: LearnerContext | null) =>
      dispatch({ type: 'SET_LEARNER_CONTEXT', context }),
    [dispatch],
  );

  const setVoiceBudgetRemainingMs = useCallback(
    (ms: number | null) => dispatch({ type: 'SET_VOICE_BUDGET', ms }),
    [dispatch],
  );

  const setAlertState = useCallback(
    (alert: AlertState) => dispatch({ type: 'SET_ALERT', alert }),
    [dispatch],
  );

  const showAlert = useCallback(
    (config: Omit<AlertState, 'visible'>) =>
      dispatch({ type: 'SET_ALERT', alert: { ...config, visible: true } }),
    [dispatch],
  );

  const hideAlert = useCallback(
    () => dispatch({ type: 'HIDE_ALERT' }),
    [dispatch],
  );

  return {
    setMessages,
    setInputText,
    setIsLoading,
    setLoadingStatus,
    setStatusStartTime,
    setStreamingMessageId,
    setStreamingContent,
    setConversation,
    setDashInstance,
    setIsInitialized,
    setEnterToSend,
    setVoiceEnabled,
    setAutoSpeakResponses,
    setIsSpeaking,
    setSpeakingMessageId,
    setIsRecording,
    setPartialTranscript,
    setShowTypingIndicator,
    setAutoSuggestQuestions,
    setContextualHelp,
    setStreamingEnabledPref,
    setIsNearBottom,
    setUnreadCount,
    setTutorSession,
    setModelPrefLoaded,
    setActiveChildId,
    setLearnerContext,
    setVoiceBudgetRemainingMs,
    setAlertState,
    showAlert,
    hideAlert,
  };
}
