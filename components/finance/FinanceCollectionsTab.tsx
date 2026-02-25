import React from 'react';
import { View, Text } from 'react-native';
import { formatCurrency, pickSectionError } from '@/hooks/useFinanceControlCenter';
import { PAYMENT_METHOD_LABELS } from '@/lib/utils/paymentMethod';
import { FinancialDataService } from '@/services/FinancialDataService';
import { CATEGORY_LABELS } from '@/hooks/useFinanceControlCenter';
import type { FinanceControlCenterBundle } from '@/types/finance';

interface FinanceCollectionsTabProps {
  bundle: FinanceControlCenterBundle | null;
  snapshot: FinanceControlCenterBundle['snapshot'] | null;
  expenses: FinanceControlCenterBundle['expenses'] | null;
  paymentBreakdown: FinanceControlCenterBundle['payment_breakdown'] | null;
  monthLabel: string;
  theme: any;
  styles: any;
  renderSectionError: (message: string | null) => React.ReactNode;
}

export function FinanceCollectionsTab({
  bundle,
  snapshot,
  expenses,
  paymentBreakdown,
  monthLabel,
  theme,
  styles,
  renderSectionError,
}: FinanceCollectionsTabProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Collections</Text>
      {renderSectionError(pickSectionError(bundle?.errors, 'breakdown'))}
      {renderSectionError(pickSectionError(bundle?.errors, 'expenses'))}

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>What Payments Were For</Text>
        {(paymentBreakdown?.purposes || []).length === 0 ? (
          <Text style={styles.calloutText}>No purpose data for this month yet.</Text>
        ) : (
          (paymentBreakdown?.purposes || []).map((row) => (
            <View key={row.purpose} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownLabel}>{row.purpose}</Text>
                <Text style={styles.breakdownMeta}>{row.count} payment{row.count === 1 ? '' : 's'}</Text>
              </View>
              <Text style={styles.breakdownValue}>{formatCurrency(row.amount)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>How Payments Were Made</Text>
        {(paymentBreakdown?.methods || []).length === 0 ? (
          <Text style={styles.calloutText}>No method data for this month yet.</Text>
        ) : (
          (paymentBreakdown?.methods || []).map((row) => (
            <View key={row.payment_method} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownLabel}>
                  {PAYMENT_METHOD_LABELS[row.payment_method] || row.payment_method}
                </Text>
                <Text style={styles.breakdownMeta}>{row.count} payment{row.count === 1 ? '' : 's'}</Text>
              </View>
              <Text style={styles.breakdownValue}>{formatCurrency(row.amount)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>Category Totals</Text>
        {(snapshot?.categories || []).length === 0 ? (
          <Text style={styles.calloutText}>No category totals for this month yet.</Text>
        ) : (
          (snapshot?.categories || []).map((row) => (
            <View key={row.category_code} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownLabel}>
                  {CATEGORY_LABELS[row.category_code] || row.category_code.replace('_', ' ')}
                </Text>
                <Text style={styles.breakdownMeta}>
                  Due {formatCurrency(row.due)} | Outstanding {formatCurrency(row.outstanding)}
                </Text>
              </View>
              <Text style={styles.breakdownValue}>{formatCurrency(row.collected)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>Expense Entries (Petty Cash + Expense Log)</Text>
        {!!expenses && (
          <Text style={styles.calloutText}>
            Total {formatCurrency(expenses.total_expenses)} | Petty cash {formatCurrency(expenses.petty_cash_expenses)} | Logged expenses {formatCurrency(expenses.financial_expenses)}
          </Text>
        )}
        {(expenses?.entries || []).length === 0 ? (
          <Text style={styles.calloutText}>No expense entries for this month yet.</Text>
        ) : (
          (expenses?.entries || []).map((row) => (
            <View key={`${row.source}-${row.id}`} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownLabel}>{row.category}</Text>
                <Text style={styles.breakdownMeta}>
                  {row.source === 'petty_cash' ? 'Petty Cash' : 'Expense Log'} • {FinancialDataService.getDisplayStatus(row.status)}
                </Text>
                <Text style={styles.breakdownMeta}>{row.description}</Text>
                <Text style={styles.breakdownMeta}>
                  {new Date(row.date).toLocaleDateString('en-ZA', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {row.reference ? ` • Ref ${row.reference}` : ''}
                </Text>
              </View>
              <Text style={[styles.breakdownValue, { color: theme.error }]}>{formatCurrency(row.amount)}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
