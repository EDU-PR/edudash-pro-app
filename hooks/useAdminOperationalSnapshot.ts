import { useQuery } from '@tanstack/react-query';
import { fetchStatsAndCounts } from '@/hooks/principal-hub/fetchStatsAndCounts';
import { FinancialDataService } from '@/services/FinancialDataService';

export interface AdminOperationalSnapshot {
  openApplications: number;
  students: number;
  classes: number;
  feesDueThisMonth: number;
  feesCollectedThisMonth: number;
  feesOutstandingThisMonth: number;
  monthIso: string;
}

interface UseAdminOperationalSnapshotParams {
  orgId?: string | null;
  enabled?: boolean;
}

function currentMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

export function useAdminOperationalSnapshot(params: UseAdminOperationalSnapshotParams) {
  const { orgId, enabled = true } = params;
  const queryEnabled = Boolean(enabled && orgId);

  return useQuery({
    queryKey: ['admin-operational-snapshot', orgId],
    enabled: queryEnabled,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminOperationalSnapshot> => {
      if (!orgId) {
        return {
          openApplications: 0,
          students: 0,
          classes: 0,
          feesDueThisMonth: 0,
          feesCollectedThisMonth: 0,
          feesOutstandingThisMonth: 0,
          monthIso: currentMonthIso(),
        };
      }

      const monthIso = currentMonthIso();

      const [statsResult, monthSnapshotResult] = await Promise.allSettled([
        fetchStatsAndCounts(orgId, 'Organization'),
        FinancialDataService.getMonthSnapshot(orgId, monthIso),
      ]);

      const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
      const monthSnapshot = monthSnapshotResult.status === 'fulfilled'
        ? monthSnapshotResult.value
        : null;

      return {
        openApplications: Number(
          (stats?.applicationsCount || 0) +
          (stats?.pendingRegistrationsCount || 0),
        ),
        students: Number(stats?.studentsCount || 0),
        classes: Number(stats?.classesCount || 0),
        feesDueThisMonth: Number(monthSnapshot?.due_this_month || 0),
        feesCollectedThisMonth: Number(monthSnapshot?.collected_this_month || 0),
        feesOutstandingThisMonth: Number(monthSnapshot?.still_outstanding || 0),
        monthIso,
      };
    },
  });
}

