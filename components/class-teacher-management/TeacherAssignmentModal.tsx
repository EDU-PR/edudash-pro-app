/**
 * Teacher Assignment Modal Component
 * Extracted from app/screens/class-teacher-management.tsx
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import type { ClassInfo, ClassFormData, Teacher } from './types';

interface TeacherAssignmentModalProps {
  visible: boolean;
  theme: any;
  selectedClass: ClassInfo | null;
  teacherId: string;
  activeTeachers: Teacher[];
  onClose: () => void;
  onAssign: () => void;
  onTeacherChange: (teacherId: string) => void;
}

export function TeacherAssignmentModal({
  visible,
  theme,
  selectedClass,
  teacherId,
  activeTeachers,
  onClose,
  onAssign,
  onTeacherChange,
}: TeacherAssignmentModalProps) {
  const styles = getStyles(theme);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Assign Teacher</Text>
          <TouchableOpacity onPress={onAssign} disabled={!teacherId}>
            <Text
              style={[
                styles.modalSave,
                { color: teacherId ? theme.primary : theme.textSecondary },
              ]}
            >
              Assign
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <Text style={styles.pickerLabel}>
            Select a teacher for {selectedClass?.name}:
          </Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={teacherId}
              onValueChange={onTeacherChange}
              style={styles.picker}
            >
              <Picker.Item label="Select a teacher..." value="" />
              {activeTeachers.map((teacher) => (
                <Picker.Item
                  key={teacher.id}
                  label={`${teacher.full_name} (${teacher.classes_assigned} classes, ${teacher.students_count} students)`}
                  value={teacher.id}
                />
              ))}
            </Picker>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    modalCancel: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    modalSave: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.primary,
    },
    modalContent: {
      flex: 1,
      padding: 16,
    },
    pickerLabel: {
      fontSize: 16,
      color: theme.text,
      marginBottom: 16,
    },
    pickerContainer: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      backgroundColor: theme.surface,
      overflow: 'hidden',
    },
    picker: {
      backgroundColor: theme.surface,
      color: theme.text,
    },
  });
