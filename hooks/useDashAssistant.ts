/**
 * useDashAssistant Hook
 * 
 * Custom hook that extracts business logic from DashAssistant component.
 * Handles message state, conversation management, attachments, and AI interactions.
 * Voice input enabled for paid tiers and a limited free daily budget.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Alert, Platform, PermissionsAndroid, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { AudioModule } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

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
  formatFileSize
} from '@/services/AttachmentService';
import { track } from '@/lib/analytics';
import { checkAIQuota, showQuotaExceededAlert } from '@/lib/ai/guards';
import type { AIQuotaFeature } from '@/lib/ai/limits';
import { getSingleUseVoiceProvider, type VoiceSession, type VoiceProvider } from '@/lib/voice/unifiedProvider';
import { formatTranscript } from '@/lib/voice/formatTranscript';
import { getChatUIPrefs, getVoiceChatPrefs, initAndMigrate, normalizeLanguageCode } from '@/lib/ai/dashSettings';
import { assertSupabase } from '@/lib/supabase';
import { calculateAge } from '@/lib/date-utils';
import { fetchParentChildren } from '@/lib/parent-children';
import { getCurrentLanguage } from '@/lib/i18n';
import { useAIModelSelection } from '@/hooks/useAIModelSelection';
import { useCapability } from '@/hooks/useCapability';
import type { AIModelId, AIModelInfo } from '@/lib/ai/models';
import { getPreferredModel, setPreferredModel } from '@/lib/ai/preferences';
import { useDashAttachments, type AttachmentProgress } from '@/hooks/useDashAttachments';
import {
  getConversationSnapshot,
  saveConversationSnapshot,
  getLastActiveConversationId,
  setLastActiveConversationId,
} from '@/services/conversationPersistence';
import { ToolRegistry } from '@/services/AgentTools';
import { formatToolResultMessage } from '@/lib/ai/toolUtils';
import { getDashToolShortcutsForRole } from '@/lib/ai/toolCatalog';
import { planToolCall, shouldAttemptToolPlan } from '@/lib/ai/toolPlanner';

// Extracted utilities
import { 
  resolveAgeBand, 
  formatGradeLabel, 
  isPreschoolContext,
  detectLearningStyle,
  detectStuckPattern,
  type LearnerContext,
} from '@/lib/dash-ai/learnerContext';
import {
  buildIntelligentSystemPrompt,
  buildAttachmentContext,
  buildGreeting,
  shouldCelebrate,
} from '@/lib/dash-ai/promptBuilder';
import {
  compressImageForAI,
  MAX_IMAGE_BASE64_LEN,
  IMAGE_COMPRESS_STEPS,
  formatBytes,
} from '@/lib/dash-ai/imageCompression';
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
  onClose?: () => void;
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
  
  // Refs
  flashListRef: React.RefObject<any>;
  inputRef: React.RefObject<any>;
  
  // Actions
  sendMessage: (text?: string) => Promise<void>;
  sendTutorAnswer: (answer: string, sourceMessageId?: string) => Promise<void>;
  speakResponse: (message: DashMessage) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  scrollToBottom: (opts?: { animated?: boolean; delay?: number }) => void;
  handleAttachFile: () => Promise<void>;
  handlePickDocuments: () => Promise<void>;
  handlePickImages: () => Promise<void>;
  handleTakePhoto: () => Promise<void>;
  handleRemoveAttachment: (attachmentId: string) => Promise<void>;
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

type TutorMode = 'diagnostic' | 'practice' | 'quiz' | 'explain';

type TutorSession = {
  id: string;
  mode: TutorMode;
  subject?: string | null;
  grade?: string | null;
  topic?: string | null;
  awaitingAnswer: boolean;
  currentQuestion?: string | null;
  expectedAnswer?: string | null;
  questionIndex: number;
  totalQuestions: number;
  correctCount: number;
  maxQuestions: number;
  difficulty: number;
  incorrectStreak: number;
  correctStreak: number;
  attemptsOnQuestion: number;
};

type TutorPayload = {
  question?: string;
  expected_answer?: string;
  subject?: string;
  grade?: string;
  topic?: string;
  difficulty?: number;
  next_step?: 'answer' | 'need_context';
  is_correct?: boolean;
  score?: number;
  feedback?: string;
  correct_answer?: string;
  explanation?: string;
  misconception?: string;
  follow_up_question?: string;
  next_expected_answer?: string;
  hint?: string;
  steps?: string;
};

const LOCAL_SNAPSHOT_LIMIT = 200;
const LOCAL_SNAPSHOT_MAX = 200;

export function useDashAssistant(options: UseDashAssistantOptions): UseDashAssistantReturn {
  const { conversationId, initialMessage, onClose } = options;
  const { setLayout } = useDashboardPreferences();
  const { tier, ready: subReady, refresh: refreshTier } = useSubscription();
  const { user, profile } = useAuth();
  const { can, ready: capsReady } = useCapability();

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
  const [voiceBudgetRemainingMs, setVoiceBudgetRemainingMs] = useState<number | null>(null);
  
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
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestQueueRef = useRef<Array<{ text: string; attachments: DashAttachment[] }>>([]);
  const isProcessingRef = useRef(false);
  const prevLengthRef = useRef<number>(0);
  const tutorSessionRef = useRef<TutorSession | null>(null);
  const tutorOverridesRef = useRef<Record<string, string>>({});
  const learnerContextRef = useRef<LearnerContext | null>(null);

  useEffect(() => {
    tutorSessionRef.current = tutorSession;
  }, [tutorSession]);

  useEffect(() => {
    learnerContextRef.current = learnerContext;
  }, [learnerContext]);

  // Save conversation ID whenever it changes for persistence
  useEffect(() => {
    if (conversation?.id) {
      AsyncStorage.setItem('@dash_ai_current_conversation_id', conversation.id).catch(err => {
        console.error('[useDashAssistant] Failed to save conversation ID:', err);
      });
    }
  }, [conversation?.id]);

  const isFreeTier = (tier || 'free').toLowerCase().includes('free');
  const canInteractiveLessons = capsReady ? can('lessons.interactive') : false;
  const canUseImages = capsReady ? can('multimodal.vision') : true;
  const canUseDocuments = capsReady ? can('multimodal.documents') : true;

  // Initialize attachments hook
  const dashAttachments = useDashAttachments({
    conversation,
    onShowAlert: showAlert,
    canUseImages,
    canUseDocuments,
    isFreeTier,
  });

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
      
      // For now, assume K-12 unless explicitly a preschool ID
      // (organization_type column doesn't exist in profiles table)
      const schoolType = schoolId && String(schoolId).toLowerCase().includes('preschool') 
        ? 'preschool' 
        : 'primary_school';
      
      // Normalize school type to detect K-12 vs preschool/ECD
      const normalizedSchoolType = String(schoolType || '').toLowerCase();
      const isPreschoolOrg = normalizedSchoolType.includes('preschool') || 
                            normalizedSchoolType.includes('ecd') || 
                            normalizedSchoolType.includes('early') ||
                            normalizedSchoolType.includes('daycare') ||
                            normalizedSchoolType.includes('creche');

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

  // Helper functions
  const wantsLessonGenerator = useCallback((t: string, assistantText?: string): boolean => {
    const rx = /(create|plan|generate)\s+(a\s+)?lesson(\s+plan)?|lesson\s+plan|teach\s+.*(about|on)/i;
    if (rx.test(t)) return true;
    if (assistantText && rx.test(assistantText)) return true;
    return false;
  }, []);

  const extractFollowUps = useCallback((text: string): string[] => {
    try {
      const lines = (text || '').split(/\n+/);
      const results: string[] = [];
      for (const line of lines) {
        const m = line.match(/^\s*User:\s*(.+)$/i);
        if (m && m[1]) {
          const q = m[1].trim();
          if (q.length > 0) results.push(q);
        }
      }
      return results;
    } catch {
      return [];
    }
  }, []);

  const detectTutorIntent = useCallback((text: string): TutorMode | null => {
    const value = (text || '').toLowerCase();
    if (!value) return null;
    
    // Only activate tutor mode for EXPLICIT quiz/practice requests
    // Help requests like "explain", "what should I do" should NOT trigger tutor mode
    if (/(quiz\s+me|test\s+me|give\s+me\s+a\s+quiz|assessment|mock\s+test)/.test(value)) return 'quiz';
    if (/(practice\s+question|drill\s+me|give\s+me\s+practice|worksheet\s+questions)/.test(value)) return 'practice';
    
    // Diagnostic ONLY for explicit "diagnose" keyword
    if (/diagnose\s+me|diagnostic\s+test/.test(value)) return 'diagnostic';
    
    return null;
  }, []);

  const isTutorStopIntent = useCallback((text: string) => {
    return /(stop|end\s+session|exit\s+tutor|cancel\s+quiz|new\s+topic)/i.test(text || '');
  }, []);

  const getMaxQuestions = useCallback((mode: TutorMode) => {
    switch (mode) {
      case 'diagnostic':
      case 'quiz':
        return 5;
      case 'practice':
        return 3;
      case 'explain':
      default:
        return 1;
    }
  }, []);

  const getTutorPhaseLabel = useCallback((mode: TutorMode) => {
    switch (mode) {
      case 'explain':
        return 'Teach';
      case 'practice':
      case 'quiz':
        return 'Practice';
      case 'diagnostic':
      default:
        return 'Diagnose';
    }
  }, []);

  const extractLearningContext = useCallback((text: string, fallback?: LearnerContext | null) => {
    const value = (text || '').toLowerCase();
    const gradeMatch = value.match(/grade\s*(r|[0-9]{1,2})/i);
    const grade = gradeMatch
      ? gradeMatch[1].toUpperCase()
      : (fallback?.grade ? String(fallback.grade).toUpperCase() : null);
    const subjectMap: Array<{ key: RegExp; label: string }> = [
      { key: /math|mathematics|algebra|geometry|numbers/, label: 'Mathematics' },
      { key: /science|physics|chemistry|biology/, label: 'Science' },
      { key: /english|reading|writing|language/, label: 'English' },
      { key: /history|social\s+studies|geography/, label: 'Social Sciences' },
      { key: /life\s+skills|life\s+orientation/, label: 'Life Skills' },
    ];
    const subject = subjectMap.find(entry => entry.key.test(value))?.label || null;
    const topicMatch = value.match(/(?:topic|on|about)\s+([a-z0-9\s-]{3,})/i);
    const topic = topicMatch ? topicMatch[1].trim() : null;
    return {
      grade,
      subject,
      topic,
      ageBand: fallback?.ageBand || null,
      ageYears: fallback?.ageYears || null,
      schoolType: fallback?.schoolType || null,
      learnerName: fallback?.learnerName || null,
    };
  }, []);

  const buildDashContextOverride = useCallback((context?: LearnerContext | null) => {
    const learner = context || null;
    const gradeLabel = formatGradeLabel(learner?.grade);
    const ageYears = learner?.ageYears ?? null;
    const ageBand = learner?.ageBand || resolveAgeBand(ageYears, gradeLabel);
    const schoolType = learner?.schoolType || null;
    const preschoolMode = isPreschoolContext({
      ...learner,
      ageBand,
    });

    const preschoolRules = preschoolMode
      ? [
          'PRESCHOOL TEACHING RULES (always on for preschool):',
          '- Always use play-based, game-like activities.',
          '- Focus on letter recognition, phonics, number recognition, counting, shapes, colors, and fine-motor skills.',
          '- Keep instructions short (3-6 steps) and hands-on.',
          '- Include a quick interactive check (e.g., “Point to the letter A” or “Count to 5 with me”).',
          '- Avoid formal tests or exam language unless a teacher explicitly asks.',
        ].join('\n')
      : null;

    const generalRules = [
      'DASH CONVERSATION STYLE:',
      '- Be warm, friendly, and conversational - like a helpful learning companion',
      '- Celebrate progress: "Great job!", "You\'re getting it!", "That\'s a smart connection!"',
      '- Be proactive: Suggest next steps, offer insights, make connections',
      '- Balance teaching with conversation - not every interaction needs to be a lesson',
      '',
      'RESPONSE STRUCTURE (for homework/learning questions):',
      '1. When user shares an image/document: ANALYZE THE ACTUAL CONTENT',
      '   - Describe what you see: "This is [textbook/worksheet/diagram]..."',
      '   - Read visible text word-for-word',
      '   - Be SPECIFIC to content shown, not generic advice',
      '   - NEVER say "I cannot see it" - the attachment is visible',
      '',
      '2. FORBIDDEN generic responses:',
      '   ❌ "Identify the problem, break it down, check your work"',
      '   ❌ "Organize approach, apply concept, reflect"',
      '   ✅ CORRECT: "This is Activity 7.1 about Multiple Intelligences..."',
      '',
      '3. Structure learning responses as:',
      '   **1. What this is about** (brief overview)',
      '   **2. Key concepts** (with examples)',
      '   **3. Step-by-step solution/explanation**',
      '   **4. Check understanding** (ONE diagnostic question)',
      '',
      '3. Formatting rules:',
      '- Use **bold** for headings',
      '- Use bullet points (•) for lists',
      '- Use numbered steps (1., 2., 3.) for sequences',
      '- Keep paragraphs short (2-3 sentences max)',
      '- Use line breaks between sections',
      '',
      '4. NEVER say: "I need more context", "I cannot see", "Please describe"',
      '   - If image attached: analyze it directly',
      '   - If unclear: make reasonable inference and explain',
    ].join('\n');

    const lines = [
      'DASH CONTEXT PACK (do not repeat verbatim):',
      learner?.learnerName ? `Learner: ${learner.learnerName}.` : null,
      gradeLabel ? `Grade: ${gradeLabel}.` : null,
      typeof ageYears === 'number' ? `Age: ${ageYears}.` : null,
      ageBand ? `Age band: ${ageBand}.` : null,
      schoolType ? `School type: ${schoolType}.` : null,
      learner?.role ? `User role: ${learner.role}.` : null,
      generalRules,
      preschoolRules,
    ].filter(Boolean);

    // Use intelligent prompt builder for enhanced AI capabilities
    const messageHistory = messages.map(msg => ({
      role: msg.type === 'task_result' ? 'assistant' : msg.type,
      content: msg.content || '',
    }));
    const hour = new Date().getHours();
    const timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' = 
      hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

    const enrichedLearner: LearnerContext = {
      ...learner,
      ageBand: ageBand || undefined,
      ageYears: ageYears || undefined,
      grade: gradeLabel || undefined,
      schoolType: schoolType || undefined,
    };

    const intelligentPrompt = buildIntelligentSystemPrompt({
      learner: enrichedLearner,
      messageHistory,
      tutorMode: true,
      sessionStart: messages.length === 0,
      timeOfDay,
    });

    // Combine traditional context with intelligent prompt
    return `${lines.join('\n')}\n\n${intelligentPrompt}`;
  }, [messages]);

  const buildAttachmentContextInternal = useCallback((attachments: DashAttachment[]) => {
    if (!attachments || attachments.length === 0) return null;
    
    const hasImages = attachments.some(a => a.kind === 'image');
    const hasDocuments = attachments.some(a => a.kind === 'document' || a.kind === 'pdf');
    
    // Use extracted utility for attachment context
    const baseContext = buildAttachmentContext(attachments.length, hasImages, hasDocuments);
    
    // Add attachment list
    const lines = attachments.map((attachment) => {
      const label = attachment.name || 'Attachment';
      const kind = attachment.kind || 'file';
      const size = typeof attachment.size === 'number' ? formatFileSize(attachment.size) : null;
      return `- ${label} (${kind}${size ? `, ${size}` : ''})`;
    });
    
    return `${baseContext}\n\nATTACHMENT LIST:\n${lines.join('\n')}`;
  }, []);

  const prepareAttachmentsForAI = useCallback(async (attachments: DashAttachment[]) => {
    if (Platform.OS === 'web') return attachments;
    if (!attachments || attachments.length === 0) return attachments;

    const prepared: DashAttachment[] = [];

    for (const attachment of attachments) {
      if (attachment.kind !== 'image' || !attachment.previewUri) {
        prepared.push(attachment);
        continue;
      }

      const uri = attachment.previewUri || '';
      if (!uri) {
        prepared.push(attachment);
        continue;
      }

      let base64: string | null = null;
      let mediaType = 'image/jpeg';

      for (const step of IMAGE_COMPRESS_STEPS) {
        try {
          const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: step.width } }],
            {
              compress: step.compress,
              format: ImageManipulator.SaveFormat.JPEG,
              base64: true,
            }
          );
          if (result.base64 && result.base64.length <= MAX_IMAGE_BASE64_LEN) {
            base64 = result.base64;
            mediaType = 'image/jpeg';
            break;
          }
        } catch {
          // Try next compression step
        }
      }

      if (!base64) {
        try {
          const fallback = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
          if (fallback && fallback.length <= MAX_IMAGE_BASE64_LEN) {
            base64 = fallback;
            mediaType = attachment.mimeType || 'image/jpeg';
          }
        } catch {
          base64 = null;
        }
      }

      if (base64) {
        prepared.push({
          ...attachment,
          meta: {
            ...(attachment.meta || {}),
            image_base64: base64,
            image_media_type: mediaType,
          },
        });
      } else {
        prepared.push(attachment);
      }
    }

    return prepared;
  }, []);

  const resolveVoiceLocale = useCallback((lang?: string | null): 'en-ZA' | 'af-ZA' | 'zu-ZA' => {
    const base = normalizeLanguageCode(lang || getCurrentLanguage?.());
    if (base === 'af') return 'af-ZA';
    if (base === 'zu') return 'zu-ZA';
    return 'en-ZA';
  }, []);

  const sanitizeTutorUserContent = useCallback((content?: string | null) => {
    if (!content) return { content: '', sanitized: false };
    const lower = content.toLowerCase();
    const isTutorPrompt = /you are dash, an interactive tutor|tutor_payload|return only json|tutor mode override/i.test(lower);
    if (!isTutorPrompt) return { content, sanitized: false };

    const requestMatch = content.match(/Learner request:\s*([^\n]+)/i);
    if (requestMatch?.[1]) {
      return { content: requestMatch[1].trim(), sanitized: true };
    }
    const answerMatch = content.match(/Learner answer:\s*([^\n]+)/i);
    if (answerMatch?.[1]) {
      return { content: answerMatch[1].trim(), sanitized: true };
    }
    const questionMatch = content.match(/Question:\s*([^\n]+)/i);
    if (questionMatch?.[1]) {
      return { content: questionMatch[1].trim(), sanitized: true };
    }
    return { content: 'Tutor request', sanitized: true };
  }, []);

  const normalizeConversationMessages = useCallback((items: DashMessage[]) => {
    return items.map((msg) => {
      if (msg.type !== 'user') return msg;
      const { content, sanitized } = sanitizeTutorUserContent(msg.content);
      return sanitized ? { ...msg, content } : msg;
    });
  }, [sanitizeTutorUserContent]);

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

  const buildTutorSystemContext = useCallback((
    session: TutorSession,
    options: {
      phase: 'start' | 'evaluate';
      learnerContext?: LearnerContext | null;
    }
  ) => {
    const learner = options.learnerContext;
    const normalizedSchool = (learner?.schoolType || '').toLowerCase();
    const ageBand = learner?.ageBand || null;
    const isPreschool = normalizedSchool.includes('preschool') ||
      normalizedSchool.includes('ecd') ||
      normalizedSchool.includes('early') ||
      ageBand === '3-5' ||
      ageBand === '6-8';

    const levelGuidance = isPreschool
      ? [
          'PRESCHOOL MODE:',
          '- Use very simple language and short sentences.',
          '- Focus on play-based learning, colors, shapes, counting to 10, letters/sounds, and everyday objects.',
          '- Keep questions extremely short and concrete.',
          '- Avoid K-12 framing or advanced concepts.',
          '- Praise effort and keep tone warm and playful.',
        ].join('\n')
      : [
          'K-12 MODE:',
          '- Match the learner grade and keep the difficulty age-appropriate.',
          '- Use clear step-by-step explanations with numbered points.',
          '- Break complex topics into simple, digestible parts.',
          '- Provide concrete examples to illustrate concepts.',
          '- Use bullet points and structured formatting for clarity.',
          '- When explaining, follow this structure:',
          '  1. Simple introduction',
          '  2. Key concepts with examples',
          '  3. Step-by-step breakdown',
          '  4. One diagnostic question to check understanding',
          '- Keep each section concise but comprehensive.',
        ].join('\n');

    const baseLines = [
      'TUTOR MODE OVERRIDE:',
      `Mode: ${session.mode}.`,
      `Difficulty target: ${session.difficulty || 1}/3.`,
      learner?.learnerName ? `Learner: ${learner.learnerName}.` : null,
      learner?.grade ? `Grade: ${learner.grade}.` : session.grade ? `Grade: ${session.grade}.` : null,
      session.subject ? `Subject: ${session.subject}.` : null,
      session.topic ? `Topic: ${session.topic}.` : null,
      ageBand ? `Age band: ${ageBand}.` : null,
      learner?.schoolType ? `School type: ${learner.schoolType}.` : null,
      levelGuidance,
      '',
      'RESPONSE FORMATTING:',
      '- Be highly interactive: ask ONE short question at a time and wait.',
      '- If the learner is wrong, provide a hint plus a step-by-step scaffold before asking the next question.',
      '- When explaining concepts, use clear headers and numbered steps.',
      '- Break down complex information into sections with headings.',
      '- Use bullet points for lists of related items.',
      '- Provide concrete examples after each key concept.',
      '- For homework help, structure responses as:',
      '  1. "What this is about" - brief overview',
      '  2. Key concepts breakdown with examples',
      '  3. Step-by-step solution or explanation',
      '  4. One check question to verify understanding',
      '',
      'Ask ONE question only and stop. Do not add extra questions or commentary.',
      'Keep responses very short (2-4 short lines max) unless explaining a concept.',
      'If grade or topic is missing, ask a single clarifying question instead.',
      'If the learner shared an attachment, assume it contains the question and ask about it directly.',
      'Return ONLY JSON wrapped in <TUTOR_PAYLOAD> tags.',
    ];

    if (options.phase === 'evaluate') {
      baseLines.push(
        `Question: ${session.currentQuestion || 'N/A'}`,
        session.expectedAnswer ? `Expected answer: ${session.expectedAnswer}` : null,
        'Evaluate the learner’s latest message as the answer.',
        'Be strict and factual: only mark correct when the answer clearly matches.',
        'If unsure, mark incorrect and explain why.',
        'If incorrect, provide a gentle hint, show a short step-by-step scaffold, then ask ONE follow-up question.'
      );
      baseLines.push(
        'JSON keys: is_correct, score (0-100), feedback, correct_answer, explanation, misconception, follow_up_question, next_expected_answer.',
        'Example: <TUTOR_PAYLOAD>{"is_correct":false,"score":40,"feedback":"...","correct_answer":"...","explanation":"...","misconception":"...","follow_up_question":"...","next_expected_answer":"..."}</TUTOR_PAYLOAD>'
      );
    } else {
      baseLines.push(
        'JSON keys: question, expected_answer, subject, grade, topic, difficulty, next_step.',
        'Example: <TUTOR_PAYLOAD>{"question":"...","expected_answer":"...","subject":"...","grade":"...","topic":"...","difficulty":1,"next_step":"answer"}</TUTOR_PAYLOAD>'
      );
    }

    return baseLines.filter(Boolean).join('\n');
  }, []);

  const parseTutorPayload = useCallback((content: string): TutorPayload | null => {
    if (!content) return null;
    const tagMatch = content.match(/<TUTOR_PAYLOAD>([\s\S]*?)<\/TUTOR_PAYLOAD>/i);
    const jsonCandidate = tagMatch ? tagMatch[1] : null;
    const fallbackMatch = !jsonCandidate ? content.match(/\{[\s\S]*\}/) : null;
    const raw = (jsonCandidate || fallbackMatch?.[0] || '').trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TutorPayload;
    } catch {
      return null;
    }
  }, []);

  const normalizeTutorText = useCallback((value: string) => {
    return (value || '')
      .toLowerCase()
      .replace(/[\u2019']/g, '')
      .replace(/[^a-z0-9.+-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const splitExpectedAnswers = useCallback((expected: string) => {
    return expected
      .split(/\/|,|;|\bor\b|\band\b/i)
      .map(part => part.trim())
      .filter(Boolean);
  }, []);

  const extractNumbers = useCallback((value: string) => {
    const matches = (value || '').match(/-?\d+(?:\.\d+)?/g);
    return matches ? matches.map(Number).filter(n => !Number.isNaN(n)) : [];
  }, []);

  const reconcileTutorEvaluation = useCallback((payload: TutorPayload, learnerAnswer: string, session: TutorSession) => {
    if (!payload || typeof payload.is_correct !== 'boolean' || !payload.is_correct) return payload;
    const feedbackText = `${payload.feedback || ''} ${payload.explanation || ''}`.toLowerCase();
    if (/(not\s+quite|incorrect|not correct|try again|almost|needs work)/i.test(feedbackText)) {
      return { ...payload, is_correct: false };
    }

    const expected = String(payload.correct_answer || session.expectedAnswer || '').trim();
    if (!expected) return payload;

    const normalizedAnswer = normalizeTutorText(learnerAnswer);
    if (!normalizedAnswer) {
      return {
        ...payload,
        is_correct: false,
        score: typeof payload.score === 'number' ? Math.min(payload.score, 20) : payload.score,
      };
    }

    const expectedNumbers = extractNumbers(expected);
    const answerNumbers = extractNumbers(learnerAnswer);
    if (expectedNumbers.length > 0 && answerNumbers.length > 0) {
      const numericMatch = expectedNumbers.every(num =>
        answerNumbers.some(answerNum => Math.abs(answerNum - num) < 1e-6)
      );
      if (!numericMatch) {
        return {
          ...payload,
          is_correct: false,
          score: typeof payload.score === 'number' ? Math.min(payload.score, 40) : payload.score,
          follow_up_question: payload.follow_up_question || session.currentQuestion || 'Try that again.',
        };
      }
      return payload;
    }

    const expectedCandidates = splitExpectedAnswers(expected).map(normalizeTutorText).filter(Boolean);
    const normalizedExpected = normalizeTutorText(expected);
    const isShortExpected = normalizedExpected.length <= 24 && normalizedExpected.split(' ').length <= 4;

    const matchesExpected = expectedCandidates.length > 0
      ? expectedCandidates.some(candidate =>
          normalizedAnswer === candidate || normalizedAnswer.includes(candidate) || candidate.includes(normalizedAnswer)
        )
      : normalizedExpected
        ? (normalizedAnswer === normalizedExpected || normalizedAnswer.includes(normalizedExpected) || normalizedExpected.includes(normalizedAnswer))
        : false;

    if (isShortExpected && !matchesExpected) {
      return {
        ...payload,
        is_correct: false,
        score: typeof payload.score === 'number' ? Math.min(payload.score, 40) : payload.score,
        feedback: payload.feedback || "Let's think about this - let's try again.",
        follow_up_question: payload.follow_up_question || session.currentQuestion || 'Try that again.',
      };
    }

    if (typeof payload.score === 'number' && payload.score < 70) {
      return {
        ...payload,
        is_correct: false,
      };
    }

    return payload;
  }, [extractNumbers, normalizeTutorText, splitExpectedAnswers]);

  const buildTutorDisplayContent = useCallback((payload: TutorPayload, isQuestionStep: boolean) => {
    if (isQuestionStep) {
      const question = payload.question?.trim();
      if (!question) return null;
      return question;
    }

    const lines: string[] = [];
    if (typeof payload.is_correct === 'boolean') {
      if (payload.is_correct) {
        lines.push('✅ ' + (payload.feedback || 'Correct!'));
      } else if (payload.feedback) {
        lines.push(payload.feedback.trim());
      }
    } else if (payload.feedback) {
      lines.push(payload.feedback.trim());
    }
    if (payload.hint) lines.push(payload.hint.trim());
    if (payload.correct_answer) {
      lines.push(`Correct answer: ${payload.correct_answer}`);
    }
    if (payload.steps) lines.push(payload.steps.trim());
    if (payload.explanation) lines.push(payload.explanation.trim());
    if (payload.follow_up_question) {
      lines.push(`\nNext question:\n${payload.follow_up_question.trim()}`);
    }
    return lines.filter(Boolean).join('\n\n');
  }, []);

  const extractTutorQuestionFromText = useCallback((content: string) => {
    const cleaned = (content || '').trim();
    if (!cleaned) return null;
    const lines = cleaned
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.includes('?')) {
        return line;
      }
    }
    const fallback = cleaned.match(/(?:^|\n)([^\n]{0,140}\?)\s*$/);
    if (fallback?.[1]) return fallback[1].trim();
    const keywordMatch = cleaned.match(/(?:^|\n)(?:what|which|how|why|solve|calculate|find|name|explain|define)[^\n]{0,120}$/i);
    return keywordMatch ? keywordMatch[0].trim() : null;
  }, []);

  const buildTutorHintPack = useCallback((params: {
    question?: string | null;
    subject?: string | null;
    expectedAnswer?: string | null;
    incorrectStreak?: number;
  }) => {
    const question = (params.question || '').trim();
    const lower = question.toLowerCase();
    const subject = (params.subject || '').toLowerCase();
    const numbers = extractNumbers(question);
    const numberList = numbers.slice(0, 3).join(', ');
    const isMath = subject.includes('math') ||
      numbers.length > 0 ||
      /(add|sum|plus|subtract|minus|difference|multiply|times|product|divide|quotient|fraction|decimal|percent|ratio|equation)/i.test(lower);
    const isReading = subject.includes('english') ||
      /(define|meaning|vocab|synonym|antonym|main idea|summarize|theme|character|plot|story|infer|explain)/i.test(lower);

    let hint = '';
    let steps = '';
    let followUpQuestion = '';

    if (isMath) {
      const opHint = /add|sum|plus/.test(lower)
        ? 'addition'
        : /subtract|minus|difference/.test(lower)
          ? 'subtraction'
          : /multiply|times|product/.test(lower)
            ? 'multiplication'
            : /divide|quotient|per/.test(lower)
              ? 'division'
              : 'the correct operation';
      hint = numberList
        ? `Hint: the key numbers are ${numberList}.`
        : 'Hint: find the key numbers and what the question is asking.';
      steps = [
        'Steps:',
        '1. Identify what the question is asking.',
        `2. Choose ${opHint}.`,
        '3. Calculate carefully.',
        '4. Check your result.'
      ].join('\n');
      followUpQuestion = numberList
        ? `Step 1: Which operation should we use with ${numberList}?`
        : 'Step 1: Which operation should we use?';
    } else if (isReading) {
      hint = 'Hint: focus on the key word or idea in the question.';
      steps = [
        'Steps:',
        '1. Restate the question in your own words.',
        '2. Find the key term or idea.',
        '3. Give a short explanation or example.'
      ].join('\n');
      followUpQuestion = 'Step 1: What is the key word or idea in the question?';
    } else {
      hint = 'Hint: start by identifying what the question is asking you to do.';
      steps = [
        'Steps:',
        '1. Identify the goal of the question.',
        '2. List the important information.',
        '3. Apply the rule or concept.',
        '4. Check your answer.'
      ].join('\n');
      followUpQuestion = 'Step 1: What is the question asking you to find or explain?';
    }

    if (params.incorrectStreak && params.incorrectStreak >= 2) {
      hint = hint ? `Let’s slow down. ${hint}` : 'Let’s slow down and take it step by step.';
      if (params.expectedAnswer && params.expectedAnswer.length <= 12 && !hint.includes(params.expectedAnswer)) {
        hint = `${hint} The target answer is ${params.expectedAnswer}.`;
      }
    }

    if (followUpQuestion && !followUpQuestion.trim().endsWith('?')) {
      followUpQuestion = `${followUpQuestion.trim()}?`;
    }

    return { hint, steps, followUpQuestion };
  }, [extractNumbers]);

  const buildFallbackTutorEvaluation = useCallback((session: TutorSession, learnerAnswer: string): TutorPayload => {
    const expected = String(session.expectedAnswer || '').trim();
    const normalizedAnswer = normalizeTutorText(learnerAnswer || '');
    let isCorrect = false;

    if (expected && normalizedAnswer) {
      const expectedNumbers = extractNumbers(expected);
      const answerNumbers = extractNumbers(learnerAnswer);
      if (expectedNumbers.length > 0 && answerNumbers.length > 0) {
        isCorrect = expectedNumbers.every(num =>
          answerNumbers.some(answerNum => Math.abs(answerNum - num) < 1e-6)
        );
      } else {
        const expectedCandidates = splitExpectedAnswers(expected).map(normalizeTutorText).filter(Boolean);
        const normalizedExpected = normalizeTutorText(expected);
        isCorrect = expectedCandidates.length > 0
          ? expectedCandidates.some(candidate =>
              normalizedAnswer === candidate || normalizedAnswer.includes(candidate) || candidate.includes(normalizedAnswer)
            )
          : normalizedExpected
            ? (normalizedAnswer === normalizedExpected || normalizedAnswer.includes(normalizedExpected) || normalizedExpected.includes(normalizedAnswer))
            : false;
      }
    }

    return {
      is_correct: isCorrect,
      score: isCorrect ? 100 : 30,
      feedback: isCorrect ? 'Correct.' : "Let's think about this.",

      correct_answer: expected || undefined,
      follow_up_question: undefined,
      subject: session.subject || undefined,
      grade: session.grade || undefined,
      topic: session.topic || undefined,
    };
  }, [extractNumbers, normalizeTutorText, splitExpectedAnswers]);

  const applyTutorHints = useCallback((payload: TutorPayload, params: {
    session?: TutorSession | null;
    incorrectStreak: number;
  }) => {
    if (payload.is_correct !== false) return payload;
    const session = params.session;
    const question = payload.follow_up_question || payload.question || session?.currentQuestion || '';
    const expectedAnswer = payload.correct_answer || session?.expectedAnswer || payload.expected_answer || null;
    const hintPack = buildTutorHintPack({
      question,
      subject: payload.subject || session?.subject || null,
      expectedAnswer,
      incorrectStreak: params.incorrectStreak,
    });

    const feedback = payload.feedback || "Let's think about this - let's work it out together.";

    let explanation = payload.explanation || '';
    if (hintPack.steps && !explanation.includes(hintPack.steps)) {
      explanation = explanation ? `${explanation}\n${hintPack.steps}` : hintPack.steps;
    }

    let followUpQuestion = payload.follow_up_question || hintPack.followUpQuestion || session?.currentQuestion || null;
    if (followUpQuestion && !followUpQuestion.trim().endsWith('?')) {
      followUpQuestion = `${followUpQuestion.trim()}?`;
    }

    let correctAnswer = payload.correct_answer;
    if (!correctAnswer && expectedAnswer && params.incorrectStreak >= 2) {
      correctAnswer = expectedAnswer;
    }

    return {
      ...payload,
      feedback,
      explanation,
      follow_up_question: followUpQuestion || payload.follow_up_question,
      correct_answer: correctAnswer,
      hint: payload.hint || hintPack.hint,
      steps: payload.steps || hintPack.steps,
    };
  }, [buildTutorHintPack]);

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
      const [voiceChatPrefs, chatUiPrefs] = await Promise.all([
        getVoiceChatPrefs(),
        getChatUIPrefs(),
      ]);
      setVoiceEnabled(voiceChatPrefs.voiceEnabled ?? true);
      setAutoSpeakResponses(voiceChatPrefs.autoSpeak ?? true);
      setShowTypingIndicator(chatUiPrefs.showTypingIndicator ?? true);
      setAutoSuggestQuestions(chatUiPrefs.autoSuggestQuestions ?? true);
      setContextualHelp(chatUiPrefs.contextualHelp ?? true);
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
  }, []);

  // hasFreeVoiceBudget check - used by voice gating and quota checks
  const hasFreeVoiceBudget = voiceBudgetRemainingMs === null
    ? true
    : voiceBudgetRemainingMs > 0;

  // Check if user has TTS/voice features
  // Note: Free tier gets a limited daily voice budget
  const hasTTSAccess = useCallback(() => {
    if (!isFreeTier) return true;
    return hasFreeVoiceBudget;
  }, [isFreeTier, hasFreeVoiceBudget]);

  const stopSpeaking = useCallback(async () => {
    if (!dashInstance) return;
    
    try {
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
    if (!dashInstance || message.type !== 'assistant') return;

    if (!voiceEnabled) {
      showAlert({
        title: 'Voice Responses Disabled',
        message: 'Enable Voice Responses in Dash AI Settings to hear spoken replies.',
        type: 'info',
        icon: 'volume-mute-outline',
        buttons: [{ text: 'OK', style: 'default' }]
      });
      return;
    }

    // Check tier for TTS access / free budget
    if (!hasTTSAccess()) {
      showAlert({
        title: isFreeTier ? 'Daily Voice Limit Reached' : 'Voice Playback - Premium',
        message: isFreeTier
          ? 'You’ve used today’s 10 minutes of voice. Upgrade for unlimited voice and voice input.'
          : 'Text-to-speech is a premium feature available on Starter and Plus plans.\n\nUpgrade to unlock:\n• Dash reads responses aloud\n• Voice input\n• Voice commands',
        type: 'info',
        icon: 'volume-high-outline',
        buttons: [
          { text: 'Maybe Later', style: 'cancel' },
          { 
            text: 'Upgrade Now', 
            onPress: () => {
              hideAlert();
              router.push('/screens/subscription-setup' as any);
            }
          }
        ]
      });
      return;
    }

    const now = Date.now();
    const sinceLastStart = now - (lastSpeakStartRef.current || 0);

    if (speakingMessageId === message.id) {
      // If this is a rapid duplicate call, ignore it instead of stopping playback.
      if (sinceLastStart < 600) {
        return;
      }
      await stopSpeaking();
      return;
    }

    if (isSpeaking && speakingMessageId) {
      // Avoid thrashing if a new speak request arrives immediately after start.
      if (sinceLastStart < 600) {
        return;
      }
      await stopSpeaking();
    }

    try {
      if (isFreeTier && message.content && process.env.NODE_ENV !== 'development') {
        const estimatedMs = Math.max(1500, Math.round((message.content.length / 12.5) * 1000));
        await consumeVoiceBudget(estimatedMs);
      }
      setIsSpeaking(true);
      setSpeakingMessageId(message.id);
      lastSpeakStartRef.current = now;
      
      await dashInstance.speakResponse(message, {
        onStart: () => {},
        onDone: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
        onStopped: () => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
        },
        onError: (error: unknown) => {
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          const errorMessage = typeof error === 'string'
            ? error
            : (error as any)?.message || '';
          const errorCode = (error as any)?.code || '';
          const normalized = `${errorCode} ${errorMessage}`.toLowerCase();

          console.error('Speech error:', error);

          let title = 'Voice Playback Error';
          let messageText = 'We had trouble speaking that response. Try again or disable voice.';

          if (normalized.includes('tts_free_tier_blocked')) {
            title = 'Voice Limit Reached';
            messageText = 'Your plan does not include voice playback. Upgrade to unlock Dash voice.';
          } else if (
            normalized.includes('auth_required') ||
            normalized.includes('unauthorized') ||
            normalized.includes('invalid token')
          ) {
            title = 'Voice Needs Login';
            messageText = 'Voice playback requires an active session. Please sign in again.';
          } else if (
            normalized.includes('azure speech not configured') ||
            normalized.includes('device_fallback') ||
            normalized.includes('tts unavailable')
          ) {
            title = 'Voice Service Offline';
            messageText = 'Azure TTS is not available right now. Check the Supabase `tts-proxy` function secrets (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION) and redeploy.';
          } else if (normalized.includes('network') || normalized.includes('fetch')) {
            title = 'Voice Network Error';
            messageText = 'Dash couldn’t reach the voice service. Check your connection and try again.';
          }

          showAlert({
            title,
            message: messageText,
            type: 'warning',
            icon: 'volume-mute-outline',
            buttons: [
              { text: 'OK', style: 'default' },
              { 
                text: 'Disable Voice', 
                onPress: () => {
                  hideAlert();
                  setVoiceEnabled(false);
                }
              }
            ]
          });
        },
      });
    } catch (error) {
      console.error('Failed to speak response:', error);
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  }, [dashInstance, speakingMessageId, isSpeaking, hasTTSAccess, showAlert, hideAlert, voiceEnabled, stopSpeaking, isFreeTier, consumeVoiceBudget]);

  // Voice and speaking functions (custom gating + alerts)

  // Internal message sender
  const sendMessageInternal = useCallback(async (text: string, attachments: DashAttachment[]) => {
    if (!dashInstance) return;

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

      // Upload attachments using dashAttachments hook
      const uploadedAttachments = await dashAttachments.uploadAttachments(attachments);
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
      const baseContextOverride = buildDashContextOverride(learnerContextRef.current || learnerContext);
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
      const normalizedRole = String(profile?.role || '').toLowerCase();
      const isLearnerRole = ['parent', 'student', 'learner'].includes(normalizedRole);
      const hasLearningAttachment = attachments.some(
        (attachment) => attachment.kind === 'image' || attachment.kind === 'document'
      );
      const stopTutor = isTutorStopIntent(userText);
      if (stopTutor && activeSession) {
        setTutorSession(null);
      }

      let tutorIntent = isLearnerRole ? detectTutorIntent(userText) : null;
      if (!tutorIntent && isLearnerRole && hasLearningAttachment) {
        tutorIntent = 'diagnostic';
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
              const execution = await ToolRegistry.execute(plan.tool, plan.parameters || {}, {
                profile,
                user,
                supabase: supabaseClient,
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
          undefined, 
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
          }
        );
        
        setStreamingMessageId(null);
        setStreamingContent('');
        setMessages(prev => prev.filter(msg => msg.id !== tempStreamingMsgId));
      } else {
        response = await dashInstance.sendMessage(
          outgoingText, 
          undefined, 
          aiAttachments.length > 0 ? aiAttachments : undefined,
          undefined,
          {
            contextOverride: mergedContextOverride,
            modelOverride: selectedModel,
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
            };
          });
        }
      } else if (!tutorPayload && tutorAction && sessionForTutorAction) {
        const fallbackFromResponse = extractTutorQuestionFromText(response?.content || '');
        const fallbackQuestion = fallbackFromResponse || (() => {
          if (!sessionForTutorAction.grade) return 'What grade are you in?';
          if (!sessionForTutorAction.subject) return 'Which subject is this?';
          if (hasLearningAttachment) {
            return 'Please type the exact question from the attachment.';
          }
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

    } catch (error) {
      console.error('Failed to send message:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to send message. Please try again.',
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
    isTutorStopIntent,
    extractLearningContext,
    buildDashContextOverride,
    buildAttachmentContext,
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
    learnerContext,
    capsReady,
    canInteractiveLessons,
    user?.id,
    profile?.role,
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

  const stopVoiceRecording = useCallback(async () => {
    if (!voiceSessionRef.current) {
      setIsRecording(false);
      return;
    }

    try {
      await voiceSessionRef.current.stop();
    } catch (error) {
      console.error('[useDashAssistant] Failed to stop voice session:', error);
    }

    if (isFreeTier && voiceInputStartAtRef.current) {
      const deltaMs = Math.max(0, Date.now() - voiceInputStartAtRef.current);
      await consumeVoiceBudget(deltaMs);
      voiceInputStartAtRef.current = null;
    }

    setIsRecording(false);
    setPartialTranscript('');
    voiceSessionRef.current = null;
  }, [consumeVoiceBudget, isFreeTier]);

  // Public send message
  const sendMessage = useCallback(async (text: string = inputText.trim()) => {
    // If voice capture is active, stop listening before sending.
    if (isRecording) {
      await stopVoiceRecording();
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
    // Check tier for voice features / free budget
    if (!hasTTSAccess()) {
      showAlert({
        title: isFreeTier ? 'Daily Voice Limit Reached' : 'Voice Features - Premium',
        message: isFreeTier
          ? 'You’ve used today’s 10 minutes of voice. Upgrade for unlimited voice input and playback.'
          : 'Voice input and text-to-speech are premium features available on Starter and Plus plans.\n\nUpgrade to unlock:\n• Voice input (speak to Dash)\n• Text-to-speech (Dash reads responses)\n• Voice commands',
        type: 'info',
        icon: 'mic-outline',
        buttons: [
          { text: 'Maybe Later', style: 'cancel' },
          { 
            text: 'Upgrade Now', 
            onPress: () => {
              hideAlert();
              router.push('/screens/subscription-setup' as any);
            }
          }
        ]
      });
      return;
    }

    // If already recording, stop and send
    if (isRecording) {
      await stopVoiceRecording();
      // The final transcript should already be in inputText from onFinal callback
      return;
    }

    // Start voice recognition
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Request microphone permission first (especially important on Android)
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Microphone Permission',
              message: 'Dash AI needs access to your microphone for voice input.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            }
          );
          
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            showAlert({
              title: 'Microphone Permission Required',
              message: 'Please grant microphone permission to use voice input with Dash.',
              type: 'warning',
              icon: 'mic-off-outline',
              buttons: [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => { hideAlert(); Linking.openSettings(); } }
              ]
            });
            return;
          }
        } catch (permErr) {
          console.error('[useDashAssistant] Permission request error:', permErr);
        }
      } else if (Platform.OS === 'ios') {
        // Use expo-audio for iOS permission
        try {
          const { status } = await AudioModule.requestPermissionsAsync();
          if (status !== 'granted') {
            showAlert({
              title: 'Microphone Permission Required',
              message: 'Please grant microphone permission to use voice input with Dash.',
              type: 'warning',
              icon: 'mic-off-outline',
              buttons: [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => { hideAlert(); Linking.openSettings(); } }
              ]
            });
            return;
          }
        } catch (permErr) {
          console.error('[useDashAssistant] iOS permission request error:', permErr);
        }
      }
      
      // Get voice provider
      if (!voiceProviderRef.current) {
        const preferredLang = dashInstance?.getPersonality?.()?.voice_settings?.language || profile?.preferred_language || null;
        const voiceLocale = resolveVoiceLocale(preferredLang);
        voiceProviderRef.current = await getSingleUseVoiceProvider(voiceLocale);
      }
      
      const provider = voiceProviderRef.current;
      const available = await provider.isAvailable();
      
      if (!available) {
        // Voice recognition not available - provide helpful guidance
        const androidMessage = `Speech recognition is not available on this device.

To enable voice input:
1. Install or update the Google app from Play Store
2. Go to Settings → Apps → Google → Permissions → Microphone
3. Enable "Offline speech recognition" in Google Settings
4. Restart EduDash Pro

Alternatively, you can use text input to chat with Dash.`;

        const iosMessage = `Speech recognition is not available.

To enable voice input:
1. Go to Settings → Privacy → Speech Recognition
2. Enable speech recognition for EduDash Pro
3. Restart the app

You can also use text input to chat with Dash.`;

        showAlert({
          title: 'Voice Input Unavailable',
          message: Platform.OS === 'android' ? androidMessage : iosMessage,
          type: 'warning',
          icon: 'mic-off-outline',
          buttons: [
            { text: 'Use Text Input', style: 'default' },
            Platform.OS === 'android' 
              ? { text: 'Open Play Store', onPress: () => { hideAlert(); Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.googlequicksearchbox'); } }
              : { text: 'Open Settings', onPress: () => { hideAlert(); Linking.openSettings(); } },
          ]
        });
        return;
      }

      // Create and start session
      const session = provider.createSession();
      voiceSessionRef.current = session;
      
      const preferredLang = dashInstance?.getPersonality?.()?.voice_settings?.language || profile?.preferred_language || null;
      const voiceLocale = resolveVoiceLocale(preferredLang);
      const started = await session.start({
        language: voiceLocale,
        onPartial: (text: string) => {
          // Show partial transcript as user speaks
          setPartialTranscript(text);
          // Update input text with partial results
          setInputText(text);
        },
        onFinal: (text: string) => {
          // Final transcript - update input text with formatting
          const formatted = formatTranscript(text, voiceLocale);
          setInputText(formatted);
          setPartialTranscript('');
          setIsRecording(false);
          if (isFreeTier && voiceInputStartAtRef.current) {
            const deltaMs = Math.max(0, Date.now() - voiceInputStartAtRef.current);
            consumeVoiceBudget(deltaMs);
            voiceInputStartAtRef.current = null;
          }
          
          // Haptic feedback for completion
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          
          // Track voice input usage
          track('edudash.voice.input_completed', {
            transcript_length: text.length,
            user_tier: tier || 'free',
          });
        },
        onError: (error: string) => {
          const msg = String(error || '');
          const isNetwork = /network|internet|offline|timeout|connection/i.test(msg);
          setIsRecording(false);
          setPartialTranscript('');
          if (voiceSessionRef.current?.isActive?.()) {
            voiceSessionRef.current.stop().catch(() => {});
          }
          if (isFreeTier && voiceInputStartAtRef.current) {
            const deltaMs = Math.max(0, Date.now() - voiceInputStartAtRef.current);
            consumeVoiceBudget(deltaMs);
            voiceInputStartAtRef.current = null;
          }
          showAlert({
            title: 'Voice Recognition Error',
            message: isNetwork
              ? 'Voice recognition needs a stable internet connection on this device. Please check your connection or use text input.'
              : 'Voice recognition failed. Please try again or use text input.',
            type: 'warning',
            icon: 'mic-off-outline',
            buttons: [{ text: 'OK', style: 'default' }],
          });
        },
      });

      if (started) {
        setIsRecording(true);
        setPartialTranscript('');
        voiceInputStartAtRef.current = Date.now();
        
        // Track voice input start
        track('edudash.voice.input_started', {
          user_tier: tier || 'free',
        });
      } else {
        showAlert({
          title: 'Voice Error',
          message: 'Failed to start voice recognition. Please check microphone permissions and try again.',
          type: 'error',
          icon: 'alert-circle-outline',
          buttons: [{ text: 'OK', style: 'default' }]
        });
      }
    } catch (error) {
      console.error('[useDashAssistant] Voice recognition error:', error);
      setIsRecording(false);
      setPartialTranscript('');
      
      showAlert({
        title: 'Voice Error',
        message: 'An error occurred with voice recognition. Please try again.',
        type: 'error',
        icon: 'alert-circle-outline',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  }, [hasTTSAccess, isRecording, stopVoiceRecording, tier, showAlert, hideAlert, dashInstance, profile?.preferred_language, resolveVoiceLocale, isFreeTier, consumeVoiceBudget]);

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
    [dashInstance, profile, user, showAlert]
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
        setIsInitialized(true);

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

        // Send initial message or add greeting
        if (initialMessage && initialMessage.trim()) {
          sendMessage(initialMessage);
        } else if (!hasExistingMessages) {
          const greeting: DashMessage = {
            id: `greeting_${Date.now()}`,
            type: 'assistant',
            content: dash.getPersonality().greeting,
            timestamp: Date.now(),
          };
          setMessages([greeting]);
        }
      } catch (error) {
        console.error('Failed to initialize Dash:', error);
        Alert.alert('Error', 'Failed to initialize AI Assistant.');
      }
    };

    initializeDash();
  }, [
    conversationId,
    initialMessage,
    loadChatPrefs,
    normalizeConversationMessages,
    hydrateFromSnapshot,
    persistConversationSnapshot,
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
      if (dashInstance && conversation) {
        dashInstance.getConversation(conversation.id).then((updatedConv: any) => {
          if (updatedConv && updatedConv.messages.length !== messages.length) {
            setMessages(normalizeConversationMessages(updatedConv.messages));
            setConversation(updatedConv);
            persistConversationSnapshot(updatedConv).catch(() => {});
          }
        });
      }

      return () => {
        if (isSpeaking) {
          stopSpeaking().catch(() => {});
        }
      };
    }, [
      dashInstance,
      conversation,
      messages.length,
      isSpeaking,
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
    
    // Refs
    flashListRef,
    inputRef,
    
    // Actions
    sendMessage,
    sendTutorAnswer,
    speakResponse,
    stopSpeaking,
    scrollToBottom,
    handleAttachFile: dashAttachments.handleAttachFile,
    handlePickDocuments: dashAttachments.handlePickDocuments,
    handlePickImages: dashAttachments.handlePickImages,
    handleTakePhoto: dashAttachments.handleTakePhoto,
    handleRemoveAttachment: dashAttachments.handleRemoveAttachment,
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
