import { useState, useEffect, useCallback, useMemo } from 'react';
import { useActiveSchoolId } from '@/lib/tenant/client';
import * as pettyCashDb from '@/lib/db/pettyCash';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import type { PettyCashDashboardMetrics, UsePettyCashDashboardResult } from './types';

export function usePettyCashDashboard(): UsePettyCashDashboardResult {
  const schoolId = useActiveSchoolId();
  const [metrics, setMetrics] = useState<PettyCashDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation('common');

  const fetchMetrics = useCallback(async () => {
    if (!schoolId) {
      setError('No active school selected');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [balance, currentMonthSummary, previousMonthSummary, recentTransactions, pendingCount] =
        await Promise.all([
          pettyCashDb.getBalance(schoolId),
          pettyCashDb.getSummary(schoolId, { from: currentMonth, to: nextMonth, groupBy: 'month' }),
          pettyCashDb.getSummary(schoolId, { from: previousMonth, to: currentMonth, groupBy: 'month' }),
          pettyCashDb.listTransactions(schoolId, { limit: 10, status: undefined }),
          pettyCashDb.listTransactions(schoolId, { status: 'pending', limit: 1 }),
        ]);

      const currentExpenses = currentMonthSummary?.total_expenses || 0;
      const currentReplenishments = currentMonthSummary?.total_replenishments || 0;
      const previousExpenses = previousMonthSummary?.total_expenses || 0;
      const previousBalance = balance - (currentReplenishments - currentExpenses);

      const expensesVsPreviousMonth =
        previousExpenses > 0 ? ((currentExpenses - previousExpenses) / previousExpenses) * 100 : 0;
      const balanceChange = balance - previousBalance;

      const categories = currentExpenses > 0
        ? [{ name: t('dashboard.general_expenses'), amount: currentExpenses, percentage: 100 }]
        : [];
      categories.sort((a, b) => b.amount - a.amount);

      const formattedTransactions = recentTransactions.transactions.map((txn) => ({
        id: txn.id,
        amount: txn.amount,
        type: txn.type,
        description: txn.description || t('dashboard.no_description'),
        status: txn.status,
        occurred_at: txn.occurred_at,
      }));

      setMetrics({
        currentBalance: balance,
        monthlyExpenses: currentExpenses,
        monthlyReplenishments: currentReplenishments,
        pendingTransactionsCount: pendingCount.total_count || 0,
        recentTransactions: formattedTransactions,
        monthlyTrend: {
          expensesVsPreviousMonth: Math.round(expensesVsPreviousMonth),
          balanceChange: Math.round(balanceChange),
          transactionCount: currentMonthSummary?.transaction_count || 0,
        },
        categories: categories.slice(0, 5),
        lastUpdated: new Date(),
      });
    } catch (err) {
      logger.error('PettyCashDashboard', 'Failed to fetch metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load petty cash data');
    } finally {
      setLoading(false);
    }
  }, [schoolId, t]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  const refresh = useCallback(async () => { await fetchMetrics(); }, [fetchMetrics]);
  const hasData = useMemo(() => metrics !== null, [metrics]);
  const isEmpty = useMemo(() => !loading && metrics === null, [loading, metrics]);

  return { metrics, loading, error, refresh, hasData, isEmpty };
}
