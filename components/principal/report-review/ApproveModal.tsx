// Modal for approving a report with signature

import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, StyleSheet } from 'react-native';
import { SignatureDisplay } from '@/components/progress-report/SignatureDisplay';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface ApproveModalProps {
  visible: boolean;
  principalSignature: string;
  principalName: string;
  approvalNotes: string;
  isApproving: boolean;
  onOpenSignaturePad: () => void;
  onChangeNotes: (notes: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  theme: any;
}

export function ApproveModal({
  visible,
  principalSignature,
  principalName,
  approvalNotes,
  isApproving,
  onOpenSignaturePad,
  onChangeNotes,
  onConfirm,
  onClose,
  theme,
}: ApproveModalProps) {
  const styles = createStyles(theme);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlayModal}>
        <View style={[styles.modalCard, { backgroundColor: theme.cardBackground }]}>
          <Text style={[styles.modalCardTitle, { color: theme.text }]}>Approve Report</Text>

          {principalSignature ? (
            <SignatureDisplay
              signatureData={principalSignature}
              signerName={principalName}
              signerRole="principal"
              signedAt={new Date().toISOString()}
              height={60}
            />
          ) : (
            <TouchableOpacity
              onPress={onOpenSignaturePad}
              style={[styles.signButton, { borderColor: theme.primary }]}
            >
              <Text style={[styles.signButtonText, { color: theme.primary }]}>Add Signature</Text>
            </TouchableOpacity>
          )}

          <TextInput
            style={[styles.textInput, {
              backgroundColor: theme.background,
              color: theme.text,
              borderColor: theme.border,
            }]}
            placeholder="Optional approval notes"
            placeholderTextColor={theme.textSecondary}
            value={approvalNotes}
            onChangeText={onChangeNotes}
            multiline
            numberOfLines={3}
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
              style={[styles.modalButton, styles.confirmButton, { backgroundColor: theme.primary }]}
              disabled={isApproving}
            >
              {isApproving ? (
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
    signButton: {
      height: 48,
      borderRadius: 8,
      borderWidth: 2,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    signButtonText: {
      fontSize: 16,
      fontWeight: '600',
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
