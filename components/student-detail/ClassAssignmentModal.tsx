/**
 * Class Assignment Modal Component
 * Modal for assigning students to classes
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { StudentDetail, Class } from './types';

interface ClassAssignmentModalProps {
  visible: boolean;
  student: StudentDetail;
  classes: Class[];
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  onSave: () => void;
  onClose: () => void;
  theme: any;
}

export const ClassAssignmentModal: React.FC<ClassAssignmentModalProps> = ({
  visible,
  student,
  classes,
  selectedClassId,
  onSelectClass,
  onSave,
  onClose,
  theme,
}) => {
  const styles = createStyles(theme);

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
          <Text style={styles.modalTitle}>Assign Class</Text>
          <TouchableOpacity onPress={onSave} disabled={!selectedClassId}>
            <Text style={[
              styles.modalSave,
              { color: selectedClassId ? '#007AFF' : '#ccc' }
            ]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <Text style={styles.pickerLabel}>Select a class for {student.first_name}:</Text>
          <Picker
            selectedValue={selectedClassId}
            onValueChange={onSelectClass}
            style={styles.picker}
          >
            <Picker.Item label="Select a class..." value="" />
            {classes.map((cls) => (
              <Picker.Item
                key={cls.id}
                label={`${cls.name} - ${cls.teacher_name || 'No teacher'} (${cls.current_enrollment}/${cls.capacity})`}
                value={cls.id}
              />
            ))}
          </Picker>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: theme.card,
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
  picker: {
    backgroundColor: theme.surface,
    borderRadius: 8,
  },
});
