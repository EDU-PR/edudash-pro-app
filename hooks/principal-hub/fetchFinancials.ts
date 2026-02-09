/**
 * Principal Hub — Financial Data Fetcher
 *
 * Reads month-scoped finance snapshots for current and previous billing month,
 * then computes financial summary metrics.
 *
 * @module hooks/principal-hub/fetchFinancials
 */

import { logger } from '@/lib/logger';
import { FinancialDataService } from '@/services/FinancialDataService';
import type { FinancialSummary } from './types';

/** Format a Date into 'YYYY-MM-01' for due_date range queries. */
const toMonthStart = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

export interface FinancialRawResult {
  monthlyRevenue: number;
  previousMonthRevenue: number;
}

/**
 * Fetch current- and previous-month collected totals (allocated to billing month)
 * from `get_finance_month_snapshot`.
 */
export async function fetchFinancials(
  preschoolId: string,
  _excludeStructureIds: string[],
): Promise<FinancialRawResult> {
  void _excludeStructureIds;
  const now = new Date();
  const currentMonth = toMonthStart(new Date(now.getFullYear(), now.getMonth(), 1));
  const previousMonth = toMonthStart(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const [currentSnapshot, previousSnapshot] = await Promise.all([
    FinancialDataService.getMonthSnapshot(preschoolId, currentMonth),
    FinancialDataService.getMonthSnapshot(preschoolId, previousMonth),
  ]);

  const monthlyRevenue = Number(currentSnapshot.collected_this_month || 0);
  const previousMonthRevenue = Number(previousSnapshot.collected_this_month || 0);

  logger.info('💰 Financials fetched', {
    month: currentMonth,
    previousMonth,
    collectedForBillingMonth: monthlyRevenue,
    previousCollectedForBillingMonth: previousMonthRevenue,
  });

  return { monthlyRevenue, previousMonthRevenue };
}

/**
 * Assemble the full `FinancialSummary` object from raw revenue + petty-cash metrics.
 */
export function buildFinancialSummary(
  raw: FinancialRawResult,
  pettyCash: { currentBalance?: number; monthlyExpenses?: number; pendingTransactionsCount?: number },
): FinancialSummary {
  const totalExpenses = pettyCash.monthlyExpenses || 0;
  const netProfit = raw.monthlyRevenue - totalExpenses;
  const profitMargin = raw.monthlyRevenue > 0
    ? Math.round((netProfit / raw.monthlyRevenue) * 100)
    : 0;

  return {
    monthlyRevenue: raw.monthlyRevenue,
    previousMonthRevenue: raw.previousMonthRevenue,
    estimatedExpenses: totalExpenses,
    netProfit,
    revenueGrowth: raw.previousMonthRevenue > 0
      ? Math.round(((raw.monthlyRevenue - raw.previousMonthRevenue) / raw.previousMonthRevenue) * 100)
      : 0,
    profitMargin,
    pettyCashBalance: pettyCash.currentBalance || 0,
    pettyCashExpenses: pettyCash.monthlyExpenses || 0,
    pendingApprovals: pettyCash.pendingTransactionsCount || 0,
    timestamp: new Date().toISOString(),
  };
}
