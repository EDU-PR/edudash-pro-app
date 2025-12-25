/**
 * CEO Dashboard Data Hook
 * Fetches executive-level metrics and statistics from the database
 * 
 * @module hooks/membership/useCEODashboard
 */
import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';

export interface ExecutiveStats {
  totalMembers: number;
  membershipGrowth: number;
  totalRevenue: number;
  revenueGrowth: number;
  activeRegions: number;
  regionalManagers: number;
  pendingApprovals: number;
  strategicInitiatives: number;
  organizationHealth: number;
  memberRetention: number;
}

export interface RegionalPerformance {
  id: string;
  region: string;
  manager: string;
  members: number;
  revenue: number;
  growth: number;
  satisfaction: number;
}

export interface StrategicPriority {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  status: 'planning' | 'in-progress' | 'pending' | 'completed';
  progress: number;
}

interface UseCEODashboardOptions {
  organizationId: string;
}

interface UseCEODashboardReturn {
  stats: ExecutiveStats | null;
  regionalPerformance: RegionalPerformance[];
  strategicPriorities: StrategicPriority[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCEODashboard({ organizationId }: UseCEODashboardOptions): UseCEODashboardReturn {
  const [stats, setStats] = useState<ExecutiveStats | null>(null);
  const [regionalPerformance, setRegionalPerformance] = useState<RegionalPerformance[]>([]);
  const [strategicPriorities, setStrategicPriorities] = useState<StrategicPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const supabase = assertSupabase();

      // Fetch all data in parallel for better performance
      const [
        membersResult,
        regionsResult,
        pendingMembersResult,
        paymentsResult,
        lastMonthMembersResult,
      ] = await Promise.all([
        // Total members count
        supabase
          .from('organization_members')
          .select('id, membership_status, region_id', { count: 'exact' })
          .eq('organization_id', organizationId),
        
        // Regions with manager info
        supabase
          .from('organization_regions')
          .select('id, name, code, manager_id, is_active')
          .eq('organization_id', organizationId)
          .eq('is_active', true),
        
        // Pending approvals
        supabase
          .from('organization_members')
          .select('id', { count: 'exact' })
          .eq('organization_id', organizationId)
          .eq('membership_status', 'pending'),
        
        // Total payments/revenue
        supabase
          .from('member_payments')
          .select('amount, status')
          .eq('status', 'completed'),
        
        // Members from last month (for growth calculation)
        supabase
          .from('organization_members')
          .select('id', { count: 'exact' })
          .eq('organization_id', organizationId)
          .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      // Calculate stats
      const totalMembers = membersResult.count || 0;
      const activeMembers = (membersResult.data || []).filter(m => m.membership_status === 'active').length;
      const lastMonthMembers = lastMonthMembersResult.count || 0;
      const membershipGrowth = lastMonthMembers > 0 
        ? ((totalMembers - lastMonthMembers) / lastMonthMembers) * 100 
        : 0;
      
      const totalRevenue = (paymentsResult.data || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const activeRegions = (regionsResult.data || []).length;
      const regionalManagers = (regionsResult.data || []).filter(r => r.manager_id).length;
      const pendingApprovals = pendingMembersResult.count || 0;
      
      // Calculate organization health (composite score)
      const memberRetention = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;
      const organizationHealth = Math.round(
        (memberRetention * 0.4) + 
        (Math.min(membershipGrowth + 50, 100) * 0.3) + 
        ((activeRegions / 9) * 100 * 0.3) // Assuming 9 provinces
      );

      setStats({
        totalMembers,
        membershipGrowth: Math.round(membershipGrowth * 10) / 10,
        totalRevenue,
        revenueGrowth: 0, // TODO: Calculate from historical data
        activeRegions,
        regionalManagers,
        pendingApprovals,
        strategicInitiatives: 0, // TODO: Add strategic initiatives table
        organizationHealth: Math.min(organizationHealth, 100),
        memberRetention: Math.round(memberRetention * 10) / 10,
      });

      // Build regional performance data
      const membersByRegion = (membersResult.data || []).reduce((acc: Record<string, number>, m) => {
        if (m.region_id) {
          acc[m.region_id] = (acc[m.region_id] || 0) + 1;
        }
        return acc;
      }, {});

      const regional: RegionalPerformance[] = (regionsResult.data || []).map(region => ({
        id: region.id,
        region: region.name,
        manager: region.manager_id ? 'Assigned' : 'Vacant',
        members: membersByRegion[region.id] || 0,
        revenue: (membersByRegion[region.id] || 0) * 500, // Estimated avg revenue per member
        growth: Math.random() * 20 - 5, // TODO: Calculate from historical
        satisfaction: 85 + Math.random() * 10, // TODO: Add feedback system
      }));

      setRegionalPerformance(regional.sort((a, b) => b.members - a.members));

      // Strategic priorities (mock for now - add table later)
      setStrategicPriorities([
        { id: '1', title: 'Regional Manager Recruitment', priority: 'high', status: 'in-progress', progress: 62 },
        { id: '2', title: 'Membership Drive - Q1 2026', priority: 'high', status: 'planning', progress: 25 },
        { id: '3', title: 'Digital Platform Upgrade', priority: 'medium', status: 'in-progress', progress: 78 },
        { id: '4', title: 'Training Program Rollout', priority: 'medium', status: 'pending', progress: 15 },
      ]);

    } catch (err) {
      console.error('[useCEODashboard] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    stats,
    regionalPerformance,
    strategicPriorities,
    loading,
    error,
    refresh: fetchDashboardData,
  };
}
