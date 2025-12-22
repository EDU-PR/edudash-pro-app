/**
 * Teacher Card Component
 * Extracted from app/screens/class-teacher-management.tsx
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Teacher } from './types';
import { getTeacherWorkloadColor } from './utils';

interface TeacherCardProps {
  teacher: Teacher;
  theme: any;
  onViewClasses: (teacherId: string) => void;
  onEditTeacher: (teacherId: string) => void;
}

export function TeacherCard({
  teacher,
  theme,
  onViewClasses,
  onEditTeacher,
}: TeacherCardProps) {
  const styles = getStyles(theme);
  const workloadColor = getTeacherWorkloadColor(teacher, theme);

  return (
    <View style={styles.teacherCard}>
      <View style={styles.teacherHeader}>
        <View style={styles.teacherCardInfo}>
          <Text style={styles.teacherCardName}>{teacher.full_name}</Text>
          <Text style={styles.teacherEmail}>{teacher.email}</Text>
          {teacher.specialization && (
            <Text style={styles.teacherSpecialization}>{teacher.specialization}</Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: teacher.status === 'active' ? theme.success : theme.error },
          ]}
        >
          <Text style={styles.statusText}>{teacher.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.teacherStats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{teacher.classes_assigned}</Text>
          <Text style={styles.statLabel}>Classes</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: workloadColor }]}>
            {teacher.students_count}
          </Text>
          <Text style={styles.statLabel}>Students</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {new Date(teacher.hire_date).getFullYear()}
          </Text>
          <Text style={styles.statLabel}>Since</Text>
        </View>
      </View>

      <View style={styles.teacherActions}>
        <TouchableOpacity
          style={styles.viewClassesButton}
          onPress={() => onViewClasses(teacher.id)}
        >
          <Text style={styles.viewClassesText}>View Classes</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editTeacherButton}
          onPress={() => onEditTeacher(teacher.id)}
        >
          <Ionicons name="create" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface TeachersEmptyStateProps {
  theme: any;
  onAddTeacher: () => void;
}

export function TeachersEmptyState({ theme, onAddTeacher }: TeachersEmptyStateProps) {
  const styles = getStyles(theme);

  return (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color={theme.textSecondary} />
      <Text style={styles.emptyTitle}>No Teachers Added</Text>
      <Text style={styles.emptySubtitle}>Add teachers to assign them to classes</Text>
      <TouchableOpacity style={styles.addButton} onPress={onAddTeacher}>
        <Ionicons name="person-add" size={20} color={theme.onPrimary} />
        <Text style={styles.addButtonText}>Add Teacher</Text>
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    teacherCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    teacherHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    teacherCardInfo: {
      flex: 1,
    },
    teacherCardName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    teacherEmail: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    teacherSpecialization: {
      fontSize: 12,
      color: theme.accent,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 10,
      color: theme.onPrimary,
      fontWeight: '500',
    },
    teacherStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 16,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    teacherActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    viewClassesButton: {
      flex: 1,
      backgroundColor: theme.elevated,
      padding: 12,
      borderRadius: 6,
      alignItems: 'center',
      marginRight: 8,
    },
    viewClassesText: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '500',
    },
    editTeacherButton: {
      padding: 12,
      backgroundColor: theme.elevated,
      borderRadius: 6,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 64,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 24,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
    },
    addButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
  });
