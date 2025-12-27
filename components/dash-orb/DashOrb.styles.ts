import { StyleSheet, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const styles = StyleSheet.create({
  orbContainer: {
    position: 'absolute',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbGlow: {
    position: 'absolute',
    backgroundColor: '#8b5cf6',
  },
  orb: {
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  orbGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  dismissArea: {
    flex: 1,
  },
  chatContainer: {
    height: SCREEN_HEIGHT * 0.75,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerOrb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  helpTooltip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  helpTooltipText: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 32,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
  },
  toolCallsContainer: {
    marginTop: 12,
    gap: 6,
  },
  toolCall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolCallText: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  quickActionsContainer: {
    marginTop: 16,
  },
  quickActionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  voiceControls: {
    flexDirection: 'row',
    gap: 8,
  },
  voiceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  voiceButtonActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * Dynamic markdown styles for assistant messages
 */
export const getMarkdownStyles = (theme: { 
  text: string; 
  textSecondary: string; 
  primary: string; 
  surface: string;
  background: string;
}) => ({
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
    marginBottom: 6,
  },
  heading2: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 10,
    marginBottom: 5,
  },
  heading3: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 8,
    marginBottom: 4,
  },
  paragraph: {
    color: theme.text,
    marginBottom: 8,
  },
  strong: {
    fontWeight: '600' as const,
    color: theme.text,
  },
  em: {
    fontStyle: 'italic' as const,
    color: theme.textSecondary,
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginBottom: 4,
  },
  bullet_list_icon: {
    color: theme.primary,
    marginRight: 8,
  },
  code_inline: {
    backgroundColor: theme.surface,
    color: theme.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
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
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  blockquote: {
    backgroundColor: theme.primary + '15',
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
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
    backgroundColor: theme.textSecondary,
    height: 1,
    marginVertical: 12,
  },
});
