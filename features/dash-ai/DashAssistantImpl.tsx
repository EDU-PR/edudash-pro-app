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
    partialTranscript,
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
    if (Platform.OS === 'web') {
      void handleTakePhoto();
      return;
    }
    setScannerVisible(true);
  }, [handleTakePhoto]);

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
    setScannerVisible(false);
  }, [addAttachments]);

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
    />
  ), [messages.length, speakingMessageId, isLoading, speakResponse, sendMessage, extractFollowUps, roleCopy.assistantLabel]);

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
                        onPress={stopAllActivity}
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
              style={[messageStyles.scrollToBottomFab, { backgroundColor: theme.primary, bottom: messageViewportInset + 12 }]}
              onPress={() => { setUnreadCount(0); scrollToBottom({ animated: true, delay: 0, force: true }); }}
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

          {/* Input */}
          <View
            style={[
              layoutStyles.composerArea,
              {
                bottom: keyboardHeight + COMPOSER_FLOAT_GAP + composerExtraBottom,
                paddingBottom: keyboardUp ? 0 : composerBottomInset,
              },
            ]}
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
              isSpeaking={isSpeaking}
              partialTranscript={partialTranscript}
              placeholder="Message Dash..."
              messages={messages}
              onSend={() => sendMessage()}
              onMicPress={handleInputMicPress}
              onInterrupt={stopAllActivity}
              onTakePhoto={openScanner}
              onAttachFile={openAttachmentSheet}
              onRemoveAttachment={handleRemoveAttachment}
              onQuickAction={(text) => sendMessage(text)}
              onCancel={cancelGeneration}
              bottomInset={0}
              hideQuickChips={useMinimalNextGenLayout}
              showAttachmentDropzone={!useMinimalNextGenLayout}
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
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default DashAssistant;
