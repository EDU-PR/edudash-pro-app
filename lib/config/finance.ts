/**
 * Finance Month Cutoff Day
 *
 * Defines the day of the month that marks the billing boundary.
 * For example, with cutoff = 24:
 *   - Billing period for "March" runs from Feb 25 → Mar 23 (parents pay from 25th).
 *   - Fees due in "March" are generated for students active as of Mar 1.
 *
 * Used by:
 * - `FinancialDataService.monthStartIsoWithCutoff()` (client-side date anchoring)
 * - `get_finance_month_snapshot` RPC (server-side month boundary)
 * - `generate-monthly-fees` Edge Function (cron — env var FINANCE_MONTH_CUTOFF_DAY)
 *
 * When changing this value, also update the environment variable
 * `FINANCE_MONTH_CUTOFF_DAY` in Supabase Edge Function secrets.
 */
export const FINANCE_MONTH_CUTOFF_DAY = 24;

/**
 * Fetch per-school finance cutoff day. Falls back to FINANCE_MONTH_CUTOFF_DAY if not set.
 */
export async function getFinanceCutoffForOrg(orgId: string | null | undefined): Promise<number> {
  if (!orgId) return FINANCE_MONTH_CUTOFF_DAY;
  try {
    const { assertSupabase } = await import('@/lib/supabase');
    const client = assertSupabase();
    const { data } = await client
      .from('preschools')
      .select('finance_month_cutoff_day')
      .eq('id', orgId)
      .single();
    const cutoff = data?.finance_month_cutoff_day;
    if (typeof cutoff === 'number' && cutoff >= 1 && cutoff <= 28) return cutoff;
    return FINANCE_MONTH_CUTOFF_DAY;
  } catch {
    return FINANCE_MONTH_CUTOFF_DAY;
  }
}
