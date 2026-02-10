/**
 * PayrollAdvanceModal — Record and view salary advances
 *
 * ≤400 lines (WARP compliant)
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlertModal, AlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { PayrollService } from '@/services/PayrollService';
import type { PayrollAdvanceRecord, PayrollRosterItem } from '@/types/finance';

interface Props {
  visible: boolean;
  recipient: PayrollRosterItem | null;
  organizationId: string;
  onClose: () => void;
  onDataChanged: () => void;
}

const formatCurrency = (v: number): string => `R${Number(v || 0).toFixed(2)}`;

const formatDate = (d: string): string => {
  try {
    return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

export function PayrollAdvanceModal({ visible, recipient, organizationId, onClose, onDataChanged }: Props) {
  const { theme } = useTheme();
  const { showAlert, alertProps } = useAlertModal();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [advances, setAdvances] = useState<PayrollAdvanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRecordForm, setShowRecordForm] = useState(false);

  // Record form
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  const [advanceNotes, setAdvanceNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAdvances = useCallback(async () => {
    if (!recipient || !organizationId) return;
    setLoading(true);
    try {
      const data = await PayrollService.getAdvances(recipient.payroll_recipient_id, organizationId);
      setAdvances(data);
    } catch (err: any) {
      showAlert({ title: 'Error', message: err?.message || 'Failed to load advances', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [recipient, organizationId, showAlert]);

  useEffect(() => {
    if (visible && recipient) {
      loadAdvances();
    }
  }, [visible, recipient, loadAdvances]);

  const handleRecordAdvance = useCallback(async () => {
    if (!recipient) return;
    const amount = Number(advanceAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showAlert({ title: 'Invalid Amount', message: 'Enter a valid amount.', type: 'warning' });
      return;
    }
    if (!advanceReason.trim()) {
      showAlert({ title: 'Reason Required', message: 'Please provide a reason for the advance.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      await PayrollService.recordAdvance({
        payrollRecipientId: recipient.payroll_recipient_id,
        organizationId,
        amount,
        reason: advanceReason.trim(),
        notes: advanceNotes.trim() || undefined,
      });
      setShowRecordForm(false);
      setAdvanceAmount('');
      setAdvanceReason('');
      setAdvanceNotes('');
      await loadAdvances();
      onDataChanged();
      showAlert({ title: 'Advance Recorded', message: `${formatCurrency(amount)} advance has been recorded.`, type: 'success' });
    } catch (err: any) {
      showAlert({ title: 'Error', message: err?.message || 'Failed to record advance', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [recipient, advanceAmount, advanceReason, advanceNotes, organizationId, loadAdvances, onDataChanged, showAlert]);

  const handleMarkRepaid = useCallback(async (advance: PayrollAdvanceRecord) => {
    setSaving(true);
    try {
      await PayrollService.markAdvanceRepaid(advance.id, advance.amount);
      await loadAdvances();
      onDataChanged();
      showAlert({ title: 'Advance Repaid', message: `${formatCurrency(advance.amount)} marked as repaid.`, type: 'success' });
    } catch (err: any) {
      showAlert({ title: 'Error', message: err?.message || 'Failed to mark advance as repaid', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [loadAdvances, onDataChanged, showAlert]);

  const outstandingTotal = advances.filter(a => !a.repaid).reduce((s, a) => s + a.amount, 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Salary Advances</Text>
                <Text style={styles.subtitle}>{recipient?.display_name}</Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {outstandingTotal > 0 && (
              <View style={styles.outstandingBanner}>
                <Ionicons name="alert-circle" size={16} color="#F59E0B" />
                <Text style={styles.outstandingText}>Outstanding: {formatCurrency(outstandingTotal)}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowRecordForm(!showRecordForm)}
            >
              <Ionicons name={showRecordForm ? 'chevron-up' : 'add-circle'} size={18} color={theme.primary} />
              <Text style={styles.addBtnText}>{showRecordForm ? 'Hide Form' : 'Record Advance'}</Text>
            </TouchableOpacity>

            {showRecordForm && (
              <View style={styles.formBox}>
                <Text style={styles.inputLabel}>Amount (R) *</Text>
                <TextInput
                  style={styles.input}
                  value={advanceAmount}
                  onChangeText={setAdvanceAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                />

                <Text style={styles.inputLabel}>Reason *</Text>
                <TextInput
                  style={[styles.input, { minHeight: 56 }]}
                  value={advanceReason}
                  onChangeText={setAdvanceReason}
                  placeholder="e.g., Emergency loan, transport"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />

                <Text style={styles.inputLabel}>Notes (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={advanceNotes}
                  onChangeText={setAdvanceNotes}
                  placeholder="Additional notes"
                  placeholderTextColor={theme.textSecondary}
                />

                <TouchableOpacity style={styles.submitBtn} onPress={handleRecordAdvance} disabled={saving}>
                  {saving ? <EduDashSpinner size="small" color="#fff" /> : <Text style={styles.submitText}>Record Advance</Text>}
                </TouchableOpacity>
              </View>
            )}

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.center}>
                  <EduDashSpinner size="large" color={theme.primary} />
                </View>
              ) : advances.length === 0 ? (
                <View style={styles.center}>
                  <Ionicons name="cash-outline" size={48} color={theme.textSecondary} />
                  <Text style={styles.emptyText}>No advances on record</Text>
                </View>
              ) : (
                advances.map(adv => (
                  <View key={adv.id} style={[styles.advanceCard, adv.repaid && styles.repaidCard]}>
                    <View style={styles.advRow}>
                      <Text style={styles.advAmount}>{formatCurrency(adv.amount)}</Text>
                      <View style={[styles.badge, adv.repaid ? styles.repaidBadge : styles.pendingBadge]}>
                        <Text style={[styles.badgeText, adv.repaid ? styles.repaidBadgeText : styles.pendingBadgeText]}>
                          {adv.repaid ? 'REPAID' : 'OUTSTANDING'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.meta}>Date: {formatDate(adv.advance_date)}</Text>
                    {adv.reason && <Text style={styles.meta}>Reason: {adv.reason}</Text>}
                    {adv.notes && <Text style={styles.meta}>Notes: {adv.notes}</Text>}
                    {adv.repaid && adv.repaid_at && <Text style={styles.meta}>Repaid: {formatDate(adv.repaid_at)}</Text>}

                    {!adv.repaid && (
                      <TouchableOpacity
                        style={styles.repaidBtn}
                        onPress={() => handleMarkRepaid(adv)}
                        disabled={saving}
                      >
                        <Ionicons name="checkmark-circle-outline" size={14} color={theme.success} />
                        <Text style={[styles.actionText, { color: theme.success }]}>Mark Repaid</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
      <AlertModal {...alertProps} />
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    keyboardAvoid: { flex: 1 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    card: {
      backgroundColor: theme.cardBackground,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 16,
      maxHeight: '85%',
      borderTopWidth: 1,
      borderColor: theme.border,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    title: { fontSize: 18, fontWeight: '800', color: theme.text },
    subtitle: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
    outstandingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#F59E0B' + '18',
      borderWidth: 1,
      borderColor: '#F59E0B' + '40',
      borderRadius: 10,
      padding: 10,
      marginBottom: 10,
    },
    outstandingText: { fontSize: 14, fontWeight: '700', color: theme.text },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      marginBottom: 4,
    },
    addBtnText: { fontSize: 14, fontWeight: '700', color: theme.primary },
    formBox: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      backgroundColor: theme.surface,
    },
    inputLabel: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginTop: 8 },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      backgroundColor: theme.cardBackground,
      fontSize: 14,
      marginTop: 4,
    },
    submitBtn: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 12,
    },
    submitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    scroll: { flexShrink: 1, marginTop: 8 },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyText: { color: theme.textSecondary, marginTop: 12, fontSize: 14 },
    advanceCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      backgroundColor: theme.surface,
    },
    repaidCard: { opacity: 0.65 },
    advRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    advAmount: { fontSize: 16, fontWeight: '700', color: theme.text },
    badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    pendingBadge: { backgroundColor: '#F59E0B' + '20' },
    repaidBadge: { backgroundColor: '#22C55E' + '20' },
    badgeText: { fontSize: 10, fontWeight: '700' },
    pendingBadgeText: { color: '#F59E0B' },
    repaidBadgeText: { color: '#22C55E' },
    meta: { fontSize: 12, color: theme.textSecondary, marginTop: 3 },
    repaidBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
    actionText: { fontSize: 13, fontWeight: '600' },
  });
