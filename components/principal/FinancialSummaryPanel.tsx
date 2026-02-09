/**
 * FinancialSummaryPanel — renders all financial summary cards.
 *
 * Includes: main stats, sub-stats, fee type breakdown, uniform payments,
 * advance payments, fee breakdown table, payments & POP, accounting snapshot,
 * and insights.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  FinancialSummary, PaymentSummary, PopSummary, ExpenseSummary,
  FeeBreakdownRow, UniformPaymentSummary, AccountingSnapshot, TimeFilter,
  FeeInsights,
} from '@/hooks/fee-overview';

interface Props {
  summary: FinancialSummary;
  paymentSummary: PaymentSummary | null;
  popSummary: PopSummary | null;
  expenseSummary: ExpenseSummary | null;
  feeBreakdown: FeeBreakdownRow[];
  advancePayments: { amount: number; count: number } | null;
  accountingSnapshot: AccountingSnapshot | null;
  uniformSummary: UniformPaymentSummary | null;
  insights: FeeInsights;
  timeFilter: TimeFilter;
  setTimeFilter: (f: TimeFilter) => void;
  formatCurrency: (amount: number) => string;
  onNavigate: (route: string) => void;
  theme: any;
  styles: any;
}

export function FinancialSummaryPanel({
  summary, paymentSummary, popSummary, expenseSummary, feeBreakdown,
  advancePayments, accountingSnapshot, uniformSummary, insights,
  timeFilter, setTimeFilter, formatCurrency, onNavigate, theme, styles,
}: Props) {
  return (
    <View style={styles.summarySection}>
      {/* Header */}
      <View style={styles.summaryHeader}>
        <View style={styles.summaryTitleBlock}>
          <Text style={styles.sectionTitle}>Financial Overview</Text>
          <Text style={styles.sectionSubtitle}>Track fees, collections, and approvals at a glance.</Text>
        </View>
        <View style={styles.summaryActions}>
          <TouchableOpacity style={styles.expensesButton} onPress={() => onNavigate('/screens/financial-dashboard')}>
            <Ionicons name="cash-outline" size={16} color={theme.primary} />
            <Text style={styles.expensesButtonText}>Expenses & Petty Cash</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manageFeesButton} onPress={() => onNavigate('/screens/admin/fee-management')}>
            <Ionicons name="wallet-outline" size={16} color={theme.primary} />
            <Text style={styles.expensesButtonText}>Manage Fee Structures</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Time Filter */}
      <View style={styles.timeFilterRow}>
        <View style={styles.timeFilterGroup}>
          <TouchableOpacity
            style={[styles.timeChip, timeFilter === 'month' && styles.timeChipActive]}
            onPress={() => setTimeFilter('month')}
          >
            <Text style={[styles.timeChipText, timeFilter === 'month' && styles.timeChipTextActive]}>This Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timeChip, timeFilter === 'all' && styles.timeChipActive]}
            onPress={() => setTimeFilter('all')}
          >
            <Text style={[styles.timeChipText, timeFilter === 'all' && styles.timeChipTextActive]}>All Time</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Stats */}
      <View style={styles.mainStatsRow}>
        <View style={[styles.mainStatCard, { borderLeftColor: theme.error }]}>
          <Text style={[styles.mainStatValue, { color: theme.error }]}>{formatCurrency(summary.totalOutstanding)}</Text>
          <Text style={styles.mainStatLabel}>Outstanding</Text>
        </View>
        <View style={[styles.mainStatCard, { borderLeftColor: theme.success }]}>
          <Text style={[styles.mainStatValue, { color: theme.success }]}>{formatCurrency(summary.totalPaid)}</Text>
          <Text style={styles.mainStatLabel}>Collected</Text>
        </View>
      </View>

      {/* Sub Stats */}
      <View style={styles.subStatsRow}>
        <View style={styles.subStatCard}>
          <Ionicons name="people" size={20} color={theme.primary} />
          <Text style={styles.subStatValue}>{summary.totalStudents}</Text>
          <Text style={styles.subStatLabel}>Students</Text>
        </View>
        <View style={styles.subStatCard}>
          <Ionicons name="alert-circle" size={20} color={theme.warning} />
          <Text style={[styles.subStatValue, { color: theme.warning }]}>{summary.overdueStudents}</Text>
          <Text style={styles.subStatLabel}>Overdue</Text>
        </View>
        <View style={styles.subStatCard}>
          <Ionicons name="ribbon" size={20} color="#6B7280" />
          <Text style={styles.subStatValue}>{formatCurrency(summary.totalWaived)}</Text>
          <Text style={styles.subStatLabel}>Waived</Text>
        </View>
      </View>

      {/* Fee Type Breakdown */}
      <View style={styles.breakdownSection}>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Registration Fees</Text>
          <View style={styles.breakdownValues}>
            <Text style={[styles.breakdownValue, { color: theme.success }]}>{formatCurrency(summary.registrationFees.collected)} collected</Text>
            <Text style={[styles.breakdownValue, { color: theme.warning }]}>{formatCurrency(summary.registrationFees.pending)} pending</Text>
          </View>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>School Fees</Text>
          <View style={styles.breakdownValues}>
            <Text style={[styles.breakdownValue, { color: theme.success }]}>{formatCurrency(summary.schoolFees.collected)} collected</Text>
            <Text style={[styles.breakdownValue, { color: theme.warning }]}>{formatCurrency(summary.schoolFees.pending)} pending</Text>
          </View>
        </View>
      </View>

      {/* Uniform Payments */}
      {uniformSummary && (uniformSummary.paidCount > 0 || uniformSummary.pendingCount > 0 || uniformSummary.submittedRequests > 0) && (
        <View style={styles.panelCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Uniform Payments</Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity style={styles.expensesButton} onPress={() => onNavigate('/screens/principal-uniforms')}>
                <Ionicons name="shirt-outline" size={16} color={theme.primary} />
                <Text style={styles.expensesButtonText}>Manage Uniforms</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.sectionHint}>Uniform orders and payment status, tracked separately from school fees.</Text>
          <View style={styles.subStatsRow}>
            <View style={styles.subStatCard}>
              <Ionicons name="checkmark-circle" size={18} color={theme.success} />
              <Text style={[styles.subStatValue, { color: theme.success }]}>{formatCurrency(uniformSummary.totalPaid)}</Text>
              <Text style={styles.subStatLabel}>Paid ({uniformSummary.paidCount})</Text>
            </View>
            <View style={styles.subStatCard}>
              <Ionicons name="time-outline" size={18} color={theme.warning} />
              <Text style={[styles.subStatValue, { color: theme.warning }]}>{formatCurrency(uniformSummary.totalPending)}</Text>
              <Text style={styles.subStatLabel}>Pending ({uniformSummary.pendingCount})</Text>
            </View>
            <View style={styles.subStatCard}>
              <Ionicons name="shirt-outline" size={18} color={theme.primary} />
              <Text style={styles.subStatValue}>{uniformSummary.submittedRequests}/{uniformSummary.totalRequests}</Text>
              <Text style={styles.subStatLabel}>Orders Placed</Text>
            </View>
          </View>
        </View>
      )}

      {/* Advance Payments */}
      {timeFilter === 'month' && advancePayments && (
        <View style={styles.panelCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Advance Payments</Text>
          </View>
          <Text style={styles.sectionHint}>Payments received before this month for fees due now.</Text>
          <View style={styles.mainStatsRow}>
            <View style={[styles.mainStatCard, { borderLeftColor: theme.primary }]}>
              <Text style={[styles.mainStatValue, { color: theme.primary }]}>{formatCurrency(advancePayments.amount)}</Text>
              <Text style={styles.mainStatLabel}>Paid in Advance</Text>
            </View>
            <View style={[styles.mainStatCard, { borderLeftColor: theme.success }]}>
              <Text style={[styles.mainStatValue, { color: theme.success }]}>{advancePayments.count}</Text>
              <Text style={styles.mainStatLabel}>Fees Covered</Text>
            </View>
          </View>
        </View>
      )}

      {/* Fee Breakdown Table */}
      {feeBreakdown.length > 0 && (
        <View style={styles.panelCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Fee Breakdown</Text>
          </View>
          <Text style={styles.sectionHint}>
            {timeFilter === 'month' ? 'Fees due this month by type.' : 'All fees by type.'}
          </Text>
          {feeBreakdown.map(row => (
            <View key={row.key} style={styles.breakdownItem}>
              <View style={styles.breakdownItemHeader}>
                <Text style={styles.breakdownItemTitle}>{row.name}</Text>
                <Text style={styles.breakdownItemAmount}>{formatCurrency(row.totalDue)}</Text>
              </View>
              <View style={styles.breakdownItemMeta}>
                <Text style={styles.breakdownItemSub}>{row.feeType || 'Fee'}</Text>
                <Text style={styles.breakdownItemSub}>{row.count} fees</Text>
              </View>
              <View style={styles.breakdownItemStats}>
                <Text style={styles.breakdownItemStat}>Paid: {formatCurrency(row.totalPaid)}</Text>
                <Text style={styles.breakdownItemStat}>Outstanding: {formatCurrency(row.outstanding)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Payments & POP */}
      {paymentSummary && popSummary && (
        <View style={styles.panelCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Payments & POP</Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity style={styles.expensesButton} onPress={() => onNavigate('/screens/pop-review')}>
                <Ionicons name="checkmark-circle-outline" size={16} color={theme.primary} />
                <Text style={styles.expensesButtonText}>Review POPs</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.expensesButton} onPress={() => onNavigate('/screens/financial-transactions')}>
                <Ionicons name="list-outline" size={16} color={theme.primary} />
                <Text style={styles.expensesButtonText}>Transactions</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.sectionHint}>
            {timeFilter === 'month' ? 'This month' : 'All time'} payments and proof-of-payment status.
          </Text>
          <View style={styles.subStatsRow}>
            <View style={styles.subStatCard}>
              <Ionicons name="cash-outline" size={18} color={theme.success} />
              <Text style={[styles.subStatValue, { color: theme.success }]}>{formatCurrency(paymentSummary.completedAmount)}</Text>
              <Text style={styles.subStatLabel}>Payments Collected</Text>
            </View>
            <View style={styles.subStatCard}>
              <Ionicons name="time-outline" size={18} color={theme.warning} />
              <Text style={[styles.subStatValue, { color: theme.warning }]}>{formatCurrency(paymentSummary.pendingAmount)}</Text>
              <Text style={styles.subStatLabel}>Payments Pending</Text>
            </View>
            <View style={styles.subStatCard}>
              <Ionicons name="alert-circle-outline" size={18} color={theme.error} />
              <Text style={[styles.subStatValue, { color: theme.error }]}>{paymentSummary.missingEvidenceCount}</Text>
              <Text style={styles.subStatLabel}>Missing Bank Proof</Text>
            </View>
          </View>
            <View style={styles.subStatsRow}>
              <View style={styles.subStatCard}>
                <Ionicons name="document-text-outline" size={18} color={theme.warning} />
                <Text style={[styles.subStatValue, { color: theme.warning }]}>{popSummary.pendingCount}</Text>
                <Text style={styles.subStatLabel}>POP Pending</Text>
            </View>
            <View style={styles.subStatCard}>
              <Ionicons name="checkmark-done-outline" size={18} color={theme.success} />
              <Text style={[styles.subStatValue, { color: theme.success }]}>{popSummary.approvedCount}</Text>
              <Text style={styles.subStatLabel}>POP Approved</Text>
            </View>
            <View style={styles.subStatCard}>
              <Ionicons name="close-circle-outline" size={18} color={theme.error} />
              <Text style={[styles.subStatValue, { color: theme.error }]}>{popSummary.rejectedCount}</Text>
                <Text style={styles.subStatLabel}>POP Rejected</Text>
              </View>
            </View>

            {paymentSummary.methodBreakdown.length > 0 && (
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownLabel}>How Payments Were Made</Text>
                {paymentSummary.methodBreakdown.slice(0, 6).map((row) => (
                  <View key={`method_${row.key}`} style={styles.breakdownRow}>
                    <Text style={styles.breakdownValue}>{row.label}</Text>
                    <View style={styles.breakdownValues}>
                      <Text style={[styles.breakdownValue, { color: theme.primary }]}>
                        {formatCurrency(row.amount)}
                      </Text>
                      <Text style={styles.breakdownItemSub}>{row.count} payments</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {paymentSummary.purposeBreakdown.length > 0 && (
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownLabel}>What Payments Were For</Text>
                {paymentSummary.purposeBreakdown.slice(0, 6).map((row) => (
                  <View key={`purpose_${row.key}`} style={styles.breakdownRow}>
                    <Text style={styles.breakdownValue}>{row.label}</Text>
                    <View style={styles.breakdownValues}>
                      <Text style={[styles.breakdownValue, { color: theme.primary }]}>
                        {formatCurrency(row.amount)}
                      </Text>
                      <Text style={styles.breakdownItemSub}>{row.count} payments</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
        </View>
      )}

      {/* Accounting Snapshot */}
      {accountingSnapshot && expenseSummary && (
        <View style={styles.panelCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Accounting Snapshot</Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity style={styles.expensesButton} onPress={() => onNavigate('/screens/petty-cash')}>
                <Ionicons name="add-circle-outline" size={16} color={theme.primary} />
                <Text style={styles.expensesButtonText}>Record Expense</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.sectionHint}>Expenses include petty cash and approved expense transactions.</Text>
          <View style={styles.mainStatsRow}>
            <View style={[styles.mainStatCard, { borderLeftColor: theme.success }]}>
              <Text style={[styles.mainStatValue, { color: theme.success }]}>{formatCurrency(accountingSnapshot.income)}</Text>
              <Text style={styles.mainStatLabel}>Income</Text>
            </View>
            <View style={[styles.mainStatCard, { borderLeftColor: theme.error }]}>
              <Text style={[styles.mainStatValue, { color: theme.error }]}>{formatCurrency(accountingSnapshot.expenses)}</Text>
              <Text style={styles.mainStatLabel}>Expenses</Text>
            </View>
          </View>
          <View style={styles.subStatsRow}>
            <View style={styles.subStatCard}>
              <Ionicons name="wallet-outline" size={18} color={accountingSnapshot.net >= 0 ? theme.success : theme.error} />
              <Text style={[styles.subStatValue, { color: accountingSnapshot.net >= 0 ? theme.success : theme.error }]}>
                {formatCurrency(accountingSnapshot.net)}
              </Text>
              <Text style={styles.subStatLabel}>Net Balance</Text>
            </View>
            <View style={styles.subStatCard}>
              <Ionicons name="trending-up-outline" size={18} color={theme.primary} />
              <Text style={styles.subStatValue}>{Math.round(accountingSnapshot.completionRate)}%</Text>
              <Text style={styles.subStatLabel}>Payment Rate</Text>
            </View>
            <View style={styles.subStatCard}>
              <Ionicons name="receipt-outline" size={18} color={theme.warning} />
              <Text style={[styles.subStatValue, { color: theme.warning }]}>{expenseSummary.missingReceiptCount}</Text>
              <Text style={styles.subStatLabel}>Missing Receipts</Text>
            </View>
          </View>
        </View>
      )}

      {/* Insights */}
      {insights && (
        <View style={styles.panelCard}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <View style={styles.insightColumns}>
            <View style={styles.insightColumn}>
              <Text style={[styles.insightHeading, { color: theme.success }]}>Do</Text>
              {insights.doList.map((item: string) => (
                <Text key={item} style={styles.insightItem}>{'\u2022'} {item}</Text>
              ))}
            </View>
            <View style={styles.insightColumn}>
              <Text style={[styles.insightHeading, { color: theme.error }]}>Avoid</Text>
              {insights.avoidList.map((item: string) => (
                <Text key={item} style={styles.insightItem}>{'\u2022'} {item}</Text>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
