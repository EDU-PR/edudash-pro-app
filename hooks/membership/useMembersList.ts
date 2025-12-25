/**
 * Hook for fetching and managing organization members list
 */
import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { OrganizationMember } from '@/components/membership/types';

interface UseMembersListOptions {
  searchQuery?: string;
  statusFilter?: 'all' | 'active' | 'pending' | 'expired' | 'suspended';
  memberTypeFilter?: string;
  regionFilter?: string;
  sortBy?: 'name' | 'date' | 'region' | 'status';
  sortOrder?: 'asc' | 'desc';
}

interface UseMembersListReturn {
  members: OrganizationMember[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => Promise<void>;
}

export function useMembersList(options: UseMembersListOptions = {}): UseMembersListReturn {
  const { profile } = useAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  
  const {
    searchQuery = '',
    statusFilter = 'all',
    memberTypeFilter,
    regionFilter,
    sortBy = 'name',
    sortOrder = 'asc',
  } = options;

  // Get organization ID from profile
  const organizationId = profile?.organization_membership?.organization_id || profile?.organization_id;

  const fetchMembers = useCallback(async () => {
    if (!organizationId) {
      console.log('[useMembersList] No organization ID found');
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = assertSupabase();
      
      // Build query
      let query = supabase
        .from('organization_members')
        .select(`
          id,
          organization_id,
          region_id,
          user_id,
          member_number,
          member_type,
          first_name,
          last_name,
          id_number,
          date_of_birth,
          email,
          phone,
          physical_address,
          city,
          province,
          membership_tier,
          membership_status,
          join_date,
          expiry_date,
          photo_url,
          created_at,
          updated_at,
          organization_regions (
            id,
            name,
            code,
            is_active
          )
        `, { count: 'exact' })
        .eq('organization_id', organizationId);

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('membership_status', statusFilter);
      }

      // Apply member type filter
      if (memberTypeFilter) {
        query = query.eq('member_type', memberTypeFilter);
      }

      // Apply region filter
      if (regionFilter) {
        query = query.eq('region_id', regionFilter);
      }

      // Apply search filter (case-insensitive)
      if (searchQuery.trim()) {
        const search = searchQuery.trim().toLowerCase();
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,member_number.ilike.%${search}%,email.ilike.%${search}%`);
      }

      // Apply sorting
      switch (sortBy) {
        case 'name':
          query = query.order('first_name', { ascending: sortOrder === 'asc' })
                       .order('last_name', { ascending: sortOrder === 'asc' });
          break;
        case 'date':
          query = query.order('join_date', { ascending: sortOrder === 'asc' });
          break;
        case 'status':
          query = query.order('membership_status', { ascending: sortOrder === 'asc' });
          break;
        case 'region':
          // For region sorting, we'll sort client-side after fetch
          break;
        default:
          query = query.order('first_name', { ascending: true });
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        console.error('[useMembersList] Error fetching members:', fetchError);
        setError(fetchError.message);
        setMembers([]);
        return;
      }

      // Transform data to match OrganizationMember interface
      const transformedMembers: OrganizationMember[] = (data || []).map((member: any) => ({
        id: member.id,
        organization_id: member.organization_id,
        region_id: member.region_id,
        user_id: member.user_id,
        member_number: member.member_number || `SOA-${member.id?.slice(0, 8) || 'UNKNOWN'}`,
        member_type: member.member_type || 'member',
        first_name: member.first_name || 'Unknown',
        last_name: member.last_name || '',
        id_number: member.id_number,
        date_of_birth: member.date_of_birth,
        email: member.email,
        phone: member.phone,
        physical_address: member.physical_address,
        city: member.city,
        province: member.province,
        membership_tier: member.membership_tier || 'standard',
        membership_status: member.membership_status || 'pending',
        joined_date: member.join_date || member.created_at,
        expiry_date: member.expiry_date,
        photo_url: member.photo_url,
        created_at: member.created_at,
        updated_at: member.updated_at,
        region: member.organization_regions ? {
          id: member.organization_regions.id,
          organization_id: member.organization_id,
          name: member.organization_regions.name,
          code: member.organization_regions.code,
          is_active: member.organization_regions.is_active,
          created_at: '',
        } : undefined,
      }));

      // Sort by region name if needed
      if (sortBy === 'region') {
        transformedMembers.sort((a, b) => {
          const aRegion = a.region?.name || '';
          const bRegion = b.region?.name || '';
          return sortOrder === 'asc' 
            ? aRegion.localeCompare(bRegion)
            : bRegion.localeCompare(aRegion);
        });
      }

      setMembers(transformedMembers);
      setTotalCount(count || transformedMembers.length);
      console.log(`[useMembersList] Loaded ${transformedMembers.length} members`);
    } catch (err: any) {
      console.error('[useMembersList] Exception:', err);
      setError(err.message || 'Failed to fetch members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, searchQuery, statusFilter, memberTypeFilter, regionFilter, sortBy, sortOrder]);

  // Initial fetch
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  return {
    members,
    loading,
    error,
    totalCount,
    refetch: fetchMembers,
  };
}
