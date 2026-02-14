/**
 * useDashAssistant Hook
 * 
 * Custom hook that extracts business logic from DashAssistant component.
 * Handles message state, conversation management, attachments, and AI interactions.
 * Voice input enabled for paid tiers and a limited free daily budget.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import type { DashMessage, DashConversation, DashAttachment } from '@/services/dash-ai/types';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  pickDocuments, 
  pickImages,
  takePhoto,
  uploadAttachment,
} from '@/services/AttachmentService';
import { track } from '@/lib/analytics';
import { buildDashTurnTelemetry, createDashTurnId } from '@/lib/dash-ai/turnTelemetry';
import { checkAIQuota, showQuotaExceededAlert } from '@/lib/ai/guards';
import type { AIQuotaFeature } from '@/lib/ai/limits';
import { type VoiceSession, type VoiceProvider } from '@/lib/voice/unifiedProvider';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import {
  getChatUIPrefs,
  getVoiceChatPrefs,
  getVoiceInputPrefs,
  initAndMigrate,
  normalizeLanguageCode,
} from '@/lib/ai/dashSettings';
import { assertSupabase } from '@/lib/supabase';
import { calculateAge } from '@/lib/date-utils';
import { fetchParentChildren } from '@/lib/parent-children';
import { getCurrentLanguage } from '@/lib/i18n';
import { useAIModelSelection } from '@/hooks/useAIModelSelection';
import { useCapability } from '@/hooks/useCapability';
import type { AIModelId, AIModelInfo } from '@/lib/ai/models';
import { getPreferredModel, setPreferredModel } from '@/lib/ai/preferences';
import { getCapabilityTier, normalizeTierName } from '@/lib/tiers';
import { useDashAttachments, type AttachmentProgress } from '@/hooks/useDashAttachments';
import {
  buildConversationContext,
  resolveConversationWindowByTier,
} from '@/hooks/dash-assistant/conversationContext';
import {
  getConversationSnapshot,
  saveConversationSnapshot,
  getLastActiveConversationId,
  setLastActiveConversationId,
} from '@/services/conversationPersistence';
import { ToolRegistry } from '@/services/AgentTools';
import { formatToolResultMessage } from '@/lib/ai/toolUtils';
import { getDashToolShortcutsForRole } from '@/lib/ai/toolCatalog';
import {
  createTutorSessionId,
} from '@/lib/dash-ai/tutorSessionService';
import { useDashTutorSessionPersistence } from '@/hooks/dash-assistant/useDashTutorSessionPersistence';
import { planToolCall, shouldAttemptToolPlan } from '@/lib/ai/toolPlanner';
import { handleDashVoiceInputPress, speakDashResponse, stopDashVoiceRecording } from '@/hooks/dash-assistant/voiceHandlers';
import {
  buildAttachmentContextInternal,
  buildDashContextOverride,
  extractFollowUps,
  prepareAttachmentsForAI,
  resolveVoiceLocale,
  sanitizeTutorUserContent,
  wantsLessonGenerator,
} from '@/hooks/dash-assistant/assistantHelpers';
import type { TutorMode, TutorPayload, TutorSession } from '@/hooks/dash-assistant/tutorTypes';
import {
  applyTutorHints,
  buildFallbackTutorEvaluation,
  buildTutorDisplayContent,
  buildTutorSystemContext,
  detectPhonicsTutorRequest,
  detectTutorIntent,
  extractLearningContext,
  extractTutorQuestionFromText,
  getInitialPhonicsStage,
  getMaxQuestions,
  getTutorPhaseLabel,
  isTutorStopIntent,
  nextPhonicsStage,
  parseTutorPayload,
  reconcileTutorEvaluation,
} from '@/hooks/dash-assistant/tutorUtils';

// Extracted utilities
import {
  resolveAgeBand, 
  type LearnerContext,
} from '@/lib/dash-ai/learnerContext';
import { resolveSchoolTypeFromProfile } from '@/lib/schoolTypeResolver';
import {
  shouldCelebrate,
} from '@/lib/dash-ai/promptBuilder';
import {
  loadVoiceBudget,
  trackVoiceUsage,
  hasVoiceBudget,
  formatTimeRemaining,
  FREE_VOICE_BUDGET_MS,
} from '@/lib/dash-ai/voiceBudget';

interface UseDashAssistantOptions {
  conversationId?: string;
  initialMessage?: string;
  handoffSource?: string;
  onClose?: () => void;
  /** Pre-configured tutor mode — bypasses intent detection */
  externalTutorMode?: 'quiz' | 'practice' | 'diagnostic' | 'play' | 'explain' | null;
  /** Tutor session config for programmatic start */
  tutorConfig?: {
    subject?: string;
    grade?: string;
    topic?: string;
    difficulty?: 1 | 2 | 3 | 4 | 5;
  };
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  icon?: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
}

interface UseDashAssistantReturn {
  // State
  messages: DashMessage[];
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  loadingStatus: 'uploading' | 'analyzing' | 'thinking' | 'responding' | null;
  streamingMessageId: string | null;
  streamingContent: string;
  isSpeaking: boolean;
  speakingMessageId: string | null;
  conversation: DashConversation | null;
  dashInstance: IDashAIAssistant | null;
  isInitialized: boolean;
  enterToSend: boolean;
  setEnterToSend: (value: boolean) => void;
  voiceEnabled: boolean;
  showTypingIndicator: boolean;
  autoSuggestQuestions: boolean;
  contextualHelp: boolean;
  selectedAttachments: DashAttachment[];
  isUploading: boolean;
  attachmentProgress: Map<string, AttachmentProgress>;
  isNearBottom: boolean;
  setIsNearBottom: (value: boolean) => void;
  unreadCount: number;
  setUnreadCount: (value: number | ((prev: number) => number)) => void;

  // Model selection
  availableModels: AIModelInfo[];
  selectedModel: AIModelId;
  setSelectedModel: (modelId: AIModelId) => void;
  
  // Voice input state
  isRecording: boolean;
  partialTranscript: string;
  
  // Alert state for premium modals
  alertState: AlertState;
  hideAlert: () => void;
  learnerContext: LearnerContext | null;
  tutorSession: TutorSession | null;
  
  // Parent child management
  parentChildren: any[];
  activeChildId: string | null;
  setActiveChildId: (id: string | null) => void;
  
  // Refs
  flashListRef: React.RefObject<any>;
  inputRef: React.RefObject<any>;
  
  // Actions
  sendMessage: (text?: string) => Promise<void>;
  sendTutorAnswer: (answer: string, sourceMessageId?: string) => Promise<void>;
  cancelGeneration: () => void;
  speakResponse: (message: DashMessage) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  scrollToBottom: (opts?: { animated?: boolean; delay?: number }) => void;
  handleAttachFile: () => Promise<void>;
  handlePickDocuments: () => Promise<void>;
  handlePickImages: () => Promise<void>;
  handleTakePhoto: () => Promise<void>;
  handleRemoveAttachment: (attachmentId: string) => Promise<void>;
  addAttachments: (attachments: DashAttachment[]) => void;
  handleInputMicPress: () => Promise<void>;
  stopVoiceRecording: () => Promise<void>;
  startNewConversation: () => Promise<void>;
  runTool: (toolName: string, params: Record<string, any>) => Promise<void>;
  
  // Helpers
  extractFollowUps: (text: string) => string[];
  wantsLessonGenerator: (t: string, assistantText?: string) => boolean;
  
  // Subscription info
  tier: string | undefined;
  subReady: boolean;
  refreshTier: () => void;
}

const DASH_AI_SERVICE_TYPE: AIQuotaFeature = 'homework_help';

const LOCAL_SNAPSHOT_LIMIT = 200;
const LOCAL_SNAPSHOT_MAX = 200;

const buildTutorKickoffPrompt = (
  mode: NonNullable<UseDashAssistantOptions['externalTutorMode']>,
  config?: UseDashAssistantOptions['tutorConfig']
) => {
  const modeLabel = String(mode || 'diagnostic').toLowerCase();
  const contextParts = [
    config?.grade ? `Grade: ${config.grade}` : null,
    config?.subject ? `Subject: ${config.subject}` : null,
    config?.topic ? `Topic: ${config.topic}` : null,
  ].filter(Boolean);
  const contextBlock = contextParts.length > 0 ? `\n${contextParts.join('\n')}` : '';
  return [
    `Start a ${modeLabel} tutor session for me.${contextBlock}`,
    'Use Diagnose → Teach → Practice flow.',
    'Ask one question at a time and adapt based on my answer.',
  ].join('\n');
};

export function useDashAssistant(options: UseDashAssistantOptions): UseDashAssistantReturn {
  const { conversationId, initialMessage, handoffSource, onClose, externalTutorMode, tutorConfig } = options;
  const { setLayout } = useDashboardPreferences();
  const { tier, ready: subReady, refresh: refreshTier } = useSubscription();
  const { user, profile } = useAuth();
  const { can, ready: capsReady } = useCapability();
  const tutorSessionsV1Enabled = useMemo(
    () => getFeatureFlagsSync().dash_tutor_sessions_v1,
    []
  );

  const toolShortcuts = useMemo(() => {
    const shortcuts = getDashToolShortcutsForRole(profile?.role || null);
    return shortcuts.filter((tool) => ToolRegistry.hasTool(tool.name));
  }, [profile?.role]);

  const autoToolShortcuts = useMemo(() => {
    return toolShortcuts.filter((tool) =>
      tool.category === 'caps' ||
      tool.category === 'data' ||
      tool.category === 'navigation' ||
      (tool.category === 'communication' && tool.name === 'export_pdf')
    );
  }, [toolShortcuts]);

  const plannerTools = useMemo(() => {
    return autoToolShortcuts
      .map((tool) => {
        const registryTool = ToolRegistry.getTool(tool.name);
        return {
          name: tool.name,
          description: tool.description || registryTool?.description || tool.label,
          parameters: registryTool?.parameters,
        };
      })
      .filter((tool) => !!tool.name);
  }, [autoToolShortcuts]);
  
  // State
  const [messages, setMessages] = useState<DashMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<'uploading' | 'analyzing' | 'thinking' | 'responding' | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [statusStartTime, setStatusStartTime] = useState<number>(0);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [conversation, setConversation] = useState<DashConversation | null>(null);
  const [dashInstance, setDashInstance] = useState<IDashAIAssistant | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [enterToSend, setEnterToSend] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoSpeakResponses, setAutoSpeakResponses] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [voiceAutoSend, setVoiceAutoSend] = useState(false);
  const [voiceAutoSendSilenceMs, setVoiceAutoSendSilenceMs] = useState(1500);
  const [voiceWhisperFlowEnabled, setVoiceWhisperFlowEnabled] = useState(true);
  const [voiceWhisperFlowSummaryEnabled, setVoiceWhisperFlowSummaryEnabled] = useState(true);
  const [showTypingIndicator, setShowTypingIndicator] = useState(true);
  const [autoSuggestQuestions, setAutoSuggestQuestions] = useState(true);
  const [contextualHelp, setContextualHelp] = useState(true);
  const [streamingEnabledPref, setStreamingEnabledPref] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tutorSession, setTutorSession] = useState<TutorSession | null>(null);
  const [modelPrefLoaded, setModelPrefLoaded] = useState(false);
  const { availableModels: tierModels, selectedModel, setSelectedModel, canSelectModel } = useAIModelSelection('chat_message');
  const isSuperAdmin = ['superadmin', 'super_admin'].includes((profile?.role || '').toLowerCase());
  const availableModels = useMemo(() => {
    if (!isSuperAdmin) return tierModels;
    const filtered = tierModels.filter(model => model.id.includes('sonnet-4'));
    return filtered.length > 0 ? filtered : tierModels;
  }, [tierModels, isSuperAdmin]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await getPreferredModel('chat_message');
      if (!mounted) return;
      if (stored && canSelectModel(stored as AIModelId)) {
        setSelectedModel(stored as AIModelId);
      }
      setModelPrefLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, [canSelectModel, setSelectedModel]);

  useEffect(() => {
    if (!modelPrefLoaded) return;
    setPreferredModel(selectedModel, 'chat_message');
  }, [modelPrefLoaded, selectedModel]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (availableModels.length === 0) return;
    if (!availableModels.find(model => model.id === selectedModel)) {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, isSuperAdmin, selectedModel, setSelectedModel]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [learnerContext, setLearnerContext] = useState<LearnerContext | null>(null);
  const [parentChildren, setParentChildren] = useState<any[]>([]);
  const [voiceBudgetRemainingMs, setVoiceBudgetRemainingMs] = useState<number | null>(null);
  const externalTutorKickoffSentRef = useRef(false);
  
  // Alert state for premium modals (replaces native Alert.alert)
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
  });
  
  // Helper to show alerts
  const showAlert = useCallback((config: Omit<AlertState, 'visible'>) => {
    setAlertState({ ...config, visible: true });
  }, []);
  
  // Helper to hide alerts
  const hideAlert = useCallback(() => {
    setAlertState(prev => ({ ...prev, visible: false }));
  }, []);
  
  // Refs
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
  const tutorOverridesRef = useRef<Record<string, string>>({});
  const learnerContextRef = useRef<LearnerContext | null>(null);
  const inputTextRef = useRef('');
  const sendMessageRef = useRef<(text?: string) => Promise<void>>(async () => {});
  const voiceAutoSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { tutorSessionRef } = useDashTutorSessionPersistence({
    userId: user?.id,
    profileRole: profile?.role,
    organizationId: profile?.organization_id,
    preschoolId: profile?.preschool_id,
    activeChildId,
    conversationId: conversation?.id,
    tutorSession,
    setTutorSession,
    remoteSyncEnabled: tutorSessionsV1Enabled,
  });

  useEffect(() => {
    learnerContextRef.current = learnerContext;
  }, [learnerContext]);

  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

  useEffect(() => {
    messagesLengthRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    isSpeakingStateRef.current = isSpeaking;
  }, [isSpeaking]);

  // Save conversation ID whenever it changes for persistence
  useEffect(() => {
    if (conversation?.id) {
      AsyncStorage.setItem('@dash_ai_current_conversation_id', conversation.id).catch(err => {
        console.error('[useDashAssistant] Failed to save conversation ID:', err);
      });
    }
  }, [conversation?.id]);

  const capabilityTier = useMemo(
    () => getCapabilityTier(normalizeTierName(String(tier || 'free'))),
    [tier],
  );
  const isFreeTier = subReady ? capabilityTier === 'free' : false;
  const canInteractiveLessons = capsReady ? can('lessons.interactive') : false;
  const canUseImages = capsReady ? can('multimodal.vision') : true;
  const canUseDocuments = capsReady ? can('multimodal.documents') : true;

  const resolveActiveConversationId = useCallback((): string | null => {
    if (conversation?.id) return conversation.id;
    try {
      const current = dashInstance?.getCurrentConversationId?.();
      if (typeof current === 'string' && current.trim().length > 0) {
        return current;
      }
    } catch {}
    return null;
  }, [conversation?.id, dashInstance]);

  // Initialize attachments hook
  const dashAttachments = useDashAttachments({
    conversation,
    getConversationId: resolveActiveConversationId,
    onShowAlert: showAlert,
    canUseImages,
    canUseDocuments,
    isFreeTier,
  });

  const addAttachments = useCallback((attachments: DashAttachment[]) => {
    if (!Array.isArray(attachments) || attachments.length === 0) return;
    dashAttachments.setSelectedAttachments((prev) => [...prev, ...attachments]);
  }, [dashAttachments]);

  // Load voice budget on mount and when tier changes
  const refreshVoiceBudget = useCallback(async () => {
    if (!isFreeTier) {
      setVoiceBudgetRemainingMs(null);
      return;
    }
    const budget = await loadVoiceBudget();
    setVoiceBudgetRemainingMs(budget.remainingMs);
  }, [isFreeTier]);

  const consumeVoiceBudget = useCallback(async (deltaMs: number) => {
    if (!isFreeTier || deltaMs <= 0) return;
    await trackVoiceUsage(deltaMs);
    await refreshVoiceBudget();
  }, [isFreeTier, refreshVoiceBudget]);

  useEffect(() => {
    refreshVoiceBudget();
  }, [refreshVoiceBudget]);

  useEffect(() => {
    let mounted = true;
    const loadActiveChild = async () => {
      try {
        const stored = await AsyncStorage.getItem('@edudash_active_child_id');
        if (mounted) {
          setActiveChildId(stored || null);
        }
      } catch {
        if (mounted) setActiveChildId(null);
      }
    };
    loadActiveChild();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!dashInstance || !user?.id) return;
    let cancelled = false;

    const applyLearnerContext = async () => {
      const profileAny = profile as any;
      const role = profile?.role || '';
      
      // Get school/organization info
      const schoolId = profile?.organization_id || profile?.preschool_id;
      
      // Resolve canonical type so K-12 aliases (combined/primary/secondary/etc.) do not fall back to preschool.
      const schoolType = resolveSchoolTypeFromProfile(profileAny);

      const setDefaultAgeBand = async (band: string | null) => {
        if (!band) return;
        try {
          const stored = await AsyncStorage.getItem('@dash_ai_age_band');
          if (!stored || stored === 'auto') {
            await AsyncStorage.setItem('@dash_ai_age_band', band);
          }
        } catch {}
      };

      const toLocale = (lang?: string | null): 'en-ZA' | 'af-ZA' | 'zu-ZA' => {
        const base = normalizeLanguageCode(lang || getCurrentLanguage?.());
        if (base === 'af') return 'af-ZA';
        if (base === 'zu') return 'zu-ZA';
        return 'en-ZA';
      };

      const personality = dashInstance.getPersonality?.();
      const uiLocale = toLocale(getCurrentLanguage?.());
      const targetLocale = personality?.response_language
        ? toLocale(personality.response_language)
        : toLocale(personality?.voice_settings?.language || profileAny?.preferred_language || uiLocale);
      const shouldForceStrict = role === 'parent' || role === 'student' || role === 'learner';

      const needsLanguageUpdate =
        personality?.response_language !== targetLocale ||
        personality?.voice_settings?.language !== targetLocale ||
        (shouldForceStrict && personality?.strict_language_mode !== true);

      if (needsLanguageUpdate) {
        try {
          await dashInstance.savePersonality({
            response_language: targetLocale,
            strict_language_mode: shouldForceStrict ? true : personality?.strict_language_mode,
            voice_settings: {
              ...(personality?.voice_settings || {}),
              language: targetLocale,
            },
          });
        } catch (langErr) {
          console.warn('[useDashAssistant] Failed to enforce language settings:', langErr);
        }
      }

      if (role === 'parent') {
        const schoolId = profile?.organization_id || profile?.preschool_id;
        const children = await fetchParentChildren(user.id, { includeInactive: false, schoolId });
        if (!cancelled) setParentChildren(children);
        const activeChild = children.find(child => child.id === activeChildId) || children[0];
        if (!activeChild) {
          const parentName = profile?.full_name || profile?.first_name || null;
          if (!cancelled) setLearnerContext({
            learnerName: parentName,
            grade: null,
            ageYears: null,
            ageBand: null,
            schoolType,
            role: 'parent',
          });
          dashInstance.updateUserContext({
            age_group: null,
            grade_levels: null,
            organization_type: schoolType || null,
            preferred_language: targetLocale,
            user_role: 'parent',
            subscription_tier: tier || null,
            capability_tier: capabilityTier,
          }).catch(() => {});
          return;
        }

        const classData = Array.isArray(activeChild.classes) ? activeChild.classes[0] : activeChild.classes;
        const grade = activeChild.grade_level || activeChild.grade || classData?.grade_level || null;
        const ageYears = calculateAge(activeChild.date_of_birth);
        const ageBand = resolveAgeBand(ageYears, grade);
        const learnerName = `${activeChild.first_name} ${activeChild.last_name}`.trim() || null;

        if (!cancelled) setLearnerContext({
          learnerName,
          grade,
          ageYears,
          ageBand,
          schoolType,
          role: 'student',
        });

        if (!activeChildId || activeChildId !== activeChild.id) {
          setActiveChildId(activeChild.id);
          try {
            await AsyncStorage.setItem('@edudash_active_child_id', activeChild.id);
          } catch {}
        }

        const ageGroup = ageBand === 'adult'
          ? 'adult'
          : ageBand === '13-15' || ageBand === '16-18'
            ? 'teen'
            : ageBand
              ? 'child'
              : null;

        dashInstance.updateUserContext({
          age_group: ageGroup,
          grade_levels: grade ? [String(grade)] : null,
          organization_type: schoolType || null,
          preferred_language: targetLocale,
          student_id: activeChild.id,
          student_name: learnerName,
          subscription_tier: tier || null,
          capability_tier: capabilityTier,
        }).catch(() => {});

        await setDefaultAgeBand(ageBand);
        return;
      }

      if (role === 'student' || role === 'learner') {
        const grade = profileAny?.grade_level || null;
        const ageYears = calculateAge(profile?.date_of_birth);
        const ageBand = resolveAgeBand(ageYears, grade);
        const learnerName = profile?.full_name || profile?.first_name || null;

        if (!cancelled) setLearnerContext({
          learnerName,
          grade,
          ageYears,
          ageBand,
          schoolType,
          role,
        });

        const ageGroup = ageBand === 'adult'
          ? 'adult'
          : ageBand === '13-15' || ageBand === '16-18'
            ? 'teen'
            : ageBand
              ? 'child'
              : null;

        dashInstance.updateUserContext({
          age_group: ageGroup,
          grade_levels: grade ? [String(grade)] : null,
          organization_type: schoolType || null,
          preferred_language: targetLocale,
          subscription_tier: tier || null,
          capability_tier: capabilityTier,
        }).catch(() => {});

        await setDefaultAgeBand(ageBand);
        return;
      }

      const staffName = profile?.full_name || profile?.first_name || null;
      if (!cancelled) setLearnerContext({
        learnerName: staffName,
        grade: null,
        ageYears: null,
        ageBand: null,
        schoolType,
        role,
      });

      dashInstance.updateUserContext({
        age_group: null,
        grade_levels: null,
        organization_type: schoolType || null,
        preferred_language: targetLocale,
        user_role: role || null,
        subscription_tier: tier || null,
        capability_tier: capabilityTier,
      }).catch(() => {});
    };

    applyLearnerContext();
    return () => {
      cancelled = true;
    };
  }, [
    dashInstance,
    user?.id,
    profile?.role,
    profile?.organization_id,
    profile?.preschool_id,
    (profile as any)?.organization_membership?.school_type,
    (profile as any)?.organization_type,
    (profile as any)?.school_type,
    (profile as any)?.usage_type,
    tier,
    capabilityTier,
    profile?.full_name,
    profile?.first_name,
    profile?.date_of_birth,
    activeChildId,
  ]);

  // Scroll utility
  const scrollToBottom = useCallback((opts?: { animated?: boolean; delay?: number }) => {
    const delay = opts?.delay ?? 120;
    const animated = opts?.animated ?? true;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    const performScroll = () => {
      const list = flashListRef.current;
      if (!list) return;

      try {
        if (typeof list.scrollToEnd === 'function') {
          list.scrollToEnd({ animated });
        }
        if (typeof list.scrollToOffset === 'function') {
          list.scrollToOffset({ offset: 999999, animated: false });
        }
        const lastIndex = Math.max(0, (messages?.length || 1) - 1);
        if (typeof list.scrollToIndex === 'function') {
          list.scrollToIndex({ index: lastIndex, animated, viewPosition: 1 });
        }
      } catch (e) {
        console.debug('[useDashAssistant] scrollToBottom failed:', e);
      }
    };

    scrollTimeoutRef.current = setTimeout(() => {
      requestAnimationFrame(() => {
        performScroll();
        // Second pass to catch late layout (large images/markdown)
        setTimeout(() => performScroll(), animated ? 250 : 0);
      });
    }, delay);
  }, [messages?.length]);

  const normalizeConversationMessages = useCallback((items: DashMessage[]) => {
    return items.map((msg) => {
      if (msg.type !== 'user') return msg;
      const { content, sanitized } = sanitizeTutorUserContent(msg.content);
      return sanitized ? { ...msg, content } : msg;
    });
  }, []);

  const mapToPersistedMessages = useCallback((items: DashMessage[]) => {
    return items.map((msg) => {
      const meta: any = {};
      if (msg.metadata && typeof msg.metadata === 'object') {
        if ('tts' in msg.metadata) meta.tts = (msg.metadata as any).tts;
        if ('ackType' in msg.metadata) meta.ackType = (msg.metadata as any).ackType;
      }
      return {
        id: msg.id,
        type: msg.type === 'task_result' ? 'assistant' : msg.type,
        content: msg.content,
        timestamp: msg.timestamp,
        meta: Object.keys(meta).length > 0 ? meta : undefined,
      };
    });
  }, []);

  const persistConversationSnapshot = useCallback(async (conv?: DashConversation | null) => {
    if (!user?.id || !conv?.id) return;
    const messages = mapToPersistedMessages(conv.messages || []);
    await saveConversationSnapshot(user.id, conv.id, messages, LOCAL_SNAPSHOT_MAX);
    await setLastActiveConversationId(user.id, conv.id);
  }, [mapToPersistedMessages, user?.id]);

  const hydrateFromSnapshot = useCallback(async (convId: string) => {
    if (!user?.id) return null;
    const snapshot = await getConversationSnapshot(user.id, convId, LOCAL_SNAPSHOT_LIMIT);
    if (!snapshot?.messages?.length) return null;
    const messages: DashMessage[] = snapshot.messages.map((m) => ({
      id: m.id,
      type: m.type,
      content: m.content,
      timestamp: m.timestamp,
      ...(m.meta ? { metadata: { ...(m.meta as any) } } : {}),
    }));
    const createdAt = messages.length > 0 ? Math.min(...messages.map(m => m.timestamp)) : snapshot.updatedAt;
    const updatedAt = snapshot.updatedAt || (messages.length > 0 ? Math.max(...messages.map(m => m.timestamp)) : Date.now());
    const conversation: DashConversation = {
      id: convId,
      title: 'Dash AI Chat',
      messages,
      created_at: createdAt,
      updated_at: updatedAt,
    };
    return { conversation, messages };
  }, [user?.id]);

  const logTutorAttempt = useCallback(async (session: TutorSession, payload: TutorPayload, learnerAnswer: string) => {
    if (!user?.id) return;
    try {
      const studentId = profile?.role === 'parent' ? activeChildId : null;
      const insertPayload = {
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
      };

      await (assertSupabase() as any)
        .from('dash_ai_tutor_attempts')
        .insert(insertPayload);
    } catch (error) {
      console.warn('[useDashAssistant] Failed to log tutor attempt:', error);
    }
  }, [user?.id, profile?.role, activeChildId]);

  const loadChatPrefs = useCallback(async () => {
    try {
      try {
        await initAndMigrate();
      } catch (e) {
        if (__DEV__) console.warn('[useDashAssistant] migration warn', e);
      }
      const [voiceChatPrefs, chatUiPrefs, voiceInputPrefs] = await Promise.all([
        getVoiceChatPrefs(),
        getChatUIPrefs(),
        getVoiceInputPrefs(profile?.role || null),
      ]);
      setVoiceEnabled(voiceChatPrefs.voiceEnabled ?? true);
      setAutoSpeakResponses(voiceChatPrefs.autoSpeak ?? true);
      setShowTypingIndicator(chatUiPrefs.showTypingIndicator ?? true);
      setAutoSuggestQuestions(chatUiPrefs.autoSuggestQuestions ?? true);
      setContextualHelp(chatUiPrefs.contextualHelp ?? true);
      setVoiceAutoSend(voiceInputPrefs.autoSend);
      setVoiceAutoSendSilenceMs(voiceInputPrefs.autoSendSilenceMs);
      setVoiceWhisperFlowEnabled(voiceInputPrefs.whisperFlowEnabled ?? true);
      setVoiceWhisperFlowSummaryEnabled(voiceInputPrefs.whisperFlowSummaryEnabled ?? true);
      if (typeof chatUiPrefs.enterToSend === 'boolean') {
        setEnterToSend(chatUiPrefs.enterToSend);
      }
      try {
        const streamingPref = await AsyncStorage.getItem('@dash_streaming_enabled');
        setStreamingEnabledPref(streamingPref === 'true');
      } catch {}
    } catch {
      try {
        const enterToSendSetting = await AsyncStorage.getItem('@dash_ai_enter_to_send');
        if (enterToSendSetting !== null) {
          setEnterToSend(enterToSendSetting === 'true');
        }
      } catch {}
    }
  }, [profile?.role]);

  // hasFreeVoiceBudget check - used by TTS gating and quota checks
  const hasFreeVoiceBudget = voiceBudgetRemainingMs === null
    ? true
    : voiceBudgetRemainingMs > 0;

  // Check if user has TTS (text-to-speech) features
  // Note: Free tier gets a limited daily voice budget for TTS only
  const hasTTSAccess = useCallback(() => {
    if (!isFreeTier) return true;
    return hasFreeVoiceBudget;
  }, [isFreeTier, hasFreeVoiceBudget]);

  // STT (speech-to-text / voice input) is always allowed if permissions are granted.
  // Voice INPUT should never be blocked by TTS budget — they are separate features.
  const hasSTTAccess = useCallback(() => {
    return true; // STT gating is handled by provider availability + permissions, not budget
  }, []);

  const stopSpeaking = useCallback(async () => {
    if (!dashInstance) return;
    
    try {
      ttsSessionIdRef.current = null;
      await dashInstance.stopSpeaking();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    } catch (error) {
      console.error('Failed to stop speaking:', error);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  }, [dashInstance]);

  // Speech functions
  const speakResponse = useCallback(async (message: DashMessage) => {
    await speakDashResponse({
      message,
      dashInstance,
      voiceEnabled,
      hasTTSAccess,
      isFreeTier,
      consumeVoiceBudget,
      isSpeaking,
      speakingMessageId,
      voiceRefs: {
        voiceSessionRef,
        voiceProviderRef,
        voiceInputStartAtRef,
        lastSpeakStartRef,
        ttsSessionIdRef,
      },
      setIsSpeaking,
      setSpeakingMessageId,
      showAlert,
      hideAlert,
      setVoiceEnabled,
      stopSpeaking,
    });
  }, [dashInstance, speakingMessageId, isSpeaking, hasTTSAccess, showAlert, hideAlert, voiceEnabled, stopSpeaking, isFreeTier, consumeVoiceBudget]);

  // Voice and speaking functions (custom gating + alerts)

  // Internal message sender
  const sendMessageInternal = useCallback(async (text: string, attachments: DashAttachment[]) => {
    if (!dashInstance) return;
    const turnId = createDashTurnId('dash_assistant_turn');
    const turnStartedAt = Date.now();
    const normalizedRole = String(profile?.role || '').toLowerCase();
    const turnModeHint = (
      tutorSessionRef.current ||
      detectTutorIntent(text) ||
      detectPhonicsTutorRequest(text)
    )
      ? 'tutor'
      : ['teacher', 'principal', 'principal_admin', 'admin', 'super_admin'].includes(normalizedRole)
        ? 'advisor'
        : 'assistant';
    const baseTurnTelemetry = buildDashTurnTelemetry({
      conversationId: resolveActiveConversationId(),
      turnId,
      mode: turnModeHint,
      tier: tier || null,
      voiceProvider: 'none',
      fallbackReason: 'none',
      source: 'useDashAssistant.sendMessageInternal',
    });
    track('dash.turn.started', baseTurnTelemetry);

    try {
      setIsLoading(true);
      scrollToBottom({ animated: true, delay: 120 });
      
      if (attachments.length > 0) {
        setLoadingStatus('uploading');
        setStatusStartTime(Date.now());
      } else {
        setLoadingStatus('thinking');
        setStatusStartTime(Date.now());
      }

      let conversationIdForUpload = resolveActiveConversationId();
      if (!conversationIdForUpload) {
        const createdId = await dashInstance.startNewConversation('Chat with Dash');
        dashInstance.setCurrentConversationId?.(createdId);
        conversationIdForUpload = createdId;
        const createdConversation = await dashInstance.getConversation(createdId);
        if (createdConversation) {
          setConversation(createdConversation);
          persistConversationSnapshot(createdConversation).catch(() => {});
        }
      }

      // Upload attachments using dashAttachments hook
      const uploadedAttachments = await dashAttachments.uploadAttachments(attachments, conversationIdForUpload);
      if (attachments.length > 0 && uploadedAttachments.length === 0) {
        throw new Error('All selected attachments failed to upload. Please retry with a smaller image or check your connection.');
      }
      const hasAttachmentPayload = uploadedAttachments.length > 0 || attachments.length > 0;
      setLoadingStatus(hasAttachmentPayload ? 'analyzing' : 'thinking');
      setStatusStartTime(Date.now());
      scrollToBottom({ animated: true, delay: 120 });

      const userText = text || 'Attached files';
      let outgoingText = userText;
      let displayText = userText;
      let tutorAction: 'start' | 'evaluate' | null = null;
      let tutorModeForMetadata: TutorMode | null = null;
      let tutorContextOverride: string | null = null;
      let sessionForTutorAction: TutorSession | null = null;
      
      // Build intelligent context with learning style adaptation
      const baseContextOverride = buildDashContextOverride({
        learner: learnerContextRef.current || learnerContext,
        messages,
      });
      const attachmentContextOverride = buildAttachmentContextInternal(uploadedAttachments);
      
      // Check if we should add celebration or greeting
      const messageHistory = messages.map(msg => ({
        role: msg.type === 'task_result' ? 'assistant' : msg.type,
        content: msg.content || '',
      }));
      const needsCelebration = shouldCelebrate(messageHistory);
      const isFirstMessage = messages.length === 0;
      
      // Add celebration hint if detected understanding/progress
      let celebrationHint = '';
      if (needsCelebration && !isFirstMessage) {
        celebrationHint = '\n\n[HINT: The learner just showed understanding or made progress. Celebrate this! Use encouraging phrases like "Great job!", "You got it!", "Nice work!"]';
      }

      const activeSession = tutorSessionRef.current;
      const roleForTutor = String(profile?.role || '').toLowerCase();
      const isLearnerRole = ['parent', 'student', 'learner'].includes(roleForTutor);
      const phonicsRequested = isLearnerRole && detectPhonicsTutorRequest(userText);
      const hasLearningAttachment = attachments.some(
        (attachment) => attachment.kind === 'image' || attachment.kind === 'document'
      );
      const stopTutor = isTutorStopIntent(userText);
      if (stopTutor && activeSession) {
        setTutorSession(null);
      }

      let tutorIntent = isLearnerRole ? detectTutorIntent(userText) : null;
      if (!tutorIntent && isLearnerRole && hasLearningAttachment) {
        // If user text implies checking/reviewing their work, use explain mode
        // (structured homework help). Otherwise leave null → normal chat handles
        // the image without the rigid <TUTOR_PAYLOAD> JSON constraint.
        const homeworkCheckPattern = /\b(check|mark|correct|grade|right|wrong|mistake|help|explain|review|look at|did I|show me|what is)\b/i;
        if (homeworkCheckPattern.test(userText)) {
          tutorIntent = 'explain';
        }
        // bare image with no homework-check words → normal chat path
      }
      if (activeSession?.awaitingAnswer && !stopTutor) {
        tutorAction = 'evaluate';
        tutorModeForMetadata = activeSession.mode;
        sessionForTutorAction = activeSession;
        tutorContextOverride = buildTutorSystemContext(activeSession, {
          phase: 'evaluate',
          learnerContext: learnerContextRef.current || learnerContext,
        });
      } else if (tutorIntent && !stopTutor) {
        const context = extractLearningContext(userText, learnerContextRef.current || learnerContext);
        const phonicsMode = phonicsRequested;
        const newSession: TutorSession = {
          id: createTutorSessionId(),
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
          phonicsMode,
          phonicsStage: phonicsMode ? getInitialPhonicsStage(userText) : null,
          phonicsMastered: [],
        };
        setTutorSession(newSession);
        tutorAction = 'start';
        tutorModeForMetadata = newSession.mode;
        sessionForTutorAction = newSession;
        tutorContextOverride = buildTutorSystemContext(newSession, {
          phase: 'start',
          learnerContext: learnerContextRef.current || learnerContext,
        });
      }
      const mergedContextBase = [baseContextOverride, tutorContextOverride, attachmentContextOverride, celebrationHint]
        .filter(Boolean)
        .join('\n\n') || null;

      const aiAttachments = await prepareAttachmentsForAI(uploadedAttachments);
      const localUserMessage: DashMessage = {
        id: `local_user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'user',
        content: displayText,
        timestamp: Date.now(),
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      };
      setMessages(prev => [...prev, localUserMessage]);

      // Auto tool execution for low-risk tools (CAPS/data/navigation/PDF)
      let autoToolContext: string | null = null;
      if (shouldAttemptToolPlan(outgoingText) && plannerTools.length > 0) {
        try {
          let supabaseClient: any = null;
          try {
            supabaseClient = assertSupabase();
          } catch {}

          if (supabaseClient) {
            const plan = await planToolCall({
              supabaseClient,
              role: String(profile?.role || 'parent').toLowerCase() || 'parent',
              message: outgoingText,
              tools: plannerTools,
            });

            if (plan?.tool) {
              const toolTraceId = `dash_assistant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              const execution = await ToolRegistry.execute(plan.tool, plan.parameters || {}, {
                profile,
                user,
                supabase: supabaseClient,
                role: String(profile?.role || 'parent').toLowerCase(),
                tier: tier || 'free',
                organizationId: (profile as any)?.organization_id || (profile as any)?.preschool_id || null,
                hasOrganization: Boolean((profile as any)?.organization_id || (profile as any)?.preschool_id),
                isGuest: !user?.id,
                trace_id: toolTraceId,
                tool_plan: {
                  source: 'useDashAssistant.auto_planner',
                  tool: plan.tool,
                },
              });
              const label = autoToolShortcuts.find((tool) => tool.name === plan.tool)?.label || plan.tool;
              const toolMessageContent = formatToolResultMessage(label, execution);

              const toolMessage: DashMessage = {
                id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                type: 'assistant',
                content: toolMessageContent,
                timestamp: Date.now(),
                metadata: {
                  tool_name: plan.tool,
                  tool_result: execution,
                  tool_args: plan.parameters || {},
                },
              };

              setMessages(prev => [...prev, toolMessage]);
              autoToolContext = toolMessageContent;
            }
          }
        } catch (toolErr) {
          console.warn('[useDashAssistant] Auto tool failed:', toolErr);
        }
      }

      const mergedContextOverride = [mergedContextBase, autoToolContext ? `TOOL RESULT:\n${autoToolContext}` : null]
        .filter(Boolean)
        .join('\n\n') || null;
      const envStreamingEnabled = 
        process.env.EXPO_PUBLIC_AI_STREAMING_ENABLED === 'true' || 
        process.env.EXPO_PUBLIC_ENABLE_AI_STREAMING === 'true';
      const streamingEnabled = Platform.OS === 'web' && (streamingEnabledPref || envStreamingEnabled);
      
      let response: DashMessage;
      const contextWindow = resolveConversationWindowByTier(capabilityTier);
      const contextSeedMessages: DashMessage[] = [
        ...messages,
        localUserMessage,
        ...(autoToolContext
          ? [{
              id: `ctx_tool_${Date.now()}`,
              type: 'assistant' as const,
              content: autoToolContext,
              timestamp: Date.now(),
            }]
          : []),
      ];
      const messagesOverride = buildConversationContext(contextSeedMessages, {
        maxMessages: contextWindow.maxMessages,
        maxTokens: contextWindow.maxTokens,
      });
      
      if (streamingEnabled) {
        const tempStreamingMsgId = `streaming_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setStreamingMessageId(tempStreamingMsgId);
        setStreamingContent('');
        
        const tempStreamingMessage: DashMessage = {
          id: tempStreamingMsgId,
          type: 'assistant',
          content: '',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, tempStreamingMessage]);
        
        response = await dashInstance.sendMessage(
          outgoingText, 
          conversationIdForUpload || undefined, 
          aiAttachments.length > 0 ? aiAttachments : undefined,
          (chunk: string) => {
            setStreamingContent(prev => {
              const newContent = prev + chunk;
              setMessages(prevMessages => 
                prevMessages.map(msg => 
                  msg.id === tempStreamingMsgId 
                    ? { ...msg, content: newContent }
                    : msg
                )
              );
              return newContent;
            });
            scrollToBottom({ animated: true, delay: 60 });
          },
          {
            contextOverride: mergedContextOverride,
            modelOverride: selectedModel,
            messagesOverride,
          }
        );
        
        setStreamingMessageId(null);
        setStreamingContent('');
        setMessages(prev => prev.filter(msg => msg.id !== tempStreamingMsgId));
      } else {
        response = await dashInstance.sendMessage(
          outgoingText, 
          conversationIdForUpload || undefined, 
          aiAttachments.length > 0 ? aiAttachments : undefined,
          undefined,
          {
            contextOverride: mergedContextOverride,
            modelOverride: selectedModel,
            messagesOverride,
          }
        );
      }

      if (tutorAction && response?.content) {
        const promptLeak = /return only json|tutor_payload|you are dash, an interactive tutor|tutor mode override/i.test(response.content);
        if (promptLeak && !parseTutorPayload(response.content)) {
          response = {
            ...response,
            content: 'I had a hiccup setting up the tutor. Please try again or tell me the topic and grade.'
          };
        }
      }

      const rawTutorPayload = parseTutorPayload(response?.content || '');
      const hasTutorQuestion = !!rawTutorPayload?.question;
      const hasTutorEvaluation = typeof rawTutorPayload?.is_correct === 'boolean' ||
        !!rawTutorPayload?.feedback ||
        !!rawTutorPayload?.follow_up_question;
      let tutorPayload = (tutorAction === 'start' && !hasTutorQuestion) ||
        (tutorAction === 'evaluate' && !hasTutorEvaluation)
        ? null
        : rawTutorPayload;
      if (!tutorPayload && tutorAction === 'evaluate' && sessionForTutorAction) {
        tutorPayload = buildFallbackTutorEvaluation(sessionForTutorAction, userText);
      }

      if (tutorPayload && tutorAction === 'start' && tutorPayload.question) {
        const displayContent = buildTutorDisplayContent(tutorPayload, true);
        if (displayContent) {
          tutorOverridesRef.current[response.id] = displayContent;
          response = {
            ...response,
            content: displayContent,
            metadata: {
              ...(response.metadata || {}),
              tutor_phase: tutorModeForMetadata ? getTutorPhaseLabel(tutorModeForMetadata) : getTutorPhaseLabel('diagnostic'),
              tutor_question: true,
              tutor_question_text: tutorPayload.question,
            },
          };
        }

        setTutorSession(prev => {
          if (!prev) return prev;
          const needsContext = tutorPayload.next_step === 'need_context';
          return {
            ...prev,
            subject: tutorPayload.subject || prev.subject,
            grade: tutorPayload.grade || prev.grade,
            topic: tutorPayload.topic || prev.topic,
            difficulty: typeof tutorPayload.difficulty === 'number' ? tutorPayload.difficulty : prev.difficulty,
            awaitingAnswer: true,
            currentQuestion: tutorPayload.question || prev.currentQuestion,
            expectedAnswer: tutorPayload.expected_answer || prev.expectedAnswer,
            questionIndex: needsContext ? prev.questionIndex : prev.questionIndex + 1,
          };
        });
      } else if (tutorPayload && tutorAction === 'evaluate') {
        const basePayload = activeSession
          ? reconcileTutorEvaluation(tutorPayload, userText, activeSession)
          : tutorPayload;
        const isCorrect = basePayload.is_correct === true;
        const nextIncorrectStreak = isCorrect ? 0 : (activeSession?.incorrectStreak || 0) + 1;
        const nextCorrectStreak = isCorrect ? (activeSession?.correctStreak || 0) + 1 : 0;
        const attemptsOnQuestion = isCorrect ? 0 : (activeSession?.attemptsOnQuestion || 0) + 1;
        const adjustedPayload = !isCorrect
          ? applyTutorHints(basePayload, { session: activeSession, incorrectStreak: nextIncorrectStreak })
          : basePayload;
        const displayContent = buildTutorDisplayContent(adjustedPayload, false);
        if (displayContent) {
          tutorOverridesRef.current[response.id] = displayContent;
          response = {
            ...response,
            content: displayContent,
            metadata: {
              ...(response.metadata || {}),
              tutor_phase: tutorModeForMetadata ? getTutorPhaseLabel(tutorModeForMetadata) : getTutorPhaseLabel('practice'),
              tutor_question: !!adjustedPayload.follow_up_question,
              tutor_question_text: adjustedPayload.follow_up_question || undefined,
            },
          };
        }

        if (activeSession) {
          await logTutorAttempt(activeSession, adjustedPayload, userText);
          setTutorSession(prev => {
            if (!prev) return prev;
            const totalQuestions = prev.totalQuestions + 1;
            const correctCount = prev.correctCount + (adjustedPayload.is_correct ? 1 : 0);
            const followUp = adjustedPayload.follow_up_question || null;
            const followExpected = adjustedPayload.next_expected_answer || null;
            const completed = totalQuestions >= prev.maxQuestions && !followUp;
            let nextDifficulty = prev.difficulty || 1;
            if (!isCorrect && nextIncorrectStreak >= 2) {
              nextDifficulty = Math.max(1, nextDifficulty - 1);
            } else if (isCorrect && nextCorrectStreak >= 2) {
              nextDifficulty = Math.min(3, nextDifficulty + 1);
            }
            const currentPhonicsStage = prev.phonicsStage || 'letter_sounds';
            const advancedPhonicsStage =
              prev.phonicsMode && isCorrect && nextCorrectStreak >= 2
                ? nextPhonicsStage(currentPhonicsStage)
                : currentPhonicsStage;
            const masteredTokenSource = adjustedPayload.correct_answer || prev.expectedAnswer || '';
            const masteredToken = String(masteredTokenSource || '').trim().toLowerCase();
            const updatedMastered = prev.phonicsMode && isCorrect && masteredToken
              ? Array.from(new Set([...(prev.phonicsMastered || []), masteredToken])).slice(-24)
              : prev.phonicsMastered;
            if (completed) {
              const summary: DashMessage = {
                id: `tutor_summary_${Date.now()}`,
                type: 'assistant',
                content: `Session complete! Score: ${correctCount}/${totalQuestions}.\nI logged your performance so we can track progress over time.`,
                timestamp: Date.now(),
              };
              setMessages(messages => [...messages, summary]);
              return null;
            }

            return {
              ...prev,
              totalQuestions,
              correctCount,
              awaitingAnswer: !!followUp,
              currentQuestion: followUp,
              expectedAnswer: followExpected,
              incorrectStreak: nextIncorrectStreak,
              correctStreak: nextCorrectStreak,
              attemptsOnQuestion,
              difficulty: nextDifficulty,
              phonicsStage: prev.phonicsMode ? advancedPhonicsStage : prev.phonicsStage,
              phonicsMastered: updatedMastered,
            };
          });
        }
      } else if (!tutorPayload && tutorAction && sessionForTutorAction) {
        const fallbackFromResponse = extractTutorQuestionFromText(response?.content || '');
        const fallbackQuestion = fallbackFromResponse || (() => {
          // If the learner sent an image, use whatever Claude said (it likely
          // analysed the image). Only fall back to grade/subject questions
          // when there is genuinely no attachment to look at.
          if (hasLearningAttachment) {
            return response?.content || 'I can see your work! Let me take a closer look — which question would you like me to check?';
          }
          if (!sessionForTutorAction.grade) return 'What grade are you in?';
          if (!sessionForTutorAction.subject) return 'Which subject is this?';
          return 'What exact question do you need help with?';
        })();

        tutorOverridesRef.current[response.id] = fallbackQuestion;
        response = {
          ...response,
          content: fallbackQuestion,
          metadata: {
            ...(response.metadata || {}),
            tutor_phase: tutorModeForMetadata
              ? getTutorPhaseLabel(tutorModeForMetadata)
              : getTutorPhaseLabel(sessionForTutorAction.mode),
            tutor_question: true,
            tutor_question_text: fallbackQuestion,
          },
        };

        setTutorSession(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            subject: prev.subject,
            grade: prev.grade,
            topic: prev.topic,
            awaitingAnswer: true,
            currentQuestion: fallbackQuestion,
            expectedAnswer: null,
            questionIndex: tutorAction === 'start' ? prev.questionIndex + 1 : prev.questionIndex,
          };
        });
      }

      // Add assistant message locally for immediate UI feedback
      setMessages(prev => [...prev, response]);
      
      setLoadingStatus('responding');
      setStatusStartTime(Date.now());
      scrollToBottom({ animated: true, delay: 120 });
      
      // Handle dashboard actions
      if (response.metadata?.dashboard_action?.type === 'switch_layout') {
        const newLayout = response.metadata.dashboard_action.layout;
        if (newLayout && (newLayout === 'classic' || newLayout === 'enhanced')) {
          setLayout(newLayout);
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch {}
        }
      } else if (response.metadata?.dashboard_action?.type === 'open_screen') {
        const { route, params } = response.metadata.dashboard_action as any;
        if (typeof route === 'string' && route.includes('/screens/ai-lesson-generator')) {
          Alert.alert(
            'Open Lesson Generator?',
            'Dash suggests opening the AI Lesson Generator with prefilled details.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open', onPress: () => { try { router.push({ pathname: route, params } as any); } catch {} } },
            ]
          );
        } else {
          try { router.push({ pathname: route, params } as any); } catch {}
        }
      }
      
      // Update messages
      const updatedConv = await dashInstance.getConversation(dashInstance.getCurrentConversationId()!);
      if (updatedConv && Array.isArray(updatedConv.messages) && updatedConv.messages.length > 0) {
        const overrideMap = tutorOverridesRef.current;
        const merged = updatedConv.messages.map(msg => {
          const override = overrideMap[msg.id];
          if (override) {
            return { ...msg, content: override };
          }
          if (msg.type === 'user') {
            const { content, sanitized } = sanitizeTutorUserContent(msg.content);
            return sanitized ? { ...msg, content } : msg;
          }
          return msg;
        });
        setMessages(prev => (merged.length >= prev.length ? merged : prev));
        setConversation(updatedConv);
        scrollToBottom({ animated: true, delay: 150 });
        persistConversationSnapshot(updatedConv).catch(() => {});

        // Server-side conversation trim to prevent unbounded DB row growth
        if (
          updatedConv.messages.length > LOCAL_SNAPSHOT_MAX &&
          user?.id &&
          (profile?.organization_id || profile?.preschool_id)
        ) {
          try {
            const svc = new (await import('@/services/dash-ai/DashConversationService')).DashConversationService(
              user.id,
              String(profile.organization_id || profile.preschool_id),
            );
            svc.trimConversation(updatedConv.id, LOCAL_SNAPSHOT_MAX).catch(() => {});
          } catch {}
        }
      }

      // Check for lesson generator intent
      try {
        const intentType = response?.metadata?.user_intent?.primary_intent || '';
        const shouldOpen = intentType === 'create_lesson' || wantsLessonGenerator(userText, response?.content);
        if (shouldOpen) {
          if (!capsReady) {
            Alert.alert('Please wait', 'Loading your subscription details. Try again in a moment.');
            return;
          }
          if (!canInteractiveLessons) {
            Alert.alert(
              'Upgrade Required',
              'Interactive lessons and activities are available on Premium or Pro Plus plans.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'View Plans', onPress: () => router.push('/pricing') },
              ]
            );
            return;
          }
          if (user?.id) {
            const lessonQuota = await checkAIQuota('lesson_generation', user.id, 1);
            if (!lessonQuota.allowed) {
              showQuotaExceededAlert('lesson_generation', lessonQuota.quotaInfo, {
                customMessages: {
                  title: 'Lesson Generation Limit Reached',
                  message: 'You have used all lesson generation credits for this month.',
                },
              });
              return;
            }
          }
          Alert.alert(
            'Open Lesson Generator?',
            'I can open the AI Lesson Generator with the details we discussed.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open', onPress: () => dashInstance.openLessonGeneratorFromContext(userText, response?.content || '') }
            ]
          );
        }
      } catch {}

      // Auto-speak if enabled
      if (autoSpeakResponses && voiceEnabled) {
        speakResponse(response);
      }

      track(
        'dash.turn.completed',
        buildDashTurnTelemetry({
          ...baseTurnTelemetry,
          conversationId: dashInstance.getCurrentConversationId?.() || baseTurnTelemetry.conversation_id,
          mode: tutorAction ? 'tutor' : baseTurnTelemetry.mode,
          latencyMs: Date.now() - turnStartedAt,
        })
      );

    } catch (error) {
      console.error('Failed to send message:', error);
      track(
        'dash.turn.failed',
        {
          ...buildDashTurnTelemetry({
            ...baseTurnTelemetry,
            conversationId: resolveActiveConversationId() || baseTurnTelemetry.conversation_id,
            latencyMs: Date.now() - turnStartedAt,
          }),
          error: error instanceof Error ? error.message : String(error || 'unknown_error'),
        }
      );
      const errorMessage = error instanceof Error ? error.message : '';
      showAlert({
        title: 'Error',
        message: errorMessage || 'Failed to send message. Please try again.',
        type: 'error',
        icon: 'alert-circle-outline',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    } finally {
      setIsLoading(false);
      setLoadingStatus(null);
    }
  }, [
    dashInstance,
    conversation,
    scrollToBottom,
    setLayout,
    wantsLessonGenerator,
    showAlert,
    speakResponse,
    autoSpeakResponses,
    voiceEnabled,
    streamingEnabledPref,
    detectTutorIntent,
    detectPhonicsTutorRequest,
    isTutorStopIntent,
    extractLearningContext,
    buildDashContextOverride,
    prepareAttachmentsForAI,
    getMaxQuestions,
    buildTutorSystemContext,
    parseTutorPayload,
    buildFallbackTutorEvaluation,
    reconcileTutorEvaluation,
    applyTutorHints,
    buildTutorDisplayContent,
    extractTutorQuestionFromText,
    sanitizeTutorUserContent,
    logTutorAttempt,
    getTutorPhaseLabel,
    persistConversationSnapshot,
    resolveActiveConversationId,
    learnerContext,
    capsReady,
    canInteractiveLessons,
    user?.id,
    profile?.role,
    tier,
    capabilityTier,
  ]);

  // Process queue
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || requestQueueRef.current.length === 0) return;
    
    isProcessingRef.current = true;
    const request = requestQueueRef.current.shift();
    
    if (request) {
      await sendMessageInternal(request.text, request.attachments);
    }
    
    isProcessingRef.current = false;
    
    if (requestQueueRef.current.length > 0) {
      setTimeout(() => processQueue(), 0);
    }
  }, [sendMessageInternal]);

  const handleVoiceFinalTranscript = useCallback(
    (transcript: string, options: { autoSend: boolean; delayMs: number }) => {
      if (voiceAutoSendTimeoutRef.current) {
        clearTimeout(voiceAutoSendTimeoutRef.current);
        voiceAutoSendTimeoutRef.current = null;
      }

      const trimmed = transcript.trim();
      if (!trimmed || !options.autoSend) return;

      const delayMs = Math.max(400, Math.min(2000, Number(options.delayMs) || 600));
      voiceAutoSendTimeoutRef.current = setTimeout(() => {
        const latestInput = inputTextRef.current.trim();
        if (!latestInput || latestInput !== trimmed) {
          voiceAutoSendTimeoutRef.current = null;
          return;
        }
        sendMessageRef.current(trimmed).catch((error) => {
          console.warn('[useDashAssistant] Voice auto-send failed:', error);
        }).finally(() => {
          voiceAutoSendTimeoutRef.current = null;
        });
      }, delayMs);
    },
    []
  );

  const stopVoiceRecording = useCallback(async () => {
    if (voiceAutoSendTimeoutRef.current) {
      clearTimeout(voiceAutoSendTimeoutRef.current);
      voiceAutoSendTimeoutRef.current = null;
    }
    await stopDashVoiceRecording({
      voiceRefs: {
        voiceSessionRef,
        voiceProviderRef,
        voiceInputStartAtRef,
        lastSpeakStartRef,
        ttsSessionIdRef,
      },
      isFreeTier,
      consumeVoiceBudget,
      setIsRecording,
      setPartialTranscript,
    });
  }, [consumeVoiceBudget, isFreeTier]);

  // Public send message
  const sendMessage = useCallback(async (text: string = inputText.trim()) => {
    // If voice capture is active, stop listening before sending.
    if (isRecording) {
      await stopVoiceRecording();
    }

    if (voiceAutoSendTimeoutRef.current) {
      clearTimeout(voiceAutoSendTimeoutRef.current);
      voiceAutoSendTimeoutRef.current = null;
    }

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
            customMessages: {
              title: 'AI Chat Limit Reached',
              message: 'You\'ve used all your AI chat messages for this month.',
            },
          });
          return;
        }
      } catch (quotaError) {
        console.warn('[useDashAssistant] Quota check failed:', quotaError);
      }
    }

    if (user?.id && text) {
      try {
        const wantsLesson = wantsLessonGenerator(text);
        if (wantsLesson) {
          const lessonQuota = await checkAIQuota('lesson_generation', user.id, 1);
          if (!lessonQuota.allowed) {
            showQuotaExceededAlert('lesson_generation', lessonQuota.quotaInfo, {
              customMessages: {
                title: 'Lesson Generation Limit Reached',
                message: 'You have used all lesson generation credits for this month.',
              },
            });
            return;
          }
        }
      } catch (lessonQuotaError) {
        console.warn('[useDashAssistant] Lesson quota check failed:', lessonQuotaError);
      }
    }
    
    requestQueueRef.current.push({
      text,
      attachments: [...dashAttachments.selectedAttachments],
    });

    setInputText('');
    dashAttachments.setSelectedAttachments([]);
    processQueue();
  }, [inputText, dashAttachments, dashInstance, user?.id, tier, processQueue, wantsLessonGenerator, isRecording, stopVoiceRecording]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const sendTutorAnswer = useCallback(async (answer: string, sourceMessageId?: string) => {
    const trimmed = answer.trim();
    if (!trimmed) return;

    const activeSession = tutorSessionRef.current;
    if (activeSession) {
      track('edudash.ai.tutor.answer', {
        session_id: activeSession.id,
        mode: activeSession.mode,
        source_message_id: sourceMessageId,
      });
    }

    await sendMessage(trimmed);
  }, [sendMessage]);

  // Attachment handlers
  // Attachment functions delegated to dashAttachments hook

  // Handle voice input mic press - START/STOP toggle
  const handleInputMicPress = useCallback(async () => {
    await handleDashVoiceInputPress({
      hasTTSAccess,
      hasSTTAccess,
      isRecording,
      stopVoiceRecording,
      tier,
      showAlert,
      hideAlert,
      dashInstance,
      preferredLanguage: profile?.preferred_language || null,
      resolveVoiceLocale,
      isFreeTier,
      consumeVoiceBudget,
      setIsRecording,
      setPartialTranscript,
      setInputText,
      voiceAutoSend,
      voiceAutoSendSilenceMs,
      voiceWhisperFlowEnabled,
      voiceWhisperFlowSummaryEnabled,
      isPreschoolMode: learnerContext?.schoolType === 'preschool',
      onFinalTranscript: handleVoiceFinalTranscript,
      voiceRefs: {
        voiceSessionRef,
        voiceProviderRef,
        voiceInputStartAtRef,
        lastSpeakStartRef,
        ttsSessionIdRef,
      },
    });
  }, [
    hasTTSAccess,
    hasSTTAccess,
    isRecording,
    stopVoiceRecording,
    tier,
    showAlert,
    hideAlert,
    dashInstance,
    profile?.preferred_language,
    resolveVoiceLocale,
    isFreeTier,
    consumeVoiceBudget,
    voiceAutoSend,
    voiceAutoSendSilenceMs,
    voiceWhisperFlowEnabled,
    voiceWhisperFlowSummaryEnabled,
    learnerContext?.schoolType,
    handleVoiceFinalTranscript,
  ]);

  // Voice session cleanup handled locally

  const startNewConversation = useCallback(async () => {
    if (!dashInstance) return;
    
    try {
      const newConvId = await dashInstance.startNewConversation('Chat with Dash');
      const newConv = await dashInstance.getConversation(newConvId);
      if (newConv) {
        setConversation(newConv);
        persistConversationSnapshot(newConv).catch(() => {});
        setMessages([]);
        setInputText('');
        dashAttachments.setSelectedAttachments([]);
        setStreamingMessageId(null);
        setStreamingContent('');
        setUnreadCount(0);
        setTutorSession(null);
        tutorOverridesRef.current = {};
        
        // Clear voice state
        if (isRecording) {
          await stopVoiceRecording();
        }
        
        const greeting: DashMessage = {
          id: `greeting_${Date.now()}`,
          type: 'assistant',
          content: dashInstance.getPersonality().greeting,
          timestamp: Date.now(),
        };
        setMessages([greeting]);
      }
    } catch (error) {
      console.error('Failed to start new conversation:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to start new conversation.',
        type: 'error',
        icon: 'alert-circle-outline',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  }, [dashInstance, dashAttachments, isRecording, showAlert, stopVoiceRecording, persistConversationSnapshot]);

  const runTool = useCallback(
    async (toolName: string, params: Record<string, any>) => {
      const tool = ToolRegistry.getTool(toolName);
      const label = tool?.name || toolName;

      if (!tool) {
        showAlert({
          title: 'Tool Not Found',
          message: `The tool "${toolName}" is not available right now.`,
          type: 'warning',
          icon: 'alert-circle-outline',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        return;
      }

      let supabaseClient: any = null;
      try {
        supabaseClient = assertSupabase();
      } catch {}

      const context = {
        profile,
        user,
        supabase: supabaseClient,
        role: String(profile?.role || 'parent').toLowerCase(),
        tier: tier || 'free',
        organizationId: (profile as any)?.organization_id || (profile as any)?.preschool_id || null,
        hasOrganization: Boolean((profile as any)?.organization_id || (profile as any)?.preschool_id),
        isGuest: !user?.id,
        trace_id: `dash_assistant_manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tool_plan: {
          source: 'useDashAssistant.runTool',
          tool: toolName,
        },
      };

      const execution = await ToolRegistry.execute(toolName, params, context);
      const content = formatToolResultMessage(label, execution);

      const toolMessage: DashMessage = {
        id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'assistant',
        content,
        timestamp: Date.now(),
        metadata: {
          tool_name: toolName,
          tool_result: execution,
          tool_args: params || {},
        },
      };

      setMessages((prev) => [...prev, toolMessage]);

      const convId = dashInstance?.getCurrentConversationId?.();
      if (dashInstance && convId) {
        try {
          await dashInstance.addMessageToConversation(convId, toolMessage);
        } catch (error) {
          console.warn('[useDashAssistant] Failed to persist tool message:', error);
        }
      }
    },
    [dashInstance, profile, user, showAlert, tier]
  );

  // Initialize Dash AI
  useEffect(() => {
    const initializeDash = async () => {
      try {
        const module = await import('@/services/dash-ai/DashAICompat');
        const DashClass = (module as any).DashAIAssistant || (module as any).default;
        const dash: IDashAIAssistant | null = DashClass?.getInstance?.() || null;
        if (!dash) throw new Error('DashAIAssistant unavailable');
        await dash.initialize();
        setDashInstance(dash);
        // NOTE: setIsInitialized(true) is deferred to AFTER all messages load
        // to prevent a flash of the empty state before orb/conversation data arrives

        const preferOrbHandoff = handoffSource === 'orb' || handoffSource === 'dash_voice_orb';
        let hasExistingMessages = false;

        if (conversationId) {
          const snapshot = await hydrateFromSnapshot(conversationId);
          const hasSnapshot = !!snapshot;
          if (hasSnapshot) {
            hasExistingMessages = snapshot.messages.length > 0;
            setConversation(snapshot.conversation);
            setMessages(normalizeConversationMessages(snapshot.messages));
            dash.setCurrentConversationId(conversationId);
          }
          const existingConv = await dash.getConversation(conversationId);
          if (existingConv) {
            hasExistingMessages = (existingConv.messages?.length || 0) > 0;
            setConversation(existingConv);
            setMessages(normalizeConversationMessages(existingConv.messages || []));
            dash.setCurrentConversationId(conversationId);
            persistConversationSnapshot(existingConv).catch(() => {});
          } else if (hasSnapshot) {
            dash.setCurrentConversationId(conversationId);
          }
        } else {
          const savedConvId = await AsyncStorage.getItem('@dash_ai_current_conversation_id');
          const lastActiveId = user?.id ? await getLastActiveConversationId(user.id) : null;
          let newConvId = savedConvId || lastActiveId || null;
          
          if (newConvId) {
            const snapshot = await hydrateFromSnapshot(newConvId);
            const hasSnapshot = !!snapshot;
            if (hasSnapshot) {
              hasExistingMessages = snapshot.messages.length > 0;
              setConversation(snapshot.conversation);
              setMessages(normalizeConversationMessages(snapshot.messages));
              dash.setCurrentConversationId(newConvId);
            }
            const existingConv = await dash.getConversation(newConvId);
            if (existingConv) {
              hasExistingMessages = (existingConv.messages?.length || 0) > 0;
              setConversation(existingConv);
              setMessages(normalizeConversationMessages(existingConv.messages || []));
              dash.setCurrentConversationId(newConvId);
              persistConversationSnapshot(existingConv).catch(() => {});
            } else if (!hasSnapshot) {
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
                setConversation(latest);
                setMessages(normalizeConversationMessages(latest.messages || []));
                dash.setCurrentConversationId(latest.id);
                persistConversationSnapshot(latest).catch(() => {});
              } else {
                const createdId = await dash.startNewConversation('Chat with Dash');
                const newConv = await dash.getConversation(createdId);
                if (newConv) {
                  setConversation(newConv);
                  persistConversationSnapshot(newConv).catch(() => {});
                }
              }
            } catch {
              const createdId = await dash.startNewConversation('Chat with Dash');
              const newConv = await dash.getConversation(createdId);
              if (newConv) {
                setConversation(newConv);
                persistConversationSnapshot(newConv).catch(() => {});
              }
            }
          }
        }

        // Load chat/voice preferences
        await loadChatPrefs();

        // Check for ORB session messages to carry over
        // Supports both voice orb format ({conversationId, messages, updatedAt})
        // and text orb format (plain array of ChatMessage objects)
        let orbMessagesLoaded = false;
        if ((preferOrbHandoff || !hasExistingMessages) && user?.id) {
          try {
            const legacyProfileId = profile?.id && profile.id !== user.id ? profile.id : null;
            // Check voice orb keys first, then text orb keys as fallback
            const candidateKeys = [
              `dash:orb-session:${user.id}`,
              legacyProfileId ? `dash:orb-session:${legacyProfileId}` : null,
              `@dash_orb_chat_${user.id}`,
              legacyProfileId ? `@dash_orb_chat_${legacyProfileId}` : null,
            ].filter((key): key is string => Boolean(key));

            let orbData: any = null;
            const consumedKeys: string[] = [];
            // Allow 2-hour window (was 30 min) — parents may take a while before continuing
            const ORB_EXPIRY_MS = 2 * 60 * 60 * 1000;
            for (const key of candidateKeys) {
              const raw = await AsyncStorage.getItem(key);
              if (!raw) continue;
              consumedKeys.push(key);
              try {
                const parsed = JSON.parse(raw);
                // Voice orb format: { messages: [...], updatedAt, conversationId }
                if (parsed?.messages?.length > 0 && (Date.now() - (parsed.updatedAt || 0)) < ORB_EXPIRY_MS) {
                  orbData = parsed;
                  break;
                }
                // Text orb format: plain array of ChatMessage objects
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const filtered = parsed.filter((m: any) => (m.role === 'user' || m.role === 'assistant') && m.content);
                  if (filtered.length > 0) {
                    // Check expiry using last message timestamp
                    const lastTs = filtered[filtered.length - 1]?.timestamp;
                    const lastTime = lastTs ? new Date(lastTs).getTime() : 0;
                    if (lastTime > 0 && (Date.now() - lastTime) < ORB_EXPIRY_MS) {
                      orbData = { messages: filtered.map((m: any) => ({ role: m.role, content: m.content })), updatedAt: lastTime };
                      break;
                    }
                  }
                }
              } catch {
                // ignore malformed orb payloads
              }
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
                  const handoffConversationId = await dash.startNewConversation('Dash Orb Chat');
                  dash.setCurrentConversationId?.(handoffConversationId);
                  let seededViaSyntheticConversation = false;

                  const addMessage = (dash as any).addMessageToConversation;
                  if (typeof addMessage === 'function') {
                    for (const message of orbMessages) {
                      await addMessage.call(dash, handoffConversationId, message);
                    }
                  } else {
                    const nowTs = Date.now();
                    const synthesizedConversation: DashConversation = {
                      id: handoffConversationId,
                      title: 'Dash Orb Chat',
                      messages: orbMessages,
                      created_at: nowTs,
                      updated_at: nowTs,
                    };
                    setConversation(synthesizedConversation);
                    setMessages(normalizeConversationMessages(orbMessages));
                    persistConversationSnapshot(synthesizedConversation).catch(() => {});
                    hasExistingMessages = orbMessages.length > 0;
                    seededViaSyntheticConversation = true;
                  }

                  if (!seededViaSyntheticConversation) {
                    const handoffConversation = await dash.getConversation(handoffConversationId);
                    if (handoffConversation) {
                      setConversation(handoffConversation);
                      setMessages(normalizeConversationMessages(handoffConversation.messages || []));
                      persistConversationSnapshot(handoffConversation).catch(() => {});
                      hasExistingMessages = (handoffConversation.messages?.length || 0) > 0;
                    } else {
                      setMessages(orbMessages);
                      hasExistingMessages = orbMessages.length > 0;
                    }
                  }
                } catch (handoffErr) {
                  console.warn('[useDashAssistant] Orb handoff conversation bootstrap failed:', handoffErr);
                  setMessages(orbMessages);
                  hasExistingMessages = orbMessages.length > 0;
                }
              } else {
                setMessages(orbMessages);
                hasExistingMessages = orbMessages.length > 0;
              }

              orbMessagesLoaded = true;
              for (const key of consumedKeys) {
                await AsyncStorage.removeItem(key);
              }
            }
          } catch (orbErr) {
            console.warn('[useDashAssistant] Failed to load ORB session:', orbErr);
          }
        }

        // Send initial message or add greeting
        if (initialMessage && initialMessage.trim()) {
          sendMessage(initialMessage.trim());
        } else if (!hasExistingMessages && !orbMessagesLoaded && externalTutorMode && !externalTutorKickoffSentRef.current) {
          externalTutorKickoffSentRef.current = true;
          sendMessage(buildTutorKickoffPrompt(externalTutorMode, tutorConfig));
        } else if (!hasExistingMessages && !orbMessagesLoaded) {
          const greeting: DashMessage = {
            id: `greeting_${Date.now()}`,
            type: 'assistant',
            content: dash.getPersonality().greeting,
            timestamp: Date.now(),
          };
          setMessages([greeting]);
        }

        // Mark initialized AFTER all data is loaded — prevents flash of empty state
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize Dash:', error);
        Alert.alert('Error', 'Failed to initialize AI Assistant.');
      }
    };

    initializeDash();
  }, [
    conversationId,
    initialMessage,
    handoffSource,
    externalTutorMode,
    tutorConfig,
    loadChatPrefs,
    normalizeConversationMessages,
    hydrateFromSnapshot,
    persistConversationSnapshot,
    profile?.id,
    user?.id,
  ]);

  // Auto-scroll effects
  useEffect(() => {
    if (isInitialized && messages.length > 0 && flashListRef.current) {
      scrollToBottom({ animated: false, delay: 300 });
    }
  }, [isInitialized]);

  useEffect(() => {
    const isTypingActive = isLoading || !!loadingStatus;
    if (isTypingActive && flashListRef.current) {
      // Scroll immediately when loading starts
      scrollToBottom({ animated: false, delay: 0 });
      // Then scroll again to catch any late renders
      const timer = setTimeout(() => {
        scrollToBottom({ animated: true, delay: 0 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, loadingStatus, scrollToBottom]);

  // Unread count tracking
  useEffect(() => {
    if (!isInitialized) return;
    const prevLen = prevLengthRef.current || 0;
    const currLen = messages.length;
    if (currLen > prevLen) {
      if (isNearBottom) {
        setUnreadCount(0);
      } else {
        setUnreadCount((c) => Math.min(999, c + (currLen - prevLen)));
      }
    }
    prevLengthRef.current = currLen;
  }, [messages.length, isNearBottom, isInitialized]);

  // Focus effect for conversation refresh
  useFocusEffect(
    useCallback(() => {
      loadChatPrefs();
      let active = true;

      if (dashInstance && conversation?.id) {
        dashInstance.getConversation(conversation.id).then((updatedConv: any) => {
          if (!active) return;
          const currentLength = messagesLengthRef.current;
          if (updatedConv && updatedConv.messages.length !== currentLength) {
            setMessages(normalizeConversationMessages(updatedConv.messages));
            setConversation(updatedConv);
            persistConversationSnapshot(updatedConv).catch(() => {});
          }
        }).catch(() => {});
      }

      return () => {
        active = false;
        if (isSpeakingStateRef.current) {
          stopSpeaking().catch(() => {});
        }
      };
    }, [
      dashInstance,
      conversation?.id,
      loadChatPrefs,
      stopSpeaking,
      normalizeConversationMessages,
      persistConversationSnapshot,
    ])
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (voiceAutoSendTimeoutRef.current) {
        clearTimeout(voiceAutoSendTimeoutRef.current);
        voiceAutoSendTimeoutRef.current = null;
      }
      if (dashInstance) {
        stopSpeaking().catch(() => {});
        dashInstance.cleanup();
      }
    };
  }, [dashInstance, stopSpeaking]);

  // Web beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (dashInstance && isSpeaking) {
        stopSpeaking().catch(() => {});
      }
    };

    if (
      Platform.OS === 'web' && 
      typeof window !== 'undefined' && 
      typeof window.addEventListener === 'function'
    ) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
    return undefined;
  }, [dashInstance, isSpeaking, stopSpeaking]);

  return {
    // State
    messages,
    inputText,
    setInputText,
    isLoading,
    loadingStatus,
    streamingMessageId,
    streamingContent,
    isSpeaking,
    speakingMessageId,
    conversation,
    dashInstance,
    isInitialized,
    enterToSend,
    setEnterToSend,
    voiceEnabled,
    showTypingIndicator,
    autoSuggestQuestions,
    contextualHelp,
    selectedAttachments: dashAttachments.selectedAttachments,
    isUploading: dashAttachments.isUploading,
    attachmentProgress: dashAttachments.attachmentProgress,
    isNearBottom,
    setIsNearBottom,
    unreadCount,
    setUnreadCount,
    availableModels,
    selectedModel,
    setSelectedModel,
    
    // Voice input state
    isRecording,
    partialTranscript,
    
    // Alert state for premium modals
    alertState,
    hideAlert,
    learnerContext,
    tutorSession,
    
    // Parent child management
    parentChildren,
    activeChildId,
    setActiveChildId,
    
    // Refs
    flashListRef,
    inputRef,
    
    // Actions
    sendMessage,
    sendTutorAnswer,
    cancelGeneration: useCallback(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsLoading(false);
      setLoadingStatus(null);
      setStreamingMessageId(null);
      setStreamingContent('');
    }, []),
    speakResponse,
    stopSpeaking,
    scrollToBottom,
    handleAttachFile: dashAttachments.handleAttachFile,
    handlePickDocuments: dashAttachments.handlePickDocuments,
    handlePickImages: dashAttachments.handlePickImages,
    handleTakePhoto: dashAttachments.handleTakePhoto,
    handleRemoveAttachment: dashAttachments.handleRemoveAttachment,
    addAttachments,
    handleInputMicPress,
    stopVoiceRecording,
    startNewConversation,
    runTool,
    
    // Helpers
    extractFollowUps,
    wantsLessonGenerator,
    
    // Subscription
    tier,
    subReady,
    refreshTier,
  };
}
