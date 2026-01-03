/**
 * Hook for youth reports data
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

export interface ReportData {
  membershipStats: { totalMembers: number; activeMembers: number; newThisMonth: number; growth: number };
  programStats: { totalPrograms: number; activePrograms: number; completedPrograms: number; totalParticipants: number };
  financialStats: { budgetAllocated: number; budgetSpent: number; pendingRequests: number; utilizationRate: number };
  engagementStats: { eventsHosted: number; averageAttendance: number; feedbackScore: number; socialReach: number };
}

const MOCK_DATA: ReportData = {
  membershipStats: { totalMembers: 1245, activeMembers: 1089, newThisMonth: 47, growth: 12.5 },
  programStats: { totalPrograms: 8, activePrograms: 3, completedPrograms: 4, totalParticipants: 865 },
  financialStats: { budgetAllocated: 500000, budgetSpent: 325000, pendingRequests: 85000, utilizationRate: 65 },
  engagementStats: { eventsHosted: 12, averageAttendance: 156, feedbackScore: 4.5, socialReach: 15420 },
};

export const MONTHLY_DATA = [
  { month: 'Aug', members: 980 }, { month: 'Sep', members: 1045 }, { month: 'Oct', members: 1120 },
  { month: 'Nov', members: 1178 }, { month: 'Dec', members: 1198 }, { month: 'Jan', members: 1245 },
];

type PeriodType = 'week' | 'month' | 'quarter' | 'year';

export function useYouthReports(period: PeriodType = 'month') {
  const { profile } = useAuth();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['youth-reports', profile?.organization_id, period],
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 300));
      return MOCK_DATA;
    },
    enabled: !!profile?.organization_id,
    staleTime: 60000,
  });

  return { reportData: data || null, isLoading, isRefreshing: isFetching && !isLoading, error: error as Error | null, refetch };
}

export const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
export const formatNumber = (num: number) => num >= 1000 ? `${(num / 1000).toFixed(1)}K` : num.toString();
