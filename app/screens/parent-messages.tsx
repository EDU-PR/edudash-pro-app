/**
 * Parent Messages Screen
 * Modern, clean messaging list with improved UX
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { MessagesListHeader } from '@/components/messaging/MessageHeader';
import { useParentThreads, MessageThread } from '@/hooks/useParentMessaging';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { getMessageDisplayText } from '@/lib/utils/messageContent';

// Format timestamp for message threads
const formatMessageTime = (timestamp: string): string => {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInHours = Math.abs(now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 168) { // 7 days
    return messageTime.toLocaleDateString([], { weekday: 'short' });
  } else {
    return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

// Thread item component - Modernized
interface ThreadItemProps {
  thread: MessageThread;
  onPress: () => void;
}

const ThreadItem: React.FC<ThreadItemProps> = React.memo(({ thread, onPress }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  
  // Get the other participant (teacher/principal)
  const otherParticipant = thread.participants?.find((p: any) => p.role !== 'parent');
  const participantName = otherParticipant?.user_profile ? 
    `${otherParticipant.user_profile.first_name} ${otherParticipant.user_profile.last_name}`.trim() :
    'Teacher';
    
  const participantRole = otherParticipant?.user_profile?.role || 'teacher';
  
  // Student name for context
  const studentName = thread.student ? 
    `${thread.student.first_name} ${thread.student.last_name}`.trim() :
    null;
  
  const hasUnread = (thread.unread_count || 0) > 0;
  
  // Get initials for avatar
  const initials = participantName
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 16,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        android: {
          elevation: 2,
        },
      }),
    },
    inner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: hasUnread ? theme.primary : theme.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '600',
      color: hasUnread ? theme.onPrimary : theme.primary,
    },
    content: {
      flex: 1,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    name: {
      fontSize: 16,
      fontWeight: hasUnread ? '700' : '500',
      color: theme.text,
      flex: 1,
    },
    time: {
      fontSize: 12,
      color: hasUnread ? theme.primary : theme.textSecondary,
      fontWeight: hasUnread ? '600' : '400',
      marginLeft: 8,
    },
    contextRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    roleBadge: {
      backgroundColor: theme.primary + '15',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
    roleText: {
      fontSize: 11,
      color: theme.primary,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    studentText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginLeft: 8,
    },
    messagePreview: {
      fontSize: 14,
      color: hasUnread ? theme.text : theme.textSecondary,
      fontWeight: hasUnread ? '500' : '400',
      lineHeight: 20,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    unreadBadge: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    unreadText: {
      color: theme.onPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
  });
  
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.inner}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.name} numberOfLines={1}>{participantName}</Text>
            {thread.last_message && (
              <Text style={styles.time}>
                {formatMessageTime(thread.last_message.created_at)}
              </Text>
            )}
          </View>
          
          <View style={styles.contextRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{participantRole}</Text>
            </View>
            {studentName && (
              <Text style={styles.studentText}>• {studentName}</Text>
            )}
          </View>
          
          <View style={styles.bottomRow}>
            {thread.last_message ? (
              <Text style={styles.messagePreview} numberOfLines={1}>
                {getMessageDisplayText(thread.last_message.content)}
              </Text>
            ) : (
              <Text style={[styles.messagePreview, { fontStyle: 'italic' }]} numberOfLines={1}>
                {t('parent.noMessagesYet', { defaultValue: 'No messages yet' })}
              </Text>
            )}
            
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {thread.unread_count && thread.unread_count > 99 ? '99+' : thread.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Dash AI Chat Item - Special entry for AI assistant
const DashAIItem: React.FC<{ onPress: () => void }> = React.memo(({ onPress }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  
  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      marginHorizontal: 16,
      marginBottom: 8,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#8B5CF6' + '40',
      ...Platform.select({
        ios: {
          shadowColor: '#8B5CF6',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    inner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    avatarGlow: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#8B5CF6' + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    avatarInner: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#8B5CF6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    sparkle: {
      marginLeft: 6,
    },
    aiBadge: {
      backgroundColor: '#8B5CF6' + '20',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      marginLeft: 8,
    },
    aiBadgeText: {
      fontSize: 11,
      color: '#8B5CF6',
      fontWeight: '600',
    },
    subtitle: {
      fontSize: 13,
      color: '#8B5CF6',
      fontWeight: '500',
      marginBottom: 4,
    },
    description: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 20,
    },
  });
  
  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.inner}>
        <View style={styles.avatarGlow}>
          <View style={styles.avatarInner}>
            <Ionicons name="sparkles" size={24} color="white" />
          </View>
        </View>
        
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.name}>Dash AI</Text>
            <Ionicons name="sparkles" size={14} color="#8B5CF6" style={styles.sparkle} />
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            {t('parent.aiAssistantSubtitle', { defaultValue: '✨ AI Assistant for lesson planning & grading' })}
          </Text>
          <Text style={styles.description} numberOfLines={1}>
            {t('parent.aiAssistantDesc', { defaultValue: "Hi! I'm Dash, your AI teaching assistant. I c..." })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function ParentMessagesScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: threads, isLoading, error, refetch, isRefetching } = useParentThreads();
  
  const handleThreadPress = useCallback((thread: MessageThread) => {
    const otherParticipant = thread.participants?.find((p: any) => p.role !== 'parent');
    const participantName = otherParticipant?.user_profile ? 
      `${otherParticipant.user_profile.first_name} ${otherParticipant.user_profile.last_name}`.trim() :
      'Teacher';
    
    router.push({
      pathname: '/screens/parent-message-thread',
      params: {
        threadId: thread.id,
        title: participantName,
        teacherId: otherParticipant?.user_id || '',
        teacherName: participantName,
      },
    });
  }, []);
  
  const handleStartNewMessage = useCallback(() => {
    router.push('/screens/parent-new-message');
  }, []);
  
  const handleOpenDashAI = useCallback(() => {
    router.push('/screens/dash-assistant');
  }, []);
  
  const handleSettings = useCallback(() => {
    Alert.alert(
      t('parent.messageSettings', { defaultValue: 'Message Settings' }),
      t('parent.messageSettingsDesc', { defaultValue: 'Configure your messaging preferences' }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        { 
          text: t('parent.notificationSettings', { defaultValue: 'Notification Settings' }),
          onPress: () => router.push('/screens/settings')
        },
      ]
    );
  }, [t]);
  
  // Filter threads by search
  const filteredThreads = React.useMemo(() => {
    if (!threads || !searchQuery.trim()) return threads || [];
    
    const query = searchQuery.toLowerCase();
    return threads.filter(thread => {
      const otherParticipant = thread.participants?.find((p: any) => p.role !== 'parent');
      const name = otherParticipant?.user_profile 
        ? `${otherParticipant.user_profile.first_name} ${otherParticipant.user_profile.last_name}`
        : '';
      const studentNameStr = thread.student 
        ? `${thread.student.first_name} ${thread.student.last_name}`
        : '';
      const lastMessage = thread.last_message?.content || '';
      
      return (
        name.toLowerCase().includes(query) ||
        studentNameStr.toLowerCase().includes(query) ||
        lastMessage.toLowerCase().includes(query)
      );
    });
  }, [threads, searchQuery]);
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      flex: 1,
      padding: 16,
    },
    skeletonItem: {
      marginBottom: 12,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    errorIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.error + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    errorText: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
      paddingHorizontal: 20,
    },
    retryButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
    },
    retryButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyIcon: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.primary + '10',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 28,
      paddingHorizontal: 20,
    },
    emptyButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    emptyButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
    listContent: {
      paddingTop: 8,
      paddingBottom: insets.bottom + 20,
    },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: insets.bottom + 20,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
  });
  
  // Loading state
  if (isLoading && !threads) {
    return (
      <View style={styles.container}>
        <MessagesListHeader
          title={t('parent.messages', { defaultValue: 'Messages' })}
          onNewMessage={handleStartNewMessage}
          onSettings={handleSettings}
        />
        <View style={styles.loadingContainer}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={styles.skeletonItem}>
              <SkeletonLoader width="100%" height={90} borderRadius={16} />
            </View>
          ))}
        </View>
      </View>
    );
  }
  
  // Error state
  if (error && !threads) {
    return (
      <View style={styles.container}>
        <MessagesListHeader
          title={t('parent.messages', { defaultValue: 'Messages' })}
          onNewMessage={handleStartNewMessage}
          onSettings={handleSettings}
        />
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Ionicons name="cloud-offline-outline" size={40} color={theme.error} />
          </View>
          <Text style={styles.errorTitle}>
            {t('parent.messagesError', { defaultValue: 'Unable to Load Messages' })}
          </Text>
          <Text style={styles.errorText}>
            {t('parent.messagesErrorDesc', { defaultValue: 'We couldn\'t load your messages. Please check your connection and try again.' })}
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
  
  // Empty state
  if (!filteredThreads || filteredThreads.length === 0) {
    return (
      <View style={styles.container}>
        <MessagesListHeader
          title={t('parent.messages', { defaultValue: 'Messages' })}
          onNewMessage={handleStartNewMessage}
          onSettings={handleSettings}
        />
        {/* Still show Dash AI even when no messages */}
        <View style={{ paddingTop: 8 }}>
          <DashAIItem onPress={handleOpenDashAI} />
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={48} color={theme.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {t('parent.noMessagesTitle', { defaultValue: 'No Messages Yet' })}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('parent.noMessagesDesc', { defaultValue: 'Start a conversation with your child\'s teacher to stay connected and informed.' })}
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleStartNewMessage}>
            <Ionicons name="chatbubble-outline" size={20} color={theme.onPrimary} />
            <Text style={styles.emptyButtonText}>
              {t('parent.startNewMessage', { defaultValue: 'Start a Conversation' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  // Thread list
  return (
    <View style={styles.container}>
      <MessagesListHeader
        title={t('parent.messages', { defaultValue: 'Messages' })}
        subtitle={`${filteredThreads.length} ${filteredThreads.length === 1 ? 'conversation' : 'conversations'}`}
        onNewMessage={handleStartNewMessage}
        onSettings={handleSettings}
      />
      
      <FlatList
        data={filteredThreads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ThreadItem
            thread={item}
            onPress={() => handleThreadPress(item)}
          />
        )}
        ListHeaderComponent={
          <DashAIItem onPress={handleOpenDashAI} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      />
      
      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={handleStartNewMessage}
        activeOpacity={0.8}
      >
        <Ionicons name="create" size={26} color={theme.onPrimary} />
      </TouchableOpacity>
    </View>
  );
}
