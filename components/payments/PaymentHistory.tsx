import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StudentFee } from '@/types/payments';
import { formatCurrency, formatPaymentDate } from '@/lib/utils/payment-utils';

interface PaymentHistoryListProps {
  paidFees: StudentFee[];
  theme: any;
}

export function PaymentHistoryList({ paidFees, theme }: PaymentHistoryListProps) {
  const styles = createStyles(theme);

  if (paidFees.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="receipt-outline" size={48} color={theme.textSecondary} />
        <Text style={styles.emptyTitle}>No Payment History</Text>
        <Text style={styles.emptySubtitle}>
          Your payment history will appear here once payments are confirmed.
        </Text>
      </View>
    );
  }

  return (
    <>
      {paidFees.map(fee => (
        <View key={fee.id} style={styles.historyCard}>
          <View style={styles.historyRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyTitle}>{fee.description}</Text>
              <Text style={styles.historyDate}>
                Paid: {formatPaymentDate(fee.paid_date || fee.due_date)}
              </Text>
            </View>
            <Text style={styles.historyAmount}>{formatCurrency(fee.amount)}</Text>
          </View>
          <View style={styles.paidBadgeSmall}>
            <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
            <Text style={styles.paidBadgeText}>Paid</Text>
          </View>
        </View>
      ))}
    </>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.text, marginTop: 12, marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
  historyCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  historyTitle: { fontSize: 14, fontWeight: '500', color: theme.text, marginBottom: 2 },
  historyDate: { fontSize: 12, color: theme.textSecondary },
  historyAmount: { fontSize: 16, fontWeight: '600', color: theme.text },
  paidBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  paidBadgeText: { fontSize: 11, color: '#22c55e', fontWeight: '600' },
});
