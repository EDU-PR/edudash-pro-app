import React from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '@/contexts/ThemeContext';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

interface InviteTeacherModalProps {
  visible: boolean;
  inviteEmail: string;
  setInviteEmail: (email: string) => void;
  onClose: () => void;
  onInvite: () => void;
  inviteLoading: boolean;
  styles: any;
  theme: ThemeColors;
}

export function InviteTeacherModal({
  visible, inviteEmail, setInviteEmail, onClose, onInvite, inviteLoading, styles, theme,
}: InviteTeacherModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme?.card || 'white' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme?.text }]}>Invite Teacher</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme?.textSecondary || '#6b7280'} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalSubtitle, { color: theme?.textSecondary }]}>
            Enter the email address of the teacher you'd like to invite to your school.
          </Text>
          <TextInput
            style={[styles.modalInput, {
              backgroundColor: theme?.surfaceVariant || '#f9fafb',
              color: theme?.text,
              borderColor: theme?.border || '#e5e7eb',
            }]}
            placeholder="teacher@example.com"
            placeholderTextColor={theme?.textSecondary || '#9ca3af'}
            keyboardType="email-address"
            autoCapitalize="none"
            value={inviteEmail}
            onChangeText={setInviteEmail}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onClose}>
              <Text style={[styles.btnSecondaryText, { color: theme?.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, !inviteEmail.includes('@') && styles.btnDisabled]}
              onPress={onInvite}
              disabled={!inviteEmail.includes('@') || inviteLoading}
            >
              {inviteLoading ? (
                <EduDashSpinner size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="white" />
                  <Text style={styles.btnPrimaryText}>Send Invite</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
