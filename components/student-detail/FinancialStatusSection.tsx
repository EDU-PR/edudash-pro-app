/**
 * Financial Status Section Component
 * Shows outstanding fees, payment status, and transaction history
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StudentDetail, Transaction, formatCurrency } from './types';

interface FinancialStatusSectionProps {
  student: StudentDetail;
  transactions: Transaction[];
  showDetails: boolean;
  onToggleDetails: () => void;
  theme: any;
}

export const FinancialStatusSection: React.FC<FinancialStatusSectionProps> = ({
  student,
  transactions,
  showDetails,
  onToggleDetails,
  theme,
}) => {
  const styles = createStyles(theme);

  return (
    <View style={styles.section}>
      <TouchableOpacity 
        style={styles.sectionHeader}
        onPress={onToggleDetails}
      >
        <Text style={styles.sectionTitle}>Financial Status</Text>
        <Ionicons 
          name={showDetails ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color={theme.primary} 
        />
      </TouchableOpacity>
      
      <View style={styles.financialCard}>
        <View style={styles.feeInfo}>
          <Text style={styles.feeLabel}>Outstanding Fees</Text>
          <Text style={[
            styles.feeAmount,
            { color: (student.outstanding_fees || 0) > 0 ? '#EF4444' : '#10B981' }
          ]}>
            {formatCurrency(student.outstanding_fees || 0)}
          </Text>
        </View>
        <View style={[
          styles.paymentStatus,
          { backgroundColor: student.payment_status === 'current' ? '#10B981' : '#EF4444' }
        ]}>
          <Text style={styles.paymentStatusText}>
            {student.payment_status === 'current' ? 'Up to Date' : 'Overdue'}
          </Text>
        </View>
      </View>

      {/* Transaction History (Expandable) */}
      {showDetails && (
        <View style={styles.transactionHistory}>
          <Text style={styles.transactionHistoryTitle}>Recent Transactions</Text>
          {transactions.length > 0 ? (
            transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionItem}>
                <View style={styles.transactionLeft}>
                  <Text style={styles.transactionType}>{transaction.type.replace('_', ' ')}</Text>
                  <Text style={styles.transactionDate}>
                    {new Date(transaction.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[
                  styles.transactionAmount,
                  { color: transaction.type.includes('payment') ? '#10B981' : '#EF4444' }
                ]}>
                  {transaction.type.includes('payment') ? '+' : '-'}
                  {formatCurrency(Math.abs(transaction.amount))}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noTransactions}>No transaction history</Text>
          )}
        </View>
      )}
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  section: {
    margin: 16,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: theme.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  financialCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeInfo: {
    flex: 1,
  },
  feeLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  feeAmount: {
    fontSize: 18,
    fontWeight: '600',
  },
  paymentStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  paymentStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  transactionHistory: {
    marginTop: 16,
    padding: 12,
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  transactionHistoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  transactionLeft: {
    flex: 1,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.text,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  noTransactions: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    padding: 16,
    fontStyle: 'italic',
  },
});
