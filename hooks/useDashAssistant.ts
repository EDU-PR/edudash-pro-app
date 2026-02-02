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

import type { DashMessage, DashConversation, DashAttachment } from '@/services/dash-ai/types';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  pickDocuments, 
  pickImages,
  takePhoto,
  uploadAttachment
} from '@/services/AttachmentService';
import { track } from '@/lib/analytics';
import { checkAIQuota, showQuotaExceededAlert } from '@/lib/ai/guards';
import type { AIQuotaFeature } from '@/lib/ai/limits';
import { getSingleUseVoiceProvider, type VoiceSession, type VoiceProvider } from '@/lib/voice/unifiedProvider';
import { formatTranscript } from '@/lib/voice/formatTranscript';
import { getChatUIPrefs, getVoiceChatPrefs, normalizeLanguageCode } from '@/lib/ai/dashSettings';
import { assertSupabase } from '@/lib/supabase';
import { calculateAge } from '@/lib/date-utils';
import { fetchParentChildren } from '@/lib/parent-children';
import { getCurrentLanguage } from '@/lib/i18n';
import { useAIModelSelection } from '@/hooks/useAIModelSelection';
import { useCapability } from '@/hooks/useCapability';
import type { AIModelId, AIModelInfo } from '@/lib/ai/models';
import { getPreferredModel, setPreferredModel } from '@/lib/ai/preferences';

interface UseDashAssistantOptions {
  conversationId?: string;
  initialMessage?: string;
  onClose?: () => void;
}

function resolveAgeBand(ageYears?: number | null, grade?: string | null): string | null {
  const raw = (grade || '').toString().toLowerCase();
  const gradeNum = raw.startsWith('r')
    ? 0
    : (() => {
        const match = raw.match(/(\d{1,2})/);
        return match ? Number(match[1]) : null;
      })();

  if (typeof gradeNum === 'number' && !Number.isNaN(gradeNum)) {
    if (gradeNum <= 1) return '3-5';
    if (gradeNum <= 3) return '6-8';
    if (gradeNum <= 7) return '9-12';
    if (gradeNum <= 9) return '13-15';
    if (gradeNum <= 12) return '16-18';
    return 'adult';
  }

  if (typeof ageYears === 'number' && !Number.isNaN(ageYears)) {
    if (ageYears <= 5) return '3-5';
    if (ageYears <= 8) return '6-8';
    if (ageYears <= 12) return '9-12';
    if (ageYears <= 15) return '13-15';
    if (ageYears <= 18) return '16-18';
    return 'adult';
  }

  return null;
}

function formatGradeLabel(grade?: string | null): string | null {
  if (!grade) return null;
  const raw = String(grade).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.startsWith('grade')) return raw.replace(/\s+/g, ' ');
  if (lower === 'r' || lower.includes('grade r')) return 'Grade R';
  const match = raw.match(/\d+/);
  if (match) return `Grade ${match[0]}`;
  return raw;
}

function isPreschoolContext(learner?: LearnerContext | null): boolean {
  const schoolType = (learner?.schoolType || '').toLowerCase();
  if (schoolType.includes('preschool') || schoolType.includes('ecd') || schoolType.includes('early')) return true;
  if (typeof learner?.ageYears === 'number' && learner.ageYears <= 6) return true;
  if (learner?.ageBand === '3-5') return true;
  return false;
}

const FREE_VOICE_BUDGET_MS = 10 * 60 * 1000;
const FREE_VOICE_BUDGET_KEY_PREFIX = '@dash_voice_free_budget_';

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function buildVoiceBudgetKey(dayKey?: string): string {
  return `${FREE_VOICE_BUDGET_KEY_PREFIX}${dayKey || getTodayKey()}`;
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
  loadingStatus: 'uploading' | 'thinking' | 'responding' | null;
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
};

type LearnerContext = {
  learnerName?: string | null;
  grade?: string | null;
  ageYears?: number | null;
  ageBand?: string | null;
  schoolType?: string | null;
  role?: string | null;
};

export function useDashAssistant(options: UseDashAssistantOptions): UseDashAssistantReturn {
  const { conversationId, initialMessage, onClose } = options;
  const { setLayout } = useDashboardPreferences();
  const { tier, ready: subReady, refresh: refreshTier } = useSubscription();
  const { user, profile } = useAuth();
  const { can, ready: capsReady } = useCapability();
  
  // State
  const [messages, setMessages] = useState<DashMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<'uploading' | 'thinking' | 'responding' | null>(null);
  const [statusStartTime, setStatusStartTime] = useState<number>(0);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<DashConversation | null>(null);
  const [dashInstance, setDashInstance] = useState<IDashAIAssistant | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [enterToSend, setEnterToSend] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [autoSpeakResponses, setAutoSpeakResponses] = useState(false);
  const [showTypingIndicator, setShowTypingIndicator] = useState(true);
  const [autoSuggestQuestions, setAutoSuggestQuestions] = useState(true);
  const [contextualHelp, setContextualHelp] = useState(true);
  const [streamingEnabledPref, setStreamingEnabledPref] = useState(false);
  const [selectedAttachments, setSelectedAttachments] = useState<DashAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
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
  
  // Voice input state
  const [isRecording, setIsRecording] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const voiceSessionRef = useRef<VoiceSession | null>(null);
  const voiceProviderRef = useRef<VoiceProvider | null>(null);
  const voiceInputStartAtRef = useRef<number | null>(null);
  
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

  const isFreeTier = (tier || 'free').toLowerCase().includes('free');
  const canInteractiveLessons = capsReady ? can('lessons.interactive') : false;

  const loadVoiceBudget = useCallback(async () => {
    if (!isFreeTier) {
      setVoiceBudgetRemainingMs(null);
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(buildVoiceBudgetKey());
      if (!raw) {
        setVoiceBudgetRemainingMs(FREE_VOICE_BUDGET_MS);
        return;
      }
      const parsed = JSON.parse(raw) as { usedMs?: number };
      const usedMs = typeof parsed?.usedMs === 'number' ? parsed.usedMs : 0;
      setVoiceBudgetRemainingMs(Math.max(FREE_VOICE_BUDGET_MS - usedMs, 0));
    } catch {
      setVoiceBudgetRemainingMs(FREE_VOICE_BUDGET_MS);
    }
  }, [isFreeTier]);

  const consumeVoiceBudget = useCallback(async (deltaMs: number) => {
    if (!isFreeTier || deltaMs <= 0) return;
    const key = buildVoiceBudgetKey();
    try {
      const raw = await AsyncStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as { usedMs?: number }) : { usedMs: 0 };
      const usedMs = typeof parsed?.usedMs === 'number' ? parsed.usedMs : 0;
      const nextUsed = Math.max(0, usedMs + deltaMs);
      await AsyncStorage.setItem(key, JSON.stringify({ usedMs: nextUsed }));
      setVoiceBudgetRemainingMs(Math.max(FREE_VOICE_BUDGET_MS - nextUsed, 0));
    } catch {}
  }, [isFreeTier]);

  useEffect(() => {
    loadVoiceBudget();
  }, [loadVoiceBudget]);

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
      const schoolType = profileAny?.school_type || profileAny?.organization_type || profileAny?.organization_membership?.school_type || null;

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

    scrollTimeoutRef.current = setTimeout(() => {
      try {
        const lastIndex = Math.max(0, (messages?.length || 1) - 1);
        flashListRef.current?.scrollToIndex({ index: lastIndex, animated });
      } catch (e) {
        console.debug('[useDashAssistant] scrollToIndex failed:', e);
      }
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
    if (/diagnostic/.test(value)) return 'diagnostic';
    if (/(quiz|test\s+me|assessment)/.test(value)) return 'quiz';
    if (/(practice|help\s+me\s+solve|one\s+practice\s+question)/.test(value)) return 'practice';
    if (/(explain|teach\s+me|walk\s+me\s+through)/.test(value)) return 'explain';
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
      'CONSISTENCY RULES:',
      '- Maintain continuity with prior messages; recap in 1-2 lines when resuming.',
      '- Ask for missing grade/age/subject when needed before deep instruction.',
      '- Use short steps, clear headings, and a quick check question.',
      '- If a tutor override is present, follow it exactly.',
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

    return lines.join('\n');
  }, []);

  const resolveVoiceLocale = useCallback((lang?: string | null): 'en-ZA' | 'af-ZA' | 'zu-ZA' => {
    const base = normalizeLanguageCode(lang || getCurrentLanguage?.());
    if (base === 'af') return 'af-ZA';
    if (base === 'zu') return 'zu-ZA';
    return 'en-ZA';
  }, []);

  const buildTutorQuestionPrompt = useCallback((session: TutorSession, userText: string) => {
    const contextParts = [
      'You are Dash, an interactive tutor for learners.',
      `Mode: ${session.mode}.`,
      session.subject ? `Subject: ${session.subject}.` : null,
      session.grade ? `Grade: ${session.grade}.` : null,
      session.topic ? `Topic: ${session.topic}.` : null,
      'Ask ONE question only and stop. Do not add extra questions or commentary.',
      'If grade or topic is missing, ask a single clarifying question instead.',
      'Return ONLY JSON wrapped in <TUTOR_PAYLOAD> tags.',
      'JSON keys: question, expected_answer, subject, grade, topic, difficulty, next_step.',
    ].filter(Boolean).join('\n');

    return `${contextParts}\nLearner request: ${userText}\n<TUTOR_PAYLOAD>{"question":"...","expected_answer":"...","subject":"...","grade":"...","topic":"...","difficulty":1,"next_step":"answer"}</TUTOR_PAYLOAD>`;
  }, []);

  const buildTutorEvaluationPrompt = useCallback((session: TutorSession, learnerAnswer: string) => {
    const contextParts = [
      'You are Dash, an interactive tutor for learners.',
      `Mode: ${session.mode}.`,
      session.subject ? `Subject: ${session.subject}.` : null,
      session.grade ? `Grade: ${session.grade}.` : null,
      session.topic ? `Topic: ${session.topic}.` : null,
      `Question: ${session.currentQuestion || 'N/A'}`,
      session.expectedAnswer ? `Expected answer: ${session.expectedAnswer}` : null,
      `Learner answer: ${learnerAnswer}`,
      'Evaluate the answer with short feedback and the correct answer.',
      'If incorrect, provide a gentle hint or example and ask ONE follow-up question.',
      'Return ONLY JSON wrapped in <TUTOR_PAYLOAD> tags.',
      'JSON keys: is_correct, score (0-100), feedback, correct_answer, explanation, misconception, follow_up_question, next_expected_answer.',
    ].filter(Boolean).join('\n');

    return `${contextParts}\n<TUTOR_PAYLOAD>{"is_correct":true,"score":100,"feedback":"...","correct_answer":"...","explanation":"...","misconception":"...","follow_up_question":"...","next_expected_answer":"..."}</TUTOR_PAYLOAD>`;
  }, []);

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
          '- Use short steps and ask one question at a time.',
        ].join('\n');

    const baseLines = [
      'TUTOR MODE OVERRIDE:',
      `Mode: ${session.mode}.`,
      learner?.learnerName ? `Learner: ${learner.learnerName}.` : null,
      learner?.grade ? `Grade: ${learner.grade}.` : session.grade ? `Grade: ${session.grade}.` : null,
      session.subject ? `Subject: ${session.subject}.` : null,
      session.topic ? `Topic: ${session.topic}.` : null,
      ageBand ? `Age band: ${ageBand}.` : null,
      learner?.schoolType ? `School type: ${learner.schoolType}.` : null,
      levelGuidance,
      'Ask ONE question only and stop. Do not add extra questions or commentary.',
      'If grade or topic is missing, ask a single clarifying question instead.',
      'Return ONLY JSON wrapped in <TUTOR_PAYLOAD> tags.',
    ];

    if (options.phase === 'evaluate') {
      baseLines.push(
        `Question: ${session.currentQuestion || 'N/A'}`,
        session.expectedAnswer ? `Expected answer: ${session.expectedAnswer}` : null,
        'Evaluate the learner’s latest message as the answer.',
        'If incorrect, provide a gentle hint and ask ONE follow-up question.'
      );
      baseLines.push(
        'JSON keys: is_correct, score (0-100), feedback, correct_answer, explanation, misconception, follow_up_question, next_expected_answer.'
      );
    } else {
      baseLines.push('JSON keys: question, expected_answer, subject, grade, topic, difficulty, next_step.');
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

  const buildTutorDisplayContent = useCallback((payload: TutorPayload, isQuestionStep: boolean) => {
    if (isQuestionStep) {
      const question = payload.question?.trim();
      if (!question) return null;
      return question;
    }

    const lines: string[] = [];
    if (typeof payload.is_correct === 'boolean') {
      lines.push(payload.is_correct ? '✅ Correct!' : '❌ Not quite.');
    }
    if (payload.feedback) lines.push(payload.feedback.trim());
    if (payload.correct_answer) {
      lines.push(`Correct answer: ${payload.correct_answer}`);
    }
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
      const [voiceChatPrefs, chatUiPrefs] = await Promise.all([
        getVoiceChatPrefs(),
        getChatUIPrefs(),
      ]);
      setVoiceEnabled(voiceChatPrefs.voiceEnabled ?? true);
      setAutoSpeakResponses(voiceChatPrefs.autoSpeak ?? false);
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

  // Attachment progress updater
  const updateAttachmentProgress = useCallback((attachmentId: string, progress: number, status?: DashAttachment['status']) => {
    setSelectedAttachments(prev => prev.map(att => 
      att.id === attachmentId 
        ? { ...att, uploadProgress: progress, ...(status && { status }) }
        : att
    ));
  }, []);

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

    if (speakingMessageId === message.id) {
      await stopSpeaking();
      return;
    }

    if (isSpeaking && speakingMessageId) {
      await stopSpeaking();
    }

    try {
      if (isFreeTier && message.content) {
        const estimatedMs = Math.max(1500, Math.round((message.content.length / 12.5) * 1000));
        await consumeVoiceBudget(estimatedMs);
      }
      setIsSpeaking(true);
      setSpeakingMessageId(message.id);
      
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
          console.error('Speech error:', error);
          showAlert({
            title: 'Voice Playback Error',
            message: 'We had trouble speaking that response. Try again or disable voice.',
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

  // Internal message sender
  const sendMessageInternal = useCallback(async (text: string, attachments: DashAttachment[]) => {
    if (!dashInstance) return;

    try {
      setIsLoading(true);
      scrollToBottom({ animated: true, delay: 120 });
      
      if (attachments.length > 0) {
        setLoadingStatus('uploading');
        setStatusStartTime(Date.now());
        setIsUploading(true);
      } else {
        setLoadingStatus('thinking');
        setStatusStartTime(Date.now());
      }

      // Upload attachments
      const uploadedAttachments: DashAttachment[] = [];
      if (attachments.length > 0 && conversation?.id) {
        for (const attachment of attachments) {
          try {
            updateAttachmentProgress(attachment.id, 0, 'uploading');
            const uploaded = await uploadAttachment(
              attachment, 
              conversation.id,
              (progress) => updateAttachmentProgress(attachment.id, progress)
            );
            updateAttachmentProgress(attachment.id, 100, 'uploaded');
            uploadedAttachments.push(uploaded);
          } catch (error) {
            console.error(`Failed to upload ${attachment.name}:`, error);
            updateAttachmentProgress(attachment.id, 0, 'failed');
            showAlert({
              title: 'Upload Failed',
              message: `Failed to upload ${attachment.name}. Please try again.`,
              type: 'error',
              icon: 'cloud-offline-outline',
              buttons: [{ text: 'OK', style: 'default' }]
            });
          }
        }
      }

      setIsUploading(false);
      setLoadingStatus('thinking');
      setStatusStartTime(Date.now());
      scrollToBottom({ animated: true, delay: 120 });

      const userText = text || 'Attached files';
      let outgoingText = userText;
      let displayText = userText;
      let tutorAction: 'start' | 'evaluate' | null = null;
      let tutorModeForMetadata: TutorMode | null = null;
      let tutorContextOverride: string | null = null;
      const baseContextOverride = buildDashContextOverride(learnerContextRef.current || learnerContext);

      const activeSession = tutorSessionRef.current;
      const stopTutor = isTutorStopIntent(userText);
      if (stopTutor && activeSession) {
        setTutorSession(null);
      }

      const tutorIntent = detectTutorIntent(userText);
      if (activeSession?.awaitingAnswer && !stopTutor) {
        tutorAction = 'evaluate';
        tutorModeForMetadata = activeSession.mode;
        outgoingText = userText;
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
        };
        setTutorSession(newSession);
        tutorAction = 'start';
        tutorModeForMetadata = newSession.mode;
        outgoingText = userText;
        tutorContextOverride = buildTutorSystemContext(newSession, {
          phase: 'start',
          learnerContext: learnerContextRef.current || learnerContext,
        });
      }
      const mergedContextOverride = [baseContextOverride, tutorContextOverride]
        .filter(Boolean)
        .join('\n\n') || null;
      const localUserMessage: DashMessage = {
        id: `local_user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'user',
        content: displayText,
        timestamp: Date.now(),
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      };
      setMessages(prev => [...prev, localUserMessage]);
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
          uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
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
          uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
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

      const tutorPayload = parseTutorPayload(response?.content || '');
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
            awaitingAnswer: true,
            currentQuestion: tutorPayload.question || prev.currentQuestion,
            expectedAnswer: tutorPayload.expected_answer || prev.expectedAnswer,
            questionIndex: needsContext ? prev.questionIndex : prev.questionIndex + 1,
          };
        });
      } else if (tutorPayload && tutorAction === 'evaluate') {
        const displayContent = buildTutorDisplayContent(tutorPayload, false);
        if (displayContent) {
          tutorOverridesRef.current[response.id] = displayContent;
          response = {
            ...response,
            content: displayContent,
            metadata: {
              ...(response.metadata || {}),
              tutor_phase: tutorModeForMetadata ? getTutorPhaseLabel(tutorModeForMetadata) : getTutorPhaseLabel('practice'),
              tutor_question: !!tutorPayload.follow_up_question,
              tutor_question_text: tutorPayload.follow_up_question || undefined,
            },
          };
        }

        if (activeSession) {
          await logTutorAttempt(activeSession, tutorPayload, userText);
          setTutorSession(prev => {
            if (!prev) return prev;
            const totalQuestions = prev.totalQuestions + 1;
            const correctCount = prev.correctCount + (tutorPayload.is_correct ? 1 : 0);
            const followUp = tutorPayload.follow_up_question || null;
            const followExpected = tutorPayload.next_expected_answer || null;
            const completed = totalQuestions >= prev.maxQuestions && !followUp;
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
            };
          });
        }
      } else if (!tutorPayload && tutorAction && activeSession) {
        const fallbackQuestion = extractTutorQuestionFromText(response?.content || '');
        if (fallbackQuestion) {
          response = {
            ...response,
            metadata: {
              ...(response.metadata || {}),
              tutor_phase: tutorModeForMetadata
                ? getTutorPhaseLabel(tutorModeForMetadata)
                : getTutorPhaseLabel(activeSession.mode),
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
          return override ? { ...msg, content: override } : msg;
        });
        setMessages(prev => (merged.length >= prev.length ? merged : prev));
        setConversation(updatedConv);
        scrollToBottom({ animated: true, delay: 150 });
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
    updateAttachmentProgress,
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
    getMaxQuestions,
    buildTutorQuestionPrompt,
    buildTutorEvaluationPrompt,
    buildTutorSystemContext,
    parseTutorPayload,
    buildTutorDisplayContent,
    extractTutorQuestionFromText,
    logTutorAttempt,
    getTutorPhaseLabel,
    learnerContext,
    capsReady,
    canInteractiveLessons,
    user?.id,
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

  // Public send message
  const sendMessage = useCallback(async (text: string = inputText.trim()) => {
    if ((!text && selectedAttachments.length === 0) || !dashInstance) return;
    
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
      attachments: [...selectedAttachments],
    });

    setInputText('');
    setSelectedAttachments([]);
    processQueue();
  }, [inputText, selectedAttachments, dashInstance, user?.id, tier, processQueue, wantsLessonGenerator]);

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
  const handleAttachFile = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showAlert({
        title: 'Attach Files',
        message: 'Choose the type of files to attach',
        type: 'info',
        icon: 'attach-outline',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Documents', onPress: () => { hideAlert(); handlePickDocuments(); } },
          { text: 'Photos', onPress: () => { hideAlert(); handlePickImages(); } }
        ]
      });
    } catch (error) {
      console.error('Failed to show file picker:', error);
    }
  }, [showAlert, hideAlert]);

  const handlePickDocuments = useCallback(async () => {
    try {
      const documents = await pickDocuments();
      if (documents.length > 0) {
        setSelectedAttachments(prev => [...prev, ...documents]);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Failed to pick documents:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to select documents.',
        type: 'error',
        icon: 'document-outline',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  }, [showAlert]);

  const handlePickImages = useCallback(async () => {
    try {
      const images = await pickImages();
      if (images.length > 0) {
        setSelectedAttachments(prev => [...prev, ...images]);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Failed to pick images:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to select images.',
        type: 'error',
        icon: 'image-outline',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  }, [showAlert]);

  const handleTakePhoto = useCallback(async () => {
    try {
      const photos = await takePhoto();
      if (photos.length > 0) {
        setSelectedAttachments(prev => [...prev, ...photos]);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
      showAlert({
        title: 'Error',
        message: 'Failed to take photo.',
        type: 'error',
        icon: 'camera-outline',
        buttons: [{ text: 'OK', style: 'default' }]
      });
    }
  }, [showAlert]);

  const handleRemoveAttachment = useCallback(async (attachmentId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedAttachments(prev => prev.filter(att => att.id !== attachmentId));
    } catch (error) {
      console.error('Failed to remove attachment:', error);
    }
  }, []);

  // Stop voice recording
  const stopVoiceRecording = useCallback(async () => {
    try {
      if (voiceSessionRef.current && voiceSessionRef.current.isActive()) {
        await voiceSessionRef.current.stop();
      }
      if (isFreeTier && voiceInputStartAtRef.current) {
        const deltaMs = Math.max(0, Date.now() - voiceInputStartAtRef.current);
        consumeVoiceBudget(deltaMs);
        voiceInputStartAtRef.current = null;
      }
      setIsRecording(false);
      setPartialTranscript('');
    } catch (error) {
      console.error('[useDashAssistant] Error stopping voice:', error);
      setIsRecording(false);
      setPartialTranscript('');
    }
  }, [isFreeTier, consumeVoiceBudget]);

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

  // Cleanup voice session on unmount
  useEffect(() => {
    return () => {
      if (voiceSessionRef.current && voiceSessionRef.current.isActive()) {
        voiceSessionRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startNewConversation = useCallback(async () => {
    if (!dashInstance) return;
    
    try {
      const newConvId = await dashInstance.startNewConversation('Chat with Dash');
      const newConv = await dashInstance.getConversation(newConvId);
      if (newConv) {
        setConversation(newConv);
        setMessages([]);
        
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
  }, [dashInstance, showAlert]);

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
          const existingConv = await dash.getConversation(conversationId);
          if (existingConv) {
            hasExistingMessages = (existingConv.messages?.length || 0) > 0;
            setConversation(existingConv);
            setMessages(existingConv.messages || []);
            dash.setCurrentConversationId(conversationId);
          }
        } else {
          const savedConvId = await AsyncStorage.getItem('@dash_ai_current_conversation_id');
          let newConvId = savedConvId || null;
          
          if (newConvId) {
            const existingConv = await dash.getConversation(newConvId);
            if (existingConv) {
              hasExistingMessages = (existingConv.messages?.length || 0) > 0;
              setConversation(existingConv);
              setMessages(existingConv.messages || []);
              dash.setCurrentConversationId(newConvId);
            } else {
              newConvId = null;
            }
          }
          
          if (!newConvId) {
            try {
              const convs = await dash.getAllConversations();
              if (Array.isArray(convs) && convs.length > 0) {
                const latest = convs.reduce((a: any, b: any) => (a.updated_at > b.updated_at ? a : b));
                hasExistingMessages = (latest.messages?.length || 0) > 0;
                setConversation(latest);
                setMessages(latest.messages || []);
                dash.setCurrentConversationId(latest.id);
              } else {
                const createdId = await dash.startNewConversation('Chat with Dash');
                const newConv = await dash.getConversation(createdId);
                if (newConv) setConversation(newConv);
              }
            } catch {
              const createdId = await dash.startNewConversation('Chat with Dash');
              const newConv = await dash.getConversation(createdId);
              if (newConv) setConversation(newConv);
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
  }, [conversationId, initialMessage, loadChatPrefs]);

  // Auto-scroll effects
  useEffect(() => {
    if (isInitialized && messages.length > 0 && flashListRef.current) {
      scrollToBottom({ animated: false, delay: 300 });
    }
  }, [isInitialized]);

  useEffect(() => {
    if (isLoading && flashListRef.current) {
      scrollToBottom({ animated: true, delay: 150 });
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
            setMessages(updatedConv.messages);
            setConversation(updatedConv);
          }
        });
      }

      return () => {
        if (dashInstance && isSpeaking) {
          setIsSpeaking(false);
          dashInstance.stopSpeaking().catch(() => {});
        }
      };
    }, [dashInstance, conversation, messages.length, isSpeaking, loadChatPrefs])
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (dashInstance) {
        dashInstance.stopSpeaking().catch(() => {});
        dashInstance.cleanup();
      }
    };
  }, [dashInstance]);

  // Web beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (dashInstance && isSpeaking) {
        dashInstance.stopSpeaking().catch(() => {});
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
  }, [dashInstance, isSpeaking]);

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
    selectedAttachments,
    isUploading,
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
    
    // Refs
    flashListRef,
    inputRef,
    
    // Actions
    sendMessage,
    sendTutorAnswer,
    speakResponse,
    stopSpeaking,
    scrollToBottom,
    handleAttachFile,
    handlePickDocuments,
    handlePickImages,
    handleTakePhoto,
    handleRemoveAttachment,
    handleInputMicPress,
    stopVoiceRecording,
    startNewConversation,
    
    // Helpers
    extractFollowUps,
    wantsLessonGenerator,
    
    // Subscription
    tier,
    subReady,
    refreshTier,
  };
}
