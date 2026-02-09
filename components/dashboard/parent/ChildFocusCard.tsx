/**
 * ChildFocusCard — Active child summary with quick action buttons
 * 
 * Shows the currently selected child's avatar, name, grade, class,
 * teacher, and quick-tap buttons for messaging and viewing homework.
 * 
 * ≤120 lines — WARP-compliant presentational component.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

interface ChildDisplayData {
  fullName: string;
  initials: string;
  avatarUrl?: string | null;
  className: string;
  teacherName: string;
  grade?: string;
}

interface ChildFocusCardProps {
  child: ChildDisplayData;
  onMessageTeacher: () => void;
  onViewHomework: () => void;
  style?: any;
}

export const ChildFocusCard: React.FC<ChildFocusCardProps> = ({
  child,
  onMessageTeacher,
  onViewHomework,
  style,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.borderLight }, style]}>
      <View style={styles.header}>
        {child.avatarUrl ? (
          <Image source={{ uri: child.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: theme.primary }]}>{child.initials}</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.text }]}>{child.fullName}</Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>
            {child.grade || t('parent.grade_unknown', { defaultValue: 'Grade' })}
            {'  •  '}
            {child.className}
          </Text>
          <Text style={[styles.teacher, { color: theme.textSecondary }]}>
            {t('parent.teacher_label', { defaultValue: 'Teacher' })}: {child.teacherName}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary }]}
          onPress={onMessageTeacher}
        >
          <Ionicons name="chatbubbles" size={16} color="#fff" />
          <Text style={styles.actionTextPrimary}>
            {t('parent.message_teacher', { defaultValue: 'Message Teacher' })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.primary + '15', borderWidth: 1, borderColor: theme.primary + '30' }]}
          onPress={onViewHomework}
        >
          <Ionicons name="book" size={16} color={theme.primary} />
          <Text style={[styles.actionTextSecondary, { color: theme.primary }]}>
            {t('parent.view_homework', { defaultValue: 'View Homework' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  meta: { fontSize: 12, marginBottom: 4 },
  teacher: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  actionTextPrimary: { color: '#fff', fontSize: 12, fontWeight: '700' },
  actionTextSecondary: { fontSize: 12, fontWeight: '700' },
});

export default ChildFocusCard;
