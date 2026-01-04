/**
 * Hook for fetching youth members
 * Uses React Query for data fetching and caching
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { OrganizationMember } from '@/components/membership/types';

// Youth member types to filter by
const YOUTH_MEMBER_TYPES = [
  'youth_member',
  'youth_president',
  'youth_deputy',
  'youth_secretary',
  'youth_treasurer',
];

type FilterType = 'all' | 'active' | 'pending' | 'suspended';
type SortType = 'name' | 'date' | 'region';

interface UseYouthMembersOptions {
  searchQuery?: string;
  statusFilter?: FilterType;
  sortBy?: SortType;
}

interface UseYouthMembersResult {
  members: OrganizationMember[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  stats: {
    total: number;
    active: number;
    pending: number;
  };
  refetch: () => Promise<void>;
}

export function useYouthMembers(options: UseYouthMembersOptions = {}): UseYouthMembersResult {
  const { searchQuery = '', statusFilter = 'all', sortBy = 'name' } = options;
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const queryKey = ['youth-members', orgId, statusFilter, searchQuery];

  const { data, isLoading, isFetching, error, refetch: queryRefetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const supabase = assertSupabase();
      
      if (!orgId) {
        throw new Error('Organization not found');
      }

      let query = supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          organization_id,
          member_number,
          member_type,
          membership_status,
          membership_tier,
          join_date,
          joined_date,
          first_name,
          last_name,
          email,
          phone,
          photo_url,
          province,
          region_id,
          wing,
          created_at,
          updated_at
        `)
        .eq('organization_id', orgId)
        .in('member_type', YOUTH_MEMBER_TYPES)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('membership_status', statusFilter);
      }

      // Apply search
      if (searchQuery.trim()) {
        query = query.or(
          `first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,member_number.ilike.%${searchQuery}%`
        );
      }

      const { data: members, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      return members || [];
    },
    enabled: !!orgId,
    staleTime: 30000, // 30 seconds
  });

  const members = useMemo(() => {
    if (!data) return [];
    
    // Apply client-side sorting
    return [...data].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'region':
          return (a.province || '').localeCompare(b.province || '');
        default:
          return 0;
      }
    });
  }, [data, sortBy]);

  const stats = useMemo(() => {
    const allMembers = data || [];
    return {
      total: allMembers.length,
      active: allMembers.filter(m => m.membership_status === 'active').length,
      pending: allMembers.filter(m => m.membership_status === 'pending').length,
    };
  }, [data]);

  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    members,
    isLoading,
    isRefreshing: isFetching && !isLoading,
    error: error as Error | null,
    stats,
    refetch,
  };
}
