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
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeTier } from '@/hooks/useRealtimeTier';
import { styles, getMarkdownStyles } from './DashOrb.styles';
import { QuickActions, QuickAction } from './QuickActions';
import { CosmicOrb } from './CosmicOrb';
import { getDashAIRoleCopy } from '@/lib/ai/dashRoleCopy';
import type { DashAttachment } from '@/services/dash-ai/types';
import { createSignedUrl } from '@/services/AttachmentService';

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
  isStreaming?: boolean;
  attachments?: DashAttachment[];
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
  onSendPrompt?: (prompt: string, displayLabel?: string) => void;
  isSpeaking?: boolean;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  isListeningForCommand?: boolean;
  onMicPress?: () => void;
  wakeWordEnabled?: boolean;
  onToggleWakeWord?: () => void;
  onOpenSettings?: () => void;
  onAttachFile?: () => void;
  onTakePhoto?: () => void;
  attachmentCount?: number;
  inlineReplyEnabled?: boolean;
  onCopyMessage?: (message: ChatMessage) => void;
  onRegenerateMessage?: (message: ChatMessage) => void;
  onEditMessage?: (message: ChatMessage) => void;
  onShareMessage?: (message: ChatMessage) => void;
  onFeedback?: (message: ChatMessage, rating: 'up' | 'down') => void;
  onNewChat?: () => void;
  onExportChat?: () => void;
  onOpenHistory?: () => void;
  isEditing?: boolean;
  onCancelEdit?: () => void;
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
  onSendPrompt,
  isSpeaking = false,
  voiceEnabled = true,
  onToggleVoice,
  isListeningForCommand = false,
  onMicPress,
  wakeWordEnabled = false,
  onToggleWakeWord,
  onOpenSettings,
  onAttachFile,
  onTakePhoto,
  attachmentCount = 0,
  inlineReplyEnabled = false,
  onCopyMessage,
  onRegenerateMessage,
  onEditMessage,
  onShareMessage,
  onFeedback,
  onNewChat,
  onExportChat,
  onOpenHistory,
  isEditing = false,
  onCancelEdit,
}) => {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const roleCopy = getDashAIRoleCopy(profile?.role);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [showWakeWordHelp, setShowWakeWordHelp] = React.useState(false);
  const [inlineReplies, setInlineReplies] = React.useState<Record<string, string>>({});
  const [imageViewerUri, setImageViewerUri] = React.useState<string | null>(null);
  const { tierStatus } = useRealtimeTier({ enabled: visible });
  const remaining = tierStatus && tierStatus.quotaLimit > 0
    ? Math.max(tierStatus.quotaLimit - tierStatus.quotaUsed, 0)
    : null;
  const statusLabel = isSpeaking ? 'Speaking...' : isProcessing ? 'Thinking...' : 'Online';
  const headerSubtitle = roleCopy.subtitle
    ? `${roleCopy.subtitle} • ${statusLabel}`
    : statusLabel;
  const showCamera = inputText.trim().length === 0 && !isListeningForCommand;

  const Container: React.ElementType = KeyboardAvoidingView;

  const isTutorPromptLeak = (content: string) =>
    /tutor_payload|return only json|you are dash, an interactive tutor|tutor mode override/i.test(content || '');

  const parseTutorPayload = (content: string) => {
    if (!content) return null;
    const tagMatch = content.match(/<TUTOR_PAYLOAD>([\s\S]*?)<\/TUTOR_PAYLOAD>/i);
    const jsonCandidate = tagMatch ? tagMatch[1] : null;
    const fallbackMatch = !jsonCandidate ? content.match(/\{[\s\S]*\}/) : null;
    const raw = (jsonCandidate || fallbackMatch?.[0] || '').trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const buildTutorDisplay = (payload: Record<string, unknown>) => {
    const question = typeof payload.question === 'string' ? payload.question.trim() : '';
    if (question) return question;

    const lines: string[] = [];
    if (typeof payload.is_correct === 'boolean') {
      lines.push(payload.is_correct ? '✅ Correct!' : '❌ Not quite.');
    }
    if (typeof payload.feedback === 'string' && payload.feedback.trim()) {
      lines.push(payload.feedback.trim());
    }
    if (typeof payload.correct_answer === 'string' && payload.correct_answer.trim()) {
      lines.push(`Correct answer: ${payload.correct_answer.trim()}`);
    }
    if (typeof payload.explanation === 'string' && payload.explanation.trim()) {
      lines.push(payload.explanation.trim());
    }
    if (typeof payload.follow_up_question === 'string' && payload.follow_up_question.trim()) {
      lines.push(`Next question:\n${payload.follow_up_question.trim()}`);
    }
    return lines.filter(Boolean).join('\n\n') || null;
  };

  const sanitizeAssistantContent = (content: string) => {
    return (content || '')
      .split(/\n+/)
      .filter(line => !/^\s*User:\s*/i.test(line))
      .filter(line => !/^\s*\[.*(wait|response).*?\]\s*$/i.test(line))
      .filter(line => !/^\s*(TUTOR MODE OVERRIDE:|Mode:|Topic:|Subject:|Grade:|Age band:|School type:)/i.test(line))
      .filter(line => !/^\s*You are Dash,.*tutor/i.test(line))
      .filter(line => !/^\s*Return ONLY JSON/i.test(line))
      .filter(line => !/TUTOR_PAYLOAD/i.test(line))
      .join('\n')
      .trim();
  };

  const getAssistantDisplayContent = (content: string) => {
    const payload = parseTutorPayload(content);
    if (payload) {
      const display = buildTutorDisplay(payload);
      if (display) return display;
    }
    if (isTutorPromptLeak(content)) {
      return 'Dash is preparing your tutor response. Tap retry if this keeps happening.';
    }
    const cleaned = sanitizeAssistantContent(content);
    return cleaned || content;
  };

  const isQuestionLike = (content: string) => {
    const trimmed = (content || '').trim();
    if (!trimmed) return false;
    if (trimmed.endsWith('?')) return true;
    return /\?\s*$/.test(trimmed) || trimmed.includes('?');
  };

  const AttachmentImagePreview: React.FC<{
    attachment: DashAttachment;
    isUser: boolean;
  }> = ({ attachment, isUser }) => {
    const [imageUrl, setImageUrl] = React.useState<string | null>(attachment.previewUri || null);
    const [hasError, setHasError] = React.useState(false);

    React.useEffect(() => {
      let mounted = true;
      if (imageUrl || !attachment.bucket || !attachment.storagePath) return () => { mounted = false; };

      (async () => {
        try {
          const signed = await createSignedUrl(attachment.bucket, attachment.storagePath, 3600);
          if (mounted) setImageUrl(signed);
        } catch {
          if (mounted) setHasError(true);
        }
      })();

      return () => {
        mounted = false;
      };
    }, [attachment.bucket, attachment.storagePath, imageUrl]);

    if (hasError || !imageUrl) return null;

    return (
      <TouchableOpacity
        style={[
          styles.imagePreviewCard,
          { borderColor: isUser ? 'rgba(255,255,255,0.18)' : theme.border },
        ]}
        activeOpacity={0.9}
        onPress={() => setImageViewerUri(imageUrl)}
      >
        <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
      </TouchableOpacity>
    );
  };

  useEffect(() => {
    if (visible && !showQuickActions) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [visible, messages, showQuickActions]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <Container
        style={[styles.modalContainer, { backgroundColor: theme.surface }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + (Platform.OS === 'ios' ? 6 : 0)}
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
                  <Text style={[styles.headerTitle, { color: theme.text }]}>
                    {roleCopy.title}
                  </Text>
                  <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                    {headerSubtitle}
                  </Text>
                </View>
              </View>
              {onOpenHistory && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onOpenHistory();
                  }}
                  style={[styles.closeButton, { marginRight: 6 }]}
                >
                  <Ionicons name="time-outline" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
              {onNewChat && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onNewChat();
                  }}
                  style={[styles.closeButton, { marginRight: 6 }]}
                >
                  <Ionicons name="add-outline" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
              {onExportChat && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onExportChat();
                  }}
                  style={[styles.closeButton, { marginRight: 6 }]}
                >
                  <Ionicons name="share-social-outline" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
              {onBackToQuickActions && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onBackToQuickActions();
                  }}
                  style={[styles.closeButton, { marginRight: 6 }]}
                >
                  <Ionicons name={showQuickActions ? 'chatbubble-ellipses-outline' : 'grid-outline'} size={22} color={theme.textSecondary} />
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

          {tierStatus && (
            <View style={[styles.usageBanner, { borderColor: theme.border, backgroundColor: theme.background }]}>
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

          {/* Content */}
          {showQuickActions ? (
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={[styles.messagesContent, { paddingBottom: Math.max(140, styles.messagesContent?.paddingBottom || 0) }]}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
            >
              <QuickActions
                onAction={onQuickAction}
                ageGroup={quickActionAge}
                onAgeGroupChange={onQuickActionAgeChange}
                customPrompt={quickActionPrompt}
                onCustomPromptChange={onQuickActionPromptChange}
                onSendPrompt={onSendPrompt}
              />
            </ScrollView>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={[styles.messagesContent, { paddingBottom: Math.max(140, styles.messagesContent?.paddingBottom || 0) }]}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 && (
                <View style={{ paddingVertical: 24 }}>
                  <Text style={[styles.loadingText, { color: theme.textSecondary, textAlign: 'center' }]}>
                    Start a conversation or tap the grid to open Quick Actions.
                  </Text>
                </View>
              )}
              {messages.map((message) => {
                const markdownStyles = getMarkdownStyles(theme);
                const displayContent = message.role === 'assistant'
                  ? getAssistantDisplayContent(message.content)
                  : message.content;
                const showInlineReply = inlineReplyEnabled && message.role === 'assistant' && isQuestionLike(displayContent);
                const showQuickReplies = inlineReplyEnabled && message.role === 'assistant' && !message.isLoading;
                const inlineValue = inlineReplies[message.id] ?? '';
                const quickReplies = [
                  { label: 'Hint', prompt: 'Give me a hint.' },
                  { label: 'Explain', prompt: 'Explain it step by step.' },
                  { label: 'Show steps', prompt: 'Show the steps.' },
                  { label: 'Try another', prompt: 'Give me another question.' },
                  { label: "I'm stuck", prompt: "I'm stuck. Please help me." },
                ];
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
                    </View>
                  ) : message.role === 'user' ? (
                    <Text style={[styles.messageText, { color: '#fff' }]}>
                      {displayContent}
                    </Text>
                  ) : (
                    // Use Markdown for assistant messages on native
                    Markdown ? (
                      <Markdown style={markdownStyles}>{displayContent}</Markdown>
                    ) : (
                      <Text style={[styles.messageText, { color: theme.text }]}>
                        {displayContent}
                      </Text>
                    )
                  )}
                  {message.attachments && message.attachments.some((a) => a.kind === 'image') && (
                    <View style={styles.imagePreviewRow}>
                      {message.attachments
                        .filter((a) => a.kind === 'image')
                        .map((attachment) => (
                          <AttachmentImagePreview
                            key={attachment.id}
                            attachment={attachment}
                            isUser={message.role === 'user'}
                          />
                        ))}
                    </View>
                  )}
                  {!message.isLoading && !message.isStreaming && (
                    <View style={styles.messageActionsRow}>
                      {onCopyMessage && (
                        <TouchableOpacity
                          style={styles.messageAction}
                          onPress={() => onCopyMessage(message)}
                        >
                          <Ionicons name="copy-outline" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                      )}
                      {message.role === 'assistant' && onRegenerateMessage && (
                        <TouchableOpacity
                          style={styles.messageAction}
                          onPress={() => onRegenerateMessage(message)}
                        >
                          <Ionicons name="refresh-outline" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                      )}
                      {message.role === 'user' && onEditMessage && (
                        <TouchableOpacity
                          style={styles.messageAction}
                          onPress={() => onEditMessage(message)}
                        >
                          <Ionicons name="create-outline" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                      )}
                      {message.role === 'assistant' && onFeedback && (
                        <>
                          <TouchableOpacity
                            style={styles.messageAction}
                            onPress={() => onFeedback(message, 'up')}
                          >
                            <Ionicons name="thumbs-up-outline" size={16} color={theme.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.messageAction}
                            onPress={() => onFeedback(message, 'down')}
                          >
                            <Ionicons name="thumbs-down-outline" size={16} color={theme.textSecondary} />
                          </TouchableOpacity>
                        </>
                      )}
                      {onShareMessage && (
                        <TouchableOpacity
                          style={styles.messageAction}
                          onPress={() => onShareMessage(message)}
                        >
                          <Ionicons name="share-outline" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  {message.isStreaming && (
                    <View style={styles.typingIndicator}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <Text style={[styles.typingText, { color: theme.textSecondary }]}>Typing…</Text>
                    </View>
                  )}
                  {showInlineReply && (
                    <View style={[styles.inlineReplyContainer, { borderTopColor: theme.border }]}>
                      <TextInput
                        style={[styles.inlineReplyInput, { backgroundColor: theme.surface, color: theme.text }]}
                        placeholder="Reply here..."
                        placeholderTextColor={theme.textSecondary}
                        value={inlineValue}
                        onChangeText={(value) => {
                          setInlineReplies(prev => ({ ...prev, [message.id]: value }));
                        }}
                        onSubmitEditing={() => {
                          const trimmed = inlineValue.trim();
                          if (!trimmed || isProcessing) return;
                          onSend(trimmed);
                          setInlineReplies(prev => ({ ...prev, [message.id]: '' }));
                        }}
                        returnKeyType="send"
                      />
                      <TouchableOpacity
                        style={[
                          styles.inlineReplySend,
                          { backgroundColor: inlineValue.trim() ? theme.primary : theme.border },
                        ]}
                        onPress={() => {
                          const trimmed = inlineValue.trim();
                          if (!trimmed || isProcessing) return;
                          onSend(trimmed);
                          setInlineReplies(prev => ({ ...prev, [message.id]: '' }));
                        }}
                        disabled={!inlineValue.trim() || isProcessing}
                      >
                        <Ionicons name="send" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {showQuickReplies && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.quickReplyRow}
                    >
                      {quickReplies.map((chip) => (
                        <TouchableOpacity
                          key={`${message.id}-${chip.label}`}
                          style={[styles.quickReplyChip, { backgroundColor: theme.surface }]}
                          onPress={() => {
                            if (isProcessing) return;
                            onSend(chip.prompt);
                          }}
                        >
                          <Text style={[styles.quickReplyText, { color: theme.textSecondary }]}>
                            {chip.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              );
              })}
            </ScrollView>
          )}

          {isEditing && (
            <View style={[styles.editingBanner, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="create-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.editingText, { color: theme.textSecondary }]}>
                Editing message
              </Text>
              {onCancelEdit && (
                <TouchableOpacity onPress={onCancelEdit}>
                  <Ionicons name="close" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
          {/* Input */}
          <View style={[styles.inputContainer, { borderTopColor: theme.border, paddingBottom: Math.max(12, insets.bottom) }]}>
            {/* Voice controls */}
            <View style={styles.voiceControls}>
              {onMicPress && (
                <TouchableOpacity
                  style={styles.orbControl}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onMicPress();
                  }}
                >
                  <CosmicOrb size={36} isProcessing={isListeningForCommand || isProcessing} isSpeaking={isSpeaking} />
                  <View
                    style={[
                      styles.orbControlRing,
                      { borderColor: isListeningForCommand ? '#ef4444' : theme.primary },
                    ]}
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
                </View>
              )}
            </View>

            <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={styles.inputAccessoryLeft}>
                {onAttachFile && (
                  <TouchableOpacity
                    style={styles.inputIconButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onAttachFile();
                    }}
                    disabled={isProcessing}
                    accessibilityLabel="Attach files"
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="attach"
                      size={18}
                      color={attachmentCount > 0 ? theme.primary : theme.textSecondary}
                    />
                    {attachmentCount > 0 && (
                      <View style={[styles.attachBadgeSmall, { backgroundColor: theme.primary }]}>
                        <Text style={[styles.attachBadgeSmallText, { color: theme.onPrimary }]}>
                          {attachmentCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {onTakePhoto && showCamera && (
                  <TouchableOpacity
                    style={styles.inputIconButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onTakePhoto();
                    }}
                    disabled={isProcessing}
                    accessibilityLabel="Take photo"
                    accessibilityRole="button"
                  >
                    <Ionicons name="camera-outline" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[styles.inputText, { color: theme.text }]}
                placeholder="Ask Dash anything..."
                placeholderTextColor={theme.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => inputText.trim() && onSend(inputText)}
                returnKeyType="send"
                multiline
                maxLength={500}
              />
            </View>
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
      </Container>
      <Modal visible={!!imageViewerUri} transparent animationType="fade" onRequestClose={() => setImageViewerUri(null)}>
        <View style={styles.imageViewerBackdrop}>
          <SafeAreaView style={styles.imageViewerContent}>
            <TouchableOpacity
              style={styles.imageViewerClose}
              onPress={() => setImageViewerUri(null)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            {imageViewerUri && (
              <Image source={{ uri: imageViewerUri }} style={styles.imageViewerImage} />
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </Modal>
  );
};
