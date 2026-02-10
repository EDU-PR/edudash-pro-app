/**
 * ThreadItem — single conversation row in the teacher message list.
 * Styles use a useMemo factory to avoid re-creation on every render.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { MessageThread } from '@/hooks/useTeacherMessaging';
import { getMessageDisplayText } from '@/lib/utils/messageContent';
import { formatMessageTime } from '@/app/screens/teacher-message-list.styles';

interface ThreadItemProps {
  thread: MessageThread;
  onPress: () => void;
}

const createThreadItemStyles = (theme: any, hasUnread: boolean) =>
  StyleSheet.create({
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
        android: { elevation: 2 },
      }),
    },
    inner: { flexDirection: 'row', alignItems: 'center', padding: 16 },
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
    content: { flex: 1 },
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
    contextRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
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
    studentText: { fontSize: 12, color: theme.textSecondary, marginLeft: 8 },
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
    unreadText: { color: theme.onPrimary, fontSize: 12, fontWeight: '700' },
  });

const ThreadItem: React.FC<ThreadItemProps> = React.memo(({ thread, onPress }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const otherParticipant = thread.participants?.find((p: any) => p.role === 'parent');
  const participantName = otherParticipant?.user_profile
    ? `${otherParticipant.user_profile.first_name} ${otherParticipant.user_profile.last_name}`.trim()
    : 'Parent';

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

  const styles = useMemo(() => createThreadItemStyles(theme, hasUnread), [theme, hasUnread]);

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
              <Text style={styles.time}>
                {formatMessageTime(thread.last_message.created_at)}
              </Text>
            )}
          </View>

          <View style={styles.contextRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>Parent</Text>
            </View>
            {studentName && <Text style={styles.studentText}>• {studentName}</Text>}
          </View>

          <View style={styles.bottomRow}>
            {thread.last_message ? (
              <Text style={styles.messagePreview} numberOfLines={1}>
                {getMessageDisplayText(thread.last_message.content)}
              </Text>
            ) : (
              <Text style={[styles.messagePreview, { fontStyle: 'italic' }]} numberOfLines={1}>
                {t('teacher.noMessagesYet', { defaultValue: 'No messages yet' })}
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

export default ThreadItem;
