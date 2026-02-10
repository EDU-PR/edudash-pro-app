/**
 * CreateTeacherModal Component
 *
 * Modal for principals to directly create teacher accounts.
 * Supports permanent (hire), temporary, and trainee teacher types.
 * Creates account with temp password and sends welcome email.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import {
  createTeacherAccount,
  type TeacherType,
  type CreateTeacherAccountResult,
} from '@/lib/services/teacherAccountService';
import { createStyles } from './CreateTeacherModal.styles';

interface CreateTeacherModalProps {
  visible: boolean;
  schoolId: string | null;
  onClose: () => void;
  onSuccess: (result: CreateTeacherAccountResult) => void;
  showAlert: (config: {
    title: string;
    message?: string;
    type?: 'info' | 'warning' | 'success' | 'error';
  }) => void;
  /** Pre-fill email when hiring from the available teachers list */
  prefillEmail?: string;
  prefillName?: string;
  defaultType?: TeacherType;
  /** School type from organization_membership (determines labels & fields) */
  schoolType?: string;
}

/** Generic / K-12 teacher types */
const GENERIC_TEACHER_TYPES: Array<{ value: TeacherType; label: string; icon: string; desc: string }> = [
  { value: 'permanent', label: 'Permanent', icon: 'briefcase', desc: 'Full-time hired teacher' },
  { value: 'temporary', label: 'Temporary', icon: 'time', desc: 'Short-term / substitute' },
  { value: 'trainee', label: 'Trainee', icon: 'school', desc: 'Student teacher / intern' },
];

/** ECD / Preschool teacher types */
const ECD_TEACHER_TYPES: Array<{ value: TeacherType; label: string; icon: string; desc: string }> = [
  { value: 'permanent', label: 'Practitioner', icon: 'heart', desc: 'Full-time ECD practitioner' },
  { value: 'temporary', label: 'Relief', icon: 'time', desc: 'Relief / substitute practitioner' },
  { value: 'trainee', label: 'Student', icon: 'school', desc: 'Student practitioner / intern' },
];

export function CreateTeacherModal({
  visible,
  schoolId,
  onClose,
  onSuccess,
  showAlert,
  prefillEmail,
  prefillName,
  defaultType = 'permanent',
  schoolType,
}: CreateTeacherModalProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const isPreschool = schoolType === 'preschool';
  const teacherTypes = isPreschool ? ECD_TEACHER_TYPES : GENERIC_TEACHER_TYPES;

  const [email, setEmail] = useState(prefillEmail || '');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [teacherType, setTeacherType] = useState<TeacherType>(defaultType);
  const [specialization, setSpecialization] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Parse prefillName into first/last
  React.useEffect(() => {
    if (prefillName) {
      const parts = prefillName.trim().split(/\s+/);
      if (parts.length >= 2) {
        setFirstName(parts[0]);
        setLastName(parts.slice(1).join(' '));
      } else {
        setFirstName(parts[0] || '');
      }
    }
  }, [prefillName]);

  React.useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  React.useEffect(() => {
    if (defaultType) setTeacherType(defaultType);
  }, [defaultType]);

  const resetForm = useCallback(() => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setTeacherType('permanent');
    setSpecialization('');
    setNotes('');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const isValid = email.trim() && firstName.trim() && lastName.trim() && schoolId;

  const handleSubmit = useCallback(async () => {
    if (!isValid || !schoolId) return;

    setSubmitting(true);
    try {
      const result = await createTeacherAccount({
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        school_id: schoolId,
        teacher_type: teacherType,
        subject_specialization: specialization.trim() || null,
        notes: notes.trim() || null,
      });

      if (!result.success) {
        showAlert({
          title: 'Creation Failed',
          message: result.error || 'Could not create the teacher account.',
          type: 'error',
        });
        return;
      }

      onSuccess(result);
      resetForm();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unexpected error';
      showAlert({ title: 'Error', message: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [
    isValid, schoolId, email, firstName, lastName, phone,
    teacherType, specialization, notes, showAlert, onSuccess, resetForm, onClose,
  ]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="person-add" size={22} color={theme.primary} />
              <Text style={styles.headerTitle}>Create Teacher Account</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Teacher Type Selector */}
            <Text style={styles.sectionLabel}>
              {isPreschool ? 'Practitioner Type' : 'Teacher Type'}
            </Text>
            <View style={styles.typeRow}>
              {teacherTypes.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.typeChip,
                    teacherType === t.value && styles.typeChipActive,
                  ]}
                  onPress={() => setTeacherType(t.value)}
                >
                  <Ionicons
                    name={t.icon as any}
                    size={16}
                    color={teacherType === t.value ? '#fff' : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.typeChipText,
                      teacherType === t.value && styles.typeChipTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.typeDesc}>
              {teacherTypes.find((t) => t.value === teacherType)?.desc}
            </Text>

            {/* Form Fields */}
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="teacher@example.com"
              placeholderTextColor={theme.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <Text style={styles.label}>First Name *</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First"
                  placeholderTextColor={theme.textTertiary}
                />
              </View>
              <View style={styles.nameField}>
                <Text style={styles.label}>Last Name *</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last"
                  placeholderTextColor={theme.textTertiary}
                />
              </View>
            </View>

            <Text style={styles.label}>Phone (optional)</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="0XX XXX XXXX"
              placeholderTextColor={theme.textTertiary}
              keyboardType="phone-pad"
            />

            {!isPreschool && (
              <>
                <Text style={styles.label}>Subject Specialization (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={specialization}
                  onChangeText={setSpecialization}
                  placeholder="e.g. Mathematics, Life Skills"
                  placeholderTextColor={theme.textTertiary}
                />
              </>
            )}

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional info..."
              placeholderTextColor={theme.textTertiary}
              multiline
              numberOfLines={3}
            />

            {/* Info box */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={18} color={theme.primary} />
              <Text style={styles.infoText}>
                A temporary password is generated only when needed.
                Teachers with existing Google sign-in can continue using Google.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, !isValid && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={!isValid || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add" size={18} color="#fff" />
                  <Text style={styles.submitText}>Create Account</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default CreateTeacherModal;
