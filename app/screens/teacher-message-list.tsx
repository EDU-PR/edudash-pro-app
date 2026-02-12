/**
 * Teacher Messages Screen
 * WhatsApp-style messaging list for teachers to communicate with parents
 * Matches PWA layout at /dashboard/teacher/messages
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { MessagesListHeader } from '@/components/messaging/MessageHeader';
import { useTeacherThreads, useTeacherThreadsRealtime, MessageThread } from '@/hooks/useTeacherMessaging';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { getDashAIRoleCopy } from '@/lib/ai/dashRoleCopy';
import ThreadItem from '@/components/teacher-messaging/ThreadItem';
import DashAIItem from '@/components/teacher-messaging/DashAIItem';
import { createStyles } from './teacher-message-list.styles';

export default function TeacherMessageListScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const dashCopy = getDashAIRoleCopy(profile?.role);
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const organizationId = (profile as any)?.organization_id || (profile as any)?.preschool_id;

  const { data: threads, isLoading, error, refetch, isRefetching } = useTeacherThreads();

  // Subscribe to real-time thread updates (new messages update list without full reload)
  useTeacherThreadsRealtime(organizationId);

  // Refetch threads when screen gains focus to update unread badges
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleThreadPress = useCallback((thread: MessageThread) => {
    const isGroupThread = Boolean(
      thread.is_group ||
      ['class_group', 'parent_group', 'teacher_group', 'announcement', 'custom'].includes(String(thread.type || thread.group_type || ''))
    );
    const otherParticipant =
      thread.participants?.find((p: any) => p.role !== 'teacher') ||
      thread.participants?.find((p: any) => p.role === 'teacher');
    const participantName = isGroupThread
      ? thread.group_name || thread.subject || 'Group'
      : (otherParticipant?.user_profile
        ? `${otherParticipant.user_profile.first_name} ${otherParticipant.user_profile.last_name}`.trim()
        : thread.subject || 'Contact');

    router.push({
      pathname: '/screens/teacher-message-thread',
      params: {
        threadId: thread.id,
        title: participantName,
        parentId: isGroupThread ? '' : (otherParticipant?.user_id || ''),
        parentName: participantName,
      },
    });
  }, []);

  const handleStartNewMessage = useCallback(() => {
    router.push('/screens/teacher-new-message');
  }, []);

  const handleOpenDashAI = useCallback(() => {
    router.push('/screens/dash-assistant');
  }, []);

  const handleSettings = useCallback(() => {
    router.push('/screens/settings');
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────────

  const filteredThreads = useMemo(() => {
    if (!threads || !searchQuery.trim()) return threads || [];

    const query = searchQuery.toLowerCase();
    return threads.filter((thread) => {
      const otherParticipant = thread.participants?.find((p: any) => p.role === 'parent');
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

  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  // ── Shared header props ───────────────────────────────────────────────────────

  const headerProps = {
    title: t('teacher.messages', { defaultValue: 'Messages' }),
    onNewMessage: handleStartNewMessage,
    onSettings: handleSettings,
  };

  const dashAIProps = {
    onPress: handleOpenDashAI,
    title: dashCopy.navLabel,
    subtitle: t('teacher.aiAssistantSubtitle', { defaultValue: dashCopy.messageSubtitle }),
    description: t('teacher.aiAssistantDesc', { defaultValue: dashCopy.messageDescription }),
  };

  // ── Loading state ─────────────────────────────────────────────────────────────

  if (isLoading && !threads) {
    return (
      <View style={styles.container}>
        <MessagesListHeader {...headerProps} />
        <View style={styles.loadingContainer}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skeletonItem}>
              <SkeletonLoader width="100%" height={90} borderRadius={16} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────────

  if (error && !threads) {
    return (
      <View style={styles.container}>
        <MessagesListHeader {...headerProps} />
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Ionicons name="cloud-offline-outline" size={40} color={theme.error} />
          </View>
          <Text style={styles.errorTitle}>
            {t('teacher.messagesError', { defaultValue: 'Unable to Load Messages' })}
          </Text>
          <Text style={styles.errorText}>
            {t('teacher.messagesErrorDesc', { defaultValue: 'We couldn\'t load your messages. Please check your connection and try again.' })}
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

  // ── Empty state (still shows Dash AI) ─────────────────────────────────────────

  if (!filteredThreads || filteredThreads.length === 0) {
    return (
      <View style={styles.container}>
        <MessagesListHeader {...headerProps} />
        <View style={{ paddingTop: 8 }}>
          <DashAIItem {...dashAIProps} />
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={48} color={theme.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {t('teacher.noMessagesTitle', { defaultValue: 'No Messages Yet' })}
          </Text>
          <Text style={styles.emptySubtitle}>
            {t('teacher.noMessagesDesc', { defaultValue: 'Parent and staff conversations will appear here once messages start.' })}
          </Text>
          <TouchableOpacity style={styles.emptyButton} onPress={handleStartNewMessage}>
            <Ionicons name="chatbubble-outline" size={20} color={theme.onPrimary} />
            <Text style={styles.emptyButtonText}>
              {t('teacher.startNewMessage', { defaultValue: 'Start New Message' })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Thread list ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <MessagesListHeader
        {...headerProps}
        subtitle={`${filteredThreads.length} ${filteredThreads.length === 1 ? 'conversation' : 'conversations'}`}
      />

      <FlashList
        data={filteredThreads}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ThreadItem thread={item} onPress={() => handleThreadPress(item)} />
        )}
        ListHeaderComponent={<DashAIItem {...dashAIProps} />}
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

      {/* Group FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 90 }]}
        onPress={() => router.push('/screens/create-group')}
        activeOpacity={0.8}
      >
        <Ionicons name="people-circle" size={24} color={theme.onPrimary} />
      </TouchableOpacity>

      {/* Compose FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleStartNewMessage} activeOpacity={0.8}>
        <Ionicons name="create" size={24} color={theme.onPrimary} />
      </TouchableOpacity>
    </View>
  );
}
