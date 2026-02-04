/**
 * Modern Financial Management Dashboard
 * 
 * Features:
 * - Interactive charts with react-native-chart-kit
 * - Real-time export functionality (CSV, PDF, Excel)
 * - Responsive design with touch interactions
 * - Clean architecture with service separation
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { navigateBack } from '@/lib/navigation';
import { useTranslation } from 'react-i18next';
import { derivePreschoolId } from '@/lib/roleUtils';
import { SimpleHeader } from '@/components/ui/SimpleHeader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOrganizationTerminology } from '@/lib/hooks/useOrganizationTerminology';

import { FinancialDataService } from '@/services/FinancialDataService';
import { ExportService } from '@/lib/services/finance/ExportService';
import type { FinanceOverviewData, FinancialMetrics, TransactionRecord } from '@/services/FinancialDataService';
import type { ExportFormat } from '@/lib/services/finance/ExportService';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
type IconName = keyof typeof Ionicons.glyphMap;
type TransactionStatus = TransactionRecord['status'];

export default function FinanceDashboard() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { t } = useTranslation('common');
  const { terminology } = useOrganizationTerminology();
  
  const [overview, setOverview] = useState<FinanceOverviewData | null>(null);
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const canAccessFinances = (): boolean => {
    return profile?.role === 'principal' || profile?.role === 'principal_admin';
  };

  const loadDashboardData = async (forceRefresh = false) => {
    try {
      setLoading(!forceRefresh);
      if (forceRefresh) setRefreshing(true);

      const preschoolId = derivePreschoolId(profile);

      // Load simple financial metrics
      const metricsData = preschoolId
        ? await FinancialDataService.getFinancialMetrics(preschoolId)
        : null;
      setMetrics(metricsData);

      // Load financial overview (used only for sample-data detection)
      const overviewData = await FinancialDataService.getOverview(preschoolId || undefined);
      setOverview(overviewData);

      // Load recent transactions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const transactionData = await FinancialDataService.getTransactions({
        from: thirtyDaysAgo.toISOString(),
        to: new Date().toISOString(),
      }, preschoolId || undefined, { useAccountingDate: true });
      setTransactions(transactionData);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('finance_dashboard.load_failed', { defaultValue: 'Failed to load financial dashboard' }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleExport = (format: ExportFormat) => {
    if ((!overview && !metrics) || !transactions.length) {
      Alert.alert(t('transactions.no_data', { defaultValue: 'No Data' }), t('finance_dashboard.no_financial_data_export', { defaultValue: 'No financial data available to export' }));
      return;
    }

    const summary = {
      revenue: metrics?.monthlyRevenue ?? overview?.keyMetrics.monthlyRevenue ?? 0,
      expenses: metrics?.monthlyExpenses ?? overview?.keyMetrics.monthlyExpenses ?? 0,
      cashFlow: metrics?.netIncome ?? overview?.keyMetrics.cashFlow ?? 0,
    };

    ExportService.exportFinancialData(transactions, summary, {
      format,
      dateRange: {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString(),
      },
      includeCharts: true,
    });
  };

  const formatCurrency = (amount: number): string => {
    return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  };

  const resolvedMetrics = useMemo<FinancialMetrics>(() => {
    if (metrics) return metrics;
    return {
      monthlyRevenue: overview?.keyMetrics.monthlyRevenue || 0,
      outstandingPayments: 0,
      monthlyExpenses: overview?.keyMetrics.monthlyExpenses || 0,
      netIncome: overview?.keyMetrics.cashFlow || 0,
      paymentCompletionRate: 0,
      totalStudents: 0,
      averageFeePerStudent: 0,
    };
  }, [metrics, overview]);

  const formatPercent = (value: number) => `${Math.round(value)}%`;

  const renderSummaryCard = (title: string, value: string, subtitle: string, color: string, icon: IconName) => (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View style={[styles.summaryIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.summaryTitle}>{title}</Text>
      </View>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summarySubtitle}>{subtitle}</Text>
    </View>
  );

  const renderActionRow = (
    title: string,
    subtitle: string,
    icon: IconName,
    color: string,
    onPress: () => void
  ) => (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.actionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.actionTextContainer}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme?.textSecondary || Colors.light.tabIconDefault} />
    </TouchableOpacity>
  );

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
  };

  const statusLabels: Record<TransactionStatus, string> = {
    completed: t('completed', { defaultValue: 'Completed' }),
    pending: t('pending', { defaultValue: 'Pending' }),
    overdue: t('overdue', { defaultValue: 'Overdue' }),
    approved: t('approved', { defaultValue: 'Approved' }),
    rejected: t('rejected', { defaultValue: 'Rejected' }),
  };

  const statusColors: Record<TransactionStatus, string> = {
    completed: theme?.success || Colors.light.tint,
    pending: theme?.warning || Colors.light.tint,
    overdue: theme?.error || Colors.light.tint,
    approved: theme?.success || Colors.light.tint,
    rejected: theme?.error || Colors.light.tint,
  };

  const recentTransactions = transactions.slice(0, 6);

  if (!canAccessFinances()) {
    return (
      <SafeAreaView style={styles.accessDenied}>
        <Ionicons name="lock-closed" size={64} color={theme?.textSecondary || Colors.light.tabIconDefault} />
        <Text style={styles.accessDeniedTitle}>{t('dashboard.accessDenied', { defaultValue: 'Access Denied' })}</Text>
        <Text style={styles.accessDeniedText}>
          {t('finance_dashboard.access_denied_text', { defaultValue: 'Only school principals can access the financial dashboard.' })}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigateBack()}>
          <Text style={styles.backButtonText}>{t('navigation.back', { defaultValue: 'Back' })}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <EduDashSpinner size="large" color={Colors.light.tint} />
        <Text style={styles.loadingText}>{t('finance_dashboard.loading', { defaultValue: 'Loading financial dashboard...' })}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <SimpleHeader title={t('finance_dashboard.title', { defaultValue: 'Finance Dashboard' })} />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadDashboardData(true)} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('finance_dashboard.overview_title', { defaultValue: 'This Month at a Glance' })}</Text>
          <Text style={styles.sectionSubtitle}>
            {t('finance_dashboard.overview_subtitle', { defaultValue: 'Simple numbers to guide your decisions.' })}
          </Text>

          <View style={styles.summaryGrid}>
            {renderSummaryCard(
              t('finance_dashboard.collected', { defaultValue: 'Collected' }),
              formatCurrency(resolvedMetrics.monthlyRevenue),
              t('finance_dashboard.collected_hint', { defaultValue: 'Fees received' }),
              theme?.success || '#059669',
              'checkmark-circle'
            )}
            {renderSummaryCard(
              t('finance_dashboard.outstanding', { defaultValue: 'Outstanding' }),
              formatCurrency(resolvedMetrics.outstandingPayments),
              t('finance_dashboard.outstanding_hint', { defaultValue: 'Still to be paid' }),
              theme?.warning || '#F59E0B',
              'alert-circle'
            )}
            {renderSummaryCard(
              t('finance_dashboard.expenses', { defaultValue: 'Expenses' }),
              formatCurrency(resolvedMetrics.monthlyExpenses),
              t('finance_dashboard.expenses_hint', { defaultValue: 'Spent this month' }),
              theme?.error || '#DC2626',
              'cash'
            )}
            {renderSummaryCard(
              t('finance_dashboard.net', { defaultValue: 'Net Balance' }),
              formatCurrency(resolvedMetrics.netIncome),
              resolvedMetrics.netIncome >= 0
                ? t('finance_dashboard.positive', { defaultValue: 'Positive' })
                : t('finance_dashboard.negative', { defaultValue: 'Negative' }),
              resolvedMetrics.netIncome >= 0 ? theme?.success || '#059669' : theme?.error || '#DC2626',
              'wallet'
            )}
          </View>

          <View style={styles.insightRow}>
            <View style={styles.insightCard}>
              <Text style={styles.insightLabel}>{t('finance_dashboard.payment_rate', { defaultValue: 'Payment Rate' })}</Text>
              <Text style={styles.insightValue}>{formatPercent(resolvedMetrics.paymentCompletionRate)}</Text>
            </View>
            <View style={styles.insightCard}>
              <Text style={styles.insightLabel}>{terminology.members}</Text>
              <Text style={styles.insightValue}>{resolvedMetrics.totalStudents}</Text>
            </View>
          </View>

          {overview?.isSample && (
            <View style={styles.sampleBanner}>
              <Ionicons name="cloud-offline" size={16} color={theme?.textSecondary || Colors.light.tabIconDefault} />
              <Text style={styles.sampleText}>
                {t('finance_dashboard.sample_data', { defaultValue: 'Live data is unavailable. Showing a sample view.' })}
              </Text>
            </View>
          )}
        </View>

        {/* Main Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('finance_dashboard.actions_title', { defaultValue: 'What do you want to do?' })}</Text>
          {renderActionRow(
            t('finance_dashboard.manage_fees', { defaultValue: `Manage ${terminology.members} Fees` }),
            t('finance_dashboard.manage_fees_hint', { defaultValue: 'See who paid and who still owes' }),
            'people',
            theme?.primary || Colors.light.tint,
            () => router.push('/screens/principal-fee-overview')
          )}
          {renderActionRow(
            t('finance_dashboard.review_payments', { defaultValue: 'Review Payments' }),
            t('finance_dashboard.review_payments_hint', { defaultValue: 'Approve POPs and registrations' }),
            'checkmark-circle',
            theme?.warning || '#F59E0B',
            () => router.push('/screens/pop-review')
          )}
          {renderActionRow(
            t('finance_dashboard.record_expense', { defaultValue: 'Record an Expense' }),
            t('finance_dashboard.record_expense_hint', { defaultValue: 'Petty cash and receipts' }),
            'cash',
            theme?.success || '#059669',
            () => router.push('/screens/petty-cash')
          )}
          {renderActionRow(
            t('finance_dashboard.view_transactions', { defaultValue: 'View Transactions' }),
            t('finance_dashboard.view_transactions_hint', { defaultValue: 'All income and expenses' }),
            'list',
            theme?.primary || Colors.light.tint,
            () => router.push('/screens/financial-transactions')
          )}
          {renderActionRow(
            t('finance_dashboard.view_reports', { defaultValue: 'Reports & Exports' }),
            t('finance_dashboard.view_reports_hint', { defaultValue: 'Monthly summaries and downloads' }),
            'analytics',
            theme?.primary || Colors.light.tint,
            () => router.push('/screens/financial-reports')
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('finance_dashboard.recent_activity', { defaultValue: 'Recent Activity' })}</Text>
          {recentTransactions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={28} color={theme?.textSecondary || Colors.light.tabIconDefault} />
              <Text style={styles.emptyTitle}>{t('finance_dashboard.no_activity', { defaultValue: 'No recent transactions yet.' })}</Text>
              <Text style={styles.emptySubtitle}>
                {t('finance_dashboard.no_activity_hint', { defaultValue: 'Payments and expenses will appear here.' })}
              </Text>
            </View>
          ) : (
            recentTransactions.map((transaction) => {
              const amountColor = transaction.type === 'income'
                ? theme?.success || '#059669'
                : theme?.error || '#DC2626';
              const statusColor = statusColors[transaction.status];
              return (
                <View key={transaction.id} style={styles.transactionRow}>
                  <View style={[styles.transactionIcon, { backgroundColor: amountColor + '20' }]}>
                    <Ionicons name={transaction.type === 'income' ? 'arrow-up-circle' : 'arrow-down-circle'} size={18} color={amountColor} />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionTitle} numberOfLines={1}>{transaction.description}</Text>
                    <Text style={styles.transactionMeta}>
                      {formatDate(transaction.date)} • {transaction.category}
                    </Text>
                  </View>
                  <View style={styles.transactionAmountWrap}>
                    <Text style={[styles.transactionAmount, { color: amountColor }]}>
                      {formatCurrency(transaction.amount)}
                    </Text>
                    <Text style={[styles.transactionStatus, { color: statusColor }]}>
                      {statusLabels[transaction.status]}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Reports & Export */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('finance_dashboard.export_title', { defaultValue: 'Export Data' })}</Text>
          <View style={styles.exportButtons}>
            <TouchableOpacity style={styles.exportButton} onPress={() => handleExport('csv')}>
              <Ionicons name="document-text" size={18} color={theme?.primary || Colors.light.tint} />
              <Text style={styles.exportButtonText}>{t('finance_dashboard.csv', { defaultValue: 'CSV' })}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportButton} onPress={() => handleExport('excel')}>
              <Ionicons name="grid" size={18} color={theme?.primary || Colors.light.tint} />
              <Text style={styles.exportButtonText}>{t('finance_dashboard.excel', { defaultValue: 'Excel' })}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportButton} onPress={() => handleExport('pdf')}>
              <Ionicons name="document" size={18} color={theme?.primary || Colors.light.tint} />
              <Text style={styles.exportButtonText}>{t('finance_dashboard.pdf', { defaultValue: 'PDF' })}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme?.background || '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 60,
    backgroundColor: theme?.surface || 'white',
    borderBottomWidth: 1,
    borderBottomColor: theme?.border || '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme?.text || Colors.light.text,
  },
  content: {
    flex: 1,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme?.text || Colors.light.text,
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    flexBasis: '48%',
    backgroundColor: theme?.cardBackground || 'white',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme?.border || '#e2e8f0',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  summaryIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 12,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summarySubtitle: {
    fontSize: 11,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
    marginTop: 4,
  },
  insightRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  insightCard: {
    flex: 1,
    backgroundColor: theme?.cardBackground || 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme?.border || '#e2e8f0',
  },
  insightLabel: {
    fontSize: 12,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
  },
  insightValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme?.text || Colors.light.text,
    marginTop: 4,
  },
  sampleBanner: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: theme?.surface || '#f1f5f9',
  },
  sampleText: {
    fontSize: 12,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme?.cardBackground || 'white',
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme?.border || '#e2e8f0',
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme?.text || Colors.light.text,
  },
  actionSubtitle: {
    fontSize: 12,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
    marginTop: 2,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme?.cardBackground || 'white',
    borderWidth: 1,
    borderColor: theme?.border || '#e2e8f0',
    marginTop: 10,
  },
  transactionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme?.text || Colors.light.text,
  },
  transactionMeta: {
    fontSize: 12,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
    marginTop: 2,
  },
  transactionAmountWrap: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  transactionStatus: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    backgroundColor: theme?.cardBackground || 'white',
    borderWidth: 1,
    borderColor: theme?.border || '#e2e8f0',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme?.text || Colors.light.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
    marginTop: 4,
    textAlign: 'center',
  },
  exportButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: (theme?.primary || Colors.light.tint) + '10',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme?.primary || Colors.light.tint,
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 16,
    color: Colors.light.tabIconDefault,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme?.background || '#f8fafc',
  },
  loadingText: {
    fontSize: 16,
    color: theme?.textSecondary || Colors.light.tabIconDefault,
    marginTop: 16,
  },
});
