import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePettyCashDashboard } from './usePettyCashDashboard';

export function usePettyCashMetricCards() {
  const { metrics, loading, error } = usePettyCashDashboard();
  const { t } = useTranslation();

  const metricCards = useMemo(() => {
    if (!metrics) return [];

    const hasMeaningfulData =
      metrics.currentBalance > 20 ||
      metrics.monthlyExpenses > 10 ||
      metrics.pendingTransactionsCount > 0;
    if (!hasMeaningfulData) return [];

    const cards = [];

    if (metrics.currentBalance > 20) {
      cards.push({
        id: 'petty_cash_balance',
        title: t('dashboard.petty_cash_balance'),
        value: `R${metrics.currentBalance.toFixed(2)}`,
        icon: 'wallet-outline',
        color: '#F59E0B',
        trend: metrics.monthlyTrend.balanceChange > 0 ? 'up' :
               metrics.monthlyTrend.balanceChange < 0 ? 'down' : 'stable',
        subtitle: `${metrics.monthlyTrend.balanceChange >= 0 ? '+' : ''}R${metrics.monthlyTrend.balanceChange.toFixed(2)} ${t('dashboard.this_month', { defaultValue: 'this month' })}`,
      });
    }

    if (metrics.monthlyExpenses > 10) {
      cards.push({
        id: 'monthly_expenses',
        title: t('dashboard.monthly_expenses'),
        value: `R${metrics.monthlyExpenses.toFixed(2)}`,
        icon: 'receipt-outline',
        color: '#DC2626',
        trend: metrics.monthlyTrend.expensesVsPreviousMonth > 10 ? 'up' :
               metrics.monthlyTrend.expensesVsPreviousMonth < -10 ? 'down' : 'stable',
        subtitle: `${Math.abs(metrics.monthlyTrend.expensesVsPreviousMonth)}% ${t('dashboard.vs_last_month', { defaultValue: 'vs last month' })}`,
      });
    }

    if (metrics.pendingTransactionsCount > 0) {
      cards.push({
        id: 'pending_approvals',
        title: t('dashboard.pending_approvals', { defaultValue: 'Pending Approvals' }),
        value: metrics.pendingTransactionsCount,
        icon: 'hourglass-outline',
        color: '#F59E0B',
        trend: metrics.pendingTransactionsCount > 3 ? 'attention' : 'stable',
        subtitle: t('dashboard.requiring_approval', { defaultValue: 'Requiring approval' }),
      });
    }

    return cards;
  }, [metrics, t]);

  return { metricCards, loading, error, hasData: !!metrics };
}
