/**
 * Date / month-ISO helpers for financial accounting periods.
 */

import { FINANCE_MONTH_CUTOFF_DAY } from '@/lib/config/finance';
import { isLikelyUtcMonthBoundaryShift, parseDateValue } from '@/lib/utils/dateUtils';

export function monthStartIsoFromDate(
  date: Date,
  options?: { shiftToNextMonth?: boolean },
): string {
  const normalized = options?.shiftToNextMonth
    ? new Date(date.getFullYear(), date.getMonth() + 1, 1)
    : new Date(date.getFullYear(), date.getMonth(), 1);
  return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, '0')}-01`;
}

export function monthStartIsoWithCutoff(
  value?: string | null,
  options?: {
    recoverUtcMonthBoundary?: boolean;
    applyCutoff?: boolean;
    /** Override global cutoff; used for per-school finance cutoff. */
    cutoffDay?: number;
  },
): string | null {
  if (!value) return null;
  const parsed = parseDateValue(value);
  if (!parsed) return null;
  const shouldRecover =
    Boolean(options?.recoverUtcMonthBoundary) && isLikelyUtcMonthBoundaryShift(value, parsed);
  if (shouldRecover) {
    return monthStartIsoFromDate(parsed, { shiftToNextMonth: true });
  }
  const cutoff =
    typeof options?.cutoffDay === 'number' && options.cutoffDay >= 1 && options.cutoffDay <= 28
      ? options.cutoffDay
      : FINANCE_MONTH_CUTOFF_DAY;
  const shouldShiftByCutoff = Boolean(options?.applyCutoff) && parsed.getDate() >= cutoff;
  return monthStartIsoFromDate(parsed, { shiftToNextMonth: shouldShiftByCutoff });
}

export function monthStartIsoFromValue(
  value?: string | null,
  options?: { recoverUtcMonthBoundary?: boolean },
): string | null {
  return monthStartIsoWithCutoff(value, {
    recoverUtcMonthBoundary: options?.recoverUtcMonthBoundary,
    applyCutoff: false,
  });
}

export function normalizeMonthIso(value?: string): string {
  const fallbackNow = new Date();
  return (
    monthStartIsoFromValue(value || fallbackNow.toISOString()) ||
    `${fallbackNow.getFullYear()}-${String(fallbackNow.getMonth() + 1).padStart(2, '0')}-01`
  );
}

export function nextMonthIso(monthIso: string): string {
  const base = new Date(monthIso);
  const date = Number.isNaN(base.getTime()) ? new Date() : base;
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}
