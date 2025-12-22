/**
 * Class Information Section Component
 * Shows student's current class and teacher, with assign class option
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StudentDetail, Class } from './types';

interface ClassInfoSectionProps {
  student: StudentDetail;
  classes: Class[];
  theme: any;
  onAssignClass: () => void;
}

export const ClassInfoSection: React.FC<ClassInfoSectionProps> = ({
  student,
  classes,
  theme,
  onAssignClass,
}) => {
  const styles = createStyles(theme);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Class Information</Text>
        {classes.length > 0 && (
          <TouchableOpacity onPress={onAssignClass}>
            <Text style={styles.editText}>Assign Class</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {student.class_name ? (
        <View style={styles.classInfo}>
          <Ionicons name="school" size={20} color="#007AFF" />
          <View style={styles.classDetails}>
            <Text style={styles.className}>{student.class_name}</Text>
            {student.teacher_name && (
              <Text style={styles.teacherName}>Teacher: {student.teacher_name}</Text>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.unassignedClass}>
          <Ionicons name="alert-circle" size={20} color="#F59E0B" />
          <Text style={styles.unassignedText}>Not assigned to any class</Text>
          {classes.length > 0 && (
            <TouchableOpacity 
              style={styles.assignButton}
              onPress={onAssignClass}
            >
              <Text style={styles.assignButtonText}>Assign Class</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  section: {
    margin: 16,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: theme.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  editText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  classInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classDetails: {
    marginLeft: 12,
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  teacherName: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  unassignedClass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unassignedText: {
    fontSize: 16,
    color: '#F59E0B',
    marginLeft: 8,
    flex: 1,
  },
  assignButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});
