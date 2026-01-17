/**
 * Hook for fetching a single member's details
 */
import { useState, useEffect, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { OrganizationMember, MemberIDCard } from '@/components/membership/types';
import { MembershipNotificationService } from '@/services/membership/MembershipNotificationService';

// Executive member types that cannot be removed (must be demoted first)
const PROTECTED_EXECUTIVE_TYPES = [
  'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
  'national_admin', 'national_coordinator',
  'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
  'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
  'veterans_president',
  'regional_manager', 'provincial_manager',
];

// Member types that can approve removals (president hierarchy)
const REMOVAL_APPROVERS = [
  'ceo', 'president', 'youth_president', 'women_president', 'veterans_president',
  'national_admin',
];

interface UseMemberDetailReturn {
  member: OrganizationMember | null;
  idCard: MemberIDCard | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateMember: (updates: Partial<OrganizationMember>) => Promise<boolean>;
  suspendMember: () => Promise<boolean>;
  activateMember: () => Promise<boolean>;
  deleteMember: () => Promise<boolean>;
  approveRemoval: () => Promise<boolean>;
  rejectRemoval: () => Promise<boolean>;
  canRemoveMember: boolean;
  canApproveRemoval: boolean;
  isExecutive: boolean;
  isPendingRemoval: boolean;
}

export function useMemberDetail(memberId: string | null): UseMemberDetailReturn {
  const { profile } = useAuth();
  const [member, setMember] = useState<OrganizationMember | null>(null);
  const [idCard, setIdCard] = useState<MemberIDCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get organization ID and current user's member type from profile
  const organizationId = profile?.organization_membership?.organization_id || profile?.organization_id;
  const currentUserMemberType = (profile as any)?.organization_membership?.member_type;
  
  // Check if current user can approve removals (is president or higher)
  const canApproveRemoval = currentUserMemberType ? REMOVAL_APPROVERS.includes(currentUserMemberType) : false;

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
          wing,
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
        wing: memberData.wing || 'main',
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
        .eq('status', 'active')
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

  // Delete member (soft delete - revoke membership or request removal)
  // If current user is a president, directly revoke
  // Otherwise, set to 'pending_removal' status for president approval
  const deleteMember = useCallback(async (): Promise<boolean> => {
    if (!memberId) return false;

    try {
      const supabase = assertSupabase();
      
      // First get the member's organization_id and member_type (needed for RLS policy to match)
      const { data: memberData, error: fetchErr } = await supabase
        .from('organization_members')
        .select('organization_id, user_id, member_type')
        .eq('id', memberId)
        .single();
      
      if (fetchErr || !memberData) {
        console.error('[useMemberDetail] Error fetching member for delete:', fetchErr);
        setError('Member not found');
        return false;
      }

      // Check if the member is an executive
      const isExec = PROTECTED_EXECUTIVE_TYPES.includes(memberData.member_type);
      if (isExec) {
        setError('Cannot delete executive member. Demote the member first.');
        return false;
      }
      
      // Determine status: presidents can directly revoke, others request removal
      const isPresident = currentUserMemberType && REMOVAL_APPROVERS.includes(currentUserMemberType);
      const newStatus = isPresident ? 'revoked' : 'pending_removal';
      
      // Soft delete - revoke membership or request removal
      const { error: deleteError } = await supabase
        .from('organization_members')
        .update({
          membership_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId)
        .eq('organization_id', memberData.organization_id);

      if (deleteError) {
        console.error('[useMemberDetail] Error deleting member:', deleteError);
        setError(deleteError.message);
        return false;
      }

      // If not president, notify the president about pending removal
      if (!isPresident && member) {
        console.log('[useMemberDetail] Removal request created, awaiting president approval');
        
        // Determine wing based on member type
        const wing = member.wing as 'youth' | 'women' | 'veterans' | 'main' || 'youth';
        
        // Send notification to president
        MembershipNotificationService.notifyPresidentOfPendingRemoval({
          member_id: memberId,
          organization_id: memberData.organization_id,
          member_name: `${member.first_name} ${member.last_name}`,
          member_type: member.member_type,
          requested_by_name: profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : 'A secretary',
          requested_by_id: profile?.id,
          region_name: member.region?.name,
        }, wing).catch(err => {
          console.warn('[useMemberDetail] Failed to notify president of pending removal:', err);
        });
      }

      return true;
    } catch (err: any) {
      console.error('[useMemberDetail] Delete exception:', err);
      setError(err.message || 'Failed to remove member');
      return false;
    }
  }, [memberId, currentUserMemberType]);

  // Approve pending removal (president only)
  const approveRemoval = useCallback(async (): Promise<boolean> => {
    if (!memberId || !canApproveRemoval) return false;

    try {
      const supabase = assertSupabase();
      
      const { error: updateError } = await supabase
        .from('organization_members')
        .update({
          membership_status: 'revoked',
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId);

      if (updateError) {
        console.error('[useMemberDetail] Error approving removal:', updateError);
        setError(updateError.message);
        return false;
      }

      await fetchMember();
      return true;
    } catch (err: any) {
      console.error('[useMemberDetail] Approve removal exception:', err);
      setError(err.message || 'Failed to approve removal');
      return false;
    }
  }, [memberId, canApproveRemoval, fetchMember]);

  // Reject pending removal and restore member (president only)
  const rejectRemoval = useCallback(async (): Promise<boolean> => {
    if (!memberId || !canApproveRemoval) return false;

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
        console.error('[useMemberDetail] Error rejecting removal:', updateError);
        setError(updateError.message);
        return false;
      }

      await fetchMember();
      return true;
    } catch (err: any) {
      console.error('[useMemberDetail] Reject removal exception:', err);
      setError(err.message || 'Failed to reject removal');
      return false;
    }
  }, [memberId, canApproveRemoval, fetchMember]);

  // Initial fetch
  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  const isExecutive = member ? PROTECTED_EXECUTIVE_TYPES.includes(member.member_type) : false;
  const canRemoveMember = !isExecutive;
  const isPendingRemoval = member?.membership_status === 'pending_removal';

  return {
    member,
    idCard,
    loading,
    error,
    refetch: fetchMember,
    updateMember,
    suspendMember,
    activateMember,
    deleteMember,
    approveRemoval,
    rejectRemoval,
    canRemoveMember,
    canApproveRemoval,
    isExecutive,
    isPendingRemoval,
  };
}
