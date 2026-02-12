/**
 * Dash AI Assistant Chat Component
 * 
 * Modern chat interface for the Dash AI Assistant with voice recording,
 * message display, and interactive features.
 * 
 * Refactored to use:
 * - useDashAssistant hook for business logic
 * - DashMessageBubble for message rendering
 * - DashInputBar for input handling
 * - DashTypingIndicator for loading states
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Dimensions, KeyboardAvoidingView, Keyboard, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { layoutStyles, headerStyles, messageStyles, inputStyles } from './dash-assistant/styles';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  DashAssistantMessages, 
  DashMessageBubble,
  DashInputBar,
  DashTypingIndicator,
  DashHeader,
  DashUsageBanner,
  DashModelSelector,
  DashContextChips,
} from './dash-assistant';
import { useTheme } from '@/contexts/ThemeContext';
import type { DashMessage, DashAttachment } from '@/services/dash-ai/types';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { DashCommandPalette } from '@/components/ai/DashCommandPalette';
import { DashToolsModal } from '@/components/ai/DashToolsModal';
import HomeworkScanner, { type HomeworkScanResult } from '@/components/ai/HomeworkScanner';
import { AlertModal } from '@/components/ui/AlertModal';
import { useDashAssistant } from '@/hooks/useDashAssistant';
import { useRealtimeTier } from '@/hooks/useRealtimeTier';
import { useCapability } from '@/hooks/useCapability';
import { DeviceEventEmitter } from '@/lib/utils/eventEmitter';
import { useAuth } from '@/contexts/AuthContext';
import { LessonGeneratorService } from '@/lib/ai/lessonGenerator';
import { assertSupabase } from '@/lib/supabase';
import { getOrganizationType } from '@/lib/tenant/compat';
import { getDashAIRoleCopy } from '@/lib/ai/dashRoleCopy';
import { checkAIQuota, showQuotaExceededAlert } from '@/lib/ai/guards';
import { getDashToolShortcutsForRole } from '@/lib/ai/toolCatalog';
import { ToolRegistry } from '@/services/AgentTools';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
const { width: screenWidth } = Dimensions.get('window');

// Merge all style domains for backward compatibility with child components
const styles = {
  ...layoutStyles,
  ...headerStyles,
  ...messageStyles,
  ...inputStyles,
};

const formatGradeLabel = (grade?: string | null) => {
  if (!grade) return null;
  const raw = String(grade).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.startsWith('grade')) return raw.replace(/\s+/g, ' ');
  if (lower === 'r' || lower.includes('grade r')) return 'Grade R';
  const match = raw.match(/\d+/);
  if (match) return `Grade ${match[0]}`;
  return raw;
};

const formatSchoolTypeLabel = (schoolType?: string | null) => {
  if (!schoolType) return null;
  const raw = String(schoolType).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]/g, '');

  if (
    lower === 'k12_school' ||
    lower === 'k12' ||
    lower === 'combined' ||
    lower === 'primary' ||
    lower === 'secondary' ||
    lower === 'community_school' ||
    lower.includes('k-12') ||
    compact.includes('k12')
  ) {
    return 'K-12 School';
  }

  if (
    lower.includes('preschool') ||
    lower.includes('ecd') ||
    lower.includes('early') ||
    lower.includes('daycare') ||
    lower.includes('creche')
  ) {
    return 'Preschool';
  }

  return raw;
};

interface DashAssistantProps {
  conversationId?: string;
  onClose?: () => void;
  initialMessage?: string;
  handoffSource?: string;
}

export const DashAssistant: React.FC<DashAssistantProps> = ({
  conversationId,
  onClose,
  initialMessage,
  handoffSource,
}: DashAssistantProps) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { tierStatus, refresh: refreshTier } = useRealtimeTier();
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [wakeWordLoaded, setWakeWordLoaded] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const wakeWordAvailable = Platform.OS !== 'web' && !!process.env.EXPO_PUBLIC_PICOVOICE_ACCESS_KEY;
  const remaining = tierStatus && tierStatus.quotaLimit > 0
    ? Math.max(tierStatus.quotaLimit - tierStatus.quotaUsed, 0)
    : null;
  const wasLoadingRef = useRef(false);
  // Keyboard listeners for reliable show/hide detection
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });
    
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadWakeWord = async () => {
      try {
        const value = await AsyncStorage.getItem('@dash_ai_in_app_wake_word');
        if (mounted) {
          setWakeWordEnabled(value === 'true');
          setWakeWordLoaded(true);
        }
      } catch {
        if (mounted) setWakeWordLoaded(true);
      }
    };
    loadWakeWord();
    const sub = DeviceEventEmitter.addListener('dash:wake_word_toggle', (value: boolean) => {
      if (mounted) setWakeWordEnabled(!!value);
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  const toggleWakeWord = useCallback(async () => {
    if (!wakeWordEnabled && !wakeWordAvailable) {
      Alert.alert(
        'Wake Word Unavailable',
        'Wake word requires a Picovoice access key. Add EXPO_PUBLIC_PICOVOICE_ACCESS_KEY to enable "Hey Dash".'
      );
      return;
    }
    const next = !wakeWordEnabled;
    setWakeWordEnabled(next);
    try {
      await AsyncStorage.setItem('@dash_ai_in_app_wake_word', next ? 'true' : 'false');
    } catch {}
    DeviceEventEmitter.emit('dash:wake_word_toggle', next);
  }, [wakeWordEnabled]);

  // Use custom hook for all business logic
  const {
    messages,
    inputText,
    setInputText,
    isLoading,
    loadingStatus,
    isSpeaking,
    speakingMessageId,
    dashInstance,
    isInitialized,
    enterToSend,
    voiceEnabled,
    showTypingIndicator,
    autoSuggestQuestions,
    contextualHelp,
    selectedAttachments,
    isUploading,
    attachmentProgress,
    isNearBottom,
    setIsNearBottom,
    unreadCount,
    setUnreadCount,
    availableModels,
    selectedModel,
    setSelectedModel,
    isRecording,
    partialTranscript,
    alertState,
    hideAlert,
    learnerContext,
    tutorSession,
    parentChildren,
    activeChildId,
    setActiveChildId,
    flashListRef,
    inputRef,
    sendMessage,
    sendTutorAnswer,
    speakResponse,
    stopSpeaking,
    startNewConversation,
    scrollToBottom,
    handleAttachFile,
    handleTakePhoto,
    handleInputMicPress,
    stopVoiceRecording,
    handleRemoveAttachment,
    addAttachments,
    extractFollowUps,
    runTool,
    tier,
    subReady,
  } = useDashAssistant({ conversationId, initialMessage, onClose, handoffSource });
  const { can, ready: capsReady } = useCapability();
  const isTypingActive = isLoading || !!loadingStatus;

  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      refreshTier?.();
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, refreshTier]);

  const handleNewChat = useCallback(async () => {
    await stopSpeaking();
    await startNewConversation();
  }, [startNewConversation, stopSpeaking]);

  const handleRunTool = useCallback(
    async (toolName: string, params: Record<string, any>) => {
      await runTool(toolName, params);
    },
    [runTool]
  );

  const openScanner = useCallback(() => {
    if (Platform.OS === 'web') {
      void handleTakePhoto();
      return;
    }
    setScannerVisible(true);
  }, [handleTakePhoto]);

  const handleScannerScanned = useCallback((result: HomeworkScanResult) => {
    if (!result?.base64) return;
    const attachment: DashAttachment = {
      id: `attach_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: `homework_scan_${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      size: Math.max(0, Math.floor(result.base64.length * 0.75)),
      bucket: 'attachments',
      storagePath: '',
      kind: 'image',
      status: 'pending',
      previewUri: result.uri,
      uploadProgress: 0,
      meta: {
        base64: result.base64,
        image_base64: result.base64,
        image_media_type: 'image/jpeg',
        width: result.width,
        height: result.height,
        source: 'homework_scanner',
      },
    };
    addAttachments([attachment]);
    setScannerVisible(false);
  }, [addAttachments]);

  const safeModels = Array.isArray(availableModels) ? availableModels : [];
  const selectedModelInfo = useMemo(
    () => safeModels.find(model => model.id === selectedModel) || safeModels[0],
    [safeModels, selectedModel]
  );
  const estimatedRemaining = selectedModelInfo && remaining !== null
    ? Math.max(Math.floor(remaining / Math.max(selectedModelInfo.relativeCost || 1, 1)), 0)
    : null;

  const { profile, user } = useAuth();
  const roleCopy = useMemo(() => getDashAIRoleCopy(profile?.role), [profile?.role]);
  const normalizedRole = String(profile?.role || '').toLowerCase();
  const isParentOrStudent = ['parent', 'student'].includes(normalizedRole);
  const isStaff = ['teacher', 'principal', 'principal_admin', 'admin', 'staff'].includes(normalizedRole);

  // Derive activeChild for parent UI
  const activeChild = useMemo(() => {
    if (!parentChildren.length) return null;
    return parentChildren.find((c: any) => c.id === activeChildId) || parentChildren[0] || null;
  }, [parentChildren, activeChildId]);

  const orgType = getOrganizationType(profile);
  const isPreschool = orgType === 'preschool';
  const canInteractiveLessons = capsReady ? can('lessons.interactive') : false;
  const toolShortcuts = useMemo(() => {
    const shortcuts = getDashToolShortcutsForRole(profile?.role || null);
    return shortcuts.filter((tool) => ToolRegistry.hasTool(tool.name));
  }, [profile?.role]);

  const contextChips = useMemo(() => {
    if (!learnerContext) return [];
    const chips: string[] = [];
    const schoolLabel = formatSchoolTypeLabel(
      learnerContext.schoolType || (isPreschool ? 'preschool' : orgType ? String(orgType) : null)
    );
    if (schoolLabel) chips.push(schoolLabel);
    const gradeLabel = formatGradeLabel(learnerContext.grade);
    if (gradeLabel) chips.push(gradeLabel);
    if (typeof learnerContext.ageYears === 'number') {
      chips.push(`Age ${learnerContext.ageYears}`);
    }
    if (learnerContext.ageBand && !chips.find((chip) => chip.includes(learnerContext.ageBand!))) {
      chips.push(`Band ${learnerContext.ageBand}`);
    }
    if (isPreschool) {
      chips.push('Play-based');
    }
    return chips;
  }, [learnerContext, isPreschool, orgType]);

  const contextHint = useMemo(() => {
    if (!learnerContext) return null;
    if (isPreschool) {
      return 'Play-based focus: games, letters, numbers, colors, and movement.';
    }
    return 'Step-by-step focus with quick checks for understanding.';
  }, [learnerContext, isPreschool]);
  const shouldShowPreschoolContext = useMemo(() => {
    if (contextChips.length === 0) return false;
    const st = String(learnerContext?.schoolType || '').toLowerCase();
    return st.includes('preschool') || st.includes('ecd') || st.includes('early');
  }, [contextChips.length, learnerContext?.schoolType]);
  const showAdvancedControls = !isParentOrStudent;
  const showWakeWordToggle = wakeWordAvailable && showAdvancedControls;
  const usageLabel = tierStatus
    ? (remaining === null ? 'Unlimited requests available' : `${remaining} left this month`)
    : '';
  const [lastSavedLessonId, setLastSavedLessonId] = useState<string | null>(null);
  const latestAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.type === 'assistant' && messages[i]?.content) {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  const ensureLessonAccess = useCallback(async () => {
    if (!capsReady) {
      Alert.alert('Please wait', 'Loading your subscription details. Try again in a moment.');
      return false;
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
      return false;
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
        return false;
      }
    }
    return true;
  }, [capsReady, canInteractiveLessons, user?.id]);

  const saveLessonFromMessage = useCallback(async () => {
    if (!latestAssistantMessage || !profile) return;
    const allowed = await ensureLessonAccess();
    if (!allowed) return;
    const schoolId = profile.preschool_id || profile.organization_id;
    if (!schoolId || !profile.id) {
      Alert.alert('Missing school', 'Please connect your school profile first.');
      return;
    }

    const text = String(latestAssistantMessage.content || '').trim();
    if (!text) return;
    const titleLine = text.split('\n').find((line) => line.trim()) || 'Dash Lesson Draft';
    const title = titleLine.replace(/^#+\s*/, '').slice(0, 80).trim() || 'Dash Lesson Draft';
    const description = text.slice(0, 180);

    try {
      const { data: category } = await assertSupabase()
        .from('lesson_categories')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (!category?.id) {
        Alert.alert('Missing category', 'Please create a lesson category first.');
        return;
      }
      const result = await LessonGeneratorService.saveGeneratedLesson({
        lesson: {
          title,
          description,
          content: JSON.stringify({
            overview: text,
            linked_interactive_activity_ids: [],
          }),
          activities: [],
        },
        teacherId: profile.id,
        preschoolId: schoolId,
        ageGroupId: isPreschool ? '3-5' : '7-9',
        categoryId: category.id,
        template: { duration: 30, complexity: 'moderate' },
        isPublished: false,
        subject: 'general',
      });
      if (!result?.success || !result.lessonId) {
        Alert.alert('Save failed', result?.error || 'Failed to save lesson');
        return;
      }
      setLastSavedLessonId(result.lessonId);
      Alert.alert('Saved', 'Lesson draft saved. Assign it to a class now?', [
        { text: 'Later', style: 'cancel' },
        { text: 'Assign now', onPress: () => router.push(`/screens/assign-lesson?lessonId=${result.lessonId}` as any) },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save lesson';
      Alert.alert('Save failed', message);
    }
  }, [latestAssistantMessage, profile, isPreschool, ensureLessonAccess]);

  const saveActivityFromMessage = useCallback(async () => {
    if (!latestAssistantMessage || !user || !profile) return;
    const allowed = await ensureLessonAccess();
    if (!allowed) return;
    const schoolId = profile.preschool_id || profile.organization_id;
    if (!schoolId) {
      Alert.alert('Missing school', 'Please connect your school profile first.');
      return;
    }
    const text = String(latestAssistantMessage.content || '').trim();
    if (!text) return;

    const titleLine = text.split('\n').find((line) => line.trim()) || 'Dash Activity Draft';
    const title = titleLine.replace(/^#+\s*/, '').slice(0, 80).trim() || 'Dash Activity Draft';
    try {
      const { data, error } = await assertSupabase()
        .from('interactive_activities')
        .insert({
          preschool_id: schoolId,
          teacher_id: user.id,
          activity_type: 'quiz',
          title,
          instructions: text.slice(0, 1000),
          content: {},
          difficulty_level: 1,
          age_group_min: 3,
          age_group_max: 6,
          stars_reward: 2,
          subject: isPreschool ? 'life_skills' : 'general',
          skills: JSON.stringify(['discussion', 'reflection']),
          is_active: false,
          is_published: false,
          approval_status: 'pending',
          approved_by: null,
          approved_at: null,
          is_template: false,
        })
        .select('id')
        .single();
      if (error) throw error;
      if (lastSavedLessonId && data?.id) {
        try {
          const { data: lessonRow } = await assertSupabase()
            .from('lessons')
            .select('content')
            .eq('id', lastSavedLessonId)
            .maybeSingle();
          const content = lessonRow?.content;
          let updatedContent: unknown = content;
          if (content && typeof content === 'string') {
            try {
              const parsed = JSON.parse(content);
              const linked = Array.isArray(parsed?.linked_interactive_activity_ids)
                ? parsed.linked_interactive_activity_ids
                : [];
              if (!linked.includes(data.id)) linked.push(data.id);
              updatedContent = JSON.stringify({ ...parsed, linked_interactive_activity_ids: linked });
            } catch {
              updatedContent = JSON.stringify({
                overview: content,
                linked_interactive_activity_ids: [data.id],
              });
            }
          } else if (content && typeof content === 'object') {
            const linked = Array.isArray((content as any).linked_interactive_activity_ids)
              ? (content as any).linked_interactive_activity_ids
              : [];
            if (!linked.includes(data.id)) linked.push(data.id);
            updatedContent = { ...(content as any), linked_interactive_activity_ids: linked };
          } else {
            updatedContent = JSON.stringify({
              overview: text,
              linked_interactive_activity_ids: [data.id],
            });
          }
          await assertSupabase()
            .from('lessons')
            .update({ content: updatedContent })
            .eq('id', lastSavedLessonId);
        } catch {}
      }
      Alert.alert('Saved', 'Interactive activity created. Edit details now?', [
        { text: 'Later', style: 'cancel' },
        { text: 'Edit now', onPress: () => router.push('/screens/teacher-activity-builder') },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save activity';
      Alert.alert('Save failed', message);
    }
  }, [latestAssistantMessage, profile?.preschool_id, user, isPreschool, ensureLessonAccess]);

  const saveRoutineFromMessage = useCallback(async () => {
    if (!latestAssistantMessage || !user || !profile) return;
    const organizationId = profile.preschool_id || profile.organization_id;
    if (!organizationId) {
      Alert.alert('Missing school', 'Please connect your school profile first.');
      return;
    }
    const text = String(latestAssistantMessage.content || '').trim();
    if (!text) return;
    const titleLine = text.split('\n').find((line) => line.trim()) || 'Daily Routine';
    const title = titleLine.replace(/^#+\s*/, '').slice(0, 80).trim() || 'Daily Routine';
    try {
      const { data: classes, error: classError } = await assertSupabase()
        .from('classes')
        .select('id')
        .or(`preschool_id.eq.${organizationId},organization_id.eq.${organizationId}`)
        .order('name')
        .limit(1);
      if (classError) throw classError;
      const classId = classes?.[0]?.id;
      if (!classId) {
        Alert.alert('Missing class', 'Please create a class before saving routines.');
        return;
      }

      const { error } = await assertSupabase()
        .from('daily_activities')
        .insert({
          activity_name: title,
          description: text.slice(0, 240),
          notes: text.slice(0, 1200),
          activity_date: new Date().toISOString().split('T')[0],
          class_id: classId,
          created_by: user.id,
        });
      if (error) throw error;
      Alert.alert('Saved', 'Routine added to daily activities.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save routine';
      Alert.alert('Save failed', message);
    }
  }, [latestAssistantMessage, profile, user]);

  const saveThemeFromMessage = useCallback(async () => {
    if (!latestAssistantMessage || !profile) return;
    const organizationId = profile.preschool_id || profile.organization_id;
    if (!organizationId) {
      Alert.alert('Missing school', 'Please connect your school profile first.');
      return;
    }
    const text = String(latestAssistantMessage.content || '').trim();
    if (!text) return;
    const titleLine = text.split('\n').find((line) => line.trim()) || 'Weekly Theme';
    const title = titleLine.replace(/^#+\s*/, '').slice(0, 80).trim() || 'Weekly Theme';

    try {
      const { error } = await assertSupabase()
        .from('curriculum_themes')
        .insert({
          preschool_id: organizationId,
          created_by: profile.id,
          title,
          description: text.slice(0, 400),
          suggested_activities: { raw: text.slice(0, 2000) },
          age_groups: isPreschool ? ['3-5'] : null,
          is_published: false,
          is_template: false,
        });
      if (error) throw error;
      Alert.alert('Saved', 'Theme added to curriculum themes.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save theme';
      Alert.alert('Save failed', message);
    }
  }, [latestAssistantMessage, profile, isPreschool]);

  const handleAgeBandChange = useCallback((band: string) => {
    if (!dashInstance?.updateUserContext) return;
    let ageGroup: 'child' | 'teen' | 'adult' | null = null;
    let gradeBand: string | null = null;
    if (band === 'adult') {
      ageGroup = 'adult';
      gradeBand = null;
    } else if (band === '13-15' || band === '16-18') {
      ageGroup = 'teen';
      gradeBand = band === '13-15' ? '8-9' : '10-12';
    } else if (band === 'auto') {
      ageGroup = null;
      gradeBand = null;
    } else {
      ageGroup = 'child';
      gradeBand = band === '3-5' ? 'R-1' : band === '6-8' ? '2-3' : '4-7';
    }
    dashInstance.updateUserContext({
      age_group: ageGroup === null ? null : ageGroup,
      grade_levels: gradeBand ? [gradeBand] : null,
    }).catch(() => {});
  }, [dashInstance]);

  // Scroll to bottom when keyboard shows to keep messages visible
  useEffect(() => {
    if (keyboardVisible && messages.length > 0) {
      // Small delay to let keyboard animation complete on Android
      const timer = setTimeout(() => {
        scrollToBottom({ animated: true, delay: 50 });
      }, Platform.OS === 'android' ? 150 : 50);
      return () => clearTimeout(timer);
    }
  }, [keyboardVisible, scrollToBottom, messages.length]);

  // Render individual message
  const renderMessage = useCallback((message: DashMessage, index: number) => {
    return (
      <DashMessageBubble
        key={message.id}
        message={message}
        index={index}
        totalMessages={messages.length}
        speakingMessageId={speakingMessageId}
        isLoading={isLoading}
        voiceEnabled={voiceEnabled}
        showFollowUps={autoSuggestQuestions}
        onSpeak={speakResponse}
        onRetry={(content) => sendMessage(content)}
        onSendFollowUp={(text) => sendMessage(text)}
        onSendTutorAnswer={(text, sourceMessageId) => sendTutorAnswer(text, sourceMessageId)}
        extractFollowUps={extractFollowUps}
        assistantLabel={roleCopy.assistantLabel}
      />
    );
  }, [messages.length, speakingMessageId, isLoading, speakResponse, sendMessage, extractFollowUps, roleCopy.assistantLabel]);

  // Render typing indicator
  const renderTypingIndicator = useCallback(() => {
    if (!isTypingActive) return null;
    return (
      <DashTypingIndicator 
        isLoading={isTypingActive} 
        loadingStatus={loadingStatus} 
      />
    );
  }, [isTypingActive, loadingStatus]);

  // Render suggested actions
  const renderSuggestedActions = useCallback(() => {
    if (!contextualHelp) {
      return null;
    }
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.type === 'user' || !lastMessage.metadata?.suggested_actions) {
      return null;
    }

    const handleSuggestedAction = (action: string) => {
      const actionMap: Record<string, string> = {
        'switch_to_enhanced': 'switch to enhanced dashboard',
        'switch_to_classic': 'switch to classic dashboard', 
        'dashboard_help': 'help me with dashboard settings',
        'dashboard_settings': 'show dashboard settings',
        'view_enhanced_features': 'what are enhanced dashboard features',
        'view_classic_features': 'what are classic dashboard features',
        'switch_dashboard_layout': 'help me switch dashboard layout',
        'view_options': 'show me dashboard options',
        'export_pdf': 'export pdf',
        'send_message': 'message parents',
        'view_financial_dashboard': 'open financial dashboard',
        'create_announcement': 'create announcement'
      };
      
      const command = actionMap[action] || action.replace('_', ' ');
      sendMessage(command);
    };

    const getActionDisplayText = (action: string): string => {
      const displayMap: Record<string, string> = {
        'switch_to_enhanced': '✨ Enhanced Dashboard',
        'switch_to_classic': '📊 Classic Dashboard',
        'dashboard_help': 'Dashboard Help',
        'dashboard_settings': '⚙️ Settings',
        'view_enhanced_features': '🌟 Enhanced Features',
        'view_classic_features': '📋 Classic Features',
        'switch_dashboard_layout': '🔄 Switch Layout',
        'view_options': '👀 View Options',
        'explore_features': '🔍 Explore Features',
        'lesson_planning': '📚 Lesson Planning',
        'student_management': '👥 Student Management',
      };
      
      return displayMap[action] || action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    return (
      <View style={messageStyles.suggestedActionsContainer}>
        <Text style={[messageStyles.suggestedActionsTitle, { color: theme.textSecondary }]}>
          Quick actions
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={messageStyles.suggestedActionsScrollContent}
        >
          {lastMessage.metadata.suggested_actions.map((action: string, index: number) => (
            <TouchableOpacity
              key={index}
              style={[
                messageStyles.suggestedAction, 
                { 
                  backgroundColor: action.includes('dashboard') ? theme.primaryLight : theme.surfaceVariant,
                  borderColor: action.includes('dashboard') ? theme.primary : theme.border,
                  borderWidth: 1
                }
              ]}
              onPress={() => handleSuggestedAction(action)}
            >
              <Text style={[messageStyles.suggestedActionText, { color: theme.text }]}>
                {getActionDisplayText(action)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }, [messages, theme, sendMessage, contextualHelp]);

  // Loading state
  if (!isInitialized) {
    return (
      <View style={[layoutStyles.loadingContainer, { backgroundColor: theme.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <EduDashSpinner size="large" color={theme.primary} />
        <Text style={[layoutStyles.loadingText, { color: theme.text }]}>
          Initializing Dash...
        </Text>
      </View>
    );
  }

    const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : 'height';
    const keyboardOffset = Platform.OS === 'ios' ? 90 : 0;
    const backgroundBase: [string, string, string] = isDark
      ? ['#0B1020', '#0F172A', theme.background]
      : ['#F7FAFF', '#EEF2FF', '#F8FAFC'];
    const glowA: [string, string, string] = isDark
      ? ['rgba(14,165,233,0.32)', 'rgba(59,130,246,0.05)', 'transparent']
      : ['rgba(14,165,233,0.35)', 'rgba(34,211,238,0.12)', 'transparent'];
    const glowB: [string, string, string] = isDark
      ? ['rgba(16,185,129,0.25)', 'rgba(99,102,241,0.06)', 'transparent']
      : ['rgba(16,185,129,0.3)', 'rgba(59,130,246,0.08)', 'transparent'];
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <KeyboardAvoidingView 
        style={[layoutStyles.container, { backgroundColor: theme.background }]}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={keyboardOffset}
      >
        <View pointerEvents="none" style={layoutStyles.backgroundLayer}>
          <LinearGradient colors={backgroundBase} style={layoutStyles.backgroundGradient} />
          <LinearGradient colors={glowA} style={layoutStyles.backgroundGlowA} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <LinearGradient colors={glowB} style={layoutStyles.backgroundGlowB} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} />
        </View>
        <View style={layoutStyles.contentLayer}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        
        {/* Header - auto-hide on scroll down */}
        {headerVisible && (
        <DashHeader
          roleCopy={roleCopy}
          tier={tier}
          subReady={subReady}
          isSpeaking={isSpeaking}
          showAdvancedControls={showAdvancedControls}
          showWakeWordToggle={showWakeWordToggle}
          wakeWordEnabled={wakeWordEnabled}
          wakeWordLoaded={wakeWordLoaded}
          tutorSession={tutorSession}
          onClose={onClose}
          stopSpeaking={stopSpeaking}
          handleNewChat={handleNewChat}
          toggleWakeWord={toggleWakeWord}
          cleanup={dashInstance ? () => dashInstance.cleanup() : undefined}
          styles={styles}
          theme={theme}
        />
        )}

        <View style={layoutStyles.topDeck}>
          {/* Context chips, usage banner, model selector - staff only */}
          {showAdvancedControls && headerVisible && shouldShowPreschoolContext && (
            <DashContextChips
              chips={contextChips}
              contextHint={contextHint}
              styles={styles}
              theme={theme}
            />
          )}

          {/* Usage banner - staff only (parents see quota on settings page) */}
          {showAdvancedControls && headerVisible && (
            <DashUsageBanner
              tierStatus={tierStatus}
              usageLabel={usageLabel}
              styles={styles}
              theme={theme}
            />
          )}

          {/* Model selector - staff only (parents auto-get best model for tier) */}
          {showAdvancedControls && (
          <DashModelSelector
            models={safeModels}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            estimatedRemaining={estimatedRemaining}
            styles={styles}
            theme={theme}
          />
          )}
        </View>

        {/* Messages */}
        <DashAssistantMessages
          flashListRef={flashListRef}
          messages={messages}
          renderMessage={renderMessage}
          styles={styles}
          theme={theme}
          isLoading={isTypingActive}
          isNearBottom={isNearBottom}
          setIsNearBottom={setIsNearBottom}
          unreadCount={unreadCount}
          setUnreadCount={setUnreadCount}
          scrollToBottom={scrollToBottom}
          renderTypingIndicator={renderTypingIndicator}
          renderSuggestedActions={renderSuggestedActions}
          onSendMessage={(text) => sendMessage(text)}
          onAgeBandChange={handleAgeBandChange}
          learnerContext={learnerContext}
          bottomInset={insets.bottom}
          keyboardVisible={keyboardVisible}
          parentChildren={parentChildren}
          activeChild={activeChild}
          onSelectChild={(childId) => setActiveChildId(childId)}
          onOpenScanner={openScanner}
          userRole={normalizedRole}
        />

        {isStaff && latestAssistantMessage && (
          <View style={[inputStyles.staffActionsShell, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <View style={inputStyles.staffActionsHeader}>
              <View style={inputStyles.staffActionsTitleWrap}>
                <Ionicons name="flash-outline" size={14} color={theme.primary} />
                <Text style={[inputStyles.staffActionsTitle, { color: theme.text }]}>Command deck</Text>
              </View>
              <Text style={[inputStyles.staffActionsToggleText, { color: theme.textSecondary }]}>
                Tap to apply
              </Text>
            </View>

            <View
              style={[
                inputStyles.staffActionScroll,
                { flexDirection: 'row', flexWrap: 'wrap', paddingRight: 0, paddingBottom: 2 },
              ]}
            >
              <TouchableOpacity
                style={[inputStyles.staffActionPrimary, { backgroundColor: theme.primary }]}
                onPress={saveLessonFromMessage}
                activeOpacity={0.85}
              >
                <Ionicons name="book-outline" size={16} color={theme.onPrimary || '#fff'} />
                <Text style={[inputStyles.staffActionText, { color: theme.onPrimary || '#fff' }]}>Save lesson</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[inputStyles.staffActionButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
                onPress={saveRoutineFromMessage}
              >
                <Ionicons name="time-outline" size={16} color={theme.text} />
                <Text style={[inputStyles.staffActionText, { color: theme.text }]}>Save routine</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[inputStyles.staffActionButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
                onPress={saveThemeFromMessage}
              >
                <Ionicons name="color-palette-outline" size={16} color={theme.text} />
                <Text style={[inputStyles.staffActionText, { color: theme.text }]}>Save theme</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[inputStyles.staffActionButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
                onPress={saveActivityFromMessage}
              >
                <Ionicons name="extension-puzzle-outline" size={16} color={theme.text} />
                <Text style={[inputStyles.staffActionText, { color: theme.text }]}>Create activity</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[inputStyles.staffActionButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
                onPress={() => router.push('/screens/teacher-activity-builder')}
              >
                <Ionicons name="hammer-outline" size={16} color={theme.text} />
                <Text style={[inputStyles.staffActionText, { color: theme.text }]}>Edit activity</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Jump to end FAB */}
        {Platform.OS === 'android' && !isNearBottom && messages.length > 0 && (
          <TouchableOpacity
            style={[messageStyles.scrollToBottomFab, { backgroundColor: theme.primary, bottom: (messageStyles.scrollToBottomFab?.bottom || 24) + 8 }]}
            onPress={() => { setUnreadCount(0); scrollToBottom({ animated: true, delay: 0 }); }}
            accessibilityLabel="Jump to bottom"
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-down" size={20} color={theme.onPrimary || '#fff'} />
            {unreadCount > 0 && (
              <View style={[messageStyles.scrollToBottomBadge, { backgroundColor: theme.error }]}>
                <Text style={[messageStyles.scrollToBottomBadgeText, { color: theme.onError || '#fff' }]}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Input Area */}
        <DashInputBar
          inputRef={inputRef}
          inputText={inputText}
          setInputText={setInputText}
          enterToSend={enterToSend}
          selectedAttachments={selectedAttachments}
          attachmentProgress={attachmentProgress}
          learnerContext={learnerContext}
          isLoading={isLoading}
          isUploading={isUploading}
          isRecording={isRecording}
          isSpeaking={isSpeaking}
          partialTranscript={partialTranscript}
          placeholder={roleCopy.inputPlaceholder}
          messages={messages}
          onSend={() => sendMessage()}
          onMicPress={handleInputMicPress}
          onTakePhoto={openScanner}
          onAttachFile={handleAttachFile}
          onOpenTools={showAdvancedControls && toolShortcuts.length > 0 ? () => setShowToolsModal(true) : undefined}
          onRemoveAttachment={handleRemoveAttachment}
          onQuickAction={(text) => sendMessage(text)}
          bottomInset={insets.bottom}
          hideQuickChips={messages.length === 0}
        />

        {/* Command Palette Modal */}
        <DashCommandPalette visible={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
        
        {/* Premium/Alert Modal */}
        <AlertModal
          visible={alertState.visible}
          title={alertState.title}
          message={alertState.message}
          type={alertState.type}
          icon={alertState.icon as any}
          buttons={alertState.buttons}
          onClose={hideAlert}
        />
        <DashToolsModal
          visible={showToolsModal}
          onClose={() => setShowToolsModal(false)}
          tools={toolShortcuts}
          getToolSchema={(toolName) => ToolRegistry.getTool(toolName)?.parameters}
          onRunTool={handleRunTool}
        />
        <HomeworkScanner
          visible={scannerVisible}
          onClose={() => setScannerVisible(false)}
          onScanned={handleScannerScanned}
          title="Scan Homework"
        />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default DashAssistant;
