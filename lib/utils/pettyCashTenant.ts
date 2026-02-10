import { assertSupabase } from '@/lib/supabase';

/**
 * Petty Cash Tenant Column Adapter
 *
 * The `petty_cash_transactions` table historically uses `school_id` as its
 * tenant column, while most other tables use `preschool_id`. This utility
 * provides a try-primary-then-fallback pattern so queries work regardless
 * of which column name exists in the current schema.
 *
 * TODO(deferred): A future migration should rename `school_id` → `preschool_id`
 * on petty_cash_transactions (and petty_cash_accounts / petty_cash_receipts),
 * then update all call-sites to use `preschool_id` directly. This adapter
 * can then be removed. The migration `20260213060000` added a
 * `financial_transaction_id` FK to petty_cash_transactions for dedup;
 * the rename should be done in a separate migration.
 */
export type PettyCashTenantColumn = 'school_id' | 'preschool_id';

const PRIMARY_TENANT_COLUMN: PettyCashTenantColumn = 'school_id';
const FALLBACK_TENANT_COLUMN: PettyCashTenantColumn = 'preschool_id';

const isMissingColumnError = (error: any, column: PettyCashTenantColumn): boolean => {
  if (!error) return false;
  if (error?.code === '42703') return true;
  const message = String(error?.message || '').toLowerCase();
  return message.includes(column) && message.includes('does not exist');
};

type SupabaseResult<T = any> = { data: T | null; error: any };
type Awaitable<T> = T | PromiseLike<T>;

export async function withPettyCashTenant<T>(
  buildQuery: (column: PettyCashTenantColumn, client: ReturnType<typeof assertSupabase>) => Awaitable<SupabaseResult<T>>
): Promise<SupabaseResult<T> & { column: PettyCashTenantColumn }> {
  const client = assertSupabase();
  const primary = await buildQuery(PRIMARY_TENANT_COLUMN, client);
  if (primary?.error && isMissingColumnError(primary.error, PRIMARY_TENANT_COLUMN)) {
    const fallback = await buildQuery(FALLBACK_TENANT_COLUMN, client);
    return { ...fallback, column: FALLBACK_TENANT_COLUMN };
  }
  return { ...primary, column: PRIMARY_TENANT_COLUMN };
}
