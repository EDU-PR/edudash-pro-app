import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, pickSectionError } from '@/hooks/useFinanceControlCenter';
import type { FinanceControlCenterBundle } from '@/types/finance';

interface FinanceOverviewTabProps {
  bundle: FinanceControlCenterBundle | null;
  snapshot: FinanceControlCenterBundle['snapshot'] | null;
  derivedOverview: {
    due: number;
    collected: number;
    collectedAllocated: number;
    collectedSource: string;
    outstanding: number;
    expenses: number;
    pettyCashExpenses: number;
    financialExpenses: number;
    expenseEntries: number;
    netAfterExpenses: number;
    pendingAmount: number;
    overdueAmount: number;
    pendingStudents: number;
    overdueStudents: number;
    pendingCount: number;
    overdueCount: number;
    pendingPOPs: number;
    prepaid: number;
    payrollDue: number;
    payrollPaid: number;
    kpiCorrelated: boolean;
    kpiDelta: number;
    allocationGap: number;
    snapshotAsOf: string | null;
  };
  monthLabel: string;
  theme: any;
  styles: any;
  renderSectionError: (message: string | null) => React.ReactNode;
}

export function FinanceOverviewTab({
  bundle,
  snapshot,
  derivedOverview,
  monthLabel,
  theme,
  styles,
  renderSectionError,
}: FinanceOverviewTabProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>At a Glance</Text>
      {renderSectionError(pickSectionError(bundle?.errors, 'snapshot'))}
      {renderSectionError(pickSectionError(bundle?.errors, 'expenses'))}
      <View style={styles.cardGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Due This Month</Text>
          <Text style={styles.metricValue}>{formatCurrency(derivedOverview.due)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Collected This Month</Text>
          <Text style={[styles.metricValue, { color: theme.success }]}>{formatCurrency(derivedOverview.collected)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Outstanding</Text>
          <Text style={[styles.metricValue, { color: theme.error }]}>{formatCurrency(derivedOverview.outstanding)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Pending</Text>
          <Text style={[styles.metricValue, { color: theme.warning || '#F59E0B' }]}>{formatCurrency(derivedOverview.pendingAmount)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Overdue</Text>
          <Text style={[styles.metricValue, { color: theme.error }]}>{formatCurrency(derivedOverview.overdueAmount)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Prepaid Future</Text>
          <Text style={[styles.metricValue, { color: theme.primary }]}>{formatCurrency(derivedOverview.prepaid)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Pending POP</Text>
          <Text style={[styles.metricValue, { color: theme.warning || '#F59E0B' }]}>{derivedOverview.pendingPOPs}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Expenses This Month</Text>
          <Text style={[styles.metricValue, { color: theme.error }]}>{formatCurrency(derivedOverview.expenses)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Net After Expenses</Text>
          <Text style={[styles.metricValue, { color: derivedOverview.netAfterExpenses >= 0 ? theme.success : theme.error }]}>
            {formatCurrency(derivedOverview.netAfterExpenses)}
          </Text>
        </View>
      </View>

      {snapshot && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Pending and overdue are scoped to {monthLabel} as of{' '}
            {new Date(derivedOverview.snapshotAsOf || Date.now()).toLocaleDateString('en-ZA')}.
          </Text>
        </View>
      )}

      {snapshot && derivedOverview.collectedSource === 'fee_ledger' && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Collected is temporarily using fee-ledger math ({formatCurrency(derivedOverview.collected)}) while
            allocation sync catches up ({formatCurrency(derivedOverview.collectedAllocated)} allocated, gap {formatCurrency(derivedOverview.allocationGap)}).
          </Text>
        </View>
      )}

      {snapshot && !derivedOverview.kpiCorrelated && (
        <View style={styles.errorCard}>
          <Ionicons name="analytics-outline" size={16} color={theme.warning || '#F59E0B'} />
          <Text style={styles.errorText}>
            KPI correlation warning: Due - Collected differs from Outstanding by {formatCurrency(derivedOverview.kpiDelta)}.
          </Text>
        </View>
      )}

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>Receivables</Text>
        <Text style={styles.calloutText}>
          Pending students {derivedOverview.pendingStudents} ({derivedOverview.pendingCount} fees) | Overdue students {derivedOverview.overdueStudents} ({derivedOverview.overdueCount} fees)
        </Text>
      </View>

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>Payroll</Text>
        <Text style={styles.calloutText}>
          Due {formatCurrency(derivedOverview.payrollDue)} | Paid {formatCurrency(derivedOverview.payrollPaid)}
        </Text>
      </View>

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>Expenses</Text>
        <Text style={styles.calloutText}>
          Petty cash {formatCurrency(derivedOverview.pettyCashExpenses)} | Logged expenses {formatCurrency(derivedOverview.financialExpenses)}
        </Text>
        <Text style={styles.calloutText}>
          {derivedOverview.expenseEntries} month-scoped entries loaded for {monthLabel}.
        </Text>
      </View>
    </View>
  );
}
