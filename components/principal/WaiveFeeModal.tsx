/**
 * Waive Fee Modal — allows full or partial fee waivers with reason.
 */

import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import type { StudentFee } from '@/hooks/student-fees/types';
import { formatCurrency } from '@/hooks/student-fees/feeHelpers';

interface WaiveFeeModalProps {
  visible: boolean;
  fee: StudentFee | null;
  saving: boolean;
  waiveType: 'full' | 'partial';
  waiveAmount: string;
  waiveReason: string;
  onChangeType: (v: 'full' | 'partial') => void;
  onChangeAmount: (v: string) => void;
  onChangeReason: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  styles: any;
}

export function WaiveFeeModal({
  visible, fee, saving, waiveType, waiveAmount, waiveReason,
  onChangeType, onChangeAmount, onChangeReason, onSubmit, onClose, styles,
}: WaiveFeeModalProps) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Waive Fee</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {fee && (
            <>
              <Text style={styles.modalSubtitle}>
                Current Amount: {formatCurrency(fee.final_amount)}
              </Text>

              <View style={styles.waiveTypeRow}>
                {(['full', 'partial'] as const).map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.waiveTypeButton, waiveType === type && styles.waiveTypeButtonActive]}
                    onPress={() => onChangeType(type)}
                  >
                    <Text style={[styles.waiveTypeText, waiveType === type && styles.waiveTypeTextActive]}>
                      {type === 'full' ? 'Full Waiver' : 'Partial Waiver'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {waiveType === 'partial' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount to Waive (R)</Text>
                  <TextInput
                    style={styles.input}
                    value={waiveAmount}
                    onChangeText={onChangeAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reason for Waiver *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={waiveReason}
                  onChangeText={onChangeReason}
                  placeholder="e.g., Financial hardship, Scholarship recipient"
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
                  <Text style={styles.submitButtonText}>
                    Waive {waiveType === 'full' ? 'Full Amount' : 'Partial Amount'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
