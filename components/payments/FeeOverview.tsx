import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PaymentChild, StudentFee } from '@/types/payments';
import { formatCurrency, formatPaymentDate } from '@/lib/utils/payment-utils';

interface BalanceCardProps {
  outstandingBalance: number;
  upcomingFeesCount: number;
  theme: any;
}

export function BalanceCard({ outstandingBalance, upcomingFeesCount, theme }: BalanceCardProps) {
  const styles = createStyles(theme);

  return (
    <View style={styles.balanceCard}>
      <View style={styles.balanceHeader}>
        <Text style={styles.balanceLabel}>Outstanding Balance</Text>
        <Ionicons name="wallet-outline" size={24} color={theme.primary} />
      </View>
      <Text style={[styles.balanceAmount, outstandingBalance > 0 && styles.balanceAmountRed]}>
        {formatCurrency(outstandingBalance)}
      </Text>
      {upcomingFeesCount > 0 && (
        <Text style={styles.balanceSubtext}>
          {upcomingFeesCount} payment{upcomingFeesCount !== 1 ? 's' : ''} pending
        </Text>
      )}
      {upcomingFeesCount > 0 && (
        <View style={styles.dueSoonBadge}>
          <Text style={styles.dueSoonText}>Due Soon</Text>
        </View>
      )}
    </View>
  );
}

interface NextPaymentCardProps {
  upcomingFees: StudentFee[];
  theme: any;
}

export function NextPaymentCard({ upcomingFees, theme }: NextPaymentCardProps) {
  if (upcomingFees.length === 0) return null;
  
  const styles = createStyles(theme);
  const nextFee = upcomingFees[0];

  return (
    <View style={styles.nextPaymentCard}>
      <View style={styles.nextPaymentHeader}>
        <Text style={styles.nextPaymentLabel}>Next Payment Due</Text>
        <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
      </View>
      <Text style={styles.nextPaymentDate}>{formatPaymentDate(nextFee.due_date)}</Text>
      <Text style={styles.nextPaymentType}>{nextFee.description}</Text>
    </View>
  );
}

interface RegistrationCardProps {
  child: PaymentChild;
  theme: any;
}

export function RegistrationCard({ child, theme }: RegistrationCardProps) {
  const styles = createStyles(theme);

  return (
    <View style={styles.registrationCard}>
      <View style={styles.registrationHeader}>
        <Text style={styles.registrationLabel}>Registration Fee</Text>
        <Ionicons name="receipt-outline" size={20} color={theme.textSecondary} />
      </View>
      <Text style={styles.registrationAmount}>
        {formatCurrency(child.registration_fee_amount || 0)}
      </Text>
      {child.registration_fee_paid ? (
        <View style={styles.paidBadge}>
          <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
          <Text style={styles.paidText}>Paid & Verified</Text>
        </View>
      ) : (
        <View style={styles.unpaidBadge}>
          <Ionicons name="time-outline" size={14} color="#fbbf24" />
          <Text style={styles.unpaidText}>Pending</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  balanceCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: { fontSize: 14, color: theme.textSecondary },
  balanceAmount: { fontSize: 32, fontWeight: '700', color: '#22c55e', marginBottom: 4 },
  balanceAmountRed: { color: '#ef4444' },
  balanceSubtext: { fontSize: 12, color: theme.textSecondary },
  dueSoonBadge: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dueSoonText: { fontSize: 12, color: '#22c55e', fontWeight: '600' },
  nextPaymentCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  nextPaymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nextPaymentLabel: { fontSize: 12, color: theme.textSecondary },
  nextPaymentDate: { fontSize: 24, fontWeight: '700', color: theme.text, marginBottom: 2 },
  nextPaymentType: { fontSize: 12, color: theme.textSecondary },
  registrationCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  registrationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  registrationLabel: { fontSize: 12, color: theme.textSecondary },
  registrationAmount: { fontSize: 24, fontWeight: '700', color: theme.text, marginBottom: 8 },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paidText: { fontSize: 12, color: '#22c55e', fontWeight: '500' },
  unpaidBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  unpaidText: { fontSize: 12, color: '#fbbf24', fontWeight: '500' },
});
