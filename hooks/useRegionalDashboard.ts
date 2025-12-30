/**
 * useRegionalDashboard Hook
 * 
 * Fetches regional dashboard data for regional managers:
 * - Members in their region (detailed view)
 * - Regional statistics
 * - All regions' aggregate counts for comparison (healthy competition)
 * - Pending tasks and recent activities
 */
import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';

export interface RegionMemberCounts {
  regionId: string;
  regionName: string;
  regionCode: string;
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  newThisMonth: number;
}

export interface RegionalMember {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  memberNumber: string | null;
  memberType: string | null;
  membershipStatus: string | null;
  membershipTier: string | null;
  province: string | null;
  city: string | null;
  joinDate: string | null;
  photoUrl: string | null;
}

export interface RegionalStats {
  regionMembers: number;
  activeMembers: number;
  pendingApplications: number;
  newMembersThisMonth: number;
  regionRevenue: number;
  idCardsIssued: number;
}

export interface PendingTask {
  id: string;
  type: 'approval' | 'id_card' | 'payment' | 'expiring';
  title: string;
  description: string;
  count: number;
  urgent: boolean;
  icon: string;
  color: string;
}

export interface RecentActivity {
  id: string;
  type: 'member_joined' | 'member_approved' | 'payment_received' | 'card_printed';
  title: string;
  subtitle: string;
  time: string;
  icon: string;
  color: string;
}

export interface UseRegionalDashboardReturn {
  // User's region data
  regionId: string | null;
  regionName: string;
  regionCode: string;
  regionColor: string;
  
  // Members in user's region
  members: RegionalMember[];
  
  // Stats for user's region
  stats: RegionalStats;
  
  // All regions' counts for comparison
  allRegionCounts: RegionMemberCounts[];
  
  // Tasks and activities
  pendingTasks: PendingTask[];
  recentActivities: RecentActivity[];
  
  // State
  loading: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
}

// Province color mapping
const PROVINCE_COLORS: Record<string, { primary: string; code: string }> = {
  'Gauteng': { primary: '#3B82F6', code: 'GP' },
  'Western Cape': { primary: '#10B981', code: 'WC' },
  'KwaZulu-Natal': { primary: '#F59E0B', code: 'KZN' },
  'Eastern Cape': { primary: '#EF4444', code: 'EC' },
  'Mpumalanga': { primary: '#8B5CF6', code: 'MP' },
  'Limpopo': { primary: '#EC4899', code: 'LP' },
  'Free State': { primary: '#06B6D4', code: 'FS' },
  'North West': { primary: '#84CC16', code: 'NW' },
  'Northern Cape': { primary: '#F97316', code: 'NC' },
};

const SOA_ORGANIZATION_ID = '63b6139a-e21f-447c-b322-376fb0828992';

export function useRegionalDashboard(): UseRegionalDashboardReturn {
  const [regionId, setRegionId] = useState<string | null>(null);
  const [regionName, setRegionName] = useState<string>('');
  const [regionCode, setRegionCode] = useState<string>('');
  const [regionColor, setRegionColor] = useState<string>('#3B82F6');
  
  const [members, setMembers] = useState<RegionalMember[]>([]);
  const [stats, setStats] = useState<RegionalStats>({
    regionMembers: 0,
    activeMembers: 0,
    pendingApplications: 0,
    newMembersThisMonth: 0,
    regionRevenue: 0,
    idCardsIssued: 0,
  });
  const [allRegionCounts, setAllRegionCounts] = useState<RegionMemberCounts[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUserRegion = useCallback(async () => {
    const supabase = assertSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get user's membership and region
    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .select(`
        region_id,
        province,
        organization_id,
        organization_regions (
          id,
          name,
          code
        )
      `)
      .eq('user_id', user.id)
      .eq('organization_id', SOA_ORGANIZATION_ID)
      .single();

    if (memberError || !member) {
      throw new Error('Could not find your membership');
    }

    let rId = member.region_id;
    let rName = member.province || 'Unknown';
    let rCode = 'XX';
    let rColor = '#3B82F6';

    if (member.organization_regions) {
      const region = member.organization_regions as any;
      rId = region.id;
      rName = region.name;
      rCode = region.code;
    }

    // Get color from province mapping
    const provinceConfig = PROVINCE_COLORS[rName];
    if (provinceConfig) {
      rColor = provinceConfig.primary;
      rCode = provinceConfig.code;
    }

    return { regionId: rId, regionName: rName, regionCode: rCode, regionColor: rColor };
  }, []);

  const fetchRegionMembers = useCallback(async (rId: string) => {
    const supabase = assertSupabase();
    
    // Fetch members in this specific region
    const { data, error: fetchError } = await supabase
      .from('organization_members')
      .select(`
        id,
        user_id,
        first_name,
        last_name,
        email,
        phone,
        member_number,
        member_type,
        membership_status,
        membership_tier,
        province,
        city,
        join_date,
        photo_url
      `)
      .eq('organization_id', SOA_ORGANIZATION_ID)
      .eq('region_id', rId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching region members:', fetchError);
      return [];
    }

    return (data || []).map(m => ({
      id: m.id,
      userId: m.user_id,
      firstName: m.first_name,
      lastName: m.last_name,
      email: m.email,
      phone: m.phone,
      memberNumber: m.member_number,
      memberType: m.member_type,
      membershipStatus: m.membership_status,
      membershipTier: m.membership_tier,
      province: m.province,
      city: m.city,
      joinDate: m.join_date,
      photoUrl: m.photo_url,
    }));
  }, []);

  const fetchRegionStats = useCallback(async (rId: string) => {
    const supabase = assertSupabase();
    
    // Get member counts for this region
    const { data: allMembers, error: membersError } = await supabase
      .from('organization_members')
      .select('id, membership_status, join_date')
      .eq('organization_id', SOA_ORGANIZATION_ID)
      .eq('region_id', rId);

    if (membersError) {
      console.error('Error fetching region stats:', membersError);
      return {
        regionMembers: 0,
        activeMembers: 0,
        pendingApplications: 0,
        newMembersThisMonth: 0,
        regionRevenue: 0,
        idCardsIssued: 0,
      };
    }

    const members = allMembers || [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const regionMembers = members.length;
    const activeMembers = members.filter(m => m.membership_status === 'active').length;
    const pendingApplications = members.filter(m => m.membership_status === 'pending').length;
    const newMembersThisMonth = members.filter(m => {
      if (!m.join_date) return false;
      return new Date(m.join_date) >= startOfMonth;
    }).length;

    // TODO: Fetch actual revenue from member_invoices
    // TODO: Fetch ID cards issued count from a tracking table

    return {
      regionMembers,
      activeMembers,
      pendingApplications,
      newMembersThisMonth,
      regionRevenue: 0, // Placeholder - needs invoice aggregation
      idCardsIssued: activeMembers, // Approximate - active members likely have cards
    };
  }, []);

  const fetchAllRegionCounts = useCallback(async () => {
    const supabase = assertSupabase();
    
    // Get all regions for the organization
    const { data: regions, error: regionsError } = await supabase
      .from('organization_regions')
      .select('id, name, code')
      .eq('organization_id', SOA_ORGANIZATION_ID)
      .eq('is_active', true);

    if (regionsError || !regions) {
      console.error('Error fetching regions:', regionsError);
      return [];
    }

    // Get member counts grouped by region
    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select('id, region_id, membership_status, join_date')
      .eq('organization_id', SOA_ORGANIZATION_ID);

    if (membersError) {
      console.error('Error fetching member counts:', membersError);
      return [];
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Aggregate counts per region
    return regions.map(region => {
      const regionMembers = (members || []).filter(m => m.region_id === region.id);
      
      return {
        regionId: region.id,
        regionName: region.name,
        regionCode: region.code,
        totalMembers: regionMembers.length,
        activeMembers: regionMembers.filter(m => m.membership_status === 'active').length,
        pendingMembers: regionMembers.filter(m => m.membership_status === 'pending').length,
        newThisMonth: regionMembers.filter(m => {
          if (!m.join_date) return false;
          return new Date(m.join_date) >= startOfMonth;
        }).length,
      };
    }).sort((a, b) => b.totalMembers - a.totalMembers); // Sort by total members descending
  }, []);

  const fetchPendingTasks = useCallback(async (rId: string) => {
    const supabase = assertSupabase();
    
    // Get pending members needing approval
    const { count: pendingCount } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', SOA_ORGANIZATION_ID)
      .eq('region_id', rId)
      .eq('membership_status', 'pending');

    // Get unpaid invoices
    const { count: unpaidInvoices } = await supabase
      .from('member_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', SOA_ORGANIZATION_ID)
      .in('status', ['draft', 'sent', 'overdue']);

    const tasks: PendingTask[] = [];

    if (pendingCount && pendingCount > 0) {
      tasks.push({
        id: 'pending-approvals',
        type: 'approval',
        title: `Review ${pendingCount} membership applications`,
        description: 'New members awaiting approval',
        count: pendingCount,
        urgent: pendingCount >= 5,
        icon: 'document-text',
        color: '#3B82F6',
      });
    }

    if (unpaidInvoices && unpaidInvoices > 0) {
      tasks.push({
        id: 'unpaid-invoices',
        type: 'payment',
        title: `Follow up on ${unpaidInvoices} unpaid invoices`,
        description: 'Members with outstanding payments',
        count: unpaidInvoices,
        urgent: unpaidInvoices >= 10,
        icon: 'cash',
        color: '#F59E0B',
      });
    }

    // Add default tasks if none found
    if (tasks.length === 0) {
      tasks.push({
        id: 'no-tasks',
        type: 'approval',
        title: 'No pending tasks',
        description: 'All caught up!',
        count: 0,
        urgent: false,
        icon: 'checkmark-circle',
        color: '#10B981',
      });
    }

    return tasks;
  }, []);

  const fetchRecentActivities = useCallback(async (rId: string) => {
    const supabase = assertSupabase();
    
    // Get recently joined members in this region
    const { data: recentMembers, error: recentError } = await supabase
      .from('organization_members')
      .select('id, first_name, last_name, membership_status, created_at, city')
      .eq('organization_id', SOA_ORGANIZATION_ID)
      .eq('region_id', rId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Error fetching recent activities:', recentError);
      return [];
    }

    const activities: RecentActivity[] = (recentMembers || []).map(member => {
      const name = [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Unknown';
      const location = member.city || 'Unknown location';
      const timeAgo = getTimeAgo(member.created_at);
      
      const isApproved = member.membership_status === 'active';
      
      return {
        id: member.id,
        type: isApproved ? 'member_approved' : 'member_joined',
        title: isApproved ? 'Member approved' : 'New member registered',
        subtitle: `${name} - ${location}`,
        time: timeAgo,
        icon: isApproved ? 'checkmark-circle' : 'person-add',
        color: isApproved ? '#10B981' : '#3B82F6',
      };
    });

    return activities;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // First get user's region
      const userRegion = await fetchCurrentUserRegion();
      setRegionId(userRegion.regionId);
      setRegionName(userRegion.regionName);
      setRegionCode(userRegion.regionCode);
      setRegionColor(userRegion.regionColor);

      if (!userRegion.regionId) {
        setError('No region assigned to your account');
        setLoading(false);
        return;
      }

      // Fetch all data in parallel
      const [
        regionMembers,
        regionStats,
        allCounts,
        tasks,
        activities,
      ] = await Promise.all([
        fetchRegionMembers(userRegion.regionId),
        fetchRegionStats(userRegion.regionId),
        fetchAllRegionCounts(),
        fetchPendingTasks(userRegion.regionId),
        fetchRecentActivities(userRegion.regionId),
      ]);

      setMembers(regionMembers);
      setStats(regionStats);
      setAllRegionCounts(allCounts);
      setPendingTasks(tasks);
      setRecentActivities(activities);
    } catch (err) {
      console.error('Error loading regional dashboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [
    fetchCurrentUserRegion,
    fetchRegionMembers,
    fetchRegionStats,
    fetchAllRegionCounts,
    fetchPendingTasks,
    fetchRecentActivities,
  ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    regionId,
    regionName,
    regionCode,
    regionColor,
    members,
    stats,
    allRegionCounts,
    pendingTasks,
    recentActivities,
    loading,
    error,
    refresh,
  };
}

// Helper function to format time ago
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  
  return date.toLocaleDateString();
}

export default useRegionalDashboard;
