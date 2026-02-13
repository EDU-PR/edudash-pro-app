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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, KeyboardAvoidingView, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { layoutStyles, headerStyles, messageStyles, inputStyles } from './dash-assistant/styles';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  DashAssistantMessages, 
  DashMessageBubble,
  DashInputBar,
  DashTypingIndicator,
} from './dash-assistant';
import { useTheme } from '@/contexts/ThemeContext';
import type { DashMessage, DashAttachment } from '@/services/dash-ai/types';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import HomeworkScanner, { type HomeworkScanResult } from '@/components/ai/HomeworkScanner';
import { AlertModal } from '@/components/ui/AlertModal';
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

interface DashAssistantProps {
  conversationId?: string;
  onClose?: () => void;
  initialMessage?: string;
  handoffSource?: string;
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
  tutorMode: externalTutorMode,
  tutorConfig,
}: DashAssistantProps) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Keyboard listeners
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // All business logic via hook
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
    alertState,
    hideAlert,
    flashListRef,
    inputRef,
    sendMessage,
    speakResponse,
    stopSpeaking,
    startNewConversation,
    scrollToBottom,
    handleAttachFile,
    handleTakePhoto,
    handleInputMicPress,
    handleRemoveAttachment,
    addAttachments,
    extractFollowUps,
    tier,
    subReady,
    cancelGeneration,
  } = useDashAssistant({ conversationId, initialMessage, onClose, handoffSource, externalTutorMode, tutorConfig });

  const isTypingActive = isLoading || !!loadingStatus;
  const { profile } = useAuth();
  const roleCopy = useMemo(() => getDashAIRoleCopy(profile?.role), [profile?.role]);

  const handleNewChat = useCallback(async () => {
    await stopSpeaking();
    await startNewConversation();
  }, [startNewConversation, stopSpeaking]);

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
    if (keyboardVisible && messages.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom({ animated: true, delay: 50 });
      }, Platform.OS === 'android' ? 150 : 50);
      return () => clearTimeout(timer);
    }
  }, [keyboardVisible, scrollToBottom, messages.length]);

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
    if (!isTypingActive) return null;
    return <DashTypingIndicator isLoading={isTypingActive} loadingStatus={loadingStatus} />;
  }, [isTypingActive, loadingStatus]);

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
            <View style={[headerStyles.headerShell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={headerStyles.headerTopRow}>
                <View style={headerStyles.headerLeft}>
                  <View style={headerStyles.headerTitleRow}>
                    <View style={[headerStyles.headerAccentDot, { backgroundColor: theme.primary }]} />
                    <Text style={[headerStyles.headerTitle, { color: theme.text }]}>Dash</Text>
                  </View>
                  <Text style={[headerStyles.headerSubtitle, { color: theme.textSecondary }]}>
                    Your AI assistant
                  </Text>
                </View>
                <View style={headerStyles.headerRight}>
                  <View style={[headerStyles.actionRail, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                    {isSpeaking && (
                      <TouchableOpacity
                        style={[headerStyles.iconButton, { backgroundColor: theme.error, borderColor: theme.error }]}
                        accessibilityLabel="Stop speaking"
                        onPress={stopSpeaking}
                      >
                        <Ionicons name="stop" size={18} color={theme.onError || theme.background} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[headerStyles.iconButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
                      accessibilityLabel="New chat"
                      onPress={handleNewChat}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[headerStyles.iconButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
                      accessibilityLabel="History"
                      onPress={() => router.push('/screens/dash-conversations-history')}
                    >
                      <Ionicons name="time-outline" size={18} color={theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[headerStyles.iconButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
                      accessibilityLabel="Open Dash Orb"
                      onPress={() => router.push('/screens/dash-voice?mode=orb')}
                    >
                      <Ionicons name="planet-outline" size={18} color={theme.text} />
                    </TouchableOpacity>
                    {onClose && (
                      <TouchableOpacity
                        style={[headerStyles.closeButton, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
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
            </View>
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
            renderSuggestedActions={() => null}
            onSendMessage={(text) => sendMessage(text)}
            bottomInset={insets.bottom}
            keyboardVisible={keyboardVisible}
            userRole={String(profile?.role || '').toLowerCase()}
          />

          {/* Jump to bottom FAB */}
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

          {/* Input */}
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
            onTakePhoto={openScanner}
            onAttachFile={handleAttachFile}
            onRemoveAttachment={handleRemoveAttachment}
            onQuickAction={(text) => sendMessage(text)}
            onCancel={cancelGeneration}
            bottomInset={insets.bottom}
            hideQuickChips={false}
          />

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
