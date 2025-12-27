import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  userAvatar: {
    marginRight: 0,
    marginLeft: 8,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: SCREEN_WIDTH * 0.75,
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
  },
  userText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  assistantText: {
    fontSize: 15,
    lineHeight: 22,
  },
  streamingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  streamingText: {
    fontSize: 14,
  },
  toolsUsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  toolsText: {
    fontSize: 11,
  },
  voiceModeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  voiceModeCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 101,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Web-specific markdown styles
  webHeading1: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    lineHeight: 28,
  },
  webHeading2: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
    lineHeight: 26,
  },
  webHeading3: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    lineHeight: 24,
  },
  webText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  webListItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 8,
  },
  webListBullet: {
    fontSize: 15,
    marginRight: 8,
    fontWeight: '600',
  },
  webListNumber: {
    fontSize: 15,
    marginRight: 8,
    fontWeight: '600',
    minWidth: 24,
  },
  webCodeBlock: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  webCodeLanguage: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  webCodeText: {
    fontFamily: Platform.OS === 'web' ? 'Monaco, Consolas, monospace' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
  },
  webInlineCode: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'web' ? 'Monaco, Consolas, monospace' : 'monospace',
    fontSize: 13,
  },
  webBlockquote: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
    borderRadius: 4,
  },
});

export const getMarkdownStyles = (theme: any) => ({
  body: {
    color: theme.text,
    fontSize: 15,
    lineHeight: 22,
  },
  heading1: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '700' as const,
    marginTop: 12,
    marginBottom: 8,
  },
  heading2: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 10,
    marginBottom: 6,
  },
  heading3: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 8,
    marginBottom: 4,
  },
  strong: {
    color: theme.text,
    fontWeight: '600' as const,
  },
  em: {
    color: theme.textSecondary,
    fontStyle: 'italic' as const,
  },
  bullet_list: {
    marginLeft: 8,
  },
  ordered_list: {
    marginLeft: 8,
  },
  list_item: {
    marginVertical: 4,
  },
  code_inline: {
    backgroundColor: theme.surface,
    color: theme.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  code_block: {
    backgroundColor: '#1e1e1e',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  fence: {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  blockquote: {
    backgroundColor: theme.primary + '15',
    borderLeftColor: theme.primary,
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 8,
    marginVertical: 8,
    borderRadius: 4,
  },
  link: {
    color: theme.primary,
    textDecorationLine: 'underline' as const,
  },
  hr: {
    backgroundColor: theme.border,
    height: 1,
    marginVertical: 16,
  },
  table: {
    borderColor: theme.border,
  },
  tr: {
    borderBottomColor: theme.border,
  },
  th: {
    backgroundColor: theme.surface,
    color: theme.text,
    fontWeight: '600' as const,
    padding: 8,
  },
  td: {
    padding: 8,
    color: theme.text,
  },
});
