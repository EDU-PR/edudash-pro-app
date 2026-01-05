/**
 * Member ID Card Types
 * Type definitions for the membership ID card system
 */

// ============================================================================
// Wing Types
// ============================================================================

export type OrganizationWingCode = 'main' | 'youth' | 'women' | 'veterans';

// Main structure member types
export type MainMemberType = 
  | 'learner' | 'mentor' | 'facilitator' | 'staff' | 'admin' 
  | 'regional_manager' | 'branch_manager' | 'provincial_manager' | 'national_admin';

// Youth Wing member types
export type YouthMemberType = 
  | 'youth_president' | 'youth_deputy' | 'youth_secretary' | 'youth_treasurer'
  | 'youth_coordinator' | 'youth_facilitator' | 'youth_mentor' | 'youth_member';

// Women's League member types
export type WomenMemberType = 
  | 'women_president' | 'women_deputy' | 'women_secretary' | 'women_treasurer'
  | 'women_coordinator' | 'women_facilitator' | 'women_mentor' | 'women_member';

// Veterans League member types
export type VeteransMemberType = 
  | 'veterans_president' | 'veterans_coordinator' | 'veterans_member';

// Legacy/executive types for backward compatibility
export type LegacyMemberType = 
  | 'ceo' | 'president' | 'executive' | 'board_member' | 'volunteer' 
  | 'secretary_general' | 'deputy_president' | 'treasurer';

// All member types
export type AllMemberTypes = 
  | MainMemberType | YouthMemberType | WomenMemberType | VeteransMemberType | LegacyMemberType;

// ============================================================================
// Organization Wing Interface
// ============================================================================

export interface OrganizationWing {
  id: string;
  organization_id: string;
  wing_code: OrganizationWingCode;
  name: string;
  description?: string;
  motto?: string;
  president_id?: string;
  deputy_id?: string;
  secretary_id?: string;
  treasurer_id?: string;
  min_age?: number;
  max_age?: number;
  annual_budget: number;
  monthly_allocation: number;
  current_balance: number;
  email?: string;
  phone?: string;
  is_active: boolean;
  established_date?: string;
  created_at: string;
  updated_at: string;
}

export interface WingRegionalCoordinator {
  id: string;
  wing_id: string;
  region_id: string;
  coordinator_id?: string;
  monthly_float: number;
  current_balance: number;
  spending_limit: number;
  is_active: boolean;
  appointed_date: string;
  appointed_by?: string;
  contact_email?: string;
  contact_phone?: string;
  created_at: string;
  // Joined relations
  wing?: OrganizationWing;
  region?: OrganizationRegion;
  coordinator?: OrganizationMember;
}

// ============================================================================
// Core Interfaces
// ============================================================================

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
  member_type: AllMemberTypes;
  wing: OrganizationWingCode;
  
  // Appointment tracking
  appointed_by?: string;
  appointed_at?: string;
  
  // Age verification (for youth wing)
  birth_year?: number;
  age_verified?: boolean;
  age_verified_at?: string;
  
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
  join_date?: string; // Database column name
  joined_date: string; // Mapped for display (alias of join_date)
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
  // Main structure
  learner: 'Learner',
  mentor: 'Mentor',
  facilitator: 'Facilitator',
  staff: 'Staff Member',
  admin: 'Administrator',
  branch_manager: 'Branch Manager',
  regional_manager: 'Regional Manager',
  provincial_manager: 'Provincial Manager',
  national_admin: 'National Administrator',
  
  // Youth Wing
  youth_president: 'Youth President',
  youth_deputy: 'Youth Deputy President',
  youth_secretary: 'Youth Secretary',
  youth_treasurer: 'Youth Treasurer',
  youth_coordinator: 'Youth Coordinator',
  youth_facilitator: 'Youth Facilitator',
  youth_mentor: 'Youth Mentor',
  youth_member: 'Youth Member',
  
  // Women's League
  women_president: "Women's League President",
  women_deputy: "Women's Deputy President",
  women_secretary: "Women's Secretary",
  women_treasurer: "Women's Treasurer",
  women_coordinator: "Women's Coordinator",
  women_facilitator: "Women's Facilitator",
  women_mentor: "Women's Mentor",
  women_member: "Women's Member",
  
  // Veterans
  veterans_president: 'Veterans President',
  veterans_coordinator: 'Veterans Coordinator',
  veterans_member: 'Veterans Member',
  
  // Legacy/executive types
  ceo: 'President',
  president: 'President',
  executive: 'Executive',
  board_member: 'Board Member',
  volunteer: 'Volunteer',
  secretary_general: 'Secretary General',
  deputy_president: 'Deputy President',
  treasurer: 'Treasurer',
};

export const WING_LABELS: Record<OrganizationWingCode, string> = {
  main: 'Main Structure',
  youth: 'Youth Wing',
  women: "Women's League",
  veterans: 'Veterans League',
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

// Re-export financial types from separate file
export * from './financial-types';

// ============================================================================
// Appointment Authority
// ============================================================================

export const APPOINTABLE_ROLES: Record<string, AllMemberTypes[]> = {
  national_admin: [
    // Main structure
    'regional_manager', 'admin', 'staff', 'facilitator', 'mentor', 'learner',
    // Youth Wing
    'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
    'youth_coordinator', 'youth_facilitator', 'youth_mentor', 'youth_member',
    // Women's League
    'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
    'women_coordinator', 'women_facilitator', 'women_mentor', 'women_member',
    // Veterans
    'veterans_president', 'veterans_coordinator', 'veterans_member',
  ],
  regional_manager: ['branch_manager', 'facilitator', 'mentor', 'learner'],
  branch_manager: ['facilitator', 'mentor', 'learner', 'youth_member'],
  youth_president: [
    'youth_deputy', 'youth_secretary', 'youth_treasurer',
    'youth_coordinator', 'youth_facilitator', 'youth_mentor', 'youth_member',
  ],
  youth_deputy: ['youth_coordinator', 'youth_facilitator', 'youth_mentor', 'youth_member'],
  youth_coordinator: ['youth_facilitator', 'youth_mentor', 'youth_member'],
  women_president: [
    'women_deputy', 'women_secretary', 'women_treasurer',
    'women_coordinator', 'women_facilitator', 'women_mentor', 'women_member',
  ],
  women_deputy: ['women_coordinator', 'women_facilitator', 'women_mentor', 'women_member'],
  women_coordinator: ['women_facilitator', 'women_mentor', 'women_member'],
  veterans_president: ['veterans_coordinator', 'veterans_member'],
  veterans_coordinator: ['veterans_member'],
};

export const SPENDING_LIMITS: Record<string, number> = {
  national_admin: 100000,
  admin: 10000,
  provincial_manager: 7500,
  regional_manager: 5000,
  branch_manager: 3000,
  staff: 2000,
  youth_president: 5000,
  youth_deputy: 3000,
  youth_treasurer: 2000,
  youth_secretary: 1000,
  youth_coordinator: 1000,
  youth_facilitator: 500,
  women_president: 5000,
  women_deputy: 3000,
  women_treasurer: 2000,
  women_secretary: 1000,
  women_coordinator: 1000,
  women_facilitator: 500,
  veterans_president: 3000,
  veterans_coordinator: 1000,
};

// ============================================================================
// Helper Functions
// ============================================================================

export function getAppointableRoles(role: AllMemberTypes): AllMemberTypes[] {
  return APPOINTABLE_ROLES[role] || [];
}

export function canAppoint(appointerRole: AllMemberTypes, targetRole: AllMemberTypes): boolean {
  const appointable = getAppointableRoles(appointerRole);
  return appointable.includes(targetRole);
}

export function getSpendingLimit(role: AllMemberTypes): number {
  return SPENDING_LIMITS[role] || 0;
}

export function canApproveAmount(role: AllMemberTypes, amount: number): boolean {
  return amount <= getSpendingLimit(role);
}

export function isYouthWingRole(role: AllMemberTypes): boolean {
  return role.startsWith('youth_');
}

export function isWomensLeagueRole(role: AllMemberTypes): boolean {
  return role.startsWith('women_');
}

export function isVeteransRole(role: AllMemberTypes): boolean {
  return role.startsWith('veterans_');
}

export function getRoleWing(role: AllMemberTypes): OrganizationWingCode {
  if (isYouthWingRole(role)) return 'youth';
  if (isWomensLeagueRole(role)) return 'women';
  if (isVeteransRole(role)) return 'veterans';
  return 'main';
}

// ============================================================================
// Executive Member Types (get photos on ID cards, executive template)
// ============================================================================

/**
 * Member types that are considered "executive" level.
 * Executives get:
 * - Photo displayed on ID card
 * - Executive card template (black/gold design)
 * - Higher visibility in member directories
 */
export const EXECUTIVE_MEMBER_TYPES: AllMemberTypes[] = [
  // National Leadership
  'ceo', 'president', 'executive', 'board_member', 'secretary_general', 'deputy_president', 'treasurer',
  'national_admin',
  // Provincial/Regional Management
  'provincial_manager', 'regional_manager',
  // Youth Wing Executives
  'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
  // Women's League Executives
  'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
  // Veterans League Executives
  'veterans_president',
];

/**
 * Check if a member type is considered executive level.
 * Executive members get special treatment like photos on ID cards.
 */
export function isExecutiveMemberType(memberType: AllMemberTypes | string): boolean {
  return EXECUTIVE_MEMBER_TYPES.includes(memberType as AllMemberTypes);
}

/**
 * Get the appropriate card template for a member based on role and tier.
 * Executives automatically get 'executive' template.
 * Learners get 'learner' template.
 * Others get template based on tier.
 */
export function getCardTemplateForMember(
  memberType: AllMemberTypes | string,
  membershipTier: string
): 'standard' | 'premium' | 'executive' | 'learner' {
  // Executives always get executive template
  if (isExecutiveMemberType(memberType)) {
    return 'executive';
  }
  // Learners get learner template
  if (memberType === 'learner') {
    return 'learner';
  }
  // Others get template based on tier
  switch (membershipTier) {
    case 'vip':
    case 'premium':
      return 'premium';
    case 'honorary':
      return 'executive';
    default:
      return 'standard';
  }
}
