/**
 * Dash AI Assistant Chat Component
 * 
 * Clean, modern conversational AI interface — general-purpose like ChatGPT.
 * No tool-heavy UI, no mode selectors, no command decks.
 * Just a beautiful chat with Dash.
 * 
 * Refactored to use:
 * - useDashAssistant hook for business logic
 * - DashMessageBubble for message rendering
 * - DashInputBar for input handling
 * - DashTypingIndicator for loading states
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, KeyboardAvoidingView, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { layoutStyles, headerStyles, messageStyles, inputStyles } from '@/components/ai/dash-assistant/styles';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  DashAssistantMessages, 
  DashMessageBubble,
  DashInputBar,
  DashTypingIndicator,
  AttachmentOptionsSheet,
  DashOptionsSheet,
} from '@/components/ai/dash-assistant';
import { useTheme } from '@/contexts/ThemeContext';
import type { DashMessage, DashAttachment } from '@/services/dash-ai/types';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import HomeworkScanner, { type HomeworkScanResult } from '@/components/ai/HomeworkScanner';
import { AlertModal } from '@/components/ui/AlertModal';
import { ModelInUseIndicator } from '@/components/ai/ModelInUseIndicator';
import { ModelSelectorChips } from '@/components/ai/ModelSelectorChips';
import { setPreferredModel } from '@/lib/ai/preferences';
import { useDashAssistant } from '@/hooks/useDashAssistant';
import { useAuth } from '@/contexts/AuthContext';
import { getDashAIRoleCopy } from '@/lib/ai/dashRoleCopy';
import { loadAutoScanBudget, trackAutoScanUsage } from '@/lib/dash-ai/imageBudget';

import EduDashSpinner from '@/components/ui/EduDashSpinner';

// Merge all style domains for backward compatibility with child components
const styles = {
  ...layoutStyles,
  ...headerStyles,
  ...messageStyles,
  ...inputStyles,
};

const COMPOSER_FLOAT_GAP = 2;
const COMPOSER_OVERLAY_MIN_HEIGHT = 64;
const COMPOSER_ANDROID_NAV_LIFT = 14;

const splitSpeechSegments = (content: string): string[] => {
  const cleaned = String(content || '').trim();
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.?!])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
};

const getBottomThinkingLabel = (
  loadingStatus: 'uploading' | 'analyzing' | 'thinking' | 'responding' | null,
): string => {
  switch (loadingStatus) {
    case 'uploading':
      return 'Dash is uploading your files...';
    case 'analyzing':
      return 'Dash is analyzing your content...';
    case 'responding':
      return 'Dash is preparing the final response...';
    case 'thinking':
    default:
      return 'Dash is thinking...';
  }
};

interface DashAssistantProps {
  conversationId?: string;
  onClose?: () => void;
  initialMessage?: string;
  handoffSource?: string;
  uiMode?: 'advisor' | 'tutor' | 'orb' | 'exam' | null;
  /** Pre-configured tutor mode — kept for routing compat but UI stays general */
  tutorMode?: 'quiz' | 'practice' | 'diagnostic' | 'play' | 'explain' | null;
  tutorConfig?: {
    subject?: string;
    grade?: string;
    topic?: string;
    difficulty?: 1 | 2 | 3 | 4 | 5;
  };
}

export const DashAssistant: React.FC<DashAssistantProps> = ({
  conversationId,
  onClose,
  initialMessage,
  handoffSource,
  uiMode,
  tutorMode: externalTutorMode,
  tutorConfig,
}: DashAssistantProps) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [optionsSheetVisible, setOptionsSheetVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(COMPOSER_OVERLAY_MIN_HEIGHT);
  const [lastSpokenMessageId, setLastSpokenMessageId] = useState<string | null>(null);
  const [speechSegmentIndex, setSpeechSegmentIndex] = useState(0);
  const [remainingScans, setRemainingScans] = useState<number | null>(null);

  // Keyboard listeners
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event?.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // All business logic via hook
  const {
    messages,
    inputText,
    setInputText,
    isLoading,
    loadingStatus,
    streamingMessageId,
    isSpeaking,
    speakingMessageId,
    dashInstance,
    isInitialized,
    enterToSend,
    voiceEnabled,
    autoSuggestQuestions,
    selectedAttachments,
    isUploading,
    attachmentProgress,
    isNearBottom,
    setIsNearBottom,
    unreadCount,
    setUnreadCount,
    isRecording,
    recordingVoiceActivity,
    partialTranscript,
    speechChunkProgress,
    voiceAutoSendCountdownActive,
    voiceAutoSendCountdownMs,
    tutorSession,
    alertState,
    hideAlert,
    flashListRef,
    inputRef,
    sendMessage,
    speakResponse,
    stopSpeaking,
    stopAllActivity,
    startNewConversation,
    scrollToBottom,
    handleTakePhoto,
    handlePickImages,
    handlePickDocuments,
    handleInputMicPress,
    cancelVoiceAutoSend,
    handleRemoveAttachment,
    addAttachments,
    runTool,
    extractFollowUps,
    cancelGeneration,
    selectedModel,
    availableModels,
    setSelectedModel,
  } = useDashAssistant({ conversationId, initialMessage, onClose, handoffSource, externalTutorMode, tutorConfig });

  const isTypingActive = isLoading || !!loadingStatus;
  const { profile } = useAuth();
  const roleCopy = useMemo(() => getDashAIRoleCopy(profile?.role), [profile?.role]);
  const isK12ParentDashEntry = handoffSource === 'k12_parent_tab';
  const useMinimalNextGenLayout = isK12ParentDashEntry;
  const isTutorUiActive = uiMode === 'tutor' || !!externalTutorMode || !!tutorSession;
  const activeTutorMode = tutorSession?.mode || externalTutorMode;
  const tutorModeLabel = activeTutorMode
    ? `${String(activeTutorMode).charAt(0).toUpperCase()}${String(activeTutorMode).slice(1)}`
    : 'Diagnose → Teach → Practice';
  const shellSubtitle = useMinimalNextGenLayout
    ? 'Your AI assistant'
    : isTutorUiActive
    ? 'Tutor Session Active'
    : uiMode === 'advisor'
      ? 'Advisor Mode'
      : uiMode === 'exam'
        ? 'Exam Builder Mode'
      : uiMode === 'orb'
        ? 'Orb Companion Mode'
        : 'Your AI assistant';

  useEffect(() => {
    if (!speakingMessageId) return;
    setLastSpokenMessageId(speakingMessageId);
    setSpeechSegmentIndex(0);
  }, [speakingMessageId]);

  useEffect(() => {
    if (!speechChunkProgress || speechChunkProgress.chunkCount <= 0) return;
    const boundedIndex = Math.max(
      0,
      Math.min(speechChunkProgress.chunkIndex, speechChunkProgress.chunkCount - 1),
    );
    setSpeechSegmentIndex((prev) => (prev === boundedIndex ? prev : boundedIndex));
  }, [speechChunkProgress]);

  const activeSpeechMessageId = speakingMessageId || lastSpokenMessageId;
  const activeSpeechMessage = useMemo(() => {
    if (!activeSpeechMessageId) return null;
    const match = messages.find((msg) => msg.id === activeSpeechMessageId);
    if (!match || match.type !== 'assistant') return null;
    return match;
  }, [messages, activeSpeechMessageId]);
  const speechSegments = useMemo(
    () => splitSpeechSegments(activeSpeechMessage?.content || ''),
    [activeSpeechMessage?.content],
  );
  const chunkCount = speechChunkProgress?.chunkCount || speechSegments.length;
  const chunkIndex = typeof speechChunkProgress?.chunkIndex === 'number'
    ? speechChunkProgress.chunkIndex
    : speechSegmentIndex;
  const displaySpeechIndex = Math.max(0, Math.min(chunkIndex, Math.max(0, chunkCount - 1)));
  const canSeekBack = displaySpeechIndex > 0 && speechSegments.length > 0;
  const canSeekForward = displaySpeechIndex < speechSegments.length - 1;
  const speechProgress = chunkCount > 0
    ? Math.min(1, Math.max(0, (displaySpeechIndex + 1) / chunkCount))
    : 0;
  const showSpeakingTransport = Boolean(activeSpeechMessage) && (isSpeaking || speechSegments.length > 0);
  const bottomThinkingLabel = getBottomThinkingLabel(loadingStatus);
  const showBottomThinkingDock = isTypingActive && !isRecording;

  const refreshScanBudget = useCallback(async () => {
    const budget = await loadAutoScanBudget(tier || 'free');
    setRemainingScans(budget.remainingCount);
  }, [tier]);

  useEffect(() => {
    void refreshScanBudget();
  }, [refreshScanBudget]);

  const handleNewChat = useCallback(async () => {
    await stopAllActivity();
    await startNewConversation();
  }, [startNewConversation, stopAllActivity]);

  const handleComposerFocus = useCallback(() => {
    if (isRecording) {
      handleInputMicPress();
    }
    if (isSpeaking) {
      void stopSpeaking();
    }
  }, [isRecording, handleInputMicPress, isSpeaking, stopSpeaking]);

  const speakFromSegment = useCallback(async (requestedIndex: number) => {
    if (!activeSpeechMessage || speechSegments.length === 0) return;
    const nextIndex = Math.max(0, Math.min(requestedIndex, speechSegments.length - 1));
    const remainingText = speechSegments.slice(nextIndex).join(' ').trim();
    if (!remainingText) return;

    setSpeechSegmentIndex(nextIndex);
    const replayMessage: DashMessage = {
      ...activeSpeechMessage,
      id: `${activeSpeechMessage.id}_segment_${nextIndex}`,
      content: remainingText,
      timestamp: Date.now(),
    };
    await stopSpeaking();
    await speakResponse(replayMessage);
  }, [activeSpeechMessage, speechSegments, speakResponse, stopSpeaking]);

  const handleSpeechToggle = useCallback(() => {
    if (isSpeaking) {
      void stopSpeaking();
      return;
    }
    void speakFromSegment(displaySpeechIndex);
  }, [displaySpeechIndex, isSpeaking, speakFromSegment, stopSpeaking]);

  const openAttachmentSheet = useCallback(() => {
    if (isRecording) {
      handleInputMicPress();
    }
    if (isSpeaking) {
      void stopSpeaking();
    }
    setAttachmentSheetVisible(true);
  }, [isRecording, handleInputMicPress, isSpeaking, stopSpeaking]);

  const closeAttachmentSheet = useCallback(() => {
    setAttachmentSheetVisible(false);
  }, []);

  const openOptionsSheet = useCallback(() => {
    if (isRecording) {
      handleInputMicPress();
    }
    if (isSpeaking) {
      void stopSpeaking();
    }
    setOptionsSheetVisible(true);
  }, [isRecording, handleInputMicPress, isSpeaking, stopSpeaking]);

  const closeOptionsSheet = useCallback(() => {
    setOptionsSheetVisible(false);
  }, []);

  const handlePasteImage = useCallback(
    (file: File) => {
      const attachment: DashAttachment = {
        id: `paste_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        bucket: 'attachments',
        storagePath: '',
        kind: 'image',
        status: 'pending',
        previewUri: typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : undefined,
      };
      addAttachments([attachment]);
    },
    [addAttachments]
  );

  const openScanner = useCallback(() => {
    setScannerVisible(true);
  }, []);

  const handleAttachmentTakePhoto = useCallback(() => {
    openScanner();
  }, [openScanner]);

  const handleAttachmentPickImages = useCallback(() => {
    void handlePickImages();
  }, [handlePickImages]);

  const handleAttachmentPickDocuments = useCallback(() => {
    void handlePickDocuments();
  }, [handlePickDocuments]);

  const handleOpenHistory = useCallback(() => {
    router.push('/screens/dash-conversations-history');
  }, []);

  const handleOpenSearch = useCallback(() => {
    router.push('/screens/app-search?scope=dash&q=dash');
  }, []);

  const handleOpenOrb = useCallback(() => {
    router.push('/screens/dash-voice?mode=orb');
  }, []);

  const handleRunScheduleTool = useCallback(() => {
    void runTool('get_schedule', { start_date: 'today', days: 7 });
  }, [runTool]);

  const handleRunAssignmentsTool = useCallback(() => {
    void runTool('get_assignments', { status: 'pending', days_ahead: 14 });
  }, [runTool]);

  const handleScannerScanned = useCallback((result: HomeworkScanResult) => {
    if (!result?.base64) return;
    const attachment: DashAttachment = {
      id: `attach_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: `scan_${Date.now()}.jpg`,
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
        source: 'scanner',
      },
    };
    addAttachments([attachment]);
    void trackAutoScanUsage(tier || 'free', 1).then(() => refreshScanBudget());
    setScannerVisible(false);
  }, [addAttachments, refreshScanBudget, tier]);

  // Scroll to bottom on keyboard show
  useEffect(() => {
    if (keyboardVisible && messages.length > 0 && isNearBottom) {
      const timer = setTimeout(() => {
        scrollToBottom({ animated: true, delay: 50 });
      }, Platform.OS === 'android' ? 150 : 50);
      return () => clearTimeout(timer);
    }
  }, [keyboardVisible, isNearBottom, scrollToBottom, messages.length]);

  // Render message
  const renderMessage = useCallback((message: DashMessage, index: number) => (
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
      extractFollowUps={extractFollowUps}
      assistantLabel={roleCopy.assistantLabel}
      onRetakeForClarity={openScanner}
    />
  ), [messages.length, speakingMessageId, isLoading, speakResponse, sendMessage, extractFollowUps, roleCopy.assistantLabel, openScanner]);

  const renderTypingIndicator = useCallback(() => {
    if (streamingMessageId) return null;
    if (!isTypingActive) return null;
    return <DashTypingIndicator isLoading={isTypingActive} loadingStatus={loadingStatus} />;
  }, [isTypingActive, loadingStatus, streamingMessageId]);

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

  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : undefined;
  const keyboardOffset = Platform.OS === 'ios' ? 90 : 0;
  const composerBottomInset = Platform.OS === 'ios'
    ? insets.bottom
    : Math.max(insets.bottom, COMPOSER_ANDROID_NAV_LIFT);
  const keyboardUp = keyboardHeight > 0;
  const safeComposerHeight = Math.max(composerHeight, COMPOSER_OVERLAY_MIN_HEIGHT);
  const composerExtraBottom = keyboardUp ? composerBottomInset : 0;
  const messageViewportInset = keyboardHeight + COMPOSER_FLOAT_GAP + composerExtraBottom + safeComposerHeight;
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
        {/* Background gradients */}
        <View pointerEvents="none" style={layoutStyles.backgroundLayer}>
          <LinearGradient colors={backgroundBase} style={layoutStyles.backgroundGradient} />
          <LinearGradient colors={glowA} style={layoutStyles.backgroundGlowA} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <LinearGradient colors={glowB} style={layoutStyles.backgroundGlowB} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} />
        </View>

        <View style={layoutStyles.contentLayer}>
          <StatusBar style={isDark ? 'light' : 'dark'} />

          {/* Clean header — ChatGPT style */}
          <View style={[headerStyles.header, { backgroundColor: 'transparent' }]}>
            <View
              style={[
                headerStyles.headerShell,
                {
                  backgroundColor: theme.surface + 'CC',
                  borderColor: 'transparent',
                  borderWidth: 0,
                  shadowColor: '#020617',
                  shadowOpacity: 0.25,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 6,
                },
              ]}
            >
              <View style={headerStyles.headerTopRow}>
                <View style={headerStyles.headerLeft}>
                  <View style={headerStyles.headerTitleRow}>
                    <View style={[headerStyles.headerAccentDot, { backgroundColor: theme.primary }]} />
                    <Text style={[headerStyles.headerTitle, { color: theme.text }]}>Dash</Text>
                  </View>
                  <Text style={[headerStyles.headerSubtitle, { color: theme.textSecondary }]}>
                    {shellSubtitle}
                  </Text>
                  {!useMinimalNextGenLayout && <ModelInUseIndicator modelId={selectedModel} compact showCostDots />}
                  {!useMinimalNextGenLayout && availableModels.length > 1 && (
                    <View style={{ marginTop: 6 }}>
                      <ModelSelectorChips
                        availableModels={availableModels}
                        selectedModel={selectedModel}
                        onSelect={setSelectedModel}
                        feature="chat_message"
                        onPersist={async (modelId, feat) => { await setPreferredModel(modelId, feat as 'chat_message'); }}
                        showSectionTitle={false}
                        showWhenFree={true}
                        collapsible
                        defaultCollapsed
                        autoCollapseOnSelect
                      />
                    </View>
                  )}
                </View>
                <View style={headerStyles.headerRight}>
                  <View
                    style={[
                      headerStyles.actionRail,
                      {
                        backgroundColor: theme.surfaceVariant + 'D9',
                        borderColor: 'transparent',
                        borderWidth: 0,
                        shadowColor: '#020617',
                        shadowOpacity: 0.22,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 6 },
                        elevation: 5,
                      },
                    ]}
                  >
                    {(isSpeaking || isTypingActive || isRecording) && (
                      <TouchableOpacity
                        style={[headerStyles.iconButton, { backgroundColor: theme.error, borderColor: 'transparent', borderWidth: 0 }]}
                        accessibilityLabel="Stop Dash activity"
                        onPress={() => {
                          void stopAllActivity('header_stop_button');
                        }}
                      >
                        <Ionicons name="stop" size={18} color={theme.onError || theme.background} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[headerStyles.iconButton, { backgroundColor: theme.surfaceVariant, borderColor: 'transparent', borderWidth: 0 }]}
                      accessibilityLabel="Open Dash options"
                      onPress={openOptionsSheet}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        headerStyles.iconButton,
                        headerStyles.orbIconButton,
                        { backgroundColor: theme.primary + '22', borderColor: 'transparent', borderWidth: 0 },
                      ]}
                      accessibilityLabel="Open Dash Orb"
                      onPress={handleOpenOrb}
                    >
                      <Ionicons name="planet" size={19} color={theme.primary} />
                    </TouchableOpacity>
                    {onClose && (
                      <TouchableOpacity
                        style={[headerStyles.closeButton, { backgroundColor: theme.surfaceVariant, borderColor: 'transparent', borderWidth: 0 }]}
                        onPress={async () => {
                          await stopSpeaking();
                          dashInstance?.cleanup?.();
                          onClose();
                        }}
                        accessibilityLabel="Close"
                      >
                        <Ionicons name="close" size={20} color={theme.text} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
              {isTutorUiActive && !useMinimalNextGenLayout && (
                <View style={headerStyles.headerStatusRow}>
                  <View
                    style={[
                      headerStyles.headerStatusPill,
                      { borderColor: theme.primary + '66', backgroundColor: theme.primary + '18' },
                    ]}
                  >
                    <Ionicons name="school-outline" size={12} color={theme.primary} />
                    <Text style={[headerStyles.headerStatusText, { color: theme.primary }]}>
                      Tutor Session Active
                    </Text>
                  </View>
                  <View
                    style={[
                      headerStyles.headerStatusPill,
                      { borderColor: theme.border, backgroundColor: theme.surfaceVariant },
                    ]}
                  >
                    <Ionicons name="git-network-outline" size={12} color={theme.textSecondary} />
                    <Text style={[headerStyles.headerStatusSubtle, { color: theme.textSecondary }]}>
                      Mode: {tutorModeLabel}
                    </Text>
                  </View>
                </View>
              )}
              {showSpeakingTransport && (
                <View
                  style={{
                    marginTop: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 12,
                    backgroundColor: theme.surfaceVariant + 'CC',
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text
                      style={{ color: theme.text, fontSize: 12, fontWeight: '700', flex: 1 }}
                      numberOfLines={1}
                    >
                      {isSpeaking ? 'Dash speaking' : 'Speech controls'}
                    </Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '600' }}>
                      {chunkCount > 0 ? `${displaySpeechIndex + 1}/${chunkCount}` : '0/0'}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 6,
                      borderRadius: 999,
                      overflow: 'hidden',
                      backgroundColor: theme.surface,
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${Math.round(speechProgress * 100)}%`,
                        backgroundColor: theme.primary,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity
                      style={[headerStyles.iconButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => void speakFromSegment(displaySpeechIndex - 1)}
                      disabled={!canSeekBack}
                      accessibilityLabel="Rewind spoken content"
                    >
                      <Ionicons
                        name="play-back"
                        size={16}
                        color={canSeekBack ? theme.text : theme.textTertiary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[headerStyles.iconButton, { backgroundColor: theme.primary + '22', borderColor: theme.primary + '44' }]}
                      onPress={handleSpeechToggle}
                      accessibilityLabel={isSpeaking ? 'Stop speech' : 'Play speech'}
                    >
                      <Ionicons
                        name={isSpeaking ? 'stop' : 'play'}
                        size={16}
                        color={theme.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[headerStyles.iconButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => void speakFromSegment(displaySpeechIndex + 1)}
                      disabled={!canSeekForward}
                      accessibilityLabel="Fast forward spoken content"
                    >
                      <Ionicons
                        name="play-forward"
                        size={16}
                        color={canSeekForward ? theme.text : theme.textTertiary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Messages */}
          <View style={[layoutStyles.messagesClip, { marginBottom: messageViewportInset }]}>
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
              renderSuggestedActions={() => null}
              onSendMessage={(text) => sendMessage(text)}
              bottomInset={0}
              keyboardVisible={keyboardVisible}
              compactBottomPadding
              tutorMode={activeTutorMode || null}
              userRole={String(profile?.role || '').toLowerCase()}
            />
          </View>

          {/* Jump to bottom FAB */}
          {Platform.OS === 'android' && !isNearBottom && messages.length > 0 && (
            <TouchableOpacity
              style={[
                messageStyles.scrollToBottomFab,
                {
                  backgroundColor: theme.primary,
                  bottom: messageViewportInset + 12,
                  zIndex: 220,
                  elevation: 16,
                },
              ]}
              onPress={() => { setUnreadCount(0); scrollToBottom({ animated: true, delay: 0, force: true }); }}
              accessibilityLabel="Jump to bottom"
              activeOpacity={0.8}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
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

          {showBottomThinkingDock && (
            <View
              style={[
                layoutStyles.bottomThinkingDock,
                {
                  bottom: keyboardHeight + safeComposerHeight + COMPOSER_FLOAT_GAP + composerExtraBottom + 10,
                  backgroundColor: theme.surface + 'EE',
                  borderColor: theme.border,
                },
              ]}
              pointerEvents="none"
            >
              <EduDashSpinner size="small" color={theme.primary} />
              <Text style={[layoutStyles.bottomThinkingText, { color: theme.text }]}>
                {bottomThinkingLabel}
              </Text>
            </View>
          )}

          {/* Input */}
          <View
            style={[
              layoutStyles.composerArea,
              {
                bottom: keyboardHeight + COMPOSER_FLOAT_GAP + composerExtraBottom,
                paddingBottom: keyboardUp ? 0 : composerBottomInset,
              },
            ]}
            pointerEvents="box-none"
            onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}
          >
            <DashInputBar
              inputRef={inputRef}
              inputText={inputText}
              setInputText={setInputText}
              enterToSend={enterToSend}
              selectedAttachments={selectedAttachments}
              attachmentProgress={attachmentProgress}
              isLoading={isLoading}
              isUploading={isUploading}
              isRecording={isRecording}
              recordingVoiceActivity={recordingVoiceActivity}
              isSpeaking={isSpeaking}
              partialTranscript={partialTranscript}
              voiceAutoSendCountdownActive={voiceAutoSendCountdownActive}
              voiceAutoSendCountdownMs={voiceAutoSendCountdownMs}
              placeholder="Message Dash..."
              messages={messages}
              onSend={() => sendMessage()}
              onMicPress={handleInputMicPress}
              onCancelVoiceAutoSend={cancelVoiceAutoSend}
              onInterrupt={stopAllActivity}
              onTakePhoto={openScanner}
              onAttachFile={openAttachmentSheet}
              onRemoveAttachment={handleRemoveAttachment}
              onQuickAction={(text) => sendMessage(text)}
              onCancel={cancelGeneration}
              bottomInset={0}
              hideQuickChips={useMinimalNextGenLayout}
              onInputFocus={handleComposerFocus}
              onPasteImage={handlePasteImage}
            />
          </View>

          {/* Modals */}
          <AlertModal
            visible={alertState.visible}
            title={alertState.title}
            message={alertState.message}
            type={alertState.type}
            icon={alertState.icon as any}
            buttons={alertState.buttons}
            onClose={hideAlert}
          />
          <AttachmentOptionsSheet
            visible={attachmentSheetVisible}
            onClose={closeAttachmentSheet}
            onTakePhoto={handleAttachmentTakePhoto}
            onPickImages={handleAttachmentPickImages}
            onPickDocuments={handleAttachmentPickDocuments}
            showDocuments
            isBusy={isLoading || isUploading}
          />
          <DashOptionsSheet
            visible={optionsSheetVisible}
            onClose={closeOptionsSheet}
            onNewChat={handleNewChat}
            onOpenHistory={handleOpenHistory}
            onOpenSearch={handleOpenSearch}
            onOpenOrb={handleOpenOrb}
            onOpenScanner={openScanner}
            onRunScheduleTool={handleRunScheduleTool}
            onRunAssignmentsTool={handleRunAssignmentsTool}
            models={availableModels}
            selectedModelId={selectedModel}
            onSelectModel={(modelId) => {
              try {
                setSelectedModel(modelId as any);
              } catch {
                // ignore invalid model id
              }
            }}
            isBusy={isLoading || isUploading}
          />
          <HomeworkScanner
            visible={scannerVisible}
            onClose={() => setScannerVisible(false)}
            onScanned={handleScannerScanned}
            title="Scan Image"
            tier={tier || 'free'}
            remainingScans={remainingScans}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default DashAssistant;
