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
