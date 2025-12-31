/**
 * Hook for managing organization board positions
 * Handles fetching, appointment, and vacancy management
 */
import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface BoardPosition {
  id: string;
  organization_id: string;
  position_code: string;
  position_title: string;
  position_order: number;
  member_id: string | null;
  appointed_at: string | null;
  appointed_by: string | null;
  term_start: string | null;
  term_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined member data
  member?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    photo_url: string | null;
  } | null;
}

export interface AppointableMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  photo_url: string | null;
  member_type: string | null;
}

interface UseBoardPositionsResult {
  positions: BoardPosition[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  appointMember: (positionId: string, memberId: string) => Promise<boolean>;
  removeMember: (positionId: string) => Promise<boolean>;
  appointableMembers: AppointableMember[];
  loadingMembers: boolean;
  fetchAppointableMembers: () => Promise<void>;
  initializePositions: () => Promise<boolean>;
}

export function useBoardPositions(organizationId?: string): UseBoardPositionsResult {
  const { profile } = useAuth();
  const [positions, setPositions] = useState<BoardPosition[]>([]);
  const [appointableMembers, setAppointableMembers] = useState<AppointableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgId = organizationId || profile?.organization_membership?.organization_id;

  const fetchPositions = useCallback(async () => {
    if (!orgId) {
      setPositions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const supabase = assertSupabase();

      const { data, error: fetchError } = await supabase
        .from('organization_board_positions')
        .select(`
          *,
          member:member_id(id, first_name, last_name, photo_url)
        `)
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('position_order', { ascending: true });

      if (fetchError) throw fetchError;

      setPositions(data || []);
    } catch (err) {
      console.error('Error fetching board positions:', err);
      setError('Failed to load board positions');
      // Return empty array instead of mock data - positions will be initialized by org admin
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const fetchAppointableMembers = useCallback(async () => {
    if (!orgId) return;

    try {
      setLoadingMembers(true);
      const supabase = assertSupabase();

      // Get active members who can be appointed (not already in a main board position)
      const { data, error: fetchError } = await supabase
        .from('organization_members')
        .select('id, first_name, last_name, email, photo_url, member_type')
        .eq('organization_id', orgId)
        .eq('membership_status', 'active')
        .order('first_name', { ascending: true });

      if (fetchError) throw fetchError;

      // Filter out members already in board positions
      const occupiedMemberIds = positions
        .filter(p => p.member_id)
        .map(p => p.member_id);

      const available = (data || []).filter(
        m => !occupiedMemberIds.includes(m.id)
      );

      setAppointableMembers(available);
    } catch (err) {
      console.error('Error fetching appointable members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, [orgId, positions]);

  const initializePositions = useCallback(async (): Promise<boolean> => {
    if (!orgId) return false;

    try {
      const supabase = assertSupabase();

      // Call the function to initialize default positions
      const { error: initError } = await supabase.rpc(
        'initialize_organization_board_positions',
        { p_organization_id: orgId }
      );

      if (initError) throw initError;

      // Refetch positions
      await fetchPositions();
      return true;
    } catch (err) {
      console.error('Error initializing board positions:', err);
      setError('Failed to initialize board positions');
      return false;
    }
  }, [orgId, fetchPositions]);

  const appointMember = useCallback(async (
    positionId: string,
    memberId: string
  ): Promise<boolean> => {
    try {
      const supabase = assertSupabase();
      // Get the appointer's member ID from org_members based on user_id
      let appointerId: string | null = null;
      if (profile?.id && orgId) {
        const { data: memberData } = await supabase
          .from('organization_members')
          .select('id')
          .eq('user_id', profile.id)
          .eq('organization_id', orgId)
          .single();
        appointerId = memberData?.id || null;
      }

      const { error: appointError } = await supabase.rpc('appoint_board_member', {
        p_position_id: positionId,
        p_member_id: memberId,
        p_appointed_by: appointerId,
      });

      if (appointError) throw appointError;

      // Refetch positions
      await fetchPositions();
      return true;
    } catch (err) {
      console.error('Error appointing board member:', err);
      setError('Failed to appoint member');
      return false;
    }
  }, [profile, fetchPositions]);

  const removeMember = useCallback(async (positionId: string): Promise<boolean> => {
    try {
      const supabase = assertSupabase();

      const { error: removeError } = await supabase
        .from('organization_board_positions')
        .update({
          member_id: null,
          appointed_at: null,
          appointed_by: null,
          term_start: null,
        })
        .eq('id', positionId);

      if (removeError) throw removeError;

      // Refetch positions
      await fetchPositions();
      return true;
    } catch (err) {
      console.error('Error removing board member:', err);
      setError('Failed to remove member');
      return false;
    }
  }, [fetchPositions]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  return {
    positions,
    loading,
    error,
    refetch: fetchPositions,
    appointMember,
    removeMember,
    appointableMembers,
    loadingMembers,
    fetchAppointableMembers,
    initializePositions,
  };
}

/**
 * Convert board positions to the format expected by BoardComponents
 */
export function positionsToLegacyFormat(positions: BoardPosition[]): {
  id: string;
  name: string;
  role: string;
  since: string;
  photo?: string;
  positionId: string;
}[] {
  // Default positions if none exist
  const defaultPositions = [
    { position_code: 'president', position_title: 'President & Chairperson', position_order: 1 },
    { position_code: 'vice_chairperson', position_title: 'Vice Chairperson', position_order: 2 },
    { position_code: 'secretary', position_title: 'Secretary', position_order: 3 },
    { position_code: 'treasurer', position_title: 'Treasurer', position_order: 4 },
    { position_code: 'board_member', position_title: 'Board Member', position_order: 5 },
  ];

  if (positions.length === 0) {
    // Return vacant positions using default list
    return defaultPositions.map((p, idx) => ({
      id: `vacant-${idx}`,
      name: 'Position Vacant',
      role: p.position_title,
      since: '-',
      positionId: '',
    }));
  }

  return positions.map(p => {
    const memberName = p.member
      ? `${p.member.first_name || ''} ${p.member.last_name || ''}`.trim() || 'Unknown'
      : 'Position Vacant';

    const since = p.term_start
      ? new Date(p.term_start).getFullYear().toString()
      : '-';

    return {
      id: p.id,
      name: memberName,
      role: p.position_title,
      since,
      photo: p.member?.photo_url || undefined,
      positionId: p.id,
    };
  });
}

export default useBoardPositions;
