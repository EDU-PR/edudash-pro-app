/**
 * useDashAssistantCore — Orchestrator
 *
 * Thin composition layer that wires all sub-hooks together.
 * Business logic lives in the sub-modules — this file only
 * calls them and returns the unified public API.
 *
 * @module hooks/dash-assistant/useDashAssistantCore
 * @max-lines 500
 */

import { useEffect, useRef, useCallback, useMemo, useReducer } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import type { DashMessage, DashConversation, DashAttachment } from '@/services/dash-ai/types';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';
import { checkAIQuota, showQuotaExceededAlert } from '@/lib/ai/guards';
import type { VoiceSession, VoiceProvider } from '@/lib/voice/unifiedProvider';
import { getChatUIPrefs, getVoiceChatPrefs, initAndMigrate } from '@/lib/ai/dashSettings';
import { assertSupabase } from '@/lib/supabase';
import { useCapability } from '@/hooks/useCapability';
import { useDashAttachments } from '@/hooks/useDashAttachments';
import {
  buildAttachmentContextInternal,
  buildDashContextOverride,
  extractFollowUps,
  prepareAttachmentsForAI,
  resolveVoiceLocale,
  sanitizeTutorUserContent,
  wantsLessonGenerator,
} from './assistantHelpers';
import { handleDashVoiceInputPress, speakDashResponse, stopDashVoiceRecording } from './voiceHandlers';
import type { TutorMode, TutorPayload, TutorSession } from './tutorTypes';
import {
  dashReducer,
  INITIAL_STATE,
  type DashAssistantState,
} from './state';
import {
  detectPhonicsTutorRequest,
  detectTutorIntent,
  extractLearningContext,
  getInitialPhonicsStage,
  getMaxQuestions,
  buildTutorSystemContext,
  parseTutorPayload,
  nextPhonicsStage,
  isTutorStopIntent,
} from './tutorUtils';
import { shouldCelebrate } from '@/lib/dash-ai/promptBuilder';
import { getConversationSnapshot, getLastActiveConversationId } from '@/services/conversationPersistence';
import { getCapabilityTier, normalizeTierName } from '@/lib/tiers';

// Sub-hooks
import type {
  UseDashAssistantOptions,
  UseDashAssistantReturn,
  SharedRefs,
  DASH_AI_SERVICE_TYPE as _unused,
} from './types';
import { DASH_AI_SERVICE_TYPE } from './types';
import { useDispatchSetters } from './useDispatchSetters';
import { useConversationPersistence } from './useConversationPersistence';
import { useVoiceBudget } from './useVoiceBudget';
import { useModelSelection } from './useModelSelection';
import { useLearnerContext } from './useLearnerContext';
import { useToolExecution } from './useToolExecution';
import { useScrollAndEffects } from './useScrollAndEffects';
import {
  processTutorStartResponse,
  processTutorEvaluateResponse,
  processTutorFallback,
  validateTutorResponse,
} from './sendMessageHelpers';
import { useSendMessage } from './useSendMessage';

export function useDashAssistant(options: UseDashAssistantOptions): UseDashAssistantReturn {
  const { conversationId, initialMessage, handoffSource, onClose } = options;
  const { setLayout } = useDashboardPreferences();
  const { tier, ready: subReady, refresh: refreshTier } = useSubscription();
  const { user, profile } = useAuth();
  const { can, ready: capsReady } = useCapability();

  // ── Reducer ──
  const [state, dispatch] = useReducer(dashReducer, INITIAL_STATE);
  const {
    messages, inputText, isLoading, loadingStatus, statusStartTime,
    streamingMessageId, streamingContent, conversation, dashInstance,
    isInitialized, isSpeaking, speakingMessageId, isRecording,
    partialTranscript, isNearBottom, unreadCount, tutorSession,
    modelPrefLoaded, activeChildId, learnerContext, voiceBudgetRemainingMs,
    alertState, chatPrefs,
  } = state;

  const {
    enterToSend, voiceEnabled, autoSpeakResponses,
    showTypingIndicator, autoSuggestQuestions, contextualHelp,
    streamingEnabledPref,
  } = chatPrefs;

  // ── Refs ──
  const flashListRef = useRef<any>(null);
  const inputRef = useRef<any>(null);
  const voiceSessionRef = useRef<VoiceSession | null>(null);
  const voiceProviderRef = useRef<VoiceProvider | null>(null);
  const voiceInputStartAtRef = useRef<number | null>(null);
  const lastSpeakStartRef = useRef<number>(0);
  const ttsSessionIdRef = useRef<string | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestQueueRef = useRef<Array<{ text: string; attachments: DashAttachment[] }>>([]);
  const isProcessingRef = useRef(false);
  const prevLengthRef = useRef<number>(0);
  const messagesLengthRef = useRef<number>(0);
  const isSpeakingStateRef = useRef<boolean>(false);
  const tutorSessionRef = useRef<TutorSession | null>(null);
  const tutorOverridesRef = useRef<Record<string, string>>({});
  const learnerContextRef = useRef<LearnerContext | null>(null);
  const messagesRef = useRef<DashMessage[]>([]);
  const streamingMessageIdRef = useRef<string | null>(null);

  // Keep refs in sync
  messagesRef.current = messages;
  streamingMessageIdRef.current = streamingMessageId;
  useEffect(() => { tutorSessionRef.current = tutorSession; }, [tutorSession]);
  useEffect(() => { learnerContextRef.current = learnerContext; }, [learnerContext]);

  const refs: SharedRefs = {
    flashListRef, inputRef, voiceSessionRef, voiceProviderRef,
    voiceInputStartAtRef, lastSpeakStartRef, ttsSessionIdRef,
    scrollTimeoutRef, requestQueueRef, isProcessingRef,
    prevLengthRef, messagesLengthRef, isSpeakingStateRef,
    tutorSessionRef, tutorOverridesRef, learnerContextRef,
    messagesRef, streamingMessageIdRef,
  };

  // ── Sub-hooks ──
  const setters = useDispatchSetters(dispatch, refs);
  const isSuperAdmin = ['superadmin', 'super_admin'].includes((profile?.role || '').toLowerCase());
  const capabilityTier = useMemo(
    () => getCapabilityTier(normalizeTierName(String(tier || 'free'))),
    [tier],
  );
  const isFreeTier = subReady ? capabilityTier === 'free' : false;
  const canInteractiveLessons = capsReady ? can('lessons.interactive') : false;
  const canUseImages = capsReady ? can('multimodal.vision') : true;
  const canUseDocuments = capsReady ? can('multimodal.documents') : true;

  const { availableModels, selectedModel, setSelectedModel } = useModelSelection(
    isSuperAdmin,
    setters.setModelPrefLoaded,
    modelPrefLoaded,
  );

  const persistence = useConversationPersistence(user?.id);

  const voiceBudgetHook = useVoiceBudget(
    isFreeTier,
    setters.setVoiceBudgetRemainingMs,
    voiceBudgetRemainingMs,
  );

  useLearnerContext({
    dashInstance,
    userId: user?.id,
    profile,
    activeChildId,
    setActiveChildId: setters.setActiveChildId,
    setLearnerContext: setters.setLearnerContext,
  });

  const resolveActiveConversationId = useCallback((): string | null => {
    if (conversation?.id) return conversation.id;
    try {
      const current = dashInstance?.getCurrentConversationId?.();
      if (typeof current === 'string' && current.trim().length > 0) return current;
    } catch {}
    return null;
  }, [conversation?.id, dashInstance]);

  const dashAttachments = useDashAttachments({
    conversation,
    getConversationId: resolveActiveConversationId,
    onShowAlert: setters.showAlert,
    canUseImages,
    canUseDocuments,
    isFreeTier,
  });

  const addAttachments = useCallback((attachments: DashAttachment[]) => {
    if (!Array.isArray(attachments) || attachments.length === 0) return;
    dashAttachments.setSelectedAttachments((prev) => [...prev, ...attachments]);
  }, [dashAttachments]);

  const toolExecution = useToolExecution({
    profile,
    user,
    tier,
    dashInstance,
    setMessages: setters.setMessages,
    showAlert: setters.showAlert,
  });

  // loadChatPrefs — used by scroll effects & init
  const loadChatPrefs = useCallback(async () => {
    try {
      try { await initAndMigrate(); } catch (e) { if (__DEV__) console.warn('[useDashAssistant] migration warn', e); }
      const [voiceChatPrefs, chatUiPrefs] = await Promise.all([
        getVoiceChatPrefs(),
        getChatUIPrefs(),
      ]);
      let streamPref = false;
      try {
        const streamingPrefVal = await AsyncStorage.getItem('@dash_streaming_enabled');
        streamPref = streamingPrefVal === 'true';
      } catch {}
      dispatch({
        type: 'SET_CHAT_PREFS',
        prefs: {
          voiceEnabled: voiceChatPrefs.voiceEnabled ?? true,
          autoSpeakResponses: voiceChatPrefs.autoSpeak ?? true,
          showTypingIndicator: chatUiPrefs.showTypingIndicator ?? true,
          autoSuggestQuestions: chatUiPrefs.autoSuggestQuestions ?? true,
          contextualHelp: chatUiPrefs.contextualHelp ?? true,
          ...(typeof chatUiPrefs.enterToSend === 'boolean'
            ? { enterToSend: chatUiPrefs.enterToSend }
            : {}),
          streamingEnabledPref: streamPref,
        },
      });
    } catch {
      try {
        const enterToSendSetting = await AsyncStorage.getItem('@dash_ai_enter_to_send');
        if (enterToSendSetting !== null) {
          dispatch({ type: 'SET_CHAT_PREFS', prefs: { enterToSend: enterToSendSetting === 'true' } });
        }
      } catch {}
    }
  }, []);

  const { scrollToBottom } = useScrollAndEffects({
    refs,
    messages,
    isInitialized,
    isLoading,
    loadingStatus,
    isNearBottom,
    isSpeaking,
    dashInstance,
    conversation,
    setUnreadCount: setters.setUnreadCount,
    setMessages: setters.setMessages,
    setConversation: setters.setConversation,
    stopSpeaking: async () => {
      if (!dashInstance) return;
      try {
        ttsSessionIdRef.current = null;
        await dashInstance.stopSpeaking();
        setters.setIsSpeaking(false);
        setters.setSpeakingMessageId(null);
      } catch {
        setters.setIsSpeaking(false);
        setters.setSpeakingMessageId(null);
      }
    },
    loadChatPrefs,
    normalizeConversationMessages: persistence.normalizeConversationMessages,
    persistConversationSnapshot: persistence.persistConversationSnapshot,
  });

  // stopSpeaking (stable ref for external use)
  const stopSpeaking = useCallback(async () => {
    if (!dashInstance) return;
    try {
      ttsSessionIdRef.current = null;
      await dashInstance.stopSpeaking();
      setters.setIsSpeaking(false);
      setters.setSpeakingMessageId(null);
    } catch {
      setters.setIsSpeaking(false);
      setters.setSpeakingMessageId(null);
    }
  }, [dashInstance, setters]);

  const speakResponse = useCallback(async (message: DashMessage) => {
    await speakDashResponse({
      message,
      dashInstance,
      voiceEnabled,
      hasTTSAccess: voiceBudgetHook.hasTTSAccess,
      isFreeTier,
      consumeVoiceBudget: voiceBudgetHook.consumeVoiceBudget,
      isSpeaking,
      speakingMessageId,
      voiceRefs: refs,
      setIsSpeaking: setters.setIsSpeaking,
      setSpeakingMessageId: setters.setSpeakingMessageId,
      showAlert: setters.showAlert,
      hideAlert: setters.hideAlert,
      setVoiceEnabled: setters.setVoiceEnabled,
      stopSpeaking,
    });
  }, [dashInstance, speakingMessageId, isSpeaking, voiceBudgetHook, setters, voiceEnabled, stopSpeaking, isFreeTier, refs]);

  // Save conversation ID
  useEffect(() => {
    if (conversation?.id) {
      AsyncStorage.setItem('@dash_ai_current_conversation_id', conversation.id).catch(() => {});
    }
  }, [conversation?.id]);

  // ── Send message ──
  const { sendMessageInternal } = useSendMessage({
    dashInstance, conversation, profile, user, tier, learnerContext,
    activeChildId, refs, selectedModel, streamingEnabledPref,
    capsReady, canInteractiveLessons, autoSpeakResponses, voiceEnabled,
    messages,
    setters, scrollToBottom, speakResponse, resolveActiveConversationId,
    dashAttachments, toolExecution, persistence,
    setLayout,
  });

  // Process queue
  const processQueue = useCallback(async () => {
    if (refs.isProcessingRef.current || refs.requestQueueRef.current.length === 0) return;
    refs.isProcessingRef.current = true;
    const request = refs.requestQueueRef.current.shift();
    if (request) await sendMessageInternal(request.text, request.attachments);
    refs.isProcessingRef.current = false;
    if (refs.requestQueueRef.current.length > 0) setTimeout(() => processQueue(), 0);
  }, [sendMessageInternal, refs]);

  const stopVoiceRecording = useCallback(async () => {
    await stopDashVoiceRecording({
      voiceRefs: refs,
      isFreeTier,
      consumeVoiceBudget: voiceBudgetHook.consumeVoiceBudget,
      setIsRecording: setters.setIsRecording,
      setPartialTranscript: setters.setPartialTranscript,
    });
  }, [voiceBudgetHook.consumeVoiceBudget, isFreeTier, refs, setters]);

  const sendMessage = useCallback(async (text: string = inputText.trim()) => {
    if (isRecording) await stopVoiceRecording();
    if ((!text && dashAttachments.selectedAttachments.length === 0) || !dashInstance) return;
    if (user?.id) {
      try {
        const quotaCheck = await checkAIQuota(DASH_AI_SERVICE_TYPE, user.id, 1);
        if (!quotaCheck.allowed) {
          track('edudash.ai.quota.blocked', {
            service_type: DASH_AI_SERVICE_TYPE,
            quota_used: quotaCheck.quotaInfo?.used,
            quota_limit: quotaCheck.quotaInfo?.limit,
            user_tier: tier || 'free',
            upgrade_shown: true,
          });
          showQuotaExceededAlert(DASH_AI_SERVICE_TYPE, quotaCheck.quotaInfo, {
            customMessages: { title: 'AI Chat Limit Reached', message: "You've used all your AI chat messages for this month." },
          });
          return;
        }
      } catch (quotaError) { console.warn('[useDashAssistant] Quota check failed:', quotaError); }
    }
    if (user?.id && text) {
      try {
        if (wantsLessonGenerator(text)) {
          const lessonQuota = await checkAIQuota('lesson_generation', user.id, 1);
          if (!lessonQuota.allowed) {
            showQuotaExceededAlert('lesson_generation', lessonQuota.quotaInfo, {
              customMessages: { title: 'Lesson Generation Limit Reached', message: 'You have used all lesson generation credits for this month.' },
            });
            return;
          }
        }
      } catch {}
    }
    refs.requestQueueRef.current.push({ text, attachments: [...dashAttachments.selectedAttachments] });
    setters.setInputText('');
    dashAttachments.setSelectedAttachments([]);
    processQueue();
  }, [inputText, dashAttachments, dashInstance, user?.id, tier, processQueue, isRecording, stopVoiceRecording, setters, refs]);

  const sendTutorAnswer = useCallback(async (answer: string, _sourceMessageId?: string) => {
    const trimmed = answer.trim();
    if (!trimmed) return;
    const activeSession = refs.tutorSessionRef.current;
    if (activeSession) {
      track('edudash.ai.tutor.answer', { session_id: activeSession.id, mode: activeSession.mode, source_message_id: _sourceMessageId });
    }
    await sendMessage(trimmed);
  }, [sendMessage, refs]);

  const handleInputMicPress = useCallback(async () => {
    await handleDashVoiceInputPress({
      hasTTSAccess: voiceBudgetHook.hasTTSAccess,
      isRecording,
      stopVoiceRecording,
      tier,
      showAlert: setters.showAlert,
      hideAlert: setters.hideAlert,
      dashInstance,
      preferredLanguage: profile?.preferred_language || null,
      resolveVoiceLocale,
      isFreeTier,
      consumeVoiceBudget: voiceBudgetHook.consumeVoiceBudget,
      setIsRecording: setters.setIsRecording,
      setPartialTranscript: setters.setPartialTranscript,
      setInputText: setters.setInputText,
      voiceRefs: refs,
    });
  }, [voiceBudgetHook, isRecording, stopVoiceRecording, tier, setters, dashInstance, profile?.preferred_language, isFreeTier, refs]);

  const startNewConversation = useCallback(async () => {
    if (!dashInstance) return;
    try {
      const newConvId = await dashInstance.startNewConversation('Chat with Dash');
      const newConv = await dashInstance.getConversation(newConvId);
      if (newConv) {
        setters.setConversation(newConv);
        persistence.persistConversationSnapshot(newConv).catch(() => {});
        setters.setMessages([]);
        setters.setInputText('');
        dashAttachments.setSelectedAttachments([]);
        setters.setStreamingMessageId(null);
        setters.setStreamingContent('');
        setters.setUnreadCount(0);
        setters.setTutorSession(null);
        refs.tutorOverridesRef.current = {};
        if (isRecording) await stopVoiceRecording();
        const greeting: DashMessage = {
          id: `greeting_${Date.now()}`,
          type: 'assistant',
          content: dashInstance.getPersonality().greeting,
          timestamp: Date.now(),
        };
        setters.setMessages([greeting]);
      }
    } catch {
      setters.showAlert({
        title: 'Error',
        message: 'Failed to start new conversation.',
        type: 'error',
        icon: 'alert-circle-outline',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    }
  }, [dashInstance, dashAttachments, isRecording, stopVoiceRecording, setters, persistence, refs]);

  // ── Initialize ──
  useEffect(() => {
    const initializeDash = async () => {
      try {
        const module = await import('@/services/dash-ai/DashAICompat');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash: IDashAIAssistant | null = DashClass?.getInstance?.() || null;
        if (!dash) throw new Error('DashAIAssistant unavailable');
        await dash.initialize();
        setters.setDashInstance(dash);
        setters.setIsInitialized(true);

        const preferOrbHandoff = handoffSource === 'orb' || handoffSource === 'dash_voice_orb';
        let hasExistingMessages = false;

        if (conversationId) {
          const snapshot = await persistence.hydrateFromSnapshot(conversationId);
          if (snapshot) {
            hasExistingMessages = snapshot.messages.length > 0;
            setters.setConversation(snapshot.conversation);
            setters.setMessages(persistence.normalizeConversationMessages(snapshot.messages));
            dash.setCurrentConversationId(conversationId);
          }
          const existingConv = await dash.getConversation(conversationId);
          if (existingConv) {
            hasExistingMessages = (existingConv.messages?.length || 0) > 0;
            setters.setConversation(existingConv);
            setters.setMessages(persistence.normalizeConversationMessages(existingConv.messages || []));
            dash.setCurrentConversationId(conversationId);
            persistence.persistConversationSnapshot(existingConv).catch(() => {});
          } else if (snapshot) {
            dash.setCurrentConversationId(conversationId);
          }
        } else {
          const savedConvId = await AsyncStorage.getItem('@dash_ai_current_conversation_id');
          const lastActiveId = user?.id ? await getLastActiveConversationId(user.id) : null;
          let newConvId = savedConvId || lastActiveId || null;

          if (newConvId) {
            const snapshot = await persistence.hydrateFromSnapshot(newConvId);
            if (snapshot) {
              hasExistingMessages = snapshot.messages.length > 0;
              setters.setConversation(snapshot.conversation);
              setters.setMessages(persistence.normalizeConversationMessages(snapshot.messages));
              dash.setCurrentConversationId(newConvId);
            }
            const existingConv = await dash.getConversation(newConvId);
            if (existingConv) {
              hasExistingMessages = (existingConv.messages?.length || 0) > 0;
              setters.setConversation(existingConv);
              setters.setMessages(persistence.normalizeConversationMessages(existingConv.messages || []));
              dash.setCurrentConversationId(newConvId);
              persistence.persistConversationSnapshot(existingConv).catch(() => {});
            } else if (!snapshot) {
              newConvId = null;
            } else {
              dash.setCurrentConversationId(newConvId);
            }
          }

          if (!newConvId) {
            try {
              const convs = await dash.getAllConversations();
              if (Array.isArray(convs) && convs.length > 0) {
                const latest = convs.reduce((a: any, b: any) => (a.updated_at > b.updated_at ? a : b));
                hasExistingMessages = (latest.messages?.length || 0) > 0;
                setters.setConversation(latest);
                setters.setMessages(persistence.normalizeConversationMessages(latest.messages || []));
                dash.setCurrentConversationId(latest.id);
                persistence.persistConversationSnapshot(latest).catch(() => {});
              } else {
                const createdId = await dash.startNewConversation('Chat with Dash');
                const newConv = await dash.getConversation(createdId);
                if (newConv) { setters.setConversation(newConv); persistence.persistConversationSnapshot(newConv).catch(() => {}); }
              }
            } catch {
              const createdId = await dash.startNewConversation('Chat with Dash');
              const newConv = await dash.getConversation(createdId);
              if (newConv) { setters.setConversation(newConv); persistence.persistConversationSnapshot(newConv).catch(() => {}); }
            }
          }
        }

        await loadChatPrefs();

        // ORB session handoff
        let orbMessagesLoaded = false;
        if ((preferOrbHandoff || !hasExistingMessages) && user?.id) {
          try {
            const legacyProfileId = profile?.id && profile.id !== user.id ? profile.id : null;
            const candidateKeys = [
              `dash:orb-session:${user.id}`,
              legacyProfileId ? `dash:orb-session:${legacyProfileId}` : null,
            ].filter((key): key is string => Boolean(key));

            let orbData: any = null;
            const consumedKeys: string[] = [];
            for (const key of candidateKeys) {
              const raw = await AsyncStorage.getItem(key);
              if (!raw) continue;
              consumedKeys.push(key);
              try {
                const parsed = JSON.parse(raw);
                if (parsed?.messages?.length > 0 && (Date.now() - (parsed.updatedAt || 0)) < 30 * 60 * 1000) { orbData = parsed; break; }
              } catch {}
            }

            if (orbData?.messages?.length > 0) {
              const orbMessages: DashMessage[] = orbData.messages.map((m: any, i: number) => ({
                id: `orb_${orbData.conversationId || 'handoff'}_${i}`,
                type: m.role === 'user' ? 'user' : 'assistant',
                content: String(m.content || ''),
                timestamp: (orbData.updatedAt || Date.now()) - ((orbData.messages.length - i) * 1000),
              }));

              if (preferOrbHandoff) {
                try {
                  const handoffConvId = await dash.startNewConversation('Dash Orb Chat');
                  dash.setCurrentConversationId?.(handoffConvId);
                  const addMessage = (dash as any).addMessageToConversation;
                  if (typeof addMessage === 'function') {
                    for (const message of orbMessages) await addMessage.call(dash, handoffConvId, message);
                    const handoffConv = await dash.getConversation(handoffConvId);
                    if (handoffConv) {
                      setters.setConversation(handoffConv);
                      setters.setMessages(persistence.normalizeConversationMessages(handoffConv.messages || []));
                      persistence.persistConversationSnapshot(handoffConv).catch(() => {});
                      hasExistingMessages = (handoffConv.messages?.length || 0) > 0;
                    }
                  } else {
                    const nowTs = Date.now();
                    const synthesized: DashConversation = { id: handoffConvId, title: 'Dash Orb Chat', messages: orbMessages, created_at: nowTs, updated_at: nowTs };
                    setters.setConversation(synthesized);
                    setters.setMessages(persistence.normalizeConversationMessages(orbMessages));
                    persistence.persistConversationSnapshot(synthesized).catch(() => {});
                    hasExistingMessages = orbMessages.length > 0;
                  }
                } catch {
                  setters.setMessages(orbMessages);
                  hasExistingMessages = orbMessages.length > 0;
                }
              } else {
                setters.setMessages(orbMessages);
                hasExistingMessages = orbMessages.length > 0;
              }
              orbMessagesLoaded = true;
              for (const key of consumedKeys) await AsyncStorage.removeItem(key);
            }
          } catch {}
        }

        if (initialMessage && initialMessage.trim()) {
          sendMessage(initialMessage);
        } else if (!hasExistingMessages && !orbMessagesLoaded) {
          const greeting: DashMessage = { id: `greeting_${Date.now()}`, type: 'assistant', content: dash.getPersonality().greeting, timestamp: Date.now() };
          setters.setMessages([greeting]);
        }
      } catch {
        Alert.alert('Error', 'Failed to initialize AI Assistant.');
      }
    };

    initializeDash();
  }, [conversationId, initialMessage, handoffSource, loadChatPrefs, persistence, profile?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Return ──
  return {
    messages, inputText, setInputText: setters.setInputText, isLoading, loadingStatus,
    streamingMessageId, streamingContent, isSpeaking, speakingMessageId,
    conversation, dashInstance, isInitialized, enterToSend, setEnterToSend: setters.setEnterToSend,
    voiceEnabled, showTypingIndicator, autoSuggestQuestions, contextualHelp,
    selectedAttachments: dashAttachments.selectedAttachments,
    isUploading: dashAttachments.isUploading,
    attachmentProgress: dashAttachments.attachmentProgress,
    isNearBottom, setIsNearBottom: setters.setIsNearBottom,
    unreadCount, setUnreadCount: setters.setUnreadCount,
    availableModels, selectedModel, setSelectedModel,
    isRecording, partialTranscript, alertState, hideAlert: setters.hideAlert,
    learnerContext, tutorSession, flashListRef, inputRef,
    sendMessage, sendTutorAnswer, speakResponse, stopSpeaking, scrollToBottom,
    handleAttachFile: dashAttachments.handleAttachFile,
    handlePickDocuments: dashAttachments.handlePickDocuments,
    handlePickImages: dashAttachments.handlePickImages,
    handleTakePhoto: dashAttachments.handleTakePhoto,
    handleRemoveAttachment: dashAttachments.handleRemoveAttachment,
    addAttachments, handleInputMicPress, stopVoiceRecording,
    startNewConversation, runTool: toolExecution.runTool,
    extractFollowUps, wantsLessonGenerator, tier, subReady, refreshTier,
  };
}

// Re-export needed by LearnerContext (used as type in refs)
import type { LearnerContext } from '@/lib/dash-ai/learnerContext';
