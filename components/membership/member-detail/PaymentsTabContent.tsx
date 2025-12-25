/**
 * Payments Tab Content Component
 * Payment history and summary
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PaymentsTabProps } from './types';

export function PaymentsTabContent({ payments, theme }: PaymentsTabProps) {
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (amount: number): string => {
    return `R ${amount.toLocaleString('en-ZA')}`;
  };

  const totalPaid = payments.reduce((sum, p) => sum + (p.status === 'paid' ? p.amount : 0), 0);
  const paidCount = payments.filter(p => p.status === 'paid').length;

  return (
    <View>
      {/* Summary */}
      <View style={[styles.paymentSummary, { backgroundColor: theme.card }]}>
        <View style={styles.paymentSummaryItem}>
          <Text style={[styles.paymentSummaryValue, { color: '#10B981' }]}>
            {formatCurrency(totalPaid)}
          </Text>
          <Text style={[styles.paymentSummaryLabel, { color: theme.textSecondary }]}>Total Paid</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
        <View style={styles.paymentSummaryItem}>
          <Text style={[styles.paymentSummaryValue, { color: theme.text }]}>
            {paidCount}
          </Text>
          <Text style={[styles.paymentSummaryLabel, { color: theme.textSecondary }]}>Payments</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
        <View style={styles.paymentSummaryItem}>
          <Text style={[styles.paymentSummaryValue, { color: theme.text }]}>R0</Text>
          <Text style={[styles.paymentSummaryLabel, { color: theme.textSecondary }]}>Outstanding</Text>
        </View>
      </View>

      {/* Payment History */}
      {payments.map((payment) => (
        <View key={payment.id} style={[styles.paymentCard, { backgroundColor: theme.card }]}>
          <View style={[styles.paymentIcon, { backgroundColor: '#10B98120' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          </View>
          <View style={styles.paymentInfo}>
            <Text style={[styles.paymentType, { color: theme.text }]}>{payment.type}</Text>
            <Text style={[styles.paymentRef, { color: theme.textSecondary }]}>
              {payment.reference} • {formatDate(payment.date)}
            </Text>
          </View>
          <Text style={[styles.paymentAmount, { color: '#10B981' }]}>
            {formatCurrency(payment.amount)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  paymentSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderRadius: 14,
    marginBottom: 16,
  },
  paymentSummaryItem: {
    alignItems: 'center',
  },
  paymentSummaryValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  paymentSummaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    gap: 12,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentType: {
    fontSize: 15,
    fontWeight: '600',
  },
  paymentRef: {
    fontSize: 12,
    marginTop: 2,
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
});
