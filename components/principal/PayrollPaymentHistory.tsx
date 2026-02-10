/**
 * PayrollPaymentHistory — Shows payment history for a staff member
 * with edit and void capabilities.
 *
 * ≤400 lines (WARP compliant)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlertModal, AlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { PayrollService } from '@/services/PayrollService';
import { createPayrollHistoryStyles } from './PayrollPaymentHistory.styles';
import type { PayrollPaymentRecord, PayrollRosterItem } from '@/types/finance';

interface Props {
  visible: boolean;
  recipient: PayrollRosterItem | null;
  monthIso: string;
  monthLabel: string;
  onClose: () => void;
  onDataChanged: () => void;
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  eft: 'EFT',
  card: 'Card',
  debit_order: 'Debit Order',
  mobile_payment: 'Mobile',
  other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#22C55E',
  edited: '#F59E0B',
  voided: '#EF4444',
};

const formatCurrency = (v: number): string => `R${Number(v || 0).toFixed(2)}`;

const formatDate = (d: string): string => {
  try {
    return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

export function PayrollPaymentHistory({ visible, recipient, monthIso, monthLabel, onClose, onDataChanged }: Props) {
  const { theme } = useTheme();
  const { showAlert, alertProps } = useAlertModal();
  const styles = React.useMemo(() => createPayrollHistoryStyles(theme), [theme]);

  const [payments, setPayments] = useState<PayrollPaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editPayment, setEditPayment] = useState<PayrollPaymentRecord | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editReason, setEditReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Void state
  const [voidPayment, setVoidPayment] = useState<PayrollPaymentRecord | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const loadHistory = useCallback(async () => {
    if (!recipient) return;
    setLoading(true);
    try {
      const data = await PayrollService.getPaymentHistory(recipient.payroll_recipient_id, monthIso);
      setPayments(data);
    } catch (err: any) {
      showAlert({ title: 'Error', message: err?.message || 'Failed to load payment history', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [recipient, monthIso, showAlert]);

  useEffect(() => {
    if (visible && recipient) {
      loadHistory();
    }
  }, [visible, recipient, loadHistory]);

  const handleEditSubmit = useCallback(async () => {
    if (!editPayment) return;
    const amount = Number(editAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showAlert({ title: 'Invalid Amount', message: 'Enter a valid payment amount.', type: 'warning' });
      return;
    }
    if (!editReason.trim()) {
      showAlert({ title: 'Reason Required', message: 'Please provide a reason for editing.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      await PayrollService.editPayment({
        paymentId: editPayment.id,
        newAmount: amount,
        reason: editReason.trim(),
      });
      setEditPayment(null);
      setEditAmount('');
      setEditReason('');
      await loadHistory();
      onDataChanged();
      showAlert({ title: 'Payment Updated', message: `Amount changed to ${formatCurrency(amount)}.`, type: 'success' });
    } catch (err: any) {
      showAlert({ title: 'Edit Failed', message: err?.message || 'Failed to edit payment', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [editPayment, editAmount, editReason, loadHistory, onDataChanged, showAlert]);

  const handleVoidSubmit = useCallback(async () => {
    if (!voidPayment) return;
    if (!voidReason.trim()) {
      showAlert({ title: 'Reason Required', message: 'Please provide a reason for voiding.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      await PayrollService.voidPayment({
        paymentId: voidPayment.id,
        reason: voidReason.trim(),
      });
      setVoidPayment(null);
      setVoidReason('');
      await loadHistory();
      onDataChanged();
      showAlert({ title: 'Payment Voided', message: `${formatCurrency(voidPayment.amount)} has been voided.`, type: 'success' });
    } catch (err: any) {
      showAlert({ title: 'Void Failed', message: err?.message || 'Failed to void payment', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [voidPayment, voidReason, loadHistory, onDataChanged, showAlert]);

  const activePayments = payments.filter(p => p.status !== 'voided');
  const totalActive = activePayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Payment History</Text>
                <Text style={styles.subtitle}>{recipient?.display_name} — {monthLabel}</Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Active Total:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totalActive)}</Text>
              <Text style={styles.summaryCount}>{activePayments.length} payment{activePayments.length !== 1 ? 's' : ''}</Text>
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.center}>
                  <EduDashSpinner size="large" color={theme.primary} />
                </View>
              ) : payments.length === 0 ? (
                <View style={styles.center}>
                  <Ionicons name="receipt-outline" size={48} color={theme.textSecondary} />
                  <Text style={styles.emptyText}>No payments recorded this month</Text>
                </View>
              ) : (
                payments.map(payment => (
                  <View key={payment.id} style={[styles.paymentCard, payment.status === 'voided' && styles.voidedCard]}>
                    <View style={styles.paymentHeader}>
                      <Text style={[styles.paymentAmount, payment.status === 'voided' && styles.voidedText]}>
                        {formatCurrency(payment.amount)}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[payment.status] || '#64748B') + '20' }]}>
                        <Text style={[styles.statusText, { color: STATUS_COLORS[payment.status] || '#64748B' }]}>
                          {payment.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.paymentMeta}>
                      {METHOD_LABELS[payment.payment_method] || payment.payment_method}
                      {payment.payment_reference ? ` • Ref: ${payment.payment_reference}` : ''}
                    </Text>
                    <Text style={styles.paymentMeta}>Recorded: {formatDate(payment.created_at)}</Text>

                    {payment.original_amount != null && payment.status === 'edited' && (
                      <Text style={styles.editNote}>
                        Originally {formatCurrency(payment.original_amount)} — {payment.edit_reason || 'Edited'}
                      </Text>
                    )}

                    {payment.status === 'voided' && (
                      <Text style={styles.voidNote}>Void reason: {payment.void_reason || 'N/A'}</Text>
                    )}

                    {payment.notes && <Text style={styles.paymentMeta}>Notes: {payment.notes}</Text>}

                    {payment.status !== 'voided' && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => {
                            setEditPayment(payment);
                            setEditAmount(payment.amount.toFixed(2));
                            setEditReason('');
                          }}
                        >
                          <Ionicons name="create-outline" size={14} color={theme.primary} />
                          <Text style={[styles.actionText, { color: theme.primary }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.voidBtn}
                          onPress={() => {
                            setVoidPayment(payment);
                            setVoidReason('');
                          }}
                        >
                          <Ionicons name="close-circle-outline" size={14} color={theme.error} />
                          <Text style={[styles.actionText, { color: theme.error }]}>Void</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>

        {/* Edit Payment Inline Modal */}
        {editPayment && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setEditPayment(null)}>
            <View style={styles.overlay}>
              <View style={styles.innerModal}>
                <Text style={styles.title}>Edit Payment</Text>
                <Text style={styles.subtitle}>Current: {formatCurrency(editPayment.amount)}</Text>

                <Text style={styles.inputLabel}>New Amount (R) *</Text>
                <TextInput
                  style={styles.input}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                />

                <Text style={styles.inputLabel}>Reason for Change *</Text>
                <TextInput
                  style={[styles.input, { minHeight: 64 }]}
                  value={editReason}
                  onChangeText={setEditReason}
                  placeholder="e.g., Typed wrong amount"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />

                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditPayment(null)} disabled={saving}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleEditSubmit} disabled={saving}>
                    {saving ? <EduDashSpinner size="small" color="#fff" /> : <Text style={styles.confirmText}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Void Payment Inline Modal */}
        {voidPayment && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setVoidPayment(null)}>
            <View style={styles.overlay}>
              <View style={styles.innerModal}>
                <Text style={styles.title}>Void Payment</Text>
                <Text style={styles.subtitle}>Amount: {formatCurrency(voidPayment.amount)}</Text>
                <Text style={[styles.subtitle, { color: theme.error }]}>This action cannot be undone.</Text>

                <Text style={styles.inputLabel}>Reason for Voiding *</Text>
                <TextInput
                  style={[styles.input, { minHeight: 64 }]}
                  value={voidReason}
                  onChangeText={setVoidReason}
                  placeholder="e.g., Duplicate entry, wrong staff member"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />

                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setVoidPayment(null)} disabled={saving}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.error }]} onPress={handleVoidSubmit} disabled={saving}>
                    {saving ? <EduDashSpinner size="small" color="#fff" /> : <Text style={styles.confirmText}>Void Payment</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </KeyboardAvoidingView>
      <AlertModal {...alertProps} />
    </Modal>
  );
}

