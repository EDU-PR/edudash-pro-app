/**
 * DashMessageBubble Component
 * 
 * Renders individual chat messages for the Dash AI Assistant.
 * Extracted from DashAssistant for better maintainability.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Platform, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../DashAssistant.styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { DashMessage, DashAttachment } from '@/services/dash-ai/types';
import { getFileIconName, formatFileSize } from '@/services/AttachmentService';
import { renderCAPSResults } from '@/lib/caps';

interface DashMessageBubbleProps {
  message: DashMessage;
  index: number;
  totalMessages: number;
  speakingMessageId: string | null;
  isLoading: boolean;
  onSpeak: (message: DashMessage) => void;
  onRetry: (content: string) => void;
  onSendFollowUp: (text: string) => void;
  extractFollowUps: (text: string) => string[];
}

export const DashMessageBubble: React.FC<DashMessageBubbleProps> = ({
  message,
  index,
  totalMessages,
  speakingMessageId,
  isLoading,
  onSpeak,
  onRetry,
  onSendFollowUp,
  extractFollowUps,
}) => {
  const { theme, isDark } = useTheme();
  const isUser = message.type === 'user';
  
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

  // Get suggestions from metadata or extract from content
  const suggestions = !isUser && (
    (message.metadata?.suggested_actions && message.metadata.suggested_actions.length > 0)
      ? message.metadata.suggested_actions
      : extractFollowUps(message.content)
  );

  return (
    <View
      style={[
        styles.messageContainer,
        isUser ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      {/* Avatar for assistant messages */}
      {!isUser && (
        <View style={[styles.avatarContainer, { backgroundColor: theme.primary }]}>
          <Ionicons name="sparkles" size={16} color={theme.onPrimary} />
        </View>
      )}
      
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
        <View style={styles.messageContentRow}>
          <Text
            style={[
              styles.messageText,
              { color: isUser ? theme.onPrimary : theme.text, flex: 1 },
            ]}
            selectable={true}
            selectionColor={isUser ? 'rgba(255,255,255,0.3)' : theme.primaryLight}
          >
            {isUser 
              ? message.content 
              : (message.content || '').split(/\n+/).filter(line => !/^\s*User:\s*/i.test(line)).join('\n')
            }
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

        {/* Bottom row with speak button and timestamp */}
        <View style={styles.messageBubbleFooter}>
          {!isUser && (
            <TouchableOpacity
              style={[
                styles.inlineSpeakButton, 
                { 
                  backgroundColor: speakingMessageId === message.id ? theme.error : theme.accent,
                }
              ]}
              onPress={() => onSpeak(message)}
              activeOpacity={0.7}
              accessibilityLabel={speakingMessageId === message.id ? "Stop speaking" : "Speak message"}
            >
              <Ionicons 
                name={speakingMessageId === message.id ? "stop" : "volume-high"} 
                size={12} 
                color={speakingMessageId === message.id ? theme.onError || theme.background : theme.onAccent} 
              />
            </TouchableOpacity>
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
