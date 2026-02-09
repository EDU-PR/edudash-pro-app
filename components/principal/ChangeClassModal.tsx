/**
 * Change Class Modal — update student's class and registration fee together.
 */

import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import type { ClassOption, Student } from '@/hooks/student-fees/types';

interface ChangeClassModalProps {
  visible: boolean;
  student: Student | null;
  classes: ClassOption[];
  saving: boolean;
  newClassId: string;
  classRegistrationFee: string;
  classFeeHint: string;
  loadingSuggestedFee: boolean;
  canSubmit: boolean;
  onSelectClass: (classId: string) => void;
  onChangeFee: (v: string) => void;
  onClearHint: () => void;
  onSubmit: () => void;
  onClose: () => void;
  styles: any;
}

export function ChangeClassModal({
  visible, student, classes, saving,
  newClassId, classRegistrationFee, classFeeHint, loadingSuggestedFee, canSubmit,
  onSelectClass, onChangeFee, onClearHint, onSubmit, onClose, styles,
}: ChangeClassModalProps) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Fix Class & Registration Fee</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>
            Current: {student?.class_name || 'No Class'}
          </Text>

          <View style={styles.classOptions}>
            {classes.map(cls => (
              <TouchableOpacity
                key={cls.id}
                style={[styles.classOption, newClassId === cls.id && styles.classOptionSelected]}
                onPress={() => onSelectClass(cls.id)}
              >
                <Text style={[styles.classOptionText, newClassId === cls.id && styles.classOptionTextSelected]}>
                  {cls.name}
                </Text>
                {newClassId === cls.id && (
                  <Ionicons name="checkmark" size={20} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Registration Fee Shown to Parent (R)</Text>
            <TextInput
              style={styles.input}
              value={classRegistrationFee}
              onChangeText={v => { onChangeFee(v.replace(/[^0-9.]/g, '')); onClearHint(); }}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
            />
            {loadingSuggestedFee && (
              <Text style={styles.classFeeHintText}>Finding suggested fee for selected class...</Text>
            )}
            {!loadingSuggestedFee && !!classFeeHint && (
              <Text style={styles.classFeeHintText}>{classFeeHint}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            {saving ? (
              <EduDashSpinner size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Save Corrections</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
