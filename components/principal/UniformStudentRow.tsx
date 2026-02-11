import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UniformEntry } from '@/hooks/useUniformRegister';

interface Props {
  entry: UniformEntry;
  onVerifyPayment: (studentId: string) => void;
  processing: boolean;
}

const STATUS_CONFIG = {
  paid: { icon: 'checkmark-circle' as const, color: '#16a34a', label: 'PAID' },
  partial: { icon: 'time' as const, color: '#d97706', label: 'PARTIAL' },
  unpaid: { icon: 'close-circle' as const, color: '#dc2626', label: 'UNPAID' },
};

export default function UniformStudentRow({ entry, onVerifyPayment, processing }: Props) {
  const status = STATUS_CONFIG[entry.payment_status];
  const outstanding = Math.max(0, entry.total_amount - entry.amount_paid);

  const handleCallParent = () => {
    if (entry.parent_phone) Linking.openURL(`tel:${entry.parent_phone}`);
  };

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.studentName}>{entry.student_name}</Text>
          {entry.parent_name && (
            <Text style={styles.parentName}>👤 {entry.parent_name}</Text>
          )}
          {entry.parent_phone && (
            <TouchableOpacity onPress={handleCallParent}>
              <Text style={styles.phone}>📞 {entry.parent_phone}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status badge */}
        <View style={[styles.badge, { backgroundColor: status.color + '18' }]}>
          <Ionicons name={status.icon} size={16} color={status.color} />
          <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Details row */}
      <View style={styles.detailRow}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Form</Text>
          <Text style={[styles.detailValue, { color: entry.filled_out ? '#16a34a' : '#dc2626' }]}>
            {entry.filled_out ? '✅ Filled' : '❌ Pending'}
          </Text>
          {entry.filled_out_at && (
            <Text style={styles.dateText}>
              {new Date(entry.filled_out_at).toLocaleDateString('en-ZA')}
            </Text>
          )}
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Total</Text>
          <Text style={styles.detailValue}>R{entry.total_amount.toFixed(2)}</Text>
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Paid</Text>
          <Text style={[styles.detailValue, { color: '#059669' }]}>R{entry.amount_paid.toFixed(2)}</Text>
        </View>

        {outstanding > 0 && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Owing</Text>
            <Text style={[styles.detailValue, { color: '#dc2626' }]}>R{outstanding.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* POP indicator */}
      {entry.proof_of_payment_url && (
        <View style={styles.popRow}>
          <Ionicons name="document-attach-outline" size={14} color="#6b7280" />
          <Text style={styles.popText}>Proof of payment uploaded</Text>
          {entry.payment_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
      )}

      {/* Verify button (only if not fully verified + paid) */}
      {entry.payment_status !== 'paid' && entry.amount_paid > 0 && !entry.payment_verified && (
        <TouchableOpacity
          style={[styles.verifyBtn, processing && { opacity: 0.5 }]}
          onPress={() => onVerifyPayment(entry.student_id)}
          disabled={processing}
        >
          <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
          <Text style={styles.verifyBtnText}>Verify Payment</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  studentName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  parentName: { fontSize: 13, color: '#4b5563', marginTop: 2 },
  phone: { fontSize: 12, color: '#1e40af', marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  detailItem: { minWidth: 60 },
  detailLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 1 },
  dateText: { fontSize: 10, color: '#9ca3af', marginTop: 1 },
  popRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  popText: { fontSize: 12, color: '#6b7280', flex: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  verifiedText: { fontSize: 11, color: '#16a34a', fontWeight: '600' },
  verifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#1e40af', borderRadius: 8, paddingVertical: 10, marginTop: 10,
  },
  verifyBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
