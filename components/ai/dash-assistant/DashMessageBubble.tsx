/**
 * DashMessageBubble Component
 * 
 * Renders individual chat messages for the Dash AI Assistant.
 * Extracted from DashAssistant for better maintainability.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Platform, Linking, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../DashAssistant.styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { DashMessage } from '@/services/dash-ai/types';
import { getFileIconName, formatFileSize } from '@/services/AttachmentService';
import { renderCAPSResults } from '@/services/caps/parseCAPSResults';

interface DashMessageBubbleProps {
  message: DashMessage;
  index: number;
  totalMessages: number;
  speakingMessageId: string | null;
  isLoading: boolean;
  voiceEnabled?: boolean;
  showFollowUps?: boolean;
  onSpeak: (message: DashMessage) => void;
  onRetry: (content: string) => void;
  onSendFollowUp: (text: string) => void;
  onSendTutorAnswer?: (text: string, sourceMessageId?: string) => void;
  extractFollowUps: (text: string) => string[];
}

export const DashMessageBubble: React.FC<DashMessageBubbleProps> = ({
  message,
  index,
  totalMessages,
  speakingMessageId,
  isLoading,
  voiceEnabled = true,
  showFollowUps = true,
  onSpeak,
  onRetry,
  onSendFollowUp,
  onSendTutorAnswer,
  extractFollowUps,
}) => {
  const { theme, isDark } = useTheme();
  const isUser = message.type === 'user';
  const [inlineAnswer, setInlineAnswer] = React.useState('');

  React.useEffect(() => {
    setInlineAnswer('');
  }, [message.id]);

  const getTutorPhase = () => {
    const explicitPhase = (message.metadata as any)?.tutor_phase || (message.metadata as any)?.phase;
    if (explicitPhase) {
      return String(explicitPhase);
    }
    const content = (message.content || '').toLowerCase();
    if (!content) return null;
    if (/(quiz|practice|exercise|try it|solve|work through)/.test(content)) {
      return 'Practice';
    }
    if (/(diagnose|check in|quick check|question|assess)/.test(content) || (content.endsWith('?') && content.length < 180)) {
      return 'Diagnose';
    }
    if (/(explain|example|step|here's how|why this works)/.test(content)) {
      return 'Teach';
    }
    return null;
  };

  const phase = !isUser ? getTutorPhase() : null;
  const phaseColors = phase
    ? {
        Diagnose: { bg: theme.warning + '22', text: theme.warning || '#f59e0b' },
        Teach: { bg: theme.primary + '22', text: theme.primary },
        Practice: { bg: theme.success + '22', text: theme.success || '#16a34a' },
      }[phase as 'Diagnose' | 'Teach' | 'Practice'] || { bg: theme.surfaceVariant, text: theme.textSecondary }
    : null;
  
  // Check if this is the last user message (for retry button)
  const isLastUserMessage = isUser && (() => {
    for (let i = totalMessages - 1; i >= 0; i--) {
      // We'd need access to all messages array to check this properly
      // For now, approximate by checking if near the end
      return index >= totalMessages - 2;
    }
    return false;
  })();

  // Extract URLs from content
  const extractUrl = (content: string): string | undefined => {
    try {
      const urlMatch = content.match(/https?:\/\/[^\s)]+/i);
      return urlMatch ? urlMatch[0] : undefined;
    } catch {
      return undefined;
    }
  };

  const url = !isUser ? extractUrl(message.content || '') : undefined;
  const isPdf = url ? /\.pdf(\?|$)/i.test(url) : false;

  const isLatestMessage = index === totalMessages - 1;
  const hasTutorQuestion = !!message.metadata?.tutor_question || !!message.metadata?.tutor_question_text;
  const showInlineAnswer = !isUser && isLatestMessage && !isLoading && hasTutorQuestion;

  const handleInlineSend = () => {
    const trimmed = inlineAnswer.trim();
    if (!trimmed) return;
    if (onSendTutorAnswer) {
      onSendTutorAnswer(trimmed, message.id);
    } else {
      onSendFollowUp(trimmed);
    }
    setInlineAnswer('');
  };

  // Get suggestions from metadata or extract from content
  const suggestions = !isUser && showFollowUps && !message.metadata?.tutor_question && (
    (message.metadata?.suggested_actions && message.metadata.suggested_actions.length > 0)
      ? message.metadata.suggested_actions
      : extractFollowUps(message.content)
  );

  const sanitizeAssistantContent = (content: string) => {
    return (content || '')
      .split(/\n+/)
      .filter(line => !/^\s*User:\s*/i.test(line))
      .filter(line => !/^\s*\[.*(wait|response).*?\]\s*$/i.test(line))
      .join('\n');
  };

  return (
    <View
      style={[
        styles.messageContainer,
        isUser ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          isUser
            ? { backgroundColor: theme.primary }
            : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 0.5 },
          Platform.OS === 'ios' ? {
            shadowColor: isDark ? '#000' : '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isUser ? 0.25 : 0.12,
            shadowRadius: 4,
          } : {
            elevation: isUser ? 3 : 2,
          }
        ]}
      >
        {!isUser && (
          <View style={styles.messageHeaderRow}>
            <View style={styles.messageHeaderLeft}>
              <View style={[styles.inlineAvatar, { backgroundColor: theme.primary }]}>
                <Ionicons name="sparkles" size={12} color={theme.onPrimary} />
              </View>
              <Text style={[styles.messageRoleLabel, { color: theme.text }]}>Dash Tutor</Text>
            </View>
            {phase && (
              <View style={[styles.phasePill, { backgroundColor: phaseColors?.bg }]}>
                <Text style={[styles.phaseText, { color: phaseColors?.text }]}>{phase}</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.messageContentRow}>
          <Text
            style={[
              styles.messageText,
              { color: isUser ? theme.onPrimary : theme.text, flex: 1 },
            ]}
            selectable={true}
            selectionColor={isUser ? 'rgba(255,255,255,0.3)' : theme.primaryLight}
          >
            {isUser ? message.content : sanitizeAssistantContent(message.content || '')}
          </Text>
          
          {isUser && isLastUserMessage && !isLoading && (
            <TouchableOpacity
              style={styles.inlineBubbleRetryButton}
              onPress={() => onRetry(message.content)}
              accessibilityLabel="Try again"
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={14} color={theme.onPrimary} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Voice note indicator */}
        {message.voiceNote && (
          <View style={styles.voiceNoteIndicator}>
            <Ionicons 
              name="mic" 
              size={12} 
              color={isUser ? theme.onPrimary : theme.textSecondary} 
            />
            <Text
              style={[
                styles.voiceNoteDuration,
                { color: isUser ? theme.onPrimary : theme.textSecondary },
              ]}
            >
              {Math.round((message.voiceNote.duration || 0) / 1000)}s
            </Text>
          </View>
        )}
        
        {/* Attachments display */}
        {message.attachments && message.attachments.length > 0 && (
          <View style={styles.messageAttachmentsContainer}>
            {message.attachments.map((attachment, idx) => (
              <View 
                key={idx}
                style={[
                  styles.messageAttachment,
                  { 
                    backgroundColor: isUser 
                      ? 'rgba(255, 255, 255, 0.2)' 
                      : theme.surfaceVariant,
                    borderColor: isUser ? 'rgba(255, 255, 255, 0.3)' : theme.border,
                  }
                ]}
              >
                <Ionicons 
                  name={getFileIconName(attachment.kind)} 
                  size={14} 
                  color={isUser ? theme.onPrimary : theme.text} 
                />
                <Text 
                  style={[
                    styles.messageAttachmentName,
                    { color: isUser ? theme.onPrimary : theme.text }
                  ]}
                  numberOfLines={1}
                >
                  {attachment.name}
                </Text>
                <Text 
                  style={[
                    styles.messageAttachmentSize,
                    { color: isUser ? theme.onPrimary : theme.textSecondary }
                  ]}
                >
                  {formatFileSize(attachment.size)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {showInlineAnswer && (
          <View style={[styles.inlineAnswerContainer, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
            <Text style={[styles.inlineAnswerLabel, { color: theme.textSecondary }]}>Your answer</Text>
            <View style={styles.inlineAnswerRow}>
              <TextInput
                style={[styles.inlineAnswerInput, { color: theme.text }]}
                placeholder="Type your answer…"
                placeholderTextColor={theme.textTertiary}
                value={inlineAnswer}
                onChangeText={setInlineAnswer}
                editable={!isLoading}
                onSubmitEditing={handleInlineSend}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[
                  styles.inlineAnswerSend,
                  { backgroundColor: inlineAnswer.trim() ? theme.primary : theme.border }
                ]}
                onPress={handleInlineSend}
                disabled={!inlineAnswer.trim()}
                accessibilityLabel="Send answer"
                accessibilityRole="button"
              >
                <Ionicons name="send" size={14} color={inlineAnswer.trim() ? theme.onPrimary : theme.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {/* CAPS results (tool outputs) */}
        {!isUser && message.metadata?.tool_results && (
          <View style={{ marginTop: 8 }}>
            {renderCAPSResults(message.metadata)}
          </View>
        )}

        {/* Follow-up question chips */}
        {!isUser && suggestions && suggestions.length > 0 && (
          <View style={styles.followUpContainer}>
            {suggestions.map((q: string, idx: number) => (
              <TouchableOpacity
                key={idx}
                style={[styles.followUpChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => onSendFollowUp(q)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Send: ${q}`}
              >
                <Text style={[styles.followUpText, { color: theme.text }]}>{q}</Text>
                <View pointerEvents="none" style={[styles.followUpFab, { backgroundColor: theme.primary }]}> 
                  <Ionicons name="send" size={16} color={theme.onPrimary || '#fff'} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        {/* PDF/Link quick action */}
        {!isUser && url && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
            <TouchableOpacity
              style={[styles.inlineSpeakButton, { backgroundColor: isPdf ? theme.primary : theme.accent }]}
              onPress={() => {
                if (Platform.OS === 'web') {
                  window.open(url, '_blank');
                } else {
                  Linking.openURL(url).catch(() => Alert.alert('Open failed', 'Could not open the link'));
                }
              }}
              accessibilityLabel={isPdf ? 'Open PDF' : 'Open link'}
              activeOpacity={0.8}
            >
              <Ionicons name={isPdf ? 'document' : 'open-outline'} size={12} color={theme.onAccent || '#fff'} />
            </TouchableOpacity>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>
              {isPdf ? 'Open PDF' : 'Open link'}
            </Text>
          </View>
        )}

        {/* Bottom row with avatar, speak button and timestamp */}
        <View style={styles.messageBubbleFooter}>
          {!isUser && (
            <>
              <TouchableOpacity
                style={[
                  styles.inlineSpeakButton, 
                  { 
                    backgroundColor: speakingMessageId === message.id ? theme.error : theme.accent,
                    opacity: voiceEnabled ? 1 : 0.5,
                  }
                ]}
                onPress={() => onSpeak(message)}
                disabled={!voiceEnabled}
                activeOpacity={0.7}
                accessibilityLabel={speakingMessageId === message.id ? "Stop speaking" : "Speak message"}
              >
                <Ionicons 
                  name={speakingMessageId === message.id ? "stop" : "volume-high"} 
                  size={12} 
                  color={speakingMessageId === message.id ? theme.onError || theme.background : theme.onAccent} 
                />
              </TouchableOpacity>
            </>
          )}
          <View style={{ flex: 1 }} />
          <Text
            style={[
              styles.messageTime,
              { color: isUser ? theme.onPrimary : theme.textTertiary },
            ]}
          >
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>
    </View>
  );
};
