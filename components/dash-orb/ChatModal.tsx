import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { styles, getMarkdownStyles } from './DashOrb.styles';
import { QuickActions, QuickAction } from './QuickActions';

// Conditional import for markdown rendering on native
const isWeb = Platform.OS === 'web';
let Markdown: React.ComponentType<any> | null = null;
if (!isWeb) {
  try {
    Markdown = require('react-native-markdown-display').default;
  } catch (e) {
    console.warn('[ChatModal] Markdown not available:', e);
  }
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  toolCalls?: Array<{
    name: string;
    status: 'pending' | 'running' | 'success' | 'error';
    result?: string;
  }>;
}

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  inputText: string;
  setInputText: (text: string) => void;
  onSend: (text: string) => void;
  isProcessing: boolean;
  showQuickActions: boolean;
  onQuickAction: (action: QuickAction) => void;
  quickActionAge?: string;
  onQuickActionAgeChange?: (ageGroup: string) => void;
  quickActionPrompt?: string;
  onQuickActionPromptChange?: (value: string) => void;
  onBackToQuickActions?: () => void; // Navigate back to quick actions
  isSpeaking?: boolean;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  isListeningForCommand?: boolean;
  onMicPress?: () => void;
  wakeWordEnabled?: boolean;
  onToggleWakeWord?: () => void;
  onOpenSettings?: () => void;
}

export const ChatModal: React.FC<ChatModalProps> = ({
  visible,
  onClose,
  messages,
  inputText,
  setInputText,
  onSend,
  isProcessing,
  showQuickActions,
  onQuickAction,
  quickActionAge,
  onQuickActionAgeChange,
  quickActionPrompt,
  onQuickActionPromptChange,
  onBackToQuickActions,
  isSpeaking = false,
  voiceEnabled = true,
  onToggleVoice,
  isListeningForCommand = false,
  onMicPress,
  wakeWordEnabled = false,
  onToggleWakeWord,
  onOpenSettings,
}) => {
  const { theme } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [showWakeWordHelp, setShowWakeWordHelp] = React.useState(false);

  useEffect(() => {
    if (visible) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [visible, messages]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.modalContainer, { backgroundColor: theme.surface }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={[styles.chatContainer, { backgroundColor: theme.surface }]}>
          {/* Header */}
          <SafeAreaView edges={['top']} style={[styles.headerSafeArea, { backgroundColor: theme.surface }]}>
            <View style={[styles.chatHeader, { borderBottomColor: theme.border }]}>
              <View style={styles.headerLeft}>
                <LinearGradient
                  colors={['#8b5cf6', '#6366f1']}
                  style={styles.headerOrb}
                >
                  <Ionicons name="sparkles" size={20} color="#fff" />
                </LinearGradient>
                <View style={styles.headerText}>
                  <Text style={[styles.headerTitle, { color: theme.text }]}>Dash AI</Text>
                  <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                    {isSpeaking ? '🔊 Speaking...' : isProcessing ? '💭 Thinking...' : '✨ Online'}
                  </Text>
                </View>
              </View>
              {onBackToQuickActions && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onBackToQuickActions();
                  }}
                  style={[styles.closeButton, { marginRight: 6 }]}
                >
                  <Ionicons name="grid-outline" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
              {onToggleVoice && Platform.OS !== 'web' && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onToggleVoice();
                  }}
                  onLongPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setShowWakeWordHelp(true);
                    setTimeout(() => setShowWakeWordHelp(false), 3000);
                  }}
                  style={[styles.closeButton, { marginRight: 8 }]}
                >
                  <Ionicons 
                    name={voiceEnabled ? 'volume-high' : 'volume-mute'} 
                    size={22} 
                    color={voiceEnabled ? theme.primary : theme.textSecondary} 
                  />
                </TouchableOpacity>
              )}
              {onOpenSettings && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onOpenSettings();
                  }}
                  style={[styles.closeButton, { marginRight: 4 }]}
                >
                  <Ionicons
                    name="settings-outline"
                    size={22}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onClose();
                }}
                style={styles.closeButton}
              >
                <Ionicons name="chevron-down" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
          
          {/* Wake Word Help Tooltip */}
          {showWakeWordHelp && (
            <View style={[styles.helpTooltip, { backgroundColor: theme.primary }]}>
              <Text style={styles.helpTooltipText}>
                💡 Wake Word: Say "Hey Dash" to activate voice input hands-free (when ear icon is enabled)
              </Text>
            </View>
          )}

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((message) => {
              const markdownStyles = getMarkdownStyles(theme);
              return (
              <View
                key={message.id}
                style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.userMessage : styles.assistantMessage,
                  { backgroundColor: message.role === 'user' ? theme.primary : theme.background },
                ]}
              >
                {message.isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                      Processing...
                    </Text>
                    {message.toolCalls && (
                      <View style={styles.toolCallsContainer}>
                        {message.toolCalls.map((tool, idx) => (
                          <View key={idx} style={styles.toolCall}>
                            <Ionicons 
                              name="construct" 
                              size={12} 
                              color={theme.primary} 
                            />
                            <Text style={[styles.toolCallText, { color: theme.textSecondary }]}>
                              {tool.name.replace('_', ' ')}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ) : message.role === 'user' ? (
                  <Text style={[styles.messageText, { color: '#fff' }]}>
                    {message.content}
                  </Text>
                ) : (
                  // Use Markdown for assistant messages on native
                  Markdown ? (
                    <Markdown style={markdownStyles}>{message.content}</Markdown>
                  ) : (
                    <Text style={[styles.messageText, { color: theme.text }]}>
                      {message.content}
                    </Text>
                  )
                )}
              </View>
            );
            })}
            
            {/* Quick Actions */}
            {showQuickActions && messages.length > 0 && (
              <QuickActions
                onAction={onQuickAction}
                ageGroup={quickActionAge}
                onAgeGroupChange={onQuickActionAgeChange}
                customPrompt={quickActionPrompt}
                onCustomPromptChange={onQuickActionPromptChange}
              />
            )}
          </ScrollView>

          {!showQuickActions && onBackToQuickActions && (
            <View style={styles.quickActionsReturn}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onBackToQuickActions();
                }}
                style={[styles.backButton, { backgroundColor: theme.background }]}
              >
                <Ionicons name="grid-outline" size={16} color={theme.primary} />
                <Text style={[styles.backButtonText, { color: theme.primary }]}>
                  Quick Actions
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Input */}
          <View style={[styles.inputContainer, { borderTopColor: theme.border }]}>
            {/* Voice controls */}
            <View style={styles.voiceControls}>
              {onMicPress && (
                <TouchableOpacity
                  style={[
                    styles.voiceButton,
                    isListeningForCommand && styles.voiceButtonActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onMicPress();
                  }}
                >
                  <Ionicons 
                    name={isListeningForCommand ? 'mic' : 'mic-outline'} 
                    size={20} 
                    color={isListeningForCommand ? '#ef4444' : theme.text} 
                  />
                </TouchableOpacity>
              )}
              {onToggleWakeWord && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <TouchableOpacity
                    style={[
                      styles.voiceButton,
                      wakeWordEnabled && styles.voiceButtonActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onToggleWakeWord();
                    }}
                    onLongPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setShowWakeWordHelp(true);
                      setTimeout(() => setShowWakeWordHelp(false), 4000);
                    }}
                  >
                    <Ionicons 
                      name={wakeWordEnabled ? 'ear' : 'ear-outline'} 
                      size={20} 
                      color={wakeWordEnabled ? '#10b981' : theme.text} 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowWakeWordHelp(!showWakeWordHelp);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="help-circle-outline"
                      size={16}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              placeholder="Ask Dash anything..."
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => inputText.trim() && onSend(inputText)}
              returnKeyType="send"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: inputText.trim() ? theme.primary : theme.border },
              ]}
              onPress={() => {
                if (inputText.trim()) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onSend(inputText);
                }
              }}
              disabled={!inputText.trim() || isProcessing}
            >
              <Ionicons 
                name={isProcessing ? 'hourglass' : 'send'} 
                size={20} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
