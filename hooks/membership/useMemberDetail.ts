/**
 * Hook for fetching a single member's details
 */
import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { OrganizationMember, MemberIDCard } from '@/components/membership/types';

interface UseMemberDetailReturn {
  member: OrganizationMember | null;
  idCard: MemberIDCard | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateMember: (updates: Partial<OrganizationMember>) => Promise<boolean>;
  suspendMember: () => Promise<boolean>;
  activateMember: () => Promise<boolean>;
}

export function useMemberDetail(memberId: string | null): UseMemberDetailReturn {
  const { profile } = useAuth();
  const [member, setMember] = useState<OrganizationMember | null>(null);
  const [idCard, setIdCard] = useState<MemberIDCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get organization ID from profile
  const organizationId = profile?.organization_membership?.organization_id || profile?.organization_id;

  const fetchMember = useCallback(async () => {
    if (!memberId) {
      setMember(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = assertSupabase();
      
      // Fetch member details with region
      const { data: memberData, error: memberError } = await supabase
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
          postal_code,
          membership_tier,
          membership_status,
          join_date,
          expiry_date,
          photo_url,
          emergency_contact_name,
          emergency_contact_phone,
          created_at,
          updated_at,
          organization_regions (
            id,
            name,
            code,
            is_active
          )
        `)
        .eq('id', memberId)
        .single();

      if (memberError) {
        console.error('[useMemberDetail] Error fetching member:', memberError);
        setError(memberError.message);
        setMember(null);
        return;
      }

      // Transform to OrganizationMember
      // Note: organization_regions comes back as an array from the join, take first element
      const regionData = Array.isArray(memberData.organization_regions) 
        ? memberData.organization_regions[0] 
        : memberData.organization_regions;
      
      const transformedMember: OrganizationMember = {
        id: memberData.id,
        organization_id: memberData.organization_id,
        region_id: memberData.region_id,
        user_id: memberData.user_id,
        member_number: memberData.member_number || `SOA-${memberData.id?.slice(0, 8) || 'UNKNOWN'}`,
        member_type: memberData.member_type || 'member',
        first_name: memberData.first_name || 'Unknown',
        last_name: memberData.last_name || '',
        id_number: memberData.id_number,
        date_of_birth: memberData.date_of_birth,
        email: memberData.email,
        phone: memberData.phone,
        physical_address: memberData.physical_address,
        city: memberData.city,
        province: memberData.province,
        membership_tier: memberData.membership_tier || 'standard',
        membership_status: memberData.membership_status || 'pending',
        joined_date: memberData.join_date || memberData.created_at,
        expiry_date: memberData.expiry_date,
        photo_url: memberData.photo_url,
        created_at: memberData.created_at,
        updated_at: memberData.updated_at,
        region: regionData ? {
          id: regionData.id,
          organization_id: memberData.organization_id,
          name: regionData.name,
          code: regionData.code,
          is_active: regionData.is_active,
          created_at: '',
        } : undefined,
      };

      setMember(transformedMember);

      // Fetch ID card if exists
      const { data: cardData, error: cardError } = await supabase
        .from('member_id_cards')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cardData && !cardError) {
        setIdCard(cardData as MemberIDCard);
      }

      console.log(`[useMemberDetail] Loaded member: ${transformedMember.first_name} ${transformedMember.last_name}`);
    } catch (err: any) {
      console.error('[useMemberDetail] Exception:', err);
      setError(err.message || 'Failed to fetch member');
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  // Update member
  const updateMember = useCallback(async (updates: Partial<OrganizationMember>): Promise<boolean> => {
    if (!memberId || !member) return false;

    try {
      const supabase = assertSupabase();
      const { error: updateError } = await supabase
        .from('organization_members')
        .update({
          first_name: updates.first_name,
          last_name: updates.last_name,
          email: updates.email,
          phone: updates.phone,
          physical_address: updates.physical_address,
          city: updates.city,
          province: updates.province,
          membership_tier: updates.membership_tier,
          member_type: updates.member_type,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId);

      if (updateError) {
        console.error('[useMemberDetail] Error updating member:', updateError);
        setError(updateError.message);
        return false;
      }

      // Refresh member data
      await fetchMember();
      return true;
    } catch (err: any) {
      console.error('[useMemberDetail] Update exception:', err);
      setError(err.message || 'Failed to update member');
      return false;
    }
  }, [memberId, member, fetchMember]);

  // Suspend member
  const suspendMember = useCallback(async (): Promise<boolean> => {
    if (!memberId) return false;

    try {
      const supabase = assertSupabase();
      const { error: updateError } = await supabase
        .from('organization_members')
        .update({
          membership_status: 'suspended',
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId);

      if (updateError) {
        console.error('[useMemberDetail] Error suspending member:', updateError);
        setError(updateError.message);
        return false;
      }

      await fetchMember();
      return true;
    } catch (err: any) {
      console.error('[useMemberDetail] Suspend exception:', err);
      setError(err.message || 'Failed to suspend member');
      return false;
    }
  }, [memberId, fetchMember]);

  // Activate member
  const activateMember = useCallback(async (): Promise<boolean> => {
    if (!memberId) return false;

    try {
      const supabase = assertSupabase();
      const { error: updateError } = await supabase
        .from('organization_members')
        .update({
          membership_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId);

      if (updateError) {
        console.error('[useMemberDetail] Error activating member:', updateError);
        setError(updateError.message);
        return false;
      }

      await fetchMember();
      return true;
    } catch (err: any) {
      console.error('[useMemberDetail] Activate exception:', err);
      setError(err.message || 'Failed to activate member');
      return false;
    }
  }, [memberId, fetchMember]);

  // Initial fetch
  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  return {
    member,
    idCard,
    loading,
    error,
    refetch: fetchMember,
    updateMember,
    suspendMember,
    activateMember,
  };
}
