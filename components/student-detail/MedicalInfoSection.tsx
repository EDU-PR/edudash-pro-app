/**
 * Medical Info Section Component
 * Shows medical conditions, allergies, and emergency contacts
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { StudentDetail } from './types';

interface MedicalInfoSectionProps {
  student: StudentDetail;
  theme: any;
  editMode: boolean;
  editedStudent: Partial<StudentDetail>;
  onEditChange: (updates: Partial<StudentDetail>) => void;
}

export const MedicalInfoSection: React.FC<MedicalInfoSectionProps> = ({
  student,
  theme,
  editMode,
  editedStudent,
  onEditChange,
}) => {
  const styles = createStyles(theme);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Medical & Emergency Information</Text>
      {editMode ? (
        <View style={{ gap: 12 }}>
          <View>
            <Text style={styles.fieldLabel}>Medical Conditions</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editedStudent.medical_conditions || ''}
              onChangeText={(text) => onEditChange({ ...editedStudent, medical_conditions: text })}
              placeholder="Enter medical conditions..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>Allergies</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={editedStudent.allergies || ''}
              onChangeText={(text) => onEditChange({ ...editedStudent, allergies: text })}
              placeholder="Enter allergies..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>Emergency Contact Name</Text>
            <TextInput
              style={styles.input}
              value={editedStudent.emergency_contact || ''}
              onChangeText={(text) => onEditChange({ ...editedStudent, emergency_contact: text })}
              placeholder="Emergency contact name..."
              placeholderTextColor={theme.textSecondary}
            />
          </View>
          <View>
            <Text style={styles.fieldLabel}>Emergency Contact Phone</Text>
            <TextInput
              style={styles.input}
              value={editedStudent.emergency_phone || ''}
              onChangeText={(text) => onEditChange({ ...editedStudent, emergency_phone: text })}
              placeholder="Emergency phone number..."
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
            />
          </View>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {student.medical_conditions && (
            <View style={styles.medicalItem}>
              <Text style={styles.medicalLabel}>Medical Conditions:</Text>
              <Text style={styles.medicalValue}>{student.medical_conditions}</Text>
            </View>
          )}
          {student.allergies && (
            <View style={styles.medicalItem}>
              <Text style={styles.medicalLabel}>Allergies:</Text>
              <Text style={styles.medicalValue}>{student.allergies}</Text>
            </View>
          )}
          {student.emergency_contact && (
            <View style={styles.medicalItem}>
              <Text style={styles.medicalLabel}>Emergency Contact:</Text>
              <Text style={styles.medicalValue}>{student.emergency_contact}</Text>
              {student.emergency_phone && (
                <Text style={styles.medicalValue}>{student.emergency_phone}</Text>
              )}
            </View>
          )}
          {!student.medical_conditions && !student.allergies && !student.emergency_contact && (
            <Text style={styles.noMedicalInfo}>No medical or emergency information</Text>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  medicalItem: {
    marginBottom: 12,
  },
  medicalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
  },
  medicalValue: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  noMedicalInfo: {
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
});
