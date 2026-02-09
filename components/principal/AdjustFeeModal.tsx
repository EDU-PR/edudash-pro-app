/**
 * Adjust Fee Modal — update fee amount with reason tracking.
 */

import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import type { StudentFee } from '@/hooks/student-fees/types';
import { formatCurrency } from '@/hooks/student-fees/feeHelpers';

interface AdjustFeeModalProps {
  visible: boolean;
  fee: StudentFee | null;
  saving: boolean;
  adjustAmount: string;
  adjustReason: string;
  onChangeAmount: (v: string) => void;
  onChangeReason: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  styles: any;
}

export function AdjustFeeModal({
  visible, fee, saving, adjustAmount, adjustReason,
  onChangeAmount, onChangeReason, onSubmit, onClose, styles,
}: AdjustFeeModalProps) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Adjust Fee Amount</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {fee && (
            <>
              <Text style={styles.modalSubtitle}>
                Current Amount: {formatCurrency(fee.final_amount)}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Amount (R) *</Text>
                <TextInput
                  style={styles.input}
                  value={adjustAmount}
                  onChangeText={onChangeAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reason for Adjustment *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={adjustReason}
                  onChangeText={onChangeReason}
                  placeholder="e.g., Correction, Age group change, Discount applied"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, saving && styles.submitButtonDisabled]}
                onPress={onSubmit}
                disabled={saving}
              >
                {saving ? (
                  <EduDashSpinner size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Update Fee Amount</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
