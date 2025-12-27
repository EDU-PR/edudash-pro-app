import React from 'react';
import { View, Text, ActivityIndicator, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { styles, getMarkdownStyles } from './DashAIChat.styles';

// Conditional import for markdown
const isWeb = Platform.OS === 'web';
let Markdown: React.ComponentType<any> | null = null;
if (!isWeb) {
  Markdown = require('react-native-markdown-display').default;
}

/**
 * Simple markdown-to-JSX renderer for web platform
 * Handles common markdown syntax without external dependencies
 */
const WebMarkdownRenderer: React.FC<{ content: string; theme: any }> = ({ content, theme }) => {
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLanguage = '';
    
    lines.forEach((line, idx) => {
      // Code block start/end
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLanguage = line.substring(3).trim();
          codeBlockContent = [];
        } else {
          inCodeBlock = false;
          elements.push(
            <View key={`code-${idx}`} style={[styles.webCodeBlock, { backgroundColor: '#1e1e1e' }]}>
              {codeBlockLanguage && (
                <Text style={[styles.webCodeLanguage, { color: '#858585' }]}>
                  {codeBlockLanguage}
                </Text>
              )}
              <ScrollView horizontal>
                <Text style={[styles.webCodeText, { color: '#d4d4d4' }]}>
                  {codeBlockContent.join('\n')}
                </Text>
              </ScrollView>
            </View>
          );
          codeBlockContent = [];
          codeBlockLanguage = '';
        }
        return;
      }
      
      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }
      
      // Headings
      if (line.startsWith('###')) {
        elements.push(
          <Text key={idx} style={[styles.webHeading3, { color: theme.text }]}>
            {line.substring(3).trim()}
          </Text>
        );
        return;
      }
      if (line.startsWith('##')) {
        elements.push(
          <Text key={idx} style={[styles.webHeading2, { color: theme.text }]}>
            {line.substring(2).trim()}
          </Text>
        );
        return;
      }
      if (line.startsWith('#')) {
        elements.push(
          <Text key={idx} style={[styles.webHeading1, { color: theme.text }]}>
            {line.substring(1).trim()}
          </Text>
        );
        return;
      }
      
      // Bullet lists
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const content = line.trim().substring(2);
        elements.push(
          <View key={idx} style={styles.webListItem}>
            <Text style={[styles.webListBullet, { color: theme.primary }]}>•</Text>
            <Text style={[styles.webText, { color: theme.text }]}>
              {renderInlineMarkdown(content, theme)}
            </Text>
          </View>
        );
        return;
      }
      
      // Numbered lists
      const numberedMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
      if (numberedMatch) {
        elements.push(
          <View key={idx} style={styles.webListItem}>
            <Text style={[styles.webListNumber, { color: theme.primary }]}>
              {numberedMatch[1]}.
            </Text>
            <Text style={[styles.webText, { color: theme.text }]}>
              {renderInlineMarkdown(numberedMatch[2], theme)}
            </Text>
          </View>
        );
        return;
      }
      
      // Blockquotes
      if (line.startsWith('> ')) {
        elements.push(
          <View key={idx} style={[styles.webBlockquote, { 
            backgroundColor: theme.primary + '15',
            borderLeftColor: theme.primary 
          }]}>
            <Text style={[styles.webText, { color: theme.text }]}>
              {renderInlineMarkdown(line.substring(2), theme)}
            </Text>
          </View>
        );
        return;
      }
      
      // Empty lines
      if (line.trim() === '') {
        elements.push(<View key={idx} style={{ height: 8 }} />);
        return;
      }
      
      // Regular paragraph
      elements.push(
        <Text key={idx} style={[styles.webText, { color: theme.text }]}>
          {renderInlineMarkdown(line, theme)}
        </Text>
      );
    });
    
    return elements;
  };
  
  const renderInlineMarkdown = (text: string, theme: any): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let currentText = '';
    let i = 0;
    
    while (i < text.length) {
      // Inline code `code`
      if (text[i] === '`') {
        if (currentText) {
          parts.push(currentText);
          currentText = '';
        }
        const end = text.indexOf('`', i + 1);
        if (end !== -1) {
          parts.push(
            <Text key={`code-${i}`} style={[styles.webInlineCode, { 
              backgroundColor: theme.surface,
              color: theme.primary 
            }]}>
              {text.substring(i + 1, end)}
            </Text>
          );
          i = end + 1;
          continue;
        }
      }
      
      // Bold **text**
      if (text.substring(i, i + 2) === '**') {
        if (currentText) {
          parts.push(currentText);
          currentText = '';
        }
        const end = text.indexOf('**', i + 2);
        if (end !== -1) {
          parts.push(
            <Text key={`bold-${i}`} style={{ fontWeight: '600' }}>
              {text.substring(i + 2, end)}
            </Text>
          );
          i = end + 2;
          continue;
        }
      }
      
      // Italic *text* or _text_
      if (text[i] === '*' || text[i] === '_') {
        const char = text[i];
        if (currentText) {
          parts.push(currentText);
          currentText = '';
        }
        const end = text.indexOf(char, i + 1);
        if (end !== -1 && text[i - 1] !== char && text[end + 1] !== char) {
          parts.push(
            <Text key={`italic-${i}`} style={{ fontStyle: 'italic', color: theme.textSecondary }}>
              {text.substring(i + 1, end)}
            </Text>
          );
          i = end + 1;
          continue;
        }
      }
      
      currentText += text[i];
      i++;
    }
    
    if (currentText) {
      parts.push(currentText);
    }
    
    return parts.length > 0 ? parts : text;
  };
  
  return <View>{renderMarkdown(content)}</View>;
};

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolsUsed?: string[];
}

interface ChatMessageProps {
  message: ChatMessageData;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const isUser = message.role === 'user';
  const markdownStyles = getMarkdownStyles(theme);

  return (
    <View
      style={[
        styles.messageContainer,
        isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
      ]}
    >
      {/* Avatar */}
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Ionicons name="sparkles" size={16} color="#fff" />
        </View>
      )}
      
      {/* Message bubble */}
      <View
        style={[
          styles.messageBubble,
          isUser 
            ? [styles.userBubble, { backgroundColor: theme.primary }]
            : [styles.assistantBubble, { backgroundColor: theme.surface }],
        ]}
      >
        {message.isStreaming ? (
          <View style={styles.streamingContainer}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.streamingText, { color: theme.textSecondary }]}>
              Thinking...
            </Text>
          </View>
        ) : isUser ? (
          <Text style={styles.userText}>{message.content}</Text>
        ) : (
          // Use appropriate markdown renderer based on platform
          isWeb ? (
            <WebMarkdownRenderer content={message.content} theme={theme} />
          ) : Markdown ? (
            <Markdown style={markdownStyles}>{message.content}</Markdown>
          ) : (
            <Text style={[styles.assistantText, { color: theme.text }]}>{message.content}</Text>
          )
        )}
        
        {/* Tools used indicator */}
        {message.toolsUsed && message.toolsUsed.length > 0 && (
          <View style={[styles.toolsUsed, { borderTopColor: theme.border }]}>
            <Ionicons name="construct-outline" size={12} color={theme.textSecondary} />
            <Text style={[styles.toolsText, { color: theme.textSecondary }]}>
              Used: {message.toolsUsed.join(', ')}
            </Text>
          </View>
        )}
      </View>
      
      {/* User avatar */}
      {isUser && (
        <View style={[styles.avatar, styles.userAvatar, { backgroundColor: theme.textSecondary }]}>
          <Text style={styles.userAvatarText}>
            {profile?.first_name?.[0] || 'U'}
          </Text>
        </View>
      )}
    </View>
  );
};
