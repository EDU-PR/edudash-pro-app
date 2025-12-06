/**
 * PettyCashSummary Component
 * 
 * Displays the balance summary card for petty cash
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { formatCurrency, type PettyCashSummary as SummaryType } from '@/hooks/usePettyCash';

interface Props {
  summary: SummaryType;
  theme?: any;
}

export function PettyCashSummaryCard({ summary, theme }: Props) {
  const { t } = useTranslation('common');
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>{t('petty_cash.current_balance')}</Text>
      <Text style={[
        styles.currentBalance,
        { color: summary.current_balance < 1000 ? '#EF4444' : '#10B981' }
      ]}>
        {formatCurrency(summary.current_balance)}
      </Text>
      
      {summary.current_balance < 1000 && (
        <View style={styles.lowBalanceWarning}>
          <Ionicons name="warning" size={16} color="#F59E0B" />
          <Text style={styles.warningText}>
            {t('petty_cash.low_balance_warning', 'Low balance - consider replenishment')}
          </Text>
        </View>
      )}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {formatCurrency(summary.total_expenses)}
          </Text>
          <Text style={styles.summaryLabel}>{t('petty_cash.total_expenses')}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {formatCurrency(summary.pending_approval)}
          </Text>
          <Text style={styles.summaryLabel}>{t('petty_cash.pending_approval')}</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  summaryCard: {
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
  summaryTitle: {
    fontSize: 16,
    color: theme?.textSecondary || '#6B7280',
    marginBottom: 8,
  },
  currentBalance: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
  },
  lowBalanceWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme?.warningLight || '#FEF3C7',
    padding: 8,
    borderRadius: 6,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 12,
    color: theme?.warning || '#92400E',
    marginLeft: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '600',
    color: theme?.text || '#333',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme?.textSecondary || '#6B7280',
  },
});

export default PettyCashSummaryCard;
