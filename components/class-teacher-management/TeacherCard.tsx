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
  onSetRole?: (teacher: Teacher, role: 'teacher' | 'admin') => void;
  roleUpdateTeacherId?: string | null;
  onDeleteTeacher?: (teacher: Teacher) => void;
}

export function TeacherCard({
  teacher,
  theme,
  onViewClasses,
  onEditTeacher,
  onSetRole,
  roleUpdateTeacherId,
  onDeleteTeacher,
}: TeacherCardProps) {
  const styles = getStyles(theme);
  const workloadColor = getTeacherWorkloadColor(teacher, theme);
  const isUpdatingRole = roleUpdateTeacherId === teacher.id;
  const isAdmin = teacher.role === 'admin' || teacher.role === 'principal_admin';
  const roleLabel = isAdmin ? 'Admin' : 'Teacher';

  return (
    <View style={styles.teacherCard}>
      <View style={styles.teacherHeader}>
        <View style={styles.teacherCardInfo}>
          <Text style={styles.teacherCardName}>{teacher.full_name}</Text>
          <Text style={styles.teacherEmail}>{teacher.email}</Text>
          {teacher.specialization && (
            <Text style={styles.teacherSpecialization}>{teacher.specialization}</Text>
          )}
          <View style={[styles.roleChip, isAdmin && styles.roleChipAdmin]}>
            <Ionicons
              name={isAdmin ? 'shield-checkmark-outline' : 'person-outline'}
              size={12}
              color={isAdmin ? '#0ea5e9' : theme.primary}
            />
            <Text style={[styles.roleChipText, isAdmin && styles.roleChipTextAdmin]}>
              {roleLabel}
            </Text>
          </View>
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

      <TouchableOpacity
        style={[styles.roleActionButton, isUpdatingRole && styles.roleActionButtonDisabled]}
        onPress={() => onSetRole?.(teacher, isAdmin ? 'teacher' : 'admin')}
        disabled={isUpdatingRole || !onSetRole}
      >
        <Ionicons
          name={isAdmin ? 'person-circle-outline' : 'shield-outline'}
          size={16}
          color={theme.primary}
        />
        <Text style={styles.roleActionText}>
          {isUpdatingRole
            ? 'Updating role...'
            : isAdmin
              ? 'Set as Teacher'
              : 'Make School Admin'}
        </Text>
      </TouchableOpacity>

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

        {onDeleteTeacher && (
          <TouchableOpacity
            style={[styles.editTeacherButton, styles.deleteTeacherButton]}
            onPress={() => onDeleteTeacher(teacher)}
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
          </TouchableOpacity>
        )}
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
    roleChip: {
      alignSelf: 'flex-start',
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.primary + '66',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.elevated,
    },
    roleChipAdmin: {
      borderColor: '#0ea5e966',
      backgroundColor: '#0ea5e91a',
    },
    roleChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.primary,
      marginLeft: 4,
    },
    roleChipTextAdmin: {
      color: '#0ea5e9',
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
    roleActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      marginBottom: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primary + '66',
      backgroundColor: theme.elevated,
    },
    roleActionButtonDisabled: {
      opacity: 0.6,
    },
    roleActionText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.primary,
      marginLeft: 6,
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
    deleteTeacherButton: {
      backgroundColor: theme.error,
      marginLeft: 8,
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
