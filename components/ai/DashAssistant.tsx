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

import React, { useCallback } from 'react';
import { 
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { DashCommandPalette } from '@/components/ai/DashCommandPalette';
import { TierBadge } from '@/components/ui/TierBadge';
import { useDashAssistant } from '@/hooks/useDashAssistant';

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
  const [showCommandPalette, setShowCommandPalette] = React.useState(false);
  
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
    selectedAttachments,
    isUploading,
    isNearBottom,
    setIsNearBottom,
    unreadCount,
    setUnreadCount,
    flashListRef,
    inputRef,
    sendMessage,
    speakResponse,
    stopSpeaking,
    scrollToBottom,
    handleAttachFile,
    handleTakePhoto,
    handleInputMicPress,
    handleRemoveAttachment,
    extractFollowUps,
    tier,
    subReady,
  } = useDashAssistant({ conversationId, initialMessage, onClose });

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
        onSpeak={speakResponse}
        onRetry={(content) => sendMessage(content)}
        onSendFollowUp={(text) => sendMessage(text)}
        extractFollowUps={extractFollowUps}
      />
    );
  }, [messages.length, speakingMessageId, isLoading, speakResponse, sendMessage, extractFollowUps]);

  // Render typing indicator
  const renderTypingIndicator = useCallback(() => {
    return (
      <DashTypingIndicator 
        isLoading={isLoading} 
        loadingStatus={loadingStatus} 
      />
    );
  }, [isLoading, loadingStatus]);

  // Render suggested actions
  const renderSuggestedActions = useCallback(() => {
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
        'dashboard_help': '❓ Dashboard Help',
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
  }, [messages, theme, sendMessage]);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        enabled={true}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.headerLeft}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Dash</Text>
                {subReady && tier && (
                  <TierBadge tier={tier as any} size="sm" />
                )}
              </View>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                AI Teaching Assistant
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
        />

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
          selectedAttachments={selectedAttachments}
          isLoading={isLoading}
          isUploading={isUploading}
          onSend={() => sendMessage()}
          onMicPress={handleInputMicPress}
          onTakePhoto={handleTakePhoto}
          onAttachFile={handleAttachFile}
          onRemoveAttachment={handleRemoveAttachment}
        />

        {/* Command Palette Modal */}
        <DashCommandPalette visible={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default DashAssistant;
