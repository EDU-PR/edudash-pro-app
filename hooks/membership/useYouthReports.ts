/**
 * Hook for youth reports data
 * Data Sources: organization_members, organization_budgets, organization_transactions,
 *               organization_announcements, organization_events
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';

export interface ReportData {
  membershipStats: { totalMembers: number; activeMembers: number; newThisMonth: number; growth: number };
  programStats: { totalPrograms: number; activePrograms: number; completedPrograms: number; totalParticipants: number };
  financialStats: { budgetAllocated: number; budgetSpent: number; pendingRequests: number; utilizationRate: number };
  engagementStats: { eventsHosted: number; averageAttendance: number; feedbackScore: number; socialReach: number };
}

export interface MonthlyDataPoint {
  month: string;
  members: number;
}

type PeriodType = 'week' | 'month' | 'quarter' | 'year';

export function useYouthReports(period: PeriodType = 'month') {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['youth-reports', organizationId, period],
    queryFn: async (): Promise<ReportData> => {
      if (!organizationId) {
        return getEmptyReportData();
      }

      const supabase = assertSupabase();
      
      // Calculate date ranges
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      // ===== MEMBERSHIP STATS =====
      // Total members
      const { count: totalMembers } = await supabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      // Active members (status = active)
      const { count: activeMembers } = await supabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'active');

      // New this month
      const { count: newThisMonth } = await supabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .gte('joined_at', monthStart.toISOString());

      // Last month count for growth calculation
      const { count: lastMonthCount } = await supabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .lt('joined_at', monthStart.toISOString())
        .gte('joined_at', lastMonthStart.toISOString());

      // Growth rate calculation
      const previousTotal = (totalMembers || 0) - (newThisMonth || 0);
      const growth = previousTotal > 0 
        ? Math.round(((newThisMonth || 0) / previousTotal) * 1000) / 10 
        : 0;

      // ===== FINANCIAL STATS =====
      // Budget allocated (sum of budgeted_amount for current year)
      const { data: budgetData } = await supabase
        .from('organization_budgets')
        .select('budgeted_amount, spent_amount, status')
        .eq('organization_id', organizationId)
        .gte('fiscal_year', now.getFullYear());

      let budgetAllocated = 0;
      let budgetSpent = 0;
      let pendingRequests = 0;

      if (budgetData) {
        budgetAllocated = budgetData.reduce((sum, b) => sum + Number(b.budgeted_amount || 0), 0);
        budgetSpent = budgetData.reduce((sum, b) => sum + Number(b.spent_amount || 0), 0);
        pendingRequests = budgetData
          .filter(b => b.status === 'proposed' || b.status === 'draft')
          .reduce((sum, b) => sum + Number(b.budgeted_amount || 0), 0);
      }

      const utilizationRate = budgetAllocated > 0 
        ? Math.round((budgetSpent / budgetAllocated) * 100) 
        : 0;

      // ===== ENGAGEMENT STATS =====
      // Events hosted (count organization_announcements with type 'event')
      const { count: eventsHosted } = await supabase
        .from('organization_announcements')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('announcement_type', 'event')
        .gte('created_at', yearStart.toISOString());

      // Announcements read count for engagement
      const { data: announcementStats } = await supabase
        .from('organization_announcement_recipients')
        .select('announcement_id, read')
        .eq('read', true);

      const socialReach = announcementStats?.length || 0;

      return {
        membershipStats: {
          totalMembers: totalMembers || 0,
          activeMembers: activeMembers || 0,
          newThisMonth: newThisMonth || 0,
          growth,
        },
        programStats: {
          totalPrograms: 0, // No programs table yet
          activePrograms: 0,
          completedPrograms: 0,
          totalParticipants: 0,
        },
        financialStats: {
          budgetAllocated,
          budgetSpent,
          pendingRequests,
          utilizationRate,
        },
        engagementStats: {
          eventsHosted: eventsHosted || 0,
          averageAttendance: Math.round(socialReach / Math.max(eventsHosted || 1, 1)),
          feedbackScore: 4.5, // Placeholder - needs feedback system
          socialReach,
        },
      };
    },
    enabled: !!organizationId,
    staleTime: 60000,
  });

  return { 
    reportData: data || null, 
    isLoading, 
    isRefreshing: isFetching && !isLoading, 
    error: error as Error | null, 
    refetch 
  };
}

export function useMonthlyMemberData() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['monthly-member-data', organizationId],
    queryFn: async (): Promise<MonthlyDataPoint[]> => {
      if (!organizationId) return getDefaultMonthlyData();

      const supabase = assertSupabase();
      const months: MonthlyDataPoint[] = [];
      const now = new Date();

      // Get data for last 6 months
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        
        const { count } = await supabase
          .from('organization_members')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .lt('joined_at', nextMonth.toISOString());

        months.push({
          month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
          members: count || 0,
        });
      }

      return months;
    },
    enabled: !!organizationId,
    staleTime: 300000, // 5 minutes - this is expensive
  });
}

// Fallback data for when no organization is set
function getEmptyReportData(): ReportData {
  return {
    membershipStats: { totalMembers: 0, activeMembers: 0, newThisMonth: 0, growth: 0 },
    programStats: { totalPrograms: 0, activePrograms: 0, completedPrograms: 0, totalParticipants: 0 },
    financialStats: { budgetAllocated: 0, budgetSpent: 0, pendingRequests: 0, utilizationRate: 0 },
    engagementStats: { eventsHosted: 0, averageAttendance: 0, feedbackScore: 0, socialReach: 0 },
  };
}

function getDefaultMonthlyData(): MonthlyDataPoint[] {
  const now = new Date();
  const months: MonthlyDataPoint[] = [];
  
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
      members: 0,
    });
  }
  
  return months;
}

// Keep MONTHLY_DATA export for backwards compatibility, but now use dynamic data
export const MONTHLY_DATA = getDefaultMonthlyData();

export const formatCurrency = (amount: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
export const formatNumber = (num: number) => num >= 1000 ? `${(num / 1000).toFixed(1)}K` : num.toString();
