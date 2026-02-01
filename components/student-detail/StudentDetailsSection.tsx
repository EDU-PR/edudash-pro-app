/**
 * Student Details Section Component
 * Shows full student profile details (IDs, demographics, enrollment, contact)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StudentDetail, formatCurrency } from './types';
import type { ThemeColors } from '@/contexts/ThemeContext';

interface StudentDetailsSectionProps {
  student: StudentDetail;
  theme: ThemeColors;
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
});
