/**
 * Student Details Section Component
 * Shows full student profile details (IDs, demographics, enrollment, contact)
 */

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { StudentDetail, formatCurrency } from './types';
import type { ThemeColors } from '@/contexts/ThemeContext';

interface StudentDetailsSectionProps {
  student: StudentDetail;
  theme: ThemeColors;
  editMode?: boolean;
  editedStudent?: Partial<StudentDetail>;
  onEditChange?: (updates: Partial<StudentDetail>) => void;
}

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

export const StudentDetailsSection: React.FC<StudentDetailsSectionProps> = ({
  student,
  theme,
  editMode = false,
  editedStudent,
  onEditChange,
}) => {
  const styles = createStyles(theme);

  const registrationFeeText =
    student.registration_fee_amount != null
      ? formatCurrency(Number(student.registration_fee_amount))
      : null;
  const registrationFeeStatus =
    typeof student.registration_fee_paid === 'boolean'
      ? student.registration_fee_paid
        ? 'Paid'
        : 'Not paid'
      : null;

  const registrationFeeValue = registrationFeeStatus
    ? `${registrationFeeStatus}${registrationFeeText ? ` (${registrationFeeText})` : ''}`
    : registrationFeeText;

  const detailRows: { label: string; value?: string | null }[] = [
    { label: 'Student ID', value: student.student_id },
    { label: 'ID Number', value: student.id_number },
    { label: 'Gender', value: student.gender },
    { label: 'Date of Birth', value: formatDate(student.date_of_birth) },
    { label: 'Enrollment Date', value: formatDate(student.enrollment_date) },
    { label: 'Academic Year', value: student.academic_year },
    { label: 'Grade', value: student.grade },
    { label: 'Grade Level', value: student.grade_level },
    { label: 'Home Address', value: student.home_address },
    { label: 'Home Phone', value: student.home_phone },
    { label: 'Payment Date', value: formatDate(student.payment_date) },
    {
      label: 'Payment Verified',
      value:
        typeof student.payment_verified === 'boolean'
          ? student.payment_verified
            ? 'Verified'
            : 'Not verified'
          : null,
    },
    {
      label: 'Registration Fee',
      value: registrationFeeValue,
    },
    { label: 'Notes', value: student.notes },
  ];

  const visibleRows = detailRows.filter(row => row.value);

  if (editMode && editedStudent && onEditChange) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Student Details</Text>
        <View style={{ gap: 12 }}>
          <TextInput
            style={styles.input}
            value={editedStudent.student_id || ''}
            onChangeText={(text) => onEditChange({ ...editedStudent, student_id: text })}
            placeholder="Student number"
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={styles.input}
            value={editedStudent.id_number || ''}
            onChangeText={(text) => onEditChange({ ...editedStudent, id_number: text })}
            placeholder="ID number"
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={styles.input}
            value={editedStudent.gender || ''}
            onChangeText={(text) => onEditChange({ ...editedStudent, gender: text })}
            placeholder="Gender"
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={styles.input}
            value={editedStudent.date_of_birth || ''}
            onChangeText={(text) => onEditChange({ ...editedStudent, date_of_birth: text })}
            placeholder="Date of birth (YYYY-MM-DD)"
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={styles.input}
            value={editedStudent.enrollment_date || ''}
            onChangeText={(text) => onEditChange({ ...editedStudent, enrollment_date: text })}
            placeholder="Enrollment date (YYYY-MM-DD)"
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={editedStudent.home_address || ''}
            onChangeText={(text) => onEditChange({ ...editedStudent, home_address: text })}
            placeholder="Home address"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={2}
          />
          <TextInput
            style={styles.input}
            value={editedStudent.home_phone || ''}
            onChangeText={(text) => onEditChange({ ...editedStudent, home_phone: text })}
            placeholder="Home phone"
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={styles.input}
            value={
              editedStudent.registration_fee_amount != null
                ? String(editedStudent.registration_fee_amount)
                : ''
            }
            onChangeText={(text) => {
              const normalized = text.trim();
              const parsed = normalized ? Number.parseFloat(normalized) : null;
              onEditChange({
                ...editedStudent,
                registration_fee_amount:
                  parsed != null && Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null,
              });
            }}
            placeholder="Registration fee amount"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
          />
          <View style={styles.toggleRow}>
            <Text style={styles.fieldLabel}>Payment Verified</Text>
            <View style={styles.toggleActions}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  editedStudent.payment_verified === true && styles.toggleButtonActive,
                ]}
                onPress={() => onEditChange({ ...editedStudent, payment_verified: true })}
              >
                <Text
                  style={[
                    styles.toggleText,
                    editedStudent.payment_verified === true && styles.toggleTextActive,
                  ]}
                >
                  Yes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  editedStudent.payment_verified === false && styles.toggleButtonActive,
                ]}
                onPress={() => onEditChange({ ...editedStudent, payment_verified: false })}
              >
                <Text
                  style={[
                    styles.toggleText,
                    editedStudent.payment_verified === false && styles.toggleTextActive,
                  ]}
                >
                  No
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <TextInput
            style={styles.input}
            value={editedStudent.payment_date || ''}
            onChangeText={(text) => onEditChange({ ...editedStudent, payment_date: text })}
            placeholder="Payment date (YYYY-MM-DD)"
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={editedStudent.notes || ''}
            onChangeText={(text) => onEditChange({ ...editedStudent, notes: text })}
            placeholder="Notes"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={3}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Student Details</Text>
      {visibleRows.length > 0 ? (
        visibleRows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={styles.label}>{row.label}</Text>
            <Text style={styles.value}>{row.value}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.noDetails}>No additional details available</Text>
      )}
    </View>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
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
  row: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 15,
    color: theme.text,
  },
  noDetails: {
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
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
    minHeight: 70,
    textAlignVertical: 'top',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  toggleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleButtonActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '14',
  },
  toggleText: {
    color: theme.textSecondary,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: theme.primary,
  },
});
