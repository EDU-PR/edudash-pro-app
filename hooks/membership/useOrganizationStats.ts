/**
 * useOrganizationStats - Fetch real organization statistics for CEO/President dashboard
 * Replaces mock data with real Supabase queries
 */
import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';

export interface OrganizationStats {
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  newMembersThisMonth: number;
  membershipGrowth: number;
  activeRegions: number;
  totalRegions: number;
  regionalManagersAssigned: number;
  regionalManagersVacant: number;
  pendingApprovals: number;
}

export interface RegionWithStats {
  id: string;
  name: string;
  code: string;
  province_code: string | null;
  is_active: boolean;
  manager_id: string | null; // organization_members.id for navigation
  manager_user_id?: string | null; // Original user_id from organization_regions
  manager_name: string | null;
  manager_email: string | null;
  member_count: number;
  pending_count: number;
  growth_percent: number;
}

export interface PendingMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  member_type: string;
  region_name: string;
  created_at: string;
}

interface UseOrganizationStatsReturn {
  stats: OrganizationStats | null;
  regions: RegionWithStats[];
  pendingMembers: PendingMember[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  organizationId: string | null;
  organizationName: string | null;
}

interface UseOrganizationStatsOptions {
  memberType?: string; // Filter by member type (e.g., 'youth_president' to show only youth structure)
}

export function useOrganizationStats(options: UseOrganizationStatsOptions = {}): UseOrganizationStatsReturn {
  const { memberType } = options;
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [regions, setRegions] = useState<RegionWithStats[]>([]);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const supabase = assertSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('Not authenticated');
        return;
      }

      // Get user's organization membership
      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select(`
          organization_id,
          role,
          member_type,
          organizations (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (membershipError || !membership?.organization_id) {
        console.error('[useOrganizationStats] No organization found:', membershipError);
        setError('No organization found for user');
        return;
      }

      const orgId = membership.organization_id;
      setOrganizationId(orgId);
      const org = membership.organizations as any;
      setOrganizationName(org?.name || 'Organization');

      // Fetch all members for this organization
      // If memberType is youth_president, only show youth wing members
      let membersQuery = supabase
        .from('organization_members')
        .select('id, user_id, membership_status, member_type, role, region_id, created_at, first_name, last_name, email, phone, wing')
        .eq('organization_id', orgId);
      
      // Filter for youth structure if user is youth president
      if (memberType === 'youth_president' || memberType === 'youth_secretary') {
        membersQuery = membersQuery.or('wing.eq.youth,member_type.ilike.youth%');
      }
      
      const { data: allMembers, error: membersError } = await membersQuery;

      if (membersError) {
        console.error('[useOrganizationStats] Error fetching members:', membersError);
        setError('Failed to fetch members');
        return;
      }

      // Fetch all regions for this organization
      // If memberType is youth_president, filter regions (if regions have wing field in future)
      // For now, show all regions but filter members above
      const { data: allRegions, error: regionsError } = await supabase
        .from('organization_regions')
        .select('id, name, code, province_code, is_active, manager_id')
        .eq('organization_id', orgId);

      if (regionsError) {
        console.error('[useOrganizationStats] Error fetching regions:', regionsError);
        setError('Failed to fetch regions');
        return;
      }

      // Calculate stats
      const members = allMembers || [];
      const regionsData = allRegions || [];

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const totalMembers = members.length;
      const activeMembers = members.filter(m => m.membership_status === 'active').length;
      const pendingMembersCount = members.filter(m => m.membership_status === 'pending').length;
      const newThisMonth = members.filter(m => new Date(m.created_at) >= thisMonthStart).length;
      const newLastMonth = members.filter(m => {
        const d = new Date(m.created_at);
        return d >= lastMonthStart && d <= lastMonthEnd;
      }).length;
      
      const membershipGrowth = newLastMonth > 0 
        ? ((newThisMonth - newLastMonth) / newLastMonth * 100) 
        : (newThisMonth > 0 ? 100 : 0);

      // Regional stats
      const activeRegions = regionsData.filter(r => r.is_active).length;
      const regionalManagersAssigned = regionsData.filter(r => r.manager_id).length;
      const regionalManagersVacant = regionsData.filter(r => !r.manager_id && r.is_active).length;

      // Build region stats with member counts
      const regionStats: RegionWithStats[] = await Promise.all(
        regionsData.map(async (region) => {
          const regionMembers = members.filter(m => m.region_id === region.id);
          const memberCount = regionMembers.filter(m => m.membership_status === 'active').length;
          const pendingCount = regionMembers.filter(m => m.membership_status === 'pending').length;
          
          // Get manager info if assigned
          // NOTE: manager_id in organization_regions stores user_id, not organization_members.id
          let managerName = null;
          let managerEmail = null;
          let managerMemberId = null; // The actual organization_members.id for navigation
          
          if (region.manager_id) {
            // Find member by user_id since manager_id stores user_id
            const manager = members.find(m => m.user_id === region.manager_id);
            if (manager) {
              managerName = `${manager.first_name || ''} ${manager.last_name || ''}`.trim();
              managerEmail = manager.email;
              managerMemberId = manager.id; // This is the organization_members.id
            }
          }

          // Calculate growth (new members this month vs last month)
          const newThisMonthRegion = regionMembers.filter(m => new Date(m.created_at) >= thisMonthStart).length;
          const totalLastMonth = regionMembers.filter(m => new Date(m.created_at) < thisMonthStart).length;
          const growthPercent = totalLastMonth > 0 
            ? (newThisMonthRegion / totalLastMonth * 100) 
            : (newThisMonthRegion > 0 ? 100 : 0);

          return {
            id: region.id,
            name: region.name,
            code: region.code,
            province_code: region.province_code,
            is_active: region.is_active ?? true,
            manager_id: managerMemberId, // Use the organization_members.id, not user_id
            manager_user_id: region.manager_id, // Keep original user_id for reference
            manager_name: managerName,
            manager_email: managerEmail,
            member_count: memberCount,
            pending_count: pendingCount,
            growth_percent: growthPercent,
          };
        })
      );

      // Get pending members for approval list
      const pending: PendingMember[] = members
        .filter(m => m.membership_status === 'pending')
        .map(m => {
          const region = regionsData.find(r => r.id === m.region_id);
          return {
            id: m.id,
            first_name: m.first_name || 'Unknown',
            last_name: m.last_name || '',
            email: m.email || '',
            phone: m.phone || '',
            member_type: m.member_type || 'member',
            region_name: region?.name || 'Unassigned',
            created_at: m.created_at,
          };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setStats({
        totalMembers,
        activeMembers,
        pendingMembers: pendingMembersCount,
        newMembersThisMonth: newThisMonth,
        membershipGrowth: Math.round(membershipGrowth * 10) / 10,
        activeRegions,
        totalRegions: regionsData.length,
        regionalManagersAssigned,
        regionalManagersVacant,
        pendingApprovals: pendingMembersCount,
      });

      setRegions(regionStats.sort((a, b) => b.member_count - a.member_count));
      setPendingMembers(pending.slice(0, 20)); // Limit to 20 most recent

    } catch (err) {
      console.error('[useOrganizationStats] Error:', err);
      setError('Failed to load organization stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    regions,
    pendingMembers,
    loading,
    error,
    refetch: fetchStats,
    organizationId,
    organizationName,
  };
}

export default useOrganizationStats;
