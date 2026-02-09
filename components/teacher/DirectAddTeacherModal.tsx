import React from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@/contexts/ThemeContext';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

interface DirectAddTeacherModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: () => void;
  loading?: boolean;
  name: string;
  email: string;
  phone: string;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  styles: any;
  theme: ThemeColors;
}

export function DirectAddTeacherModal({
  visible, onClose, onSubmit, loading,
  name, email, phone,
  onNameChange, onEmailChange, onPhoneChange,
  styles, theme,
}: DirectAddTeacherModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.modalKeyboardAvoider}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.modalContent, { backgroundColor: theme?.card || 'white' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme?.text }]}>Add Teacher Directly</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color={theme?.textSecondary || '#6b7280'} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.modalSubtitle, { color: theme?.textSecondary }]}>
                Add a teacher to your school directly. They can link their account later.
              </Text>
              <TextInput
                style={[styles.modalInput, {
                  backgroundColor: theme?.surfaceVariant || '#f9fafb',
                  color: theme?.text,
                  borderColor: theme?.border || '#e5e7eb',
                }]}
                placeholder="Full name *"
                placeholderTextColor={theme?.textSecondary || '#9ca3af'}
                value={name}
                onChangeText={onNameChange}
              />
              <TextInput
                style={[styles.modalInput, {
                  backgroundColor: theme?.surfaceVariant || '#f9fafb',
                  color: theme?.text,
                  borderColor: theme?.border || '#e5e7eb',
                }]}
                placeholder="Email (optional)"
                placeholderTextColor={theme?.textSecondary || '#9ca3af'}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={onEmailChange}
              />
              <TextInput
                style={[styles.modalInput, {
                  backgroundColor: theme?.surfaceVariant || '#f9fafb',
                  color: theme?.text,
                  borderColor: theme?.border || '#e5e7eb',
                }]}
                placeholder="Phone (optional)"
                placeholderTextColor={theme?.textSecondary || '#9ca3af'}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={onPhoneChange}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onClose}>
                  <Text style={[styles.btnSecondaryText, { color: theme?.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, !name.trim() && styles.btnDisabled]}
                  onPress={onSubmit}
                  disabled={!name.trim() || loading}
                >
                  {loading ? (
                    <EduDashSpinner size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={16} color="white" />
                      <Text style={styles.btnPrimaryText}>Add Teacher</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
