/**
 * DashMessageBubble Component
 * 
 * Renders individual chat messages for the Dash AI Assistant.
 * Extracted from DashAssistant for better maintainability.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Platform, Linking, Alert, TextInput, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../DashAssistant.styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { DashMessage } from '@/services/dash-ai/types';
import { createSignedUrl, getFileIconName, formatFileSize } from '@/services/AttachmentService';
import { renderCAPSResults } from '@/services/caps/parseCAPSResults';
import { LinearGradient } from 'expo-linear-gradient';

const isWeb = Platform.OS === 'web';
let Markdown: React.ComponentType<any> | null = null;
if (!isWeb) {
  try {
    Markdown = require('react-native-markdown-display').default;
  } catch (e) {
    console.warn('[DashMessageBubble] Markdown not available:', e);
  }
}

const buildMarkdownStyles = (theme: ReturnType<typeof useTheme>['theme'], isUser: boolean) => ({
  body: {
    color: isUser ? theme.onPrimary : theme.text,
    fontSize: 14,
    lineHeight: 20,
  },
  paragraph: {
    color: isUser ? theme.onPrimary : theme.text,
    marginBottom: 6,
  },
  heading1: {
    color: isUser ? theme.onPrimary : theme.text,
    fontSize: 18,
    fontWeight: '700' as const,
    marginTop: 12,
    marginBottom: 6,
  },
  heading2: {
    color: isUser ? theme.onPrimary : theme.text,
    fontSize: 16,
    fontWeight: '700' as const,
    marginTop: 10,
    marginBottom: 6,
  },
  heading3: {
    color: isUser ? theme.onPrimary : theme.text,
    fontSize: 15,
    fontWeight: '600' as const,
    marginTop: 8,
    marginBottom: 4,
  },
  strong: {
    fontWeight: '700' as const,
    color: isUser ? theme.onPrimary : theme.text,
  },
  em: {
    fontStyle: 'italic' as const,
    color: isUser ? theme.onPrimary : theme.textSecondary,
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginBottom: 2,
  },
  bullet_list_icon: {
    color: isUser ? theme.onPrimary : theme.primary,
    marginRight: 8,
  },
  code_inline: {
    backgroundColor: isUser ? 'rgba(255,255,255,0.18)' : theme.surfaceVariant,
    color: isUser ? theme.onPrimary : theme.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  code_block: {
    backgroundColor: isUser ? 'rgba(0,0,0,0.25)' : '#101420',
    padding: 12,
    borderRadius: 10,
    marginVertical: 8,
  },
  fence: {
    backgroundColor: isUser ? 'rgba(0,0,0,0.25)' : '#101420',
    padding: 12,
    borderRadius: 10,
    marginVertical: 8,
  },
  blockquote: {
    backgroundColor: (isUser ? theme.onPrimary : theme.primary) + '12',
    borderLeftWidth: 3,
    borderLeftColor: isUser ? theme.onPrimary : theme.primary,
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
    borderRadius: 6,
  },
  link: {
    color: isUser ? theme.onPrimary : theme.primary,
    textDecorationLine: 'underline' as const,
  },
});

const AttachmentImagePreview: React.FC<{
  attachment: DashMessage['attachments'][number];
  isUser: boolean;
}> = ({ attachment, isUser }) => {
  const { theme } = useTheme();
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
    <View
      style={[
        styles.imagePreviewCard,
        { borderColor: isUser ? 'rgba(255,255,255,0.2)' : theme.border },
      ]}
    >
      <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
    </View>
  );
};

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
  assistantLabel?: string;
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
  assistantLabel,
}) => {
  const { theme, isDark } = useTheme();
  const isUser = message.type === 'user';
  const [inlineAnswer, setInlineAnswer] = React.useState('');
  
  // Enhanced gradients for better visual appeal
  const userGradient = isDark
    ? [theme.primaryDark || '#1e40af', theme.primary, theme.accentDark || '#7c3aed']
    : ['#0ea5e9', '#3b82f6', '#6366f1']; // Sky blue → Blue → Indigo

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
    if (typeof payload.hint === 'string' && payload.hint.trim()) {
      lines.push(payload.hint.trim());
    }
    if (typeof payload.correct_answer === 'string' && payload.correct_answer.trim()) {
      lines.push(`Correct answer: ${payload.correct_answer.trim()}`);
    }
    if (typeof payload.steps === 'string' && payload.steps.trim()) {
      lines.push(payload.steps.trim());
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
      .filter(line => !/^\s*(TUTOR MODE OVERRIDE:|Mode:|Age band:|School type:)/i.test(line))
      .filter(line => !/^\s*You are Dash,.*tutor/i.test(line))
      .filter(line => !/^\s*Return ONLY JSON/i.test(line))
      .filter(line => !/TUTOR_PAYLOAD/i.test(line))
      .join('\n')
      .trim();
  };

  const getAssistantDisplayContent = () => {
    const raw = message.content || '';
    const payload = parseTutorPayload(raw);
    if (payload) {
      const display = buildTutorDisplay(payload);
      if (display) return display;
    }
    const metaQuestion = message.metadata?.tutor_question_text;
    if (metaQuestion) {
      const cleaned = sanitizeAssistantContent(raw);
      if (cleaned && cleaned.length > metaQuestion.trim().length + 20) {
        return cleaned;
      }
      return metaQuestion;
    }
    if (isTutorPromptLeak(raw)) {
      return 'Dash is preparing your tutor response. Tap retry if this keeps happening.';
    }
    const cleaned = sanitizeAssistantContent(raw);
    return cleaned || raw.trim();
  };

  const sanitizeUserDisplayContent = (content: string) => {
    if (!content) return content;
    const lower = content.toLowerCase();
    const isTutorPrompt = /you are dash, an interactive tutor|tutor_payload|return only json|tutor mode override/i.test(lower);
    if (!isTutorPrompt) return content;
    const requestMatch = content.match(/Learner request:\s*([^\n]+)/i);
    if (requestMatch?.[1]) return requestMatch[1].trim();
    const answerMatch = content.match(/Learner answer:\s*([^\n]+)/i);
    if (answerMatch?.[1]) return answerMatch[1].trim();
    const questionMatch = content.match(/Question:\s*([^\n]+)/i);
    if (questionMatch?.[1]) return questionMatch[1].trim();
    return 'Tutor request';
  };

  const assistantContent = getAssistantDisplayContent();
  const userContent = sanitizeUserDisplayContent(message.content || '');
  const markdownStyles = React.useMemo(() => buildMarkdownStyles(theme, isUser), [theme, isUser]);

  const BubbleSurface: React.ElementType = isUser ? LinearGradient : View;
  const bubbleSurfaceProps = isUser
    ? { 
        colors: userGradient, 
        start: { x: 0, y: 0 }, 
        end: { x: 1, y: 1 } 
      }
    : {};
  
  // Enhanced bubble shadows for depth
  const bubbleShadow = Platform.OS === 'ios'
    ? {
        shadowColor: isUser ? theme.primary : '#000',
        shadowOffset: { width: 0, height: isUser ? 4 : 2 },
        shadowOpacity: isUser ? 0.3 : 0.1,
        shadowRadius: isUser ? 12 : 8,
      }
    : {
        elevation: isUser ? 5 : 2,
      };

  return (
    <View
      style={[
        styles.messageContainer,
        isUser ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      <BubbleSurface
        {...bubbleSurfaceProps}
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          { alignSelf: isUser ? 'flex-end' : 'flex-start' },
          isUser
            ? { 
                borderColor: 'rgba(255,255,255,0.3)', 
                borderWidth: 0.5 
              }
            : { 
                backgroundColor: theme.surface, 
                borderColor: theme.border, 
                borderWidth: 1.5 
              },
          bubbleShadow,
        ]}
      >
        {!isUser && (
          <View style={styles.messageHeaderRow}>
            <View style={styles.messageHeaderLeft}>
              <View style={[styles.inlineAvatar, { backgroundColor: theme.primary }]}>
                <Ionicons name="sparkles" size={12} color={theme.onPrimary} />
              </View>
              <Text style={[styles.messageRoleLabel, { color: theme.text }]}>
                {assistantLabel || 'Dash AI'}
              </Text>
            </View>
            {phase && (
              <View style={[styles.phasePill, { backgroundColor: phaseColors?.bg, borderColor: phaseColors?.text || theme.border }]}>
                <Text style={[styles.phaseText, { color: phaseColors?.text }]}>{phase}</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.messageContentRow}>
          {isUser || !Markdown ? (
            <Text
              style={[
                styles.messageText,
                { color: isUser ? theme.onPrimary : theme.text, flex: 1 },
                message.content?.length < 18 ? { textAlign: 'center' } : null,
              ]}
              selectable={true}
              selectionColor={isUser ? 'rgba(255,255,255,0.3)' : theme.primaryLight}
            >
              {isUser ? userContent : assistantContent}
            </Text>
          ) : (
            <View style={{ flex: 1 }}>
              <Markdown style={markdownStyles}>{assistantContent}</Markdown>
            </View>
          )}
          
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
        
        {/* Image previews */}
        {message.attachments && message.attachments.some((a) => a.kind === 'image') && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imagePreviewRow}
          >
            {message.attachments
              .filter((attachment) => attachment.kind === 'image')
              .map((attachment, idx) => (
                <AttachmentImagePreview key={`${attachment.id}-${idx}`} attachment={attachment} isUser={isUser} />
              ))}
          </ScrollView>
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.followUpScroll}
            >
              {suggestions.map((q: string, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.followUpChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => onSendFollowUp(q)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Send: ${q}`}
                >
                  <Text style={[styles.followUpText, { color: theme.text }]} numberOfLines={1}>
                    {q}
                  </Text>
                  <Ionicons name="send" size={14} color={theme.primary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
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
              { color: isUser ? 'rgba(255,255,255,0.72)' : theme.textTertiary },
            ]}
          >
            {new Date(message.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </BubbleSurface>
    </View>
  );
};
