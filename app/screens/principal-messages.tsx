/**
 * Principal Messages Screen
 * Thread-based messaging list for principals
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { MessagesListHeader } from '@/components/messaging/MessageHeader';
import { useParentThreads, MessageThread, MessageParticipant } from '@/hooks/useParentMessaging';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { getMessageDisplayText } from '@/lib/utils/messageContent';

const formatMessageTime = (timestamp: string): string => {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInHours = Math.abs(now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    return 'Just now';
  }
  if (diffInHours < 24) {
    return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffInHours < 168) {
    return messageTime.toLocaleDateString([], { weekday: 'short' });
  }
  return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

interface ThreadItemProps {
  thread: MessageThread;
  onPress: () => void;
  currentUserId?: string | null;
}

const ThreadItem: React.FC<ThreadItemProps> = React.memo(({ thread, onPress, currentUserId }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const otherParticipant = thread.participants?.find((p: MessageParticipant) => p.user_id !== currentUserId);
  const participantName = otherParticipant?.user_profile
    ? `${otherParticipant.user_profile.first_name} ${otherParticipant.user_profile.last_name}`.trim()
    : t('principal.contactLabel', { defaultValue: 'Contact' });

  const participantRole = otherParticipant?.user_profile?.role || 'contact';
  const studentName = thread.student
    ? `${thread.student.first_name} ${thread.student.last_name}`.trim()
    : null;

  const hasUnread = (thread.unread_count || 0) > 0;
  const initials = participantName
    .split(' ')
    .map((n) => n.charAt(0))
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
      fontWeight: '600',
      color: theme.text,
    },
    time: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    messagePreview: {
      fontSize: 13,
      color: theme.textSecondary,
      flex: 1,
      marginRight: 8,
    },
    unreadBadge: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    unreadText: {
      color: theme.onPrimary,
      fontSize: 11,
      fontWeight: '600',
    },
    roleChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      backgroundColor: theme.elevated,
      marginTop: 2,
    },
    roleText: {
      fontSize: 11,
      color: theme.textSecondary,
      textTransform: 'capitalize',
    },
  });

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.inner}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.name} numberOfLines={1}>{participantName}</Text>
            {thread.last_message && (
              <Text style={styles.time}>{formatMessageTime(thread.last_message.created_at)}</Text>
            )}
          </View>
          {studentName && (
            <Text style={styles.subtitle} numberOfLines={1}>{studentName}</Text>
          )}
          <View style={styles.messageRow}>
            <Text style={styles.messagePreview} numberOfLines={1}>
              {thread.last_message
                ? getMessageDisplayText(thread.last_message.content)
                : t('principal.noMessagesYet', { defaultValue: 'No messages yet' })}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {thread.unread_count && thread.unread_count > 99 ? '99+' : thread.unread_count}
                </Text>
              </View>
            )}
          </View>
          {!!participantRole && (
            <View style={styles.roleChip}>
              <Text style={styles.roleText}>{participantRole}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function PrincipalMessagesScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: threads, isLoading, error, refetch, isRefetching } = useParentThreads();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleThreadPress = useCallback((thread: MessageThread) => {
    const otherParticipant = thread.participants?.find((p: MessageParticipant) => p.user_id !== user?.id);
    const participantName = otherParticipant?.user_profile
      ? `${otherParticipant.user_profile.first_name} ${otherParticipant.user_profile.last_name}`.trim()
      : t('principal.contactLabel', { defaultValue: 'Contact' });

    router.push({
      pathname: '/screens/principal-message-thread',
      params: {
        threadId: thread.id,
        title: participantName,
      },
    });
  }, [t, user?.id]);

  const handleSettings = useCallback(() => {
    // TODO: Add messaging preferences for principals
    router.push('/screens/settings');
  }, []);

  const handleAnnouncements = useCallback(() => {
    router.push('/screens/principal-announcement');
  }, []);

  const handleGroups = useCallback(() => {
    router.push('/screens/create-group');
  }, []);

  const filteredThreads = useMemo(() => {
    if (!threads) return [];
    if (!searchQuery.trim()) return threads;
    const query = searchQuery.toLowerCase();
    return threads.filter((thread) => {
      const otherParticipant = thread.participants?.find((p: MessageParticipant) => p.user_id !== user?.id);
      const participantName = otherParticipant?.user_profile
        ? `${otherParticipant.user_profile.first_name} ${otherParticipant.user_profile.last_name}`.trim()
        : '';
      const studentName = thread.student
        ? `${thread.student.first_name} ${thread.student.last_name}`.trim()
        : '';
      const lastMessage = thread.last_message?.content || '';
      return (
        participantName.toLowerCase().includes(query) ||
        studentName.toLowerCase().includes(query) ||
        lastMessage.toLowerCase().includes(query)
      );
    });
  }, [threads, searchQuery, user?.id]);

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
      backgroundColor: theme.error + '20',
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
    errorSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    listContent: {
      paddingVertical: 12,
      paddingBottom: insets.bottom + 16,
    },
    searchContainer: {
      marginHorizontal: 16,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
    },
    quickActions: {
      flexDirection: 'row',
      gap: 12,
      marginHorizontal: 16,
      marginBottom: 12,
    },
    quickActionCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    quickActionText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
      flexShrink: 1,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 20,
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
      marginBottom: 24,
    },
    emptyButton: {
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    emptyButtonText: {
      color: theme.onPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
  });

  if (isLoading && !threads) {
    return (
      <View style={styles.container}>
        <MessagesListHeader
          title={t('principal.messages', { defaultValue: 'Messages' })}
          onSettings={handleSettings}
          onNewMessage={() => router.push('/screens/principal-new-message')}
        />
        <View style={styles.loadingContainer}>
          {[...Array(6)].map((_, i) => (
            <View key={i} style={styles.skeletonItem}>
              <SkeletonLoader height={84} borderRadius={16} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error && !threads) {
    return (
      <View style={styles.container}>
        <MessagesListHeader
          title={t('principal.messages', { defaultValue: 'Messages' })}
          onSettings={handleSettings}
          onNewMessage={() => router.push('/screens/principal-new-message')}
        />
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={40} color={theme.error} />
          </View>
          <Text style={styles.errorTitle}>
            {t('principal.messagesError', { defaultValue: 'Unable to Load Messages' })}
          </Text>
          <Text style={styles.errorSubtitle}>
            {t('principal.messagesErrorDesc', { defaultValue: 'Please check your connection and try again.' })}
          </Text>
        </View>
      </View>
    );
  }

  if (!threads || threads.length === 0) {
    return (
      <View style={styles.container}>
        <MessagesListHeader
          title={t('principal.messages', { defaultValue: 'Messages' })}
          onSettings={handleSettings}
          onNewMessage={() => router.push('/screens/principal-new-message')}
        />
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={48} color={theme.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {t('principal.noMessagesTitle', { defaultValue: 'No Conversations Yet' })}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('principal.noMessagesDesc', { defaultValue: 'Messages from parents and staff will appear here.' })}
          </Text>
        </View>
      </View>
    );
  }

  if (threads.length > 0 && filteredThreads.length === 0 && searchQuery.trim()) {
    return (
      <View style={styles.container}>
        <MessagesListHeader
          title={t('principal.messages', { defaultValue: 'Messages' })}
          subtitle={`${threads.length} ${threads.length === 1 ? 'conversation' : 'conversations'}`}
          onSettings={handleSettings}
          onNewMessage={() => router.push('/screens/principal-new-message')}
        />
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color={theme.textSecondary} />
          <TextInput
            placeholder={t('principal.searchMessages', { defaultValue: 'Search messages...' })}
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="search" size={48} color={theme.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {t('principal.noSearchResults', { defaultValue: 'No matches found' })}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('principal.noSearchResultsDesc', { defaultValue: 'Try a different name or keyword.' })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MessagesListHeader
        title={t('principal.messages', { defaultValue: 'Messages' })}
        subtitle={`${threads.length} ${threads.length === 1 ? 'conversation' : 'conversations'}`}
        onSettings={handleSettings}
        onNewMessage={() => router.push('/screens/principal-new-message')}
      />
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color={theme.textSecondary} />
        <TextInput
          placeholder={t('principal.searchMessages', { defaultValue: 'Search messages...' })}
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />
      </View>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionCard} onPress={handleAnnouncements}>
          <Ionicons name="megaphone" size={18} color={theme.primary} />
          <Text style={styles.quickActionText}>Send Announcement</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionCard} onPress={handleGroups}>
          <Ionicons name="people" size={18} color={theme.primary} />
          <Text style={styles.quickActionText}>Create Groups</Text>
        </TouchableOpacity>
      </View>
      <FlashList
        data={filteredThreads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ThreadItem
            thread={item}
            onPress={() => handleThreadPress(item)}
            currentUserId={user?.id}
          />
        )}
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
    </View>
  );
}
