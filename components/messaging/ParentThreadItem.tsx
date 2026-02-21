/**
 * ParentThreadItem — Thread list item for parent messages screen
 * Extracted from parent-messages.tsx for WARP compliance
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getMessageDisplayText } from '@/lib/utils/messageContent';

export interface ParentThreadItemProps {
  thread: any;
  onPress: () => void;
  onLongPress?: () => void;
  typingText?: string | null;
  selectionMode?: boolean;
  isSelected?: boolean;
}

export const ParentThreadItem: React.FC<ParentThreadItemProps> = React.memo(({ thread, onPress, onLongPress, typingText, selectionMode = false, isSelected = false }) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();

  const isGroup = thread.is_group || ['class_group', 'parent_group', 'announcement'].includes(thread.type);
  const isParentDM = thread.type === 'parent-parent';

  const otherParticipant = isParentDM
    ? thread.participants?.find((p: any) => p.user_id !== user?.id)
    : thread.participants?.find((p: any) => p.role !== 'parent');
  const participantName = isGroup
    ? ((thread as any).group_name || thread.subject || 'Group')
    : otherParticipant?.user_profile
      ? `${otherParticipant.user_profile.first_name} ${otherParticipant.user_profile.last_name}`.trim()
      : isParentDM ? 'Parent' : 'Teacher';

  const participantRole = isGroup
    ? (thread.type === 'announcement' ? 'announcement' : 'group')
    : otherParticipant?.user_profile?.role || (isParentDM ? 'parent' : 'teacher');
  const groupMemberCount = isGroup
    ? Number((thread as any).member_count ?? thread.participant_count ?? thread.participants?.length ?? 0)
    : 0;
  const groupOnlineCount = isGroup
    ? Number((thread as any).online_count ?? 0)
    : 0;

  const studentName = thread.student
    ? `${thread.student.first_name} ${thread.student.last_name}`.trim()
    : null;

  const hasUnread = (thread.unread_count || 0) > 0;
  const initials = participantName.split(' ').map((n: string) => n.charAt(0)).join('').toUpperCase().slice(0, 2);

  const s = React.useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      marginHorizontal: 16, marginBottom: 8, borderRadius: 16, overflow: 'hidden',
      borderWidth: isSelected ? 2 : 0,
      borderColor: isSelected ? theme.primary : 'transparent',
      ...Platform.select({
        ios: { shadowColor: theme.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
        android: { elevation: 2 },
      }),
    },
    inner: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    avatar: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: hasUnread ? theme.primary : theme.primary + '20',
      alignItems: 'center', justifyContent: 'center', marginRight: 14,
    },
    avatarText: { fontSize: 18, fontWeight: '600', color: hasUnread ? theme.onPrimary : theme.primary },
    content: { flex: 1 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    name: { fontSize: 16, fontWeight: hasUnread ? '700' : '500', color: theme.text, flex: 1 },
    time: { fontSize: 12, color: hasUnread ? theme.primary : theme.textSecondary, fontWeight: hasUnread ? '600' : '400', marginLeft: 8 },
    contextRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    roleBadge: { backgroundColor: theme.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    roleText: { fontSize: 11, color: theme.primary, fontWeight: '600', textTransform: 'capitalize' },
    studentText: { fontSize: 12, color: theme.textSecondary, marginLeft: 8 },
    messagePreview: { fontSize: 14, color: hasUnread ? theme.text : theme.textSecondary, fontWeight: hasUnread ? '500' : '400', lineHeight: 20 },
    bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
    unreadBadge: { backgroundColor: theme.primary, borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    unreadText: { color: theme.onPrimary, fontSize: 12, fontWeight: '700' },
    selectedIndicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      marginLeft: 8,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
    },
  }), [theme, hasUnread, isSelected]);

  return (
    <TouchableOpacity style={s.container} onPress={onPress} onLongPress={onLongPress} delayLongPress={220} activeOpacity={0.7}>
      <View style={s.inner}>
        <View style={s.avatar}>
          {isGroup ? (
            <Ionicons name="people" size={24} color={hasUnread ? theme.onPrimary : theme.primary} />
          ) : (
            <Text style={s.avatarText}>{initials}</Text>
          )}
        </View>
        <View style={s.content}>
          <View style={s.topRow}>
            <Text style={s.name} numberOfLines={1}>{participantName}</Text>
            {thread.last_message && (
              <Text style={s.time}>{formatMessageTime(thread.last_message.created_at)}</Text>
            )}
          </View>
          <View style={s.contextRow}>
            <View style={s.roleBadge}>
              <Text style={s.roleText}>{participantRole}</Text>
            </View>
            {isGroup && groupMemberCount > 0 && (
              <Text style={s.studentText}>
                • {groupOnlineCount > 0 ? `${groupOnlineCount} online • ` : ''}
                {groupMemberCount} member{groupMemberCount === 1 ? '' : 's'}
              </Text>
            )}
            {studentName && <Text style={s.studentText}>• {studentName}</Text>}
          </View>
          <View style={s.bottomRow}>
            {typingText ? (
              <Text style={[s.messagePreview, { color: theme.primary, fontStyle: 'italic' }]} numberOfLines={1}>{typingText}</Text>
            ) : thread.last_message ? (
              <Text style={s.messagePreview} numberOfLines={1}>{getMessageDisplayText(thread.last_message.content)}</Text>
            ) : (
              <Text style={[s.messagePreview, { fontStyle: 'italic' }]} numberOfLines={1}>
                {t('parent.noMessagesYet', { defaultValue: 'No messages yet' })}
              </Text>
            )}
            {hasUnread && (
              <View style={s.unreadBadge}>
                <Text style={s.unreadText}>{thread.unread_count && thread.unread_count > 99 ? '99+' : thread.unread_count}</Text>
              </View>
            )}
            {selectionMode && (
              <View
                style={[
                  s.selectedIndicator,
                  {
                    borderColor: isSelected ? theme.primary : theme.border,
                    backgroundColor: isSelected ? theme.primary : 'transparent',
                  },
                ]}
              >
                {isSelected && <Ionicons name="checkmark" size={14} color={theme.onPrimary} />}
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

function formatMessageTime(timestamp: string): string {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInHours = Math.abs(now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffInHours < 168) return messageTime.toLocaleDateString([], { weekday: 'short' });
  return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
