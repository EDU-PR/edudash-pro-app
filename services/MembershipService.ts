/**
 * Membership Service
 * 
 * Handles all organization membership operations using Supabase.
 * Includes member CRUD, ID cards, regions, invoices, and events.
 * 
 * For wing/sub-structure operations, see WingService.ts
 */

import { assertSupabase } from '@/lib/supabase';
import type { 
  OrganizationMember, 
  MemberType, 
  MembershipTier, 
  MembershipStatus,
} from '@/components/membership/types';

// ============================================================================
// Types
// ============================================================================

export interface CreateMemberParams {
  organization_id: string;
  region_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  id_number?: string;
  date_of_birth?: string;
  member_type: MemberType;
  membership_tier?: MembershipTier;
  membership_status?: MembershipStatus;
  address_line1?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
}

export interface UpdateMemberParams {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  id_number?: string;
  member_type?: MemberType;
  membership_tier?: MembershipTier;
  membership_status?: MembershipStatus;
  region_id?: string;
  address_line1?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  photo_url?: string;
  notes?: string;
  expiry_date?: string;
}

export interface MemberIDCard {
  id: string;
  member_id: string;
  organization_id: string;
  card_number: string;
  qr_code_data: string;
  status: 'active' | 'suspended' | 'revoked' | 'expired' | 'replacement_requested';
  issue_date: string;
  expiry_date: string;
  card_template: string;
  verification_count: number;
  last_verified_at?: string;
  created_at: string;
}

export interface OrganizationRegion {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  province_code?: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface MemberInvoice {
  id: string;
  organization_id: string;
  member_id: string;
  invoice_number: string;
  description?: string;
  line_items: Array<{ description: string; amount: number; quantity: number }>;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled' | 'refunded';
  issue_date: string;
  due_date?: string;
  paid_date?: string;
  created_at: string;
}

export interface MemberListFilters {
  region_id?: string;
  member_type?: MemberType;
  membership_status?: MembershipStatus;
  membership_tier?: MembershipTier;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Member Operations
// ============================================================================

/**
 * Create a new organization member
 * Handles duplicate detection - returns existing member if already exists
 */
export async function createMember(params: CreateMemberParams): Promise<OrganizationMember> {
  const supabase = assertSupabase();

  // Check for existing member by email or ID number first
  if (params.email || params.id_number) {
    const existingQuery = supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', params.organization_id);
    
    if (params.email) {
      existingQuery.eq('email', params.email.trim());
    } else if (params.id_number) {
      existingQuery.eq('id_number', params.id_number.trim());
    }
    
    const { data: existing } = await existingQuery.maybeSingle();
    
    if (existing) {
      console.log('[MembershipService] Member already exists, returning existing record');
      return existing as OrganizationMember;
    }
  }

  const { data, error } = await supabase
    .from('organization_members')
    .insert({
      organization_id: params.organization_id,
      region_id: params.region_id || null,
      first_name: params.first_name.trim(),
      last_name: params.last_name.trim(),
      email: params.email?.trim() || null,
      phone: params.phone?.trim() || null,
      id_number: params.id_number?.trim() || null,
      date_of_birth: params.date_of_birth || null,
      member_type: params.member_type,
      membership_tier: params.membership_tier || 'standard',
      membership_status: params.membership_status || 'pending',
      physical_address: params.address_line1 || null,
      city: params.city || null,
      province: params.province || null,
      postal_code: params.postal_code || null,
      emergency_contact_name: params.emergency_contact_name || null,
      emergency_contact_phone: params.emergency_contact_phone || null,
      notes: params.notes || null,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation (409 Conflict)
    if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
      console.log('[MembershipService] Duplicate detected, fetching existing member');
      
      // Try to fetch the existing member
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', params.organization_id)
        .or(`email.eq.${params.email?.trim()},id_number.eq.${params.id_number?.trim()}`)
        .maybeSingle();
      
      if (existingMember) {
        return existingMember as OrganizationMember;
      }
    }
    
    console.error('Failed to create member:', error);
    throw new Error(error.message || 'Failed to create member');
  }

  return data as OrganizationMember;
}

/**
 * Get member by ID
 */
export async function getMember(memberId: string): Promise<OrganizationMember | null> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('organization_members')
    .select('*, organization_regions(name, code)')
    .eq('id', memberId)
    .single();

  if (error) {
    console.error('Failed to fetch member:', error);
    return null;
  }

  return data as OrganizationMember;
}

/**
 * Update member details
 */
export async function updateMember(
  memberId: string,
  updates: UpdateMemberParams
): Promise<OrganizationMember> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('organization_members')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update member:', error);
    throw new Error(error.message || 'Failed to update member');
  }

  return data as OrganizationMember;
}

/**
 * List members with filters
 */
export async function listMembers(
  organizationId: string,
  filters?: MemberListFilters
): Promise<{ members: OrganizationMember[]; total: number }> {
  const supabase = assertSupabase();

  let query = supabase
    .from('organization_members')
    .select('*, organization_regions(name, code)', { count: 'exact' })
    .eq('organization_id', organizationId);

  // Apply filters
  if (filters?.region_id) {
    query = query.eq('region_id', filters.region_id);
  }
  if (filters?.member_type) {
    query = query.eq('member_type', filters.member_type);
  }
  if (filters?.membership_status) {
    query = query.eq('membership_status', filters.membership_status);
  }
  if (filters?.membership_tier) {
    query = query.eq('membership_tier', filters.membership_tier);
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},member_number.ilike.${searchTerm}`);
  }

  // Pagination
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  // Order by
  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    console.error('Failed to list members:', error);
    throw new Error(error.message || 'Failed to list members');
  }

  return {
    members: (data || []) as OrganizationMember[],
    total: count || 0,
  };
}

/**
 * Delete member (soft delete by changing status)
 */
export async function deleteMember(memberId: string): Promise<void> {
  const supabase = assertSupabase();

  const { error } = await supabase
    .from('organization_members')
    .update({ membership_status: 'cancelled' })
    .eq('id', memberId);

  if (error) {
    console.error('Failed to delete member:', error);
    throw new Error(error.message || 'Failed to delete member');
  }
}

// ============================================================================
// ID Card Operations
// ============================================================================

/**
 * Generate ID card for member
 */
export async function generateIDCard(memberId: string): Promise<MemberIDCard> {
  const supabase = assertSupabase();

  // First get the member to access organization_id
  const member = await getMember(memberId);
  if (!member) {
    throw new Error('Member not found');
  }

  // Calculate expiry date (1 year from now)
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  const { data, error } = await supabase
    .from('member_id_cards')
    .insert({
      member_id: memberId,
      organization_id: member.organization_id,
      card_number: '', // Will be generated by trigger
      qr_code_data: '', // Will be generated by trigger
      expiry_date: expiryDate.toISOString().split('T')[0],
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to generate ID card:', error);
    throw new Error(error.message || 'Failed to generate ID card');
  }

  return data as MemberIDCard;
}

/**
 * Get member's active ID card
 */
export async function getMemberIDCard(memberId: string): Promise<MemberIDCard | null> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('member_id_cards')
    .select('*')
    .eq('member_id', memberId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to fetch ID card:', error);
    return null;
  }

  return data as MemberIDCard | null;
}

/**
 * Verify ID card by QR code data
 */
export async function verifyIDCard(qrCodeData: string): Promise<{
  valid: boolean;
  member?: OrganizationMember;
  card?: MemberIDCard;
  message: string;
}> {
  const supabase = assertSupabase();

  const { data: card, error } = await supabase
    .from('member_id_cards')
    .select('*, organization_members(*)')
    .eq('qr_code_data', qrCodeData)
    .single();

  if (error || !card) {
    return { valid: false, message: 'Invalid QR code' };
  }

  // Check card status
  if (card.status !== 'active') {
    return { valid: false, card: card as MemberIDCard, message: `Card is ${card.status}` };
  }

  // Check expiry
  if (new Date(card.expiry_date) < new Date()) {
    return { valid: false, card: card as MemberIDCard, message: 'Card has expired' };
  }

  // Update verification count
  await supabase
    .from('member_id_cards')
    .update({
      verification_count: (card.verification_count || 0) + 1,
      last_verified_at: new Date().toISOString(),
    })
    .eq('id', card.id);

  return {
    valid: true,
    member: card.organization_members as OrganizationMember,
    card: card as MemberIDCard,
    message: 'Verified successfully',
  };
}

// ============================================================================
// Region Operations
// ============================================================================

/**
 * List organization regions
 */
export async function listRegions(organizationId: string): Promise<OrganizationRegion[]> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('organization_regions')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Failed to list regions:', error);
    throw new Error(error.message || 'Failed to list regions');
  }

  return (data || []) as OrganizationRegion[];
}

/**
 * Create organization region
 */
export async function createRegion(
  organizationId: string,
  params: {
    name: string;
    code: string;
    province_code?: string;
    description?: string;
    contact_email?: string;
    contact_phone?: string;
  }
): Promise<OrganizationRegion> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('organization_regions')
    .insert({
      organization_id: organizationId,
      name: params.name.trim(),
      code: params.code.toUpperCase().trim(),
      province_code: params.province_code?.toUpperCase() || null,
      description: params.description || null,
      contact_email: params.contact_email || null,
      contact_phone: params.contact_phone || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create region:', error);
    throw new Error(error.message || 'Failed to create region');
  }

  return data as OrganizationRegion;
}

// ============================================================================
// Invoice Operations
// ============================================================================

/**
 * Create invoice for member
 */
export async function createInvoice(params: {
  organization_id: string;
  member_id: string;
  description?: string;
  line_items: Array<{ description: string; amount: number; quantity: number }>;
  due_date?: string;
}): Promise<MemberInvoice> {
  const supabase = assertSupabase();

  const subtotal = params.line_items.reduce(
    (sum, item) => sum + item.amount * item.quantity,
    0
  );
  const tax_amount = subtotal * 0.15; // 15% VAT
  const total_amount = subtotal + tax_amount;

  const { data, error } = await supabase
    .from('member_invoices')
    .insert({
      organization_id: params.organization_id,
      member_id: params.member_id,
      invoice_number: '', // Generated by trigger
      description: params.description || null,
      line_items: params.line_items,
      subtotal,
      tax_amount,
      discount_amount: 0,
      total_amount,
      due_date: params.due_date || null,
      status: 'draft',
      created_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create invoice:', error);
    throw new Error(error.message || 'Failed to create invoice');
  }

  return data as MemberInvoice;
}

/**
 * List member invoices
 */
export async function listMemberInvoices(memberId: string): Promise<MemberInvoice[]> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('member_invoices')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to list invoices:', error);
    throw new Error(error.message || 'Failed to list invoices');
  }

  return (data || []) as MemberInvoice[];
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get membership statistics for organization
 */
export async function getMembershipStats(organizationId: string): Promise<{
  total_members: number;
  active_members: number;
  pending_members: number;
  by_type: Record<string, number>;
  by_tier: Record<string, number>;
  by_region: Record<string, number>;
}> {
  const supabase = assertSupabase();

  const { data, error } = await supabase
    .from('organization_members')
    .select('member_type, membership_tier, membership_status, region_id')
    .eq('organization_id', organizationId);

  if (error) {
    console.error('Failed to fetch stats:', error);
    throw new Error(error.message || 'Failed to fetch statistics');
  }

  const members = data || [];
  const stats = {
    total_members: members.length,
    active_members: members.filter((m) => m.membership_status === 'active').length,
    pending_members: members.filter((m) => m.membership_status === 'pending').length,
    by_type: {} as Record<string, number>,
    by_tier: {} as Record<string, number>,
    by_region: {} as Record<string, number>,
  };

  members.forEach((m) => {
    stats.by_type[m.member_type] = (stats.by_type[m.member_type] || 0) + 1;
    stats.by_tier[m.membership_tier] = (stats.by_tier[m.membership_tier] || 0) + 1;
    if (m.region_id) {
      stats.by_region[m.region_id] = (stats.by_region[m.region_id] || 0) + 1;
    }
  });

  return stats;
}
