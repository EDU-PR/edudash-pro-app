/**
 * Parent Message Thread Screen
 * Modern chat interface with call integration
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  FlatList,
  Alert,
  Keyboard,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { MessageHeader } from '@/components/messaging/MessageHeader';
import { MessageAttachmentBar, MessageAttachment } from '@/components/messaging/MessageAttachmentBar';
import { AttachmentPreview } from '@/components/messaging/AttachmentPreview';
import { 
  useThreadMessages, 
  useSendMessage, 
  useMarkThreadRead, 
  Message 
} from '@/hooks/useParentMessaging';
import { useAuth } from '@/contexts/AuthContext';
import { useCall } from '@/components/calls/CallProvider';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import SkeletonLoader from '@/components/ui/SkeletonLoader';

// Format message timestamp
const formatMessageTime = (timestamp: string): string => {
  const messageTime = new Date(timestamp);
  const now = new Date();
  const diffInHours = Math.abs(now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 24) {
    return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return messageTime.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
};

// Format date for message groups
const formatDateSeparator = (timestamp: string): string => {
  const messageDate = new Date(timestamp);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) {
    return messageDate.toLocaleDateString([], { weekday: 'long' });
  }
  return messageDate.toLocaleDateString([], { 
    month: 'long', 
    day: 'numeric',
    year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
  });
};

// Message bubble component - Memoized for performance
interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showSender?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({ 
  message, 
  isOwnMessage,
  showSender = true 
}) => {
  const { theme } = useTheme();
  
  const styles = StyleSheet.create({
    container: {
      marginVertical: 2,
      marginHorizontal: 16,
      alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
      maxWidth: '80%',
    },
    bubble: {
      backgroundColor: isOwnMessage ? theme.primary : theme.surface,
      borderRadius: 20,
      borderTopLeftRadius: isOwnMessage ? 20 : 6,
      borderTopRightRadius: isOwnMessage ? 6 : 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      ...Platform.select({
        ios: {
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
        android: {
          elevation: 1,
        },
      }),
    },
    text: {
      fontSize: 16,
      color: isOwnMessage ? theme.onPrimary : theme.text,
      lineHeight: 22,
    },
    footer: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
    },
    timestamp: {
      fontSize: 11,
      color: isOwnMessage ? theme.onPrimary + '90' : theme.textSecondary,
    },
    senderName: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '600',
      marginBottom: 4,
    },
  });
  
  const senderName = message.sender ? 
    `${message.sender.first_name} ${message.sender.last_name}`.trim() :
    'Unknown';
  
  return (
    <View style={styles.container}>
      {!isOwnMessage && showSender && (
        <Text style={styles.senderName}>{senderName}</Text>
      )}
      <View style={styles.bubble}>
        <Text style={styles.text}>{message.content}</Text>
        <View style={styles.footer}>
          <Text style={styles.timestamp}>
            {formatMessageTime(message.created_at)}
          </Text>
        </View>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  return prevProps.message.id === nextProps.message.id &&
         prevProps.message.content === nextProps.message.content &&
         prevProps.isOwnMessage === nextProps.isOwnMessage;
});

// Date separator component
const DateSeparator: React.FC<{ date: string }> = ({ date }) => {
  const { theme } = useTheme();
  
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 16,
      marginHorizontal: 32,
    },
    line: {
      flex: 1,
      height: 1,
      backgroundColor: theme.border,
    },
    text: {
      fontSize: 12,
      color: theme.textSecondary,
      marginHorizontal: 12,
      fontWeight: '500',
    },
  });
  
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.text}>{formatDateSeparator(date)}</Text>
      <View style={styles.line} />
    </View>
  );
};

// Typing indicator component
const TypingIndicator: React.FC = () => {
  const { theme } = useTheme();
  
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 20,
      marginVertical: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.textSecondary,
      marginHorizontal: 2,
    },
  });
  
  return (
    <View style={styles.container}>
      <View style={styles.dot} />
      <View style={[styles.dot, { opacity: 0.7 }]} />
      <View style={[styles.dot, { opacity: 0.4 }]} />
    </View>
  );
};

export default function ParentMessageThreadScreen() {
  const { threadId, title, teacherId, teacherName } = useLocalSearchParams<{ 
    threadId: string; 
    title: string; 
    teacherId?: string;
    teacherName?: string;
  }>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  
  // Call functionality
  let callContext: ReturnType<typeof useCall> | null = null;
  try {
    callContext = useCall();
  } catch {
    // Call provider not available
  }
  
  // Check if calls are enabled
  const callsEnabled = useMemo(() => {
    try {
      const flags = getFeatureFlagsSync();
      return flags.video_calls_enabled || flags.voice_calls_enabled;
    } catch {
      return false;
    }
  }, []);
  
  // Hooks
  const { data: messages = [], isLoading, error, refetch } = useThreadMessages(threadId);
  const sendMessageMutation = useSendMessage();
  const markReadMutation = useMarkThreadRead();
  
  // Handle keyboard events
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);
  
  // Mark thread as read when messages load
  useEffect(() => {
    if (threadId && messages.length > 0 && !isLoading) {
      markReadMutation.mutate({ threadId });
    }
  }, [threadId, messages.length, isLoading]);
  
  // Get the other participant's user ID for calling
  const otherParticipantId = useMemo(() => {
    if (teacherId) return teacherId;
    const otherMessage = messages.find(m => m.sender_id !== user?.id);
    return otherMessage?.sender_id;
  }, [teacherId, messages, user?.id]);
  
  const displayName = useMemo(() => {
    if (teacherName) return decodeURIComponent(teacherName);
    if (title) return decodeURIComponent(title);
    return t('parent.teacher', { defaultValue: 'Teacher' });
  }, [teacherName, title, t]);
  
  // Call handlers
  const handleVoiceCall = useCallback(() => {
    if (!callContext || !otherParticipantId) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('parent.cannotStartCall', { defaultValue: 'Unable to start call. Please try again.' })
      );
      return;
    }
    callContext.startVoiceCall(otherParticipantId, displayName);
  }, [callContext, otherParticipantId, displayName, t]);
  
  const handleVideoCall = useCallback(() => {
    if (!callContext || !otherParticipantId) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('parent.cannotStartCall', { defaultValue: 'Unable to start call. Please try again.' })
      );
      return;
    }
    callContext.startVideoCall(otherParticipantId, displayName);
  }, [callContext, otherParticipantId, displayName, t]);
  
  // Attachment handlers
  const handleAttach = useCallback((newAttachments: MessageAttachment[]) => {
    setAttachments(prev => [...prev, ...newAttachments].slice(0, 5)); // Max 5 attachments
  }, []);
  
  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);
  
  const handleSendMessage = useCallback(async () => {
    const content = messageText.trim();
    const hasAttachments = attachments.length > 0;
    
    if ((!content && !hasAttachments) || !threadId || isSending) return;
    
    setIsSending(true);
    try {
      // Build message content
      let finalContent = content;
      
      // For now, append attachment info to message content
      // In a full implementation, attachments would be uploaded to storage
      // and their URLs stored in a message_attachments table
      if (hasAttachments) {
        const attachmentInfo = attachments.map(a => 
          a.type === 'audio' ? `🎤 Voice message (${Math.round((a.duration || 0) / 1000)}s)` :
          a.type === 'image' ? `📷 Photo: ${a.name}` :
          a.type === 'video' ? `🎬 Video: ${a.name}` :
          `📎 ${a.name}`
        ).join('\n');
        
        finalContent = content ? `${content}\n\n${attachmentInfo}` : attachmentInfo;
      }
      
      await sendMessageMutation.mutateAsync({
        threadId,
        content: finalContent
      });
      setMessageText('');
      setAttachments([]); // Clear attachments after sending
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('parent.messageSendError', { defaultValue: 'Failed to send message. Please try again.' })
      );
    } finally {
      setIsSending(false);
    }
  }, [messageText, threadId, isSending, attachments, sendMessageMutation, t]);
  
  // Process messages with date separators
  const processedMessages = useMemo(() => {
    if (!messages.length) return [];
    
    const result: Array<{ type: 'message' | 'date'; data: any; key: string }> = [];
    let lastDate = '';
    
    messages.forEach((msg, index) => {
      const msgDate = new Date(msg.created_at).toDateString();
      
      if (msgDate !== lastDate) {
        result.push({
          type: 'date',
          data: msg.created_at,
          key: `date-${msgDate}`,
        });
        lastDate = msgDate;
      }
      
      result.push({
        type: 'message',
        data: msg,
        key: msg.id,
      });
    });
    
    return result;
  }, [messages]);
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    messagesContainer: {
      flex: 1,
    },
    messagesList: {
      paddingVertical: 8,
    },
    loadingContainer: {
      flex: 1,
      padding: 16,
    },
    skeletonLeft: {
      alignSelf: 'flex-start',
      marginLeft: 16,
      marginVertical: 4,
    },
    skeletonRight: {
      alignSelf: 'flex-end',
      marginRight: 16,
      marginVertical: 4,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    errorIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.error + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    errorText: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
    },
    retryButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 10,
    },
    retryButtonText: {
      color: theme.onPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.primary + '10',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    inputWrapper: {
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 8,
      paddingTop: 10,
      paddingBottom: 10,
    },
    textInputContainer: {
      flex: 1,
      backgroundColor: theme.elevated,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
      marginRight: 8,
      maxHeight: 120,
    },
    textInput: {
      fontSize: 16,
      color: theme.text,
      lineHeight: 22,
      maxHeight: 100,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: theme.textSecondary + '30',
    },
  });
  
  // Render item for FlatList
  const renderItem = useCallback(({ item }: { item: { type: 'message' | 'date'; data: any; key: string } }) => {
    if (item.type === 'date') {
      return <DateSeparator date={item.data} />;
    }
    
    const message = item.data as Message;
    const isOwnMessage = message.sender_id === user?.id;
    
    return (
      <MessageBubble
        message={message}
        isOwnMessage={isOwnMessage}
        showSender={!isOwnMessage}
      />
    );
  }, [user?.id]);
  
  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <MessageHeader
          title={displayName}
          subtitle={t('parent.loading', { defaultValue: 'Loading...' })}
          showCallButtons={callsEnabled && Platform.OS !== 'web'}
          onVoiceCall={handleVoiceCall}
          onVideoCall={handleVideoCall}
        />
        <View style={styles.loadingContainer}>
          <View style={styles.skeletonLeft}>
            <SkeletonLoader width={200} height={50} borderRadius={20} />
          </View>
          <View style={styles.skeletonRight}>
            <SkeletonLoader width={160} height={50} borderRadius={20} />
          </View>
          <View style={styles.skeletonLeft}>
            <SkeletonLoader width={180} height={50} borderRadius={20} />
          </View>
          <View style={styles.skeletonRight}>
            <SkeletonLoader width={140} height={50} borderRadius={20} />
          </View>
        </View>
      </View>
    );
  }
  
  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <MessageHeader
          title={displayName}
          showCallButtons={false}
        />
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={36} color={theme.error} />
          </View>
          <Text style={styles.errorTitle}>
            {t('parent.threadError', { defaultValue: 'Unable to Load Messages' })}
          </Text>
          <Text style={styles.errorText}>
            {t('parent.threadErrorDesc', { defaultValue: 'We couldn\'t load your conversation. Please try again.' })}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>
              {t('common.retry', { defaultValue: 'Try Again' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <MessageHeader
        title={displayName}
        subtitle={t('parent.tapForInfo', { defaultValue: 'Tap for info' })}
        showCallButtons={callsEnabled && !!otherParticipantId && Platform.OS !== 'web'}
        onVoiceCall={handleVoiceCall}
        onVideoCall={handleVideoCall}
      />
      
      <View style={styles.messagesContainer}>
        {processedMessages.length === 0 ? (
          // Empty state
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={theme.primary} />
            </View>
            <Text style={styles.emptyTitle}>
              {t('parent.startConversation', { defaultValue: 'Start the Conversation' })}
            </Text>
            <Text style={styles.emptySubtitle}>
              {t('parent.startConversationDesc', { defaultValue: 'Send your first message to begin chatting.' })}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={processedMessages}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={15}
            windowSize={10}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
            onLayout={() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
          />
        )}
      </View>
      
      {/* Message input */}
      <View style={styles.inputWrapper}>
        {/* Attachment Preview */}
        {attachments.length > 0 && (
          <AttachmentPreview
            attachments={attachments}
            onRemove={handleRemoveAttachment}
          />
        )}
        
        <View style={styles.inputContainer}>
          {/* Attachment Button */}
          <MessageAttachmentBar
            onAttach={handleAttach}
            disabled={isSending}
            maxAttachments={5}
            currentAttachments={attachments}
          />
          
          <View style={styles.textInputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder={t('parent.typeMessage', { defaultValue: 'Type a message...' })}
              placeholderTextColor={theme.textSecondary}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() && attachments.length === 0 || isSending) && styles.sendButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={(!messageText.trim() && attachments.length === 0) || isSending}
            activeOpacity={0.7}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <Ionicons name="send" size={20} color={theme.onPrimary} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
