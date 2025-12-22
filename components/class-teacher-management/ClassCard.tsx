/**
 * Class Card Component
 * Extracted from app/screens/class-teacher-management.tsx
 */

import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ClassInfo, Teacher } from './types';
import { getClassStatusColor } from './utils';

interface ClassCardProps {
  classInfo: ClassInfo;
  theme: any;
  onToggleStatus: (classInfo: ClassInfo) => void;
  onRemoveTeacher: (classInfo: ClassInfo) => void;
  onAssignTeacher: (classInfo: ClassInfo) => void;
  onViewStudents: (classId: string) => void;
  onEditClass: (classId: string) => void;
}

export function ClassCard({
  classInfo,
  theme,
  onToggleStatus,
  onRemoveTeacher,
  onAssignTeacher,
  onViewStudents,
  onEditClass,
}: ClassCardProps) {
  const styles = getStyles(theme);
  const statusColor = getClassStatusColor(classInfo, theme);

  return (
    <View style={styles.classCard}>
      <View style={styles.classHeader}>
        <View style={styles.classInfo}>
          <Text style={styles.className}>{classInfo.name}</Text>
          <Text style={styles.gradeLevel}>{classInfo.grade_level}</Text>
          {classInfo.room_number && (
            <Text style={styles.roomNumber}>Room {classInfo.room_number}</Text>
          )}
        </View>
        <View style={styles.classActions}>
          <Switch
            value={classInfo.is_active}
            onValueChange={() => onToggleStatus(classInfo)}
            trackColor={{ false: theme.border, true: theme.success }}
            thumbColor={classInfo.is_active ? theme.onPrimary : theme.textSecondary}
          />
        </View>
      </View>

      <View style={styles.classDetails}>
        <View style={styles.enrollmentInfo}>
          <Text style={styles.enrollmentLabel}>Enrollment</Text>
          <Text style={[styles.enrollmentValue, { color: statusColor }]}>
            {classInfo.current_enrollment}/{classInfo.capacity}
          </Text>
        </View>

        <View style={styles.teacherInfo}>
          {classInfo.teacher_name ? (
            <View style={styles.assignedTeacher}>
              <Text style={styles.teacherLabel}>Teacher</Text>
              <Text style={styles.teacherName}>{classInfo.teacher_name}</Text>
              <TouchableOpacity onPress={() => onRemoveTeacher(classInfo)}>
                <Ionicons name="close-circle" size={20} color={theme.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.assignTeacherButton}
              onPress={() => onAssignTeacher(classInfo)}
            >
              <Ionicons name="person-add" size={16} color={theme.primary} />
              <Text style={styles.assignTeacherText}>Assign Teacher</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.classFooter}>
        <TouchableOpacity
          style={styles.viewStudentsButton}
          onPress={() => onViewStudents(classInfo.id)}
        >
          <Ionicons name="people" size={16} color={theme.accent} />
          <Text style={styles.viewStudentsText}>View Students</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editClassButton}
          onPress={() => onEditClass(classInfo.id)}
        >
          <Ionicons name="create" size={16} color={theme.textSecondary} />
          <Text style={styles.editClassText}>Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface ClassesEmptyStateProps {
  theme: any;
  onCreateClass: () => void;
}

export function ClassesEmptyState({ theme, onCreateClass }: ClassesEmptyStateProps) {
  const styles = getStyles(theme);

  return (
    <View style={styles.emptyState}>
      <Ionicons name="school-outline" size={64} color={theme.textSecondary} />
      <Text style={styles.emptyTitle}>No Classes Created</Text>
      <Text style={styles.emptySubtitle}>
        Create your first class to start organizing students
      </Text>
      <TouchableOpacity style={styles.addButton} onPress={onCreateClass}>
        <Ionicons name="add" size={20} color={theme.onPrimary} />
        <Text style={styles.addButtonText}>Create Class</Text>
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    classCard: {
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
    classHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    classInfo: {
      flex: 1,
    },
    className: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    gradeLevel: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    roomNumber: {
      fontSize: 12,
      color: theme.accent,
    },
    classActions: {
      alignItems: 'flex-end',
    },
    classDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    enrollmentInfo: {
      flex: 1,
    },
    enrollmentLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    enrollmentValue: {
      fontSize: 16,
      fontWeight: '600',
    },
    teacherInfo: {
      flex: 1,
      alignItems: 'flex-end',
    },
    assignedTeacher: {
      alignItems: 'flex-end',
    },
    teacherLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 4,
    },
    teacherName: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text,
    },
    assignTeacherButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      backgroundColor: theme.elevated,
      borderRadius: 6,
    },
    assignTeacherText: {
      fontSize: 12,
      color: theme.primary,
      marginLeft: 4,
    },
    classFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    viewStudentsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
    },
    viewStudentsText: {
      fontSize: 14,
      color: theme.accent,
      marginLeft: 4,
    },
    editClassButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
    },
    editClassText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginLeft: 4,
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
