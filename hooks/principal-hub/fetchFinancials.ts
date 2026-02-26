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
  monthlyExpenses: number;
  hasError: boolean;
  errorMessage?: string | null;
}

type SettledResult<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; reason: unknown };

async function settle<T>(promise: Promise<T>): Promise<SettledResult<T>> {
  try {
    const value = await promise;
    return { status: 'fulfilled', value };
  } catch (reason) {
    return { status: 'rejected', reason };
  }
}

function reasonToMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  if (reason && typeof reason === 'object') {
    const asRecord = reason as Record<string, unknown>;
    const nestedMessage = asRecord.message || asRecord.error || asRecord.details;
    if (typeof nestedMessage === 'string' && nestedMessage.trim().length > 0) {
      return nestedMessage;
    }
  }
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
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

  try {
    // Hermes-safe replacement for Promise.allSettled (not available on some production devices).
    const [currentResult, previousResult] = await Promise.all([
      settle(FinancialDataService.getMonthSnapshot(preschoolId, currentMonth)),
      settle(FinancialDataService.getMonthSnapshot(preschoolId, previousMonth)),
    ]);

    const currentSnapshot = currentResult.status === 'fulfilled' ? currentResult.value : null;
    const previousSnapshot = previousResult.status === 'fulfilled' ? previousResult.value : null;

    const monthlyRevenue = Number(currentSnapshot?.collected_this_month || 0);
    const previousMonthRevenue = Number(previousSnapshot?.collected_this_month || 0);
    const monthlyExpenses = Number(currentSnapshot?.expenses_this_month || 0);

    const errorMessages = [
      currentResult.status === 'rejected' ? reasonToMessage(currentResult.reason) : null,
      previousResult.status === 'rejected' ? reasonToMessage(previousResult.reason) : null,
    ].filter(Boolean);

    const hasError = !currentSnapshot || errorMessages.length > 0;

    logger.info('💰 Financials fetched', {
      month: currentMonth,
      previousMonth,
      collectedForBillingMonth: monthlyRevenue,
      previousCollectedForBillingMonth: previousMonthRevenue,
      expensesForBillingMonth: monthlyExpenses,
      fallbackUsed: hasError,
    });

    if (hasError) {
      logger.warn('principalhub.financials.snapshot_fallback', {
        preschoolId,
        month: currentMonth,
        previousMonth,
        errors: errorMessages,
        currentSnapshotLoaded: Boolean(currentSnapshot),
        previousSnapshotLoaded: Boolean(previousSnapshot),
      });
    }

    return {
      monthlyRevenue,
      previousMonthRevenue,
      monthlyExpenses,
      hasError,
      errorMessage: errorMessages.length ? errorMessages.join(' | ') : null,
    };
  } catch (error) {
    const message = reasonToMessage(error) || 'Failed to load financial summary';
    logger.warn('principalhub.financials.snapshot_fallback', {
      preschoolId,
      month: currentMonth,
      previousMonth,
      reason: message,
      source: 'catch_block',
    });
    return {
      monthlyRevenue: 0,
      previousMonthRevenue: 0,
      monthlyExpenses: 0,
      hasError: true,
      errorMessage: message,
    };
  }
}

/**
 * Assemble the full `FinancialSummary` object from raw revenue + petty-cash metrics.
 */
export function buildFinancialSummary(
  raw: FinancialRawResult,
  pettyCash: { currentBalance?: number; monthlyExpenses?: number; pendingTransactionsCount?: number },
): FinancialSummary {
  const totalExpenses = Number(raw.monthlyExpenses || 0);
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
    hasDataError: raw.hasError,
    dataErrorMessage: raw.errorMessage || null,
    timestamp: new Date().toISOString(),
  };
}
