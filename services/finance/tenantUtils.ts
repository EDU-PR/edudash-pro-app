/**
 * Finance tenant column resolution utilities.
 *
 * Tries preschool_id → organization_id → school_id to find the correct
 * tenant column in payment / finance tables.
 */

import type { FinanceTenantColumn } from '../financial/types';

export const PRIMARY_FINANCE_COLUMN: FinanceTenantColumn = 'preschool_id';
export const SECONDARY_FINANCE_COLUMN: FinanceTenantColumn = 'organization_id';
export const FALLBACK_FINANCE_COLUMN: FinanceTenantColumn = 'school_id';

export const isMissingFinanceColumnError = (error: any, column: FinanceTenantColumn): boolean => {
  if (!error) return false;
  if (error?.code === '42703') return true;
  const message = String(error?.message || '').toLowerCase();
  return message.includes(column) && message.includes('does not exist');
};

export const isMissingFinanceTenantColumn = (error: any): boolean =>
  isMissingFinanceColumnError(error, 'preschool_id') ||
  isMissingFinanceColumnError(error, 'organization_id') ||
  isMissingFinanceColumnError(error, 'school_id');

export async function withFinanceTenant<T>(
  buildQuery: (column: FinanceTenantColumn) => PromiseLike<{ data: T | null; error: any; count?: number | null }>,
): Promise<{ data: T | null; error: any; count?: number | null; column: FinanceTenantColumn }> {
  const primary = await buildQuery(PRIMARY_FINANCE_COLUMN);
  if (primary?.error && isMissingFinanceColumnError(primary.error, PRIMARY_FINANCE_COLUMN)) {
    const secondary = await buildQuery(SECONDARY_FINANCE_COLUMN);
    if (secondary?.error && isMissingFinanceColumnError(secondary.error, SECONDARY_FINANCE_COLUMN)) {
      const fallback = await buildQuery(FALLBACK_FINANCE_COLUMN);
      return { ...fallback, column: FALLBACK_FINANCE_COLUMN };
    }
    return { ...secondary, column: SECONDARY_FINANCE_COLUMN };
  }
  return { ...primary, column: PRIMARY_FINANCE_COLUMN };
}
