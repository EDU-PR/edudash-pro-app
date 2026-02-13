/**
 * DashMessageBubble Component
 * 
 * Renders individual chat messages for the Dash AI Assistant.
 * Extracted from DashAssistant for better maintainability.
 */

import React from 'react';
import { View, Text, TouchableOpacity, Platform, Linking, Alert, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { messageStyles as styles } from './styles/message.styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { DashMessage } from '@/services/dash-ai/types';
import { createSignedUrl, getFileIconName, formatFileSize } from '@/services/AttachmentService';
import { LinearGradient } from 'expo-linear-gradient';
import { MathRenderer } from './MathRenderer';
import { MermaidRenderer } from './MermaidRenderer';

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

const toTitleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const prettifyToolName = (toolName?: string) => {
  const normalized = String(toolName || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!normalized) return 'Operation';
  return toTitleCase(
    normalized
      .replace(/\b(get|fetch|run|execute|create|generate|build)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || normalized,
  );
};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

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
  extractFollowUps,
  assistantLabel,
}) => {
  const { theme, isDark } = useTheme();
  const isUser = message.type === 'user';
  const [showRawToolPayload, setShowRawToolPayload] = React.useState(false);
  
  // Enhanced gradients for better visual appeal
  const userGradient = isDark
    ? [theme.primaryDark || '#1e40af', theme.primary, theme.accentDark || '#7c3aed']
    : ['#0ea5e9', '#3b82f6', '#6366f1']; // Sky blue → Blue → Indigo

  React.useEffect(() => {
    setShowRawToolPayload(false);
  }, [message.id]);

  // Check if this is the last user message (for retry button)
  const isLastUserMessage = isUser && index >= totalMessages - 2;

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

  // Get suggestions from metadata or extract from content
  const suggestions = !isUser && showFollowUps && (
    (message.metadata?.suggested_actions && message.metadata.suggested_actions.length > 0)
      ? message.metadata.suggested_actions
      : extractFollowUps(message.content)
  );

  const sanitizeAssistantContent = (content: string) => {
    return (content || '').trim();
  };

  const assistantContent = sanitizeAssistantContent(message.content || '');
  const userContent = message.content || '';
  const hasAssistantContent = assistantContent.trim().length > 0;
  const assistantFallbackText = isLoading && isLatestMessage
    ? 'Working on your request...'
    : 'I completed that step. Ask a follow-up and I will refine it.';
  const assistantDisplayText = hasAssistantContent ? assistantContent : assistantFallbackText;
  const metadata = (message.metadata || {}) as Record<string, any>;
  const rawToolName = firstText(metadata.tool_name);
  const toolExecution = metadata.tool_result as Record<string, any> | undefined;
  const isToolOperation = !isUser && !!rawToolName && !!toolExecution;
  const toolPayload = toolExecution ? (toolExecution.result ?? toolExecution.data ?? null) : null;
  const toolSuccess = toolExecution ? toolExecution.success !== false : true;
  const toolError = toolExecution ? firstText(toolExecution.error) : null;
  const generatedImages = (Array.isArray(metadata.generated_images) ? metadata.generated_images : [])
    .filter((img) => typeof img?.signed_url === 'string' && String(img.signed_url).trim().length > 0);
  const toolSummary = (() => {
    const explicitSummary = firstText(metadata.tool_summary);
    if (explicitSummary) return explicitSummary;
    if (!toolExecution) return null;
    const summary = firstText(
      toolPayload?.summary,
      toolPayload?.message,
      toolPayload?.status_message,
      toolPayload?.title,
    );
    if (summary) return summary;

    const count = typeof toolPayload?.count === 'number' ? toolPayload.count : null;
    const grade = firstText(toolPayload?.grade, toolPayload?.grade_level);
    const subject = firstText(toolPayload?.subject, toolPayload?.topic);
    const toolKey = String(rawToolName || '').toLowerCase();

    if (toolKey === 'get_caps_documents') {
      const target = [grade ? `Grade ${String(grade).replace(/^grade\s*/i, '')}` : null, subject]
        .filter(Boolean)
        .join(' ');
      if (count === 0) return `No CAPS documents found${target ? ` for ${target}` : ''}.`;
      if (count !== null) return `Found ${count} CAPS document${count === 1 ? '' : 's'}${target ? ` for ${target}` : ''}.`;
    }

    if (Array.isArray(toolPayload?.documents)) {
      const total = toolPayload.documents.length;
      return `Found ${total} document${total === 1 ? '' : 's'}.`;
    }
    if (Array.isArray(toolPayload?.recommendations)) {
      const total = toolPayload.recommendations.length;
      return `Generated ${total} recommendation${total === 1 ? '' : 's'}.`;
    }
    if (count !== null) {
      return `${count} result${count === 1 ? '' : 's'} returned.`;
    }
    return null;
  })();
  const toolMetaPills = (() => {
    if (!toolPayload || typeof toolPayload !== 'object') return [] as string[];
    const pills: string[] = [];
    const count = typeof toolPayload.count === 'number' ? toolPayload.count : null;
    const grade = firstText(toolPayload.grade, toolPayload.grade_level);
    const subject = firstText(toolPayload.subject, toolPayload.topic);
    const term = firstText(toolPayload.term, toolPayload.period, toolPayload.time_period);

    if (count !== null) pills.push(`${count} result${count === 1 ? '' : 's'}`);
    if (grade) pills.push(String(grade).toLowerCase().startsWith('grade') ? grade : `Grade ${grade}`);
    if (subject) pills.push(subject);
    if (term) pills.push(`Term ${term}`.replace(/\bterm term\b/i, 'Term'));
    return pills.slice(0, 4);
  })();
  const toolRawPayload = React.useMemo(() => {
    if (!toolExecution) return null;
    try {
      return JSON.stringify(toolPayload ?? toolExecution, null, 2);
    } catch {
      return null;
    }
  }, [toolExecution, toolPayload]);
  const markdownStyles = React.useMemo(() => buildMarkdownStyles(theme, isUser), [theme, isUser]);

  type RichSegment =
    | { type: 'markdown'; content: string }
    | { type: 'math'; content: string }
    | { type: 'inlineMath'; content: string }
    | { type: 'mermaid'; content: string }
    | { type: 'quiz'; content: string };

  const parseRichSegments = (content: string): RichSegment[] => {
    const splitByPattern = (
      input: RichSegment[],
      regex: RegExp,
      mapper: (value: string) => RichSegment,
    ): RichSegment[] => {
      const next: RichSegment[] = [];
      for (const segment of input) {
        if (segment.type !== 'markdown') {
          next.push(segment);
          continue;
        }
        const text = segment.content || '';
        let cursor = 0;
        regex.lastIndex = 0;
        let match: RegExpExecArray | null = null;
        while ((match = regex.exec(text)) !== null) {
          const [raw, captured] = match;
          const start = match.index;
          const end = start + raw.length;
          if (start > cursor) {
            next.push({ type: 'markdown', content: text.slice(cursor, start) });
          }
          next.push(mapper(String(captured || '').trim()));
          cursor = end;
        }
        if (cursor < text.length) {
          next.push({ type: 'markdown', content: text.slice(cursor) });
        }
      }
      return next;
    };

    const base: RichSegment[] = [{ type: 'markdown', content }];
    // Quiz blocks: ```quiz ... ```
    const withQuiz = splitByPattern(base, /```quiz\s*([\s\S]*?)```/gi, (value) => ({
      type: 'quiz' as const,
      content: value,
    }));
    const withMermaid = splitByPattern(withQuiz, /```mermaid\s*([\s\S]*?)```/gi, (value) => ({
      type: 'mermaid',
      content: value,
    }));
    const withMath = splitByPattern(withMermaid, /\$\$([\s\S]*?)\$\$/g, (value) => ({
      type: 'math',
      content: value,
    }));
    // Inline math: $...$ (single dollar, not preceded/followed by space+dollar)
    const withInlineMath = splitByPattern(withMath, /(?<!\$)\$(?!\$)([^\$\n]+?)(?<!\$)\$(?!\$)/g, (value) => ({
      type: 'inlineMath',
      content: value,
    }));

    return withInlineMath.filter((segment) => {
      if (segment.type === 'markdown') return segment.content.trim().length > 0;
      return segment.content.length > 0;
    });
  };

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
                {assistantLabel || 'Dash'}
              </Text>
            </View>
          </View>
        )}
        <View style={styles.messageContentRow}>
          {isToolOperation ? (
            <View
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: toolSuccess ? theme.primary + '44' : theme.error + '44',
                backgroundColor: toolSuccess ? theme.primary + '12' : theme.error + '10',
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: toolSuccess ? theme.primary + '22' : theme.error + '22',
                    }}
                  >
                    <Ionicons
                      name={toolSuccess ? 'checkmark-done-outline' : 'alert-circle-outline'}
                      size={14}
                      color={toolSuccess ? theme.primary : theme.error}
                    />
                  </View>
                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700', flexShrink: 1 }}>
                    {prettifyToolName(rawToolName || undefined)}
                  </Text>
                </View>
                <View
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    backgroundColor: toolSuccess ? theme.success + '22' : theme.error + '22',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: toolSuccess ? (theme.success || '#16a34a') : theme.error,
                      textTransform: 'uppercase',
                    }}
                  >
                    {toolSuccess ? 'Done' : 'Error'}
                  </Text>
                </View>
              </View>

              {(toolSummary || assistantContent) && (
                <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>
                  {toolSummary || assistantContent}
                </Text>
              )}

              {toolMetaPills.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {toolMetaPills.map((pill) => (
                    <View
                      key={pill}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderWidth: 1,
                        borderColor: theme.border,
                        backgroundColor: theme.surface,
                      }}
                    >
                      <Text style={{ color: theme.text, fontSize: 11, fontWeight: '600' }}>{pill}</Text>
                    </View>
                  ))}
                </View>
              )}

              {toolRawPayload && (
                <TouchableOpacity
                  onPress={() => setShowRawToolPayload((prev) => !prev)}
                  style={{
                    alignSelf: 'flex-start',
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: theme.surface,
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={showRawToolPayload ? 'Hide raw tool output' : 'View raw tool output'}
                >
                  <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>
                    {showRawToolPayload ? 'Hide raw output' : 'View raw output'}
                  </Text>
                </TouchableOpacity>
              )}

              {showRawToolPayload && toolRawPayload && (
                <View
                  style={{
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: '#0f172a',
                    maxHeight: 220,
                    overflow: 'hidden',
                  }}
                >
                  <ScrollView
                    style={{ maxHeight: 220 }}
                    contentContainerStyle={{ padding: 10 }}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={true}
                  >
                    <Text
                      selectable
                      style={{
                        color: '#cbd5e1',
                        fontFamily: 'monospace',
                        fontSize: 11,
                        lineHeight: 16,
                      }}
                    >
                      {toolRawPayload}
                    </Text>
                  </ScrollView>
                </View>
              )}

              {!toolSuccess && toolError && (
                <Text style={{ color: theme.error, fontSize: 12, lineHeight: 17 }}>
                  {toolError}
                </Text>
              )}
            </View>
          ) : isUser || !Markdown ? (
            <Text
              style={[
                styles.messageText,
                { color: isUser ? theme.onPrimary : theme.text, flex: 1 },
                message.content?.length < 18 ? { textAlign: 'center' } : null,
              ]}
              selectable={true}
              selectionColor={isUser ? 'rgba(255,255,255,0.3)' : theme.primaryLight}
            >
              {isUser ? userContent : assistantDisplayText}
            </Text>
          ) : (
            <View style={{ flex: 1 }}>
              {parseRichSegments(assistantDisplayText).map((segment, segmentIndex) => {
                if (segment.type === 'math') {
                  return (
                    <MathRenderer
                      key={`math-${message.id}-${segmentIndex}`}
                      expression={segment.content}
                      displayMode
                    />
                  );
                }
                if (segment.type === 'inlineMath') {
                  return (
                    <MathRenderer
                      key={`imath-${message.id}-${segmentIndex}`}
                      expression={segment.content}
                      displayMode={false}
                    />
                  );
                }
                if (segment.type === 'mermaid') {
                  return (
                    <MermaidRenderer
                      key={`mermaid-${message.id}-${segmentIndex}`}
                      definition={segment.content}
                    />
                  );
                }
                return (
                  <Markdown key={`md-${message.id}-${segmentIndex}`} style={markdownStyles}>
                    {segment.content}
                  </Markdown>
                );
              })}
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
        {generatedImages.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imagePreviewRow}
          >
            {generatedImages.map((image, idx) => (
              <View
                key={`generated-${message.id}-${idx}`}
                style={[
                  styles.imagePreviewCard,
                  { borderColor: isUser ? 'rgba(255,255,255,0.2)' : theme.border },
                ]}
              >
                <Image source={{ uri: String(image.signed_url) }} style={styles.imagePreview} />
              </View>
            ))}
          </ScrollView>
        )}

        {/* Attachments display (non-image only — images already shown as visual previews above) */}
        {message.attachments && message.attachments.some((a) => a.kind !== 'image') && (
          <View style={styles.messageAttachmentsContainer}>
            {message.attachments
              .filter((attachment) => attachment.kind !== 'image')
              .map((attachment, idx) => (
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
