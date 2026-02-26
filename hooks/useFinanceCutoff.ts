/**
 * Hook to fetch per-school finance cutoff day for the given org.
 * Falls back to global FINANCE_MONTH_CUTOFF_DAY when not set or on error.
 */

import { useQuery } from '@tanstack/react-query';
import { getFinanceCutoffForOrg } from '@/lib/config/finance';

export function useFinanceCutoff(orgId: string | null | undefined): number {
  const { data: cutoff } = useQuery({
    queryKey: ['financeCutoff', orgId ?? ''],
    queryFn: () => getFinanceCutoffForOrg(orgId),
    enabled: Boolean(orgId),
  });
  return cutoff ?? 24; // 24 = FINANCE_MONTH_CUTOFF_DAY default
}
