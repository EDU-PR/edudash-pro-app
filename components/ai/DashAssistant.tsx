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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { styles } from './DashAssistant.styles';
import { Ionicons } from '@expo/vector-icons';
import { 
  DashAssistantMessages, 
  DashMessageBubble,
  DashInputBar,
  DashTypingIndicator 
} from './dash-assistant';
import { useTheme } from '@/contexts/ThemeContext';
import type { DashMessage } from '@/services/dash-ai/types';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { DashCommandPalette } from '@/components/ai/DashCommandPalette';
import { TierBadge } from '@/components/ui/TierBadge';
import { AlertModal } from '@/components/ui/AlertModal';
import { useDashAssistant } from '@/hooks/useDashAssistant';
import { useRealtimeTier } from '@/hooks/useRealtimeTier';
import { DeviceEventEmitter } from '@/lib/utils/eventEmitter';
import { useAuth } from '@/contexts/AuthContext';
import { LessonGeneratorService } from '@/lib/ai/lessonGenerator';
import { assertSupabase } from '@/lib/supabase';
import { getOrganizationType } from '@/lib/tenant/compat';
import { getDashAIRoleCopy } from '@/lib/ai/dashRoleCopy';

const { width: screenWidth } = Dimensions.get('window');

interface DashAssistantProps {
  conversationId?: string;
  onClose?: () => void;
  initialMessage?: string;
}

export const DashAssistant: React.FC<DashAssistantProps> = ({
  conversationId,
  onClose,
  initialMessage
}: DashAssistantProps) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { tierStatus } = useRealtimeTier();
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [wakeWordLoaded, setWakeWordLoaded] = useState(false);
  const wakeWordAvailable = Platform.OS !== 'web' && !!process.env.EXPO_PUBLIC_PICOVOICE_ACCESS_KEY;
  const remaining = tierStatus && tierStatus.quotaLimit > 0
    ? Math.max(tierStatus.quotaLimit - tierStatus.quotaUsed, 0)
    : null;
  const selectedModelInfo = useMemo(
    () => availableModels.find(model => model.id === selectedModel) || availableModels[0],
    [availableModels, selectedModel]
  );
  const estimatedRemaining = selectedModelInfo && remaining !== null
    ? Math.max(Math.floor(remaining / Math.max(selectedModelInfo.relativeCost || 1, 1)), 0)
    : null;
  
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
    flashListRef,
    inputRef,
    sendMessage,
    sendTutorAnswer,
    speakResponse,
    stopSpeaking,
    scrollToBottom,
    handleAttachFile,
    handleTakePhoto,
    handleInputMicPress,
    stopVoiceRecording,
    handleRemoveAttachment,
    extractFollowUps,
    tier,
    subReady,
  } = useDashAssistant({ conversationId, initialMessage, onClose });

  const { profile, user } = useAuth();
  const roleCopy = useMemo(() => getDashAIRoleCopy(profile?.role), [profile?.role]);
  const normalizedRole = String(profile?.role || '').toLowerCase();
  const isStaff = ['teacher', 'principal', 'principal_admin', 'admin', 'staff'].includes(normalizedRole);
  const orgType = getOrganizationType(profile);
  const isPreschool = orgType === 'preschool';
  const [lastSavedLessonId, setLastSavedLessonId] = useState<string | null>(null);
  const latestAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.type === 'assistant' && messages[i]?.content) {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  const saveLessonFromMessage = useCallback(async () => {
    if (!latestAssistantMessage || !profile) return;
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
  }, [latestAssistantMessage, profile, isPreschool]);

  const saveActivityFromMessage = useCallback(async () => {
    if (!latestAssistantMessage || !user || !profile) return;
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
          is_active: true,
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
  }, [latestAssistantMessage, profile?.preschool_id, user, isPreschool]);

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
    if (!showTypingIndicator) return null;
    return (
      <DashTypingIndicator 
        isLoading={isLoading} 
        loadingStatus={loadingStatus} 
      />
    );
  }, [isLoading, loadingStatus, showTypingIndicator]);

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
      <View style={styles.suggestedActionsContainer}>
        <Text style={[styles.suggestedActionsTitle, { color: theme.textSecondary }]}>
          Quick actions:
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestedActionsScrollContent}
        >
          {lastMessage.metadata.suggested_actions.map((action: string, index: number) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.suggestedAction, 
                { 
                  backgroundColor: action.includes('dashboard') ? theme.primaryLight : theme.surfaceVariant,
                  borderColor: action.includes('dashboard') ? theme.primary : theme.border,
                  borderWidth: 1
                }
              ]}
              onPress={() => handleSuggestedAction(action)}
            >
              <Text style={[styles.suggestedActionText, { color: theme.text }]}>
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
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          Initializing Dash...
        </Text>
      </View>
    );
  }

    const Container: React.ElementType = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
    const keyboardOffset = insets.top + (Platform.OS === 'ios' ? 6 : 0);
    const containerProps = Platform.OS === 'ios'
      ? { behavior: 'padding' as const, keyboardVerticalOffset: keyboardOffset }
      : {};
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <Container 
        style={[styles.container, { backgroundColor: theme.background }]}
        {...containerProps}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.headerLeft}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>
                  {roleCopy.title}
                </Text>
                {subReady && tier && (
                  <TierBadge tier={tier as any} size="sm" />
                )}
              </View>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {roleCopy.subtitle}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {isSpeaking && (
              <TouchableOpacity
                style={[styles.iconButton, { backgroundColor: theme.error }]}
                accessibilityLabel="Stop speaking"
                onPress={stopSpeaking}
              >
                <Ionicons name="stop" size={screenWidth < 400 ? 18 : 22} color={theme.onError || theme.background} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.iconButton}
              accessibilityLabel="Conversations"
              onPress={() => router.push('/screens/dash-conversations-history')}
            >
              <Ionicons name="time-outline" size={screenWidth < 400 ? 18 : 22} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              accessibilityLabel="Open Dash Orb"
              onPress={() => router.push('/screens/dash-orb')}
            >
              <Ionicons name="grid-outline" size={screenWidth < 400 ? 18 : 22} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              accessibilityLabel="Toggle wake word"
              onPress={toggleWakeWord}
              disabled={!wakeWordLoaded}
            >
              <Ionicons
                name={wakeWordEnabled ? 'ear' : 'ear-outline'}
                size={screenWidth < 400 ? 18 : 22}
                color={wakeWordEnabled ? theme.success : theme.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              accessibilityLabel="Settings"
              onPress={() => router.push('/screens/dash-ai-settings')}
            >
              <Ionicons name="settings-outline" size={screenWidth < 400 ? 18 : 22} color={theme.text} />
            </TouchableOpacity>
            {onClose && (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={async () => {
                  if (dashInstance) {
                    await stopSpeaking();
                    dashInstance.cleanup();
                  }
                  onClose();
                }}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={screenWidth < 400 ? 20 : 24} color={theme.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {tierStatus && (
          <View style={[styles.usageBanner, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Ionicons name="sparkles-outline" size={14} color={theme.primary} />
            <Text style={[styles.usageBannerText, { color: theme.textSecondary }]}>
              {tierStatus.tierDisplayName} • {remaining === null ? 'Unlimited' : `${remaining} left today`}
            </Text>
            {tierStatus.quotaLimit > 0 && (
              <View style={[styles.usageProgress, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.usageProgressFill,
                    { backgroundColor: theme.primary, width: `${Math.min(tierStatus.quotaPercentage, 100)}%` },
                  ]}
                />
              </View>
            )}
          </View>
        )}

        {availableModels.length > 0 && (
          <View style={[styles.modelSelector, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <View style={styles.modelSelectorHeader}>
              <Text style={[styles.modelSelectorTitle, { color: theme.text }]}>Model</Text>
              {selectedModelInfo && (
                <Text style={[styles.modelSelectorHint, { color: theme.textSecondary }]}>
                  {selectedModelInfo.displayName} • {estimatedRemaining === null ? 'Unlimited' : `~${estimatedRemaining} chats left`}
                </Text>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modelSelectorRow}>
              {availableModels.map((model) => {
                const isActive = model.id === selectedModel;
                return (
                  <TouchableOpacity
                    key={model.id}
                    style={[
                      styles.modelChip,
                      { borderColor: theme.border, backgroundColor: theme.surfaceVariant },
                      isActive && { borderColor: theme.primary, backgroundColor: theme.primary + '22' },
                    ]}
                    onPress={() => setSelectedModel(model.id)}
                  >
                    <Text style={[styles.modelChipTitle, { color: isActive ? theme.primary : theme.text }]}>
                      {model.displayName}
                    </Text>
                    <Text style={[styles.modelChipSub, { color: theme.textSecondary }]}>
                      {model.relativeCost}x usage
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Messages */}
        <DashAssistantMessages
          flashListRef={flashListRef}
          messages={messages}
          renderMessage={renderMessage}
          styles={styles}
          theme={theme}
          isLoading={isLoading}
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
        />

        {isStaff && latestAssistantMessage && (
          <View style={[styles.staffActionsRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <TouchableOpacity
              style={[styles.staffActionButton, { backgroundColor: theme.primary }]}
              onPress={saveLessonFromMessage}
            >
              <Ionicons name="book-outline" size={16} color={theme.onPrimary || '#fff'} />
              <Text style={[styles.staffActionText, { color: theme.onPrimary || '#fff' }]}>Save lesson</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.staffActionButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
              onPress={saveRoutineFromMessage}
            >
              <Ionicons name="time-outline" size={16} color={theme.text} />
              <Text style={[styles.staffActionText, { color: theme.text }]}>Save routine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.staffActionButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
              onPress={saveThemeFromMessage}
            >
              <Ionicons name="color-palette-outline" size={16} color={theme.text} />
              <Text style={[styles.staffActionText, { color: theme.text }]}>Save theme</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.staffActionButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
              onPress={saveActivityFromMessage}
            >
              <Ionicons name="extension-puzzle-outline" size={16} color={theme.text} />
              <Text style={[styles.staffActionText, { color: theme.text }]}>Create activity</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.staffActionButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
              onPress={() => router.push('/screens/teacher-activity-builder')}
            >
              <Ionicons name="hammer-outline" size={16} color={theme.text} />
              <Text style={[styles.staffActionText, { color: theme.text }]}>Edit activity</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Jump to end FAB */}
        {Platform.OS === 'android' && !isNearBottom && messages.length > 0 && (
          <TouchableOpacity
            style={[styles.scrollToBottomFab, { backgroundColor: theme.primary, bottom: (styles.scrollToBottomFab?.bottom || 24) + 8 }]}
            onPress={() => { setUnreadCount(0); scrollToBottom({ animated: true, delay: 0 }); }}
            accessibilityLabel="Jump to bottom"
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-down" size={20} color={theme.onPrimary || '#fff'} />
            {unreadCount > 0 && (
              <View style={[styles.scrollToBottomBadge, { backgroundColor: theme.error }]}>
                <Text style={[styles.scrollToBottomBadgeText, { color: theme.onError || '#fff' }]}>
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
          learnerContext={learnerContext}
          isLoading={isLoading}
          isUploading={isUploading}
          isRecording={isRecording}
          isSpeaking={isSpeaking}
          partialTranscript={partialTranscript}
          placeholder={roleCopy.inputPlaceholder}
          onSend={() => sendMessage()}
          onMicPress={handleInputMicPress}
          onTakePhoto={handleTakePhoto}
          onAttachFile={handleAttachFile}
          onRemoveAttachment={handleRemoveAttachment}
          onQuickAction={(text) => sendMessage(text)}
          bottomInset={insets.bottom}
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
      </Container>
    </SafeAreaView>
  );
};

export default DashAssistant;
