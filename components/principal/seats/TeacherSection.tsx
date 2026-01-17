// Teacher section component - lists teachers with/without seats

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TeacherListItem } from './TeacherListItem';
import type { Teacher } from './types';

interface TeacherSectionProps {
  teachers: Teacher[];
  pendingTeacherId: string | null;
  subscriptionId: string | null;
  onAssignTeacher: (teacherId: string, email: string) => Promise<void>;
  onRevokeTeacher: (teacherId: string, email: string) => Promise<void>;
  theme: any;
  isDark: boolean;
}

export function TeacherSection({
  teachers,
  pendingTeacherId,
  subscriptionId,
  onAssignTeacher,
  onRevokeTeacher,
  theme,
  isDark,
}: TeacherSectionProps) {
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  const teachersWithSeats = teachers.filter(t => t.hasSeat);
  const teachersWithoutSeats = teachers.filter(t => !t.hasSeat);

  if (teachers.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
        <Text style={styles.emptyStateTitle}>
          {t('seat_management.no_teachers', { defaultValue: 'No Teachers Found' })}
        </Text>
        <Text style={styles.emptyStateSubtitle}>
          {t('seat_management.add_teachers_hint', {
            defaultValue: 'Add teachers to your school to manage seat assignments',
          })}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.teachersSection}>
      <View style={styles.teachersSectionHeader}>
        <Text style={styles.title}>
          {t('seat_management.all_teachers', { defaultValue: 'All Teachers' })} ({teachers.length})
        </Text>
        <View style={styles.seatsSummary}>
          <Text style={styles.seatsAssigned}>
            {teachersWithSeats.length} {t('seat_management.with_seats', { defaultValue: 'with seats' })}
          </Text>
          <Text style={styles.seatsUnassigned}>
            {teachersWithoutSeats.length} {t('seat_management.without_seats', { defaultValue: 'without seats' })}
          </Text>
        </View>
      </View>

      <View style={styles.teachersList}>
        {/* Teachers with seats */}
        {teachersWithSeats.length > 0 && (
          <>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryIndicator}>
                <View style={[styles.statusDot, { backgroundColor: theme.success }]} />
                <Text style={styles.categoryTitle}>
                  {t('seat_management.teachers_with_seats', { defaultValue: 'Teachers with Seats' })} ({teachersWithSeats.length})
                </Text>
              </View>
            </View>
            {teachersWithSeats.map(teacher => (
              <TeacherListItem
                key={teacher.id}
                teacher={teacher}
                isPending={pendingTeacherId === teacher.id}
                disabled={!subscriptionId}
                onAction={() => onRevokeTeacher(teacher.id, teacher.email)}
                theme={theme}
                isDark={isDark}
              />
            ))}
          </>
        )}

        {/* Teachers without seats */}
        {teachersWithoutSeats.length > 0 && (
          <>
            <View style={[styles.categoryHeader, teachersWithSeats.length > 0 && { marginTop: 20 }]}>
              <View style={styles.categoryIndicator}>
                <View style={[styles.statusDot, { backgroundColor: theme.warning }]} />
                <Text style={styles.categoryTitle}>
                  {t('seat_management.teachers_without_seats', { defaultValue: 'Teachers without Seats' })} ({teachersWithoutSeats.length})
                </Text>
              </View>
            </View>
            {teachersWithoutSeats.map(teacher => (
              <TeacherListItem
                key={teacher.id}
                teacher={teacher}
                isPending={pendingTeacherId === teacher.id}
                disabled={!subscriptionId}
                onAction={() => onAssignTeacher(teacher.id, teacher.email)}
                theme={theme}
                isDark={isDark}
              />
            ))}
          </>
        )}
      </View>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    teachersSection: {
      marginTop: 16,
    },
    teachersSectionHeader: {
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.text,
    },
    seatsSummary: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 8,
    },
    seatsAssigned: {
      color: theme.success,
      fontSize: 14,
      fontWeight: '600',
    },
    seatsUnassigned: {
      color: theme.warning,
      fontSize: 14,
      fontWeight: '600',
    },
    emptyState: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyStateTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '600',
      marginTop: 16,
    },
    emptyStateSubtitle: {
      color: theme.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
    teachersList: {
      gap: 8,
    },
    categoryHeader: {
      marginBottom: 12,
    },
    categoryIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    categoryTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '600',
    },
  });
