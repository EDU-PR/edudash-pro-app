// Modal for rejecting a report with reason

import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, StyleSheet } from 'react-native';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface RejectModalProps {
  visible: boolean;
  rejectionReason: string;
  approvalNotes: string;
  isRejecting: boolean;
  onChangeReason: (reason: string) => void;
  onChangeNotes: (notes: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  theme: any;
}

export function RejectModal({
  visible,
  rejectionReason,
  approvalNotes,
  isRejecting,
  onChangeReason,
  onChangeNotes,
  onConfirm,
  onClose,
  theme,
}: RejectModalProps) {
  const styles = createStyles(theme);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlayModal}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.modalCardTitle, { color: theme.text }]}>Reject Report</Text>

          <TextInput
            style={[styles.textInput, {
              backgroundColor: theme.background,
              color: theme.text,
              borderColor: theme.border,
            }]}
            placeholder="Rejection reason (required, min 10 characters)"
            placeholderTextColor={theme.textSecondary}
            value={rejectionReason}
            onChangeText={onChangeReason}
            multiline
            numberOfLines={4}
          />

          <TextInput
            style={[styles.textInput, {
              backgroundColor: theme.background,
              color: theme.text,
              borderColor: theme.border,
            }]}
            placeholder="Optional notes"
            placeholderTextColor={theme.textSecondary}
            value={approvalNotes}
            onChangeText={onChangeNotes}
            multiline
            numberOfLines={2}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.modalButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={[styles.modalButton, styles.confirmButton, { backgroundColor: theme.error }]}
              disabled={isRejecting}
            >
              {isRejecting ? (
                <EduDashSpinner color="#FFFFFF" />
              ) : (
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    overlayModal: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCard: {
      width: '90%',
      maxWidth: 400,
      borderRadius: 12,
      padding: 20,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    modalCardTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
    },
    textInput: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      fontSize: 14,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    modalButton: {
      flex: 1,
      height: 44,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
    },
    confirmButton: {
      borderWidth: 0,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
  });
