/**
 * Lesson Assignment Modal Component
 * 
 * Modal for assigning lessons to students or classes
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface LessonAssignmentModalProps {
  visible: boolean;
  onClose: () => void;
  onAssign: (params: {
    studentIds?: string[];
    classId?: string;
    dueDate?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    notes?: string;
  }) => Promise<void>;
  students?: Array<{ id: string; first_name: string; last_name: string }>;
  classes?: Array<{ id: string; name: string }>;
  lessonTitle?: string;
}

export function LessonAssignmentModal({
  visible,
  onClose,
  onAssign,
  students = [],
  classes = [],
  lessonTitle,
}: LessonAssignmentModalProps) {
  const { theme } = useTheme();
  const [targetType, setTargetType] = useState<'class' | 'student'>('class');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState<string>('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [notes, setNotes] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async () => {
    setAssigning(true);
    try {
      await onAssign({
        studentIds: targetType === 'student' ? Array.from(selectedStudentIds) : undefined,
        classId: targetType === 'class' ? selectedClassId : undefined,
        dueDate: dueDate || undefined,
        priority,
        notes: notes || undefined,
      });
      onClose();
      // Reset form
      setSelectedClassId('');
      setSelectedStudentIds(new Set());
      setDueDate('');
      setPriority('normal');
      setNotes('');
    } catch (error) {
      console.error('Assignment error:', error);
    } finally {
      setAssigning(false);
    }
  };

  const toggleStudent = (studentId: string) => {
    const newSet = new Set(selectedStudentIds);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setSelectedStudentIds(newSet);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Assign Lesson</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {lessonTitle && (
            <Text style={[styles.lessonTitle, { color: theme.textSecondary }]}>{lessonTitle}</Text>
          )}

          <ScrollView style={styles.content}>
            {/* Target Selection */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Assign To</Text>
              <View style={styles.targetButtons}>
                <TouchableOpacity
                  style={[
                    styles.targetButton,
                    {
                      backgroundColor: targetType === 'class' ? theme.primary : theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setTargetType('class')}
                >
                  <Text style={{ color: targetType === 'class' ? '#fff' : theme.text }}>
                    Entire Class
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.targetButton,
                    {
                      backgroundColor: targetType === 'student' ? theme.primary : theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={() => setTargetType('student')}
                >
                  <Text style={{ color: targetType === 'student' ? '#fff' : theme.text }}>
                    Individual Students
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Class Selection */}
            {targetType === 'class' && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Class</Text>
                {classes.map((cls) => (
                  <TouchableOpacity
                    key={cls.id}
                    style={[
                      styles.option,
                      {
                        backgroundColor: selectedClassId === cls.id ? theme.primary + '20' : theme.surface,
                        borderColor: selectedClassId === cls.id ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setSelectedClassId(cls.id)}
                  >
                    <Text style={{ color: theme.text }}>{cls.name}</Text>
                    {selectedClassId === cls.id && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Student Selection */}
            {targetType === 'student' && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Select Students ({selectedStudentIds.size} selected)
                </Text>
                {students.map((student) => (
                  <TouchableOpacity
                    key={student.id}
                    style={[
                      styles.option,
                      {
                        backgroundColor: selectedStudentIds.has(student.id) ? theme.primary + '20' : theme.surface,
                        borderColor: selectedStudentIds.has(student.id) ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => toggleStudent(student.id)}
                  >
                    <Text style={{ color: theme.text }}>
                      {student.first_name} {student.last_name}
                    </Text>
                    {selectedStudentIds.has(student.id) && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Due Date */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Due Date (Optional)</Text>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                Leave empty for no due date
              </Text>
            </View>

            {/* Priority */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Priority</Text>
              <View style={styles.priorityButtons}>
                {(['low', 'normal', 'high', 'urgent'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityButton,
                      {
                        backgroundColor: priority === p ? theme.primary : theme.surface,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={{ color: priority === p ? '#fff' : theme.text, textTransform: 'capitalize' }}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Notes (Optional)</Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: theme.border }]}
              onPress={onClose}
              disabled={assigning}
            >
              <Text style={{ color: theme.text }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.assignButton, { backgroundColor: theme.primary }]}
              onPress={handleAssign}
              disabled={assigning || (targetType === 'class' && !selectedClassId) || (targetType === 'student' && selectedStudentIds.size === 0)}
            >
              {assigning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '600' }}>Assign</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  lessonTitle: {
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  hint: {
    fontSize: 12,
    marginTop: 4,
  },
  targetButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  targetButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  priorityButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priorityButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  assignButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
});
