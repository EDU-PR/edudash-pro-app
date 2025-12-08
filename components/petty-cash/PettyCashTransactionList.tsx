/**
 * PettyCashTransactionList Component
 * 
 * Displays filtered transaction list with category and date filters
 */

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { 
  type PettyCashTransaction, 
  EXPENSE_CATEGORIES,
  formatCurrency, 
  getStatusColor, 
  getCategoryIcon 
} from '@/hooks/usePettyCash';

interface Props {
  transactions: PettyCashTransaction[];
  onViewReceipts: (transactionId: string) => void;
  onAttachReceipt: (transactionId: string) => void;
  onCancelTransaction: (transactionId: string) => void;
  onReverseTransaction: (transaction: PettyCashTransaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  canDelete: () => Promise<boolean>;
  theme?: any;
}

type DateRange = '7d' | '30d' | 'all' | 'custom';

export function PettyCashTransactionList({
  transactions,
  onViewReceipts,
  onAttachReceipt,
  onCancelTransaction,
  onReverseTransaction,
  onDeleteTransaction,
  canDelete,
  theme,
}: Props) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedRange, setSelectedRange] = useState<DateRange>('30d');

  const filteredTransactions = useMemo(() => {
    let list = transactions;

    if (selectedCategory !== 'All') {
      list = list.filter(tx => tx.category === selectedCategory);
    }

    if (selectedRange === '7d' || selectedRange === '30d') {
      const now = Date.now();
      const cutoff = selectedRange === '7d' 
        ? now - 7 * 24 * 60 * 60 * 1000 
        : now - 30 * 24 * 60 * 60 * 1000;
      list = list.filter(tx => new Date(tx.created_at).getTime() >= cutoff);
    }

    return list;
  }, [transactions, selectedCategory, selectedRange]);

  const handleTransactionOptions = async (transaction: PettyCashTransaction) => {
    const options: any[] = [];
    
    options.push({ 
      text: t('receipt.view_receipts', { defaultValue: 'View Receipts' }), 
      onPress: () => onViewReceipts(transaction.id) 
    });
    options.push({ 
      text: t('receipt.attach_receipt', { defaultValue: 'Attach Receipt' }), 
      onPress: () => onAttachReceipt(transaction.id) 
    });
    
    if (transaction.status === 'pending') {
      options.push({ 
        text: t('petty_cash.cancel', { defaultValue: 'Cancel' }) + ' (reject)', 
        onPress: () => onCancelTransaction(transaction.id) 
      });
    }
    
    options.push({ 
      text: 'Reverse', 
      onPress: () => onReverseTransaction(transaction) 
    });

    const allowDelete = await canDelete();
    if (allowDelete) {
      options.push({ 
        text: t('common.delete', { defaultValue: 'Delete' }), 
        style: 'destructive', 
        onPress: () => onDeleteTransaction(transaction.id) 
      });
    }

    options.push({ text: t('common.close', { defaultValue: 'Close' }), style: 'cancel' });

    Alert.alert(
      t('transaction.options', { defaultValue: 'Transaction Options' }), 
      t('transaction.choose_action', { defaultValue: 'Choose an action' }), 
      options, 
      { cancelable: true }
    );
  };

  const allCategories = ['All', ...EXPENSE_CATEGORIES, 'Replenishment', 'Withdrawal/Adjustment'];
  const dateRanges = [
    { key: '7d' as DateRange, label: t('common.last_7_days', { defaultValue: 'Last 7 days' }) },
    { key: '30d' as DateRange, label: t('common.last_30_days', { defaultValue: 'Last 30 days' }) },
    { key: 'all' as DateRange, label: t('common.all_time', { defaultValue: 'All time' }) },
  ];

  return (
    <View style={styles.transactionsCard}>
      <View style={styles.transactionsHeader}>
        <Text style={styles.transactionsTitle}>{t('petty_cash.recent_transactions')}</Text>
        <TouchableOpacity onPress={() => router.push('/screens/financial-transactions')}>
          <Text style={styles.viewAllText}>{t('petty_cash.view_all')}</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {allCategories.map(cat => (
          <TouchableOpacity
            key={cat}
            onPress={() => setSelectedCategory(cat)}
            style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, selectedCategory === cat && styles.filterChipTextActive]}>
              {cat === 'All' ? t('common.all', { defaultValue: 'All' }) :
               cat === 'Replenishment' ? t('petty_cash.replenishment') :
               cat === 'Withdrawal/Adjustment' ? t('petty_cash.withdrawal_adjustment', { defaultValue: 'Withdrawal/Adjustment' }) : cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Date Range Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {dateRanges.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setSelectedRange(key)}
            style={[styles.filterChip, selectedRange === key && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, selectedRange === key && styles.filterChipTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Transaction List */}
      {filteredTransactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>{t('petty_cash.no_transactions_yet')}</Text>
          <Text style={styles.emptySubtitle}>{t('petty_cash.add_first_expense')}</Text>
        </View>
      ) : (
        filteredTransactions.slice(0, 10).map((transaction) => (
          <View key={transaction.id} style={styles.transactionItem}>
            <View style={styles.transactionLeft}>
              <Ionicons
                name={getCategoryIcon(transaction.category) as any}
                size={20}
                color={(transaction.type === 'expense' || transaction.type === 'adjustment') ? '#EF4444' : '#10B981'}
              />
              <View style={styles.transactionDetails}>
                <Text style={styles.transactionDescription}>{transaction.description}</Text>
                <Text style={styles.transactionCategory}>{transaction.category}</Text>
                <Text style={styles.transactionDate}>
                  {new Date(transaction.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  })}
                </Text>
              </View>
            </View>
            
            <View style={styles.transactionRight}>
              <View style={styles.rightTopRow}>
                <Text style={[
                  styles.transactionAmount,
                  { color: (transaction.type === 'expense' || transaction.type === 'adjustment') ? '#EF4444' : '#10B981' }
                ]}>
                  {(transaction.type === 'expense' || transaction.type === 'adjustment') ? '-' : '+'}
                  {formatCurrency(transaction.amount)}
                </Text>
                <TouchableOpacity
                  style={styles.optionsButton}
                  onPress={() => handleTransactionOptions(transaction)}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color={theme?.textSecondary || '#6B7280'} />
                </TouchableOpacity>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(transaction.status, theme) }]}>
                <Text style={styles.statusText}>{t(`petty_cash.${transaction.status}`)}</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  transactionsCard: {
    margin: 16,
    backgroundColor: theme?.cardBackground || '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: theme?.shadow || '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  transactionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme?.text || '#333',
  },
  viewAllText: {
    color: theme?.primary || '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  filterRow: {
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: theme?.surfaceVariant || '#eef2f7',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: theme?.primary || '#007AFF',
  },
  filterChipText: {
    color: theme?.textSecondary || '#6B7280',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme?.text || '#111827',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme?.textSecondary || '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#f3f4f6',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionDetails: {
    marginLeft: 12,
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: theme?.text || '#333',
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: 12,
    color: theme?.accent || '#8B5CF6',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 11,
    color: theme?.textSecondary || '#6B7280',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  rightTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionsButton: {
    marginLeft: 8,
    padding: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
});

export default PettyCashTransactionList;
