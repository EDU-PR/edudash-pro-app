/**
 * Member ID Card Types
 * Type definitions for the membership ID card system
 */

export interface OrganizationRegion {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  province_code?: string;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  region_id?: string;
  user_id?: string;
  profile_id?: string;
  
  member_number: string;
  member_type: 'learner' | 'mentor' | 'facilitator' | 'staff' | 'admin' | 'regional_manager' | 'national_admin' | 'ceo' | 'president' | 'executive' | 'board_member' | 'volunteer' | 'secretary_general' | 'deputy_president' | 'treasurer';
  
  first_name: string;
  last_name: string;
  id_number?: string;
  date_of_birth?: string;
  gender?: string;
  nationality?: string;
  
  email?: string;
  phone?: string;
  physical_address?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  
  membership_tier: 'standard' | 'premium' | 'vip' | 'honorary';
  membership_status: 'pending' | 'active' | 'suspended' | 'expired' | 'cancelled';
  joined_date: string;
  expiry_date?: string;
  
  photo_url?: string;
  skills?: string[];
  qualifications?: any[];
  
  created_at: string;
  updated_at: string;
  
  // Joined relations
  organization?: {
    id: string;
    name: string;
    logo_url?: string;
  };
  region?: OrganizationRegion;
}

export interface MemberIDCard {
  id: string;
  member_id: string;
  organization_id: string;
  card_number: string;
  qr_code_data: string;
  barcode_data?: string;
  status: 'active' | 'suspended' | 'revoked' | 'expired' | 'replacement_requested';
  issue_date: string;
  expiry_date: string;
  card_template: string;
  print_requested: boolean;
  printed: boolean;
  last_verified_at?: string;
  verification_count: number;
  created_at: string;
  
  // Joined
  member?: OrganizationMember;
}

export type CardTemplate = 'standard' | 'premium' | 'executive' | 'learner';

export interface CardTemplateConfig {
  id: CardTemplate;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  gradientColors: string[];
  pattern?: 'none' | 'dots' | 'lines' | 'waves';
}

export const CARD_TEMPLATES: Record<CardTemplate, CardTemplateConfig> = {
  standard: {
    id: 'standard',
    name: 'Standard',
    primaryColor: '#1E40AF',
    secondaryColor: '#3B82F6',
    accentColor: '#60A5FA',
    textColor: '#1F2937',
    backgroundColor: '#FFFFFF',
    gradientColors: ['#1E40AF', '#3B82F6'],
    pattern: 'none',
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    primaryColor: '#7C3AED',
    secondaryColor: '#8B5CF6',
    accentColor: '#A78BFA',
    textColor: '#1F2937',
    backgroundColor: '#FDFCFF',
    gradientColors: ['#7C3AED', '#EC4899'],
    pattern: 'dots',
  },
  executive: {
    id: 'executive',
    name: 'Executive',
    primaryColor: '#0F172A',
    secondaryColor: '#334155',
    accentColor: '#D4AF37',
    textColor: '#0F172A',
    backgroundColor: '#FFFEF7',
    gradientColors: ['#0F172A', '#1E293B'],
    pattern: 'lines',
  },
  learner: {
    id: 'learner',
    name: 'Learner',
    primaryColor: '#059669',
    secondaryColor: '#10B981',
    accentColor: '#34D399',
    textColor: '#1F2937',
    backgroundColor: '#FFFFFF',
    gradientColors: ['#059669', '#10B981'],
    pattern: 'waves',
  },
};

export const MEMBER_TYPE_LABELS: Record<string, string> = {
  learner: 'Learner',
  mentor: 'Mentor',
  facilitator: 'Facilitator',
  staff: 'Staff Member',
  admin: 'President',
  regional_manager: 'Regional Manager',
  national_admin: 'National Administrator',
  ceo: 'President',
  president: 'President',
  executive: 'Executive',
  board_member: 'Board Member',
  volunteer: 'Volunteer',
  secretary_general: 'Secretary General',
  deputy_president: 'Deputy President',
  treasurer: 'Treasurer',
};

export const MEMBERSHIP_TIER_LABELS: Record<string, string> = {
  standard: 'Standard',
  premium: 'Premium',
  vip: 'VIP',
  honorary: 'Honorary',
};

export const STATUS_COLORS: Record<string, string> = {
  active: '#10B981',
  pending: '#F59E0B',
  suspended: '#EF4444',
  expired: '#6B7280',
  cancelled: '#374151',
};

// Type aliases for backward compatibility
export type MemberType = OrganizationMember['member_type'];
export type MembershipTier = OrganizationMember['membership_tier'];
export type MembershipStatus = OrganizationMember['membership_status'];
