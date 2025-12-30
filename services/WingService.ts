/**
 * Wing Service
 * 
 * Handles all organization wing/sub-structure operations.
 * Includes Youth Wing, Women's League, and Veterans League.
 */

import { assertSupabase } from '@/lib/supabase';
import type { 
  OrganizationMember,
  MembershipStatus,
  OrganizationWingCode,
  OrganizationWing,
  WingRegionalCoordinator,
  AllMemberTypes,
} from '@/components/membership/types';
import { getAppointableRoles } from '@/components/membership/types';

// ============================================================================
// Wing CRUD Operations
// ============================================================================

/**
 * Get all wings for an organization
 */
export async function getOrganizationWings(organizationId: string): Promise<OrganizationWing[]> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('organization_wings')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('wing_code');

  if (error) {
    console.error('Failed to fetch wings:', error);
    throw new Error(error.message || 'Failed to fetch wings');
  }

  return (data || []) as OrganizationWing[];
}

/**
 * Get specific wing by code
 */
export async function getWingByCode(
  organizationId: string, 
  wingCode: OrganizationWingCode
): Promise<OrganizationWing | null> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('organization_wings')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('wing_code', wingCode)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Failed to fetch wing:', error);
    throw new Error(error.message || 'Failed to fetch wing');
  }

  return data as OrganizationWing;
}

/**
 * Create a new wing for an organization
 */
export async function createWing(params: {
  organization_id: string;
  wing_code: OrganizationWingCode;
  name: string;
  description?: string;
  motto?: string;
  min_age?: number;
  max_age?: number;
  email?: string;
  phone?: string;
}): Promise<OrganizationWing> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('organization_wings')
    .insert({
      organization_id: params.organization_id,
      wing_code: params.wing_code,
      name: params.name,
      description: params.description || null,
      motto: params.motto || null,
      min_age: params.min_age || null,
      max_age: params.max_age || null,
      email: params.email || null,
      phone: params.phone || null,
      established_date: new Date().toISOString().split('T')[0],
      created_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create wing:', error);
    throw new Error(error.message || 'Failed to create wing');
  }

  return data as OrganizationWing;
}

/**
 * Update wing leadership
 */
export async function updateWingLeadership(
  wingId: string,
  leadership: {
    president_id?: string | null;
    deputy_id?: string | null;
    secretary_id?: string | null;
    treasurer_id?: string | null;
  }
): Promise<OrganizationWing> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('organization_wings')
    .update({
      ...leadership,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wingId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update wing leadership:', error);
    throw new Error(error.message || 'Failed to update wing leadership');
  }

  return data as OrganizationWing;
}

// ============================================================================
// Wing Members
// ============================================================================

/**
 * Get wing members
 */
export async function getWingMembers(
  organizationId: string,
  wingCode: OrganizationWingCode,
  filters?: {
    region_id?: string;
    member_type?: string;
    status?: MembershipStatus;
    limit?: number;
    offset?: number;
  }
): Promise<OrganizationMember[]> {
  const supabase = assertSupabase();

  let query = supabase
    .from('organization_members')
    .select('*, organization_regions(name, code)')
    .eq('organization_id', organizationId)
    .eq('wing', wingCode);

  if (filters?.region_id) {
    query = query.eq('region_id', filters.region_id);
  }
  if (filters?.member_type) {
    query = query.eq('member_type', filters.member_type);
  }
  if (filters?.status) {
    query = query.eq('membership_status', filters.status);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, (filters.offset || 0) + (filters.limit || 50) - 1);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch wing members:', error);
    throw new Error(error.message || 'Failed to fetch wing members');
  }

  return (data || []) as OrganizationMember[];
}

// ============================================================================
// Wing Coordinators
// ============================================================================

/**
 * Get wing regional coordinators
 */
export async function getWingCoordinators(wingId: string): Promise<WingRegionalCoordinator[]> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('wing_regional_coordinators')
    .select(`
      *,
      organization_regions(id, name, code, province_code),
      coordinator:organization_members(id, first_name, last_name, member_type, email, phone)
    `)
    .eq('wing_id', wingId)
    .eq('is_active', true);

  if (error) {
    console.error('Failed to fetch wing coordinators:', error);
    throw new Error(error.message || 'Failed to fetch wing coordinators');
  }

  return (data || []) as WingRegionalCoordinator[];
}

/**
 * Appoint a regional coordinator for a wing
 */
export async function appointWingCoordinator(params: {
  wing_id: string;
  region_id: string;
  coordinator_id: string;
  appointed_by: string;
  monthly_float?: number;
  spending_limit?: number;
}): Promise<WingRegionalCoordinator> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('wing_regional_coordinators')
    .upsert({
      wing_id: params.wing_id,
      region_id: params.region_id,
      coordinator_id: params.coordinator_id,
      appointed_by: params.appointed_by,
      appointed_date: new Date().toISOString().split('T')[0],
      monthly_float: params.monthly_float || 10000,
      spending_limit: params.spending_limit || 1000,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'wing_id,region_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to appoint wing coordinator:', error);
    throw new Error(error.message || 'Failed to appoint wing coordinator');
  }

  return data as WingRegionalCoordinator;
}

// ============================================================================
// Appointment Authority
// ============================================================================

/**
 * Check if a member can appoint another role
 */
export async function checkAppointmentAuthority(
  appointerId: string,
  targetRole: AllMemberTypes
): Promise<{ canAppoint: boolean; reason?: string }> {
  const supabase = assertSupabase();

  const { data: appointer, error } = await supabase
    .from('organization_members')
    .select('member_type, wing')
    .eq('id', appointerId)
    .single();

  if (error || !appointer) {
    return { canAppoint: false, reason: 'Appointer not found' };
  }

  const appointableRoles = getAppointableRoles(appointer.member_type as AllMemberTypes);
  
  if (!appointableRoles.includes(targetRole)) {
    return { 
      canAppoint: false, 
      reason: `${appointer.member_type} cannot appoint ${targetRole}` 
    };
  }

  return { canAppoint: true };
}

/**
 * Appoint a member to a new role
 */
export async function appointMember(params: {
  member_id: string;
  new_role: AllMemberTypes;
  new_wing: OrganizationWingCode;
  appointed_by: string;
}): Promise<OrganizationMember> {
  const supabase = assertSupabase();

  // First check authority
  const authority = await checkAppointmentAuthority(params.appointed_by, params.new_role);
  if (!authority.canAppoint) {
    throw new Error(authority.reason || 'Insufficient authority to make this appointment');
  }

  const { data, error } = await supabase
    .from('organization_members')
    .update({
      member_type: params.new_role,
      wing: params.new_wing,
      appointed_by: params.appointed_by,
      appointed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.member_id)
    .select()
    .single();

  if (error) {
    console.error('Failed to appoint member:', error);
    throw new Error(error.message || 'Failed to appoint member');
  }

  return data as OrganizationMember;
}

// ============================================================================
// Wing Statistics
// ============================================================================

/**
 * Get statistics for a specific wing
 */
export async function getWingStats(
  organizationId: string,
  wingCode: OrganizationWingCode
): Promise<{
  total_members: number;
  active_members: number;
  pending_members: number;
  by_type: Record<string, number>;
  by_region: Record<string, number>;
  current_balance: number;
}> {
  const supabase = assertSupabase();

  const { data: members, error: membersError } = await supabase
    .from('organization_members')
    .select('member_type, membership_status, region_id')
    .eq('organization_id', organizationId)
    .eq('wing', wingCode);

  if (membersError) {
    console.error('Failed to fetch wing stats:', membersError);
    throw new Error(membersError.message || 'Failed to fetch wing statistics');
  }

  const { data: wing } = await supabase
    .from('organization_wings')
    .select('current_balance')
    .eq('organization_id', organizationId)
    .eq('wing_code', wingCode)
    .single();

  const memberList = members || [];
  const stats = {
    total_members: memberList.length,
    active_members: memberList.filter((m) => m.membership_status === 'active').length,
    pending_members: memberList.filter((m) => m.membership_status === 'pending').length,
    by_type: {} as Record<string, number>,
    by_region: {} as Record<string, number>,
    current_balance: wing?.current_balance || 0,
  };

  memberList.forEach((m) => {
    stats.by_type[m.member_type] = (stats.by_type[m.member_type] || 0) + 1;
    if (m.region_id) {
      stats.by_region[m.region_id] = (stats.by_region[m.region_id] || 0) + 1;
    }
  });

  return stats;
}

// Re-export helper functions from types
export { 
  getAppointableRoles, 
  canAppoint, 
  getSpendingLimit, 
  canApproveAmount 
} from '@/components/membership/types';
