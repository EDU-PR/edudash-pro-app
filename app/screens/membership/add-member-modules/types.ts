/**
 * Types and constants for Add Member screen
 */
import { MemberType, MembershipTier } from '@/components/membership/types';

// ============================================================================
// Form Data Types
// ============================================================================

export interface AddMemberFormData {
  region_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  id_number: string;
  date_of_birth: string;
  address_line1: string;
  address_line2: string;
  city: string;
  province: string;
  postal_code: string;
  member_type: MemberType;
  membership_tier: MembershipTier;
  membership_status: 'active' | 'pending' | 'suspended';
  emergency_contact_name: string;
  emergency_contact_phone: string;
  notes: string;
  send_welcome_email: boolean;
  generate_id_card: boolean;
  waive_payment: boolean;
}

export interface Region {
  id: string;
  name: string;
  code: string;
}

export interface MemberTypeOption {
  value: MemberType;
  label: string;
}

export interface MembershipTierOption {
  value: MembershipTier;
  label: string;
  price: number;
}

export interface StatusOption {
  value: 'active' | 'pending' | 'suspended';
  label: string;
  color: string;
}

export type RegistrationStatus = 'idle' | 'registering' | 'success' | 'error';

export interface RetryStatus {
  retry: number;
  maxRetries: number;
}

// ============================================================================
// Constants
// ============================================================================

export const REGIONS: Region[] = [
  { id: 'r1', name: 'Gauteng', code: 'GP' },
  { id: 'r2', name: 'Western Cape', code: 'WC' },
  { id: 'r3', name: 'KwaZulu-Natal', code: 'KZN' },
  { id: 'r4', name: 'Eastern Cape', code: 'EC' },
  { id: 'r5', name: 'Limpopo', code: 'LP' },
  { id: 'r6', name: 'Mpumalanga', code: 'MP' },
  { id: 'r7', name: 'North West', code: 'NW' },
  { id: 'r8', name: 'Free State', code: 'FS' },
  { id: 'r9', name: 'Northern Cape', code: 'NC' },
];

export const DEFAULT_MEMBER_TYPES: MemberTypeOption[] = [
  { value: 'learner', label: 'Learner' },
  { value: 'facilitator', label: 'Facilitator' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'regional_manager', label: 'Regional Manager' },
];

export const YOUTH_MEMBER_TYPES: MemberTypeOption[] = [
  { value: 'youth_member' as MemberType, label: 'Youth Member' },
  { value: 'youth_facilitator' as MemberType, label: 'Youth Facilitator' },
  { value: 'youth_mentor' as MemberType, label: 'Youth Mentor' },
  { value: 'youth_coordinator' as MemberType, label: 'Youth Coordinator' },
];

export const WOMENS_MEMBER_TYPES: MemberTypeOption[] = [
  { value: 'women_member' as MemberType, label: "Women's Member" },
  { value: 'women_facilitator' as MemberType, label: "Women's Facilitator" },
  { value: 'women_mentor' as MemberType, label: "Women's Mentor" },
];

export const VETERANS_MEMBER_TYPES: MemberTypeOption[] = [
  { value: 'veterans_member' as MemberType, label: "Veterans Member" },
  { value: 'veterans_coordinator' as MemberType, label: "Veterans Coordinator" },
];

export const MEMBERSHIP_TIERS: MembershipTierOption[] = [
  { value: 'standard', label: 'Standard', price: 20 },
  { value: 'premium', label: 'Premium', price: 350 },
  { value: 'vip', label: 'VIP', price: 600 },
];

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'active', label: 'Active', color: '#10B981' },
  { value: 'pending', label: 'Pending', color: '#F59E0B' },
  { value: 'suspended', label: 'Suspended', color: '#EF4444' },
];

// ============================================================================
// Helper Functions
// ============================================================================

export const getInitialFormData = (defaultMemberType: MemberType = 'learner'): AddMemberFormData => ({
  region_id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  id_number: '',
  date_of_birth: '',
  address_line1: '',
  address_line2: '',
  city: '',
  province: '',
  postal_code: '',
  member_type: defaultMemberType,
  membership_tier: 'standard',
  membership_status: 'active',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  notes: '',
  send_welcome_email: true,
  generate_id_card: true,
  waive_payment: false,
});

export const getMemberTypesForWing = (
  isYouthWing: boolean,
  isWomensWing: boolean,
  isVeteransWing: boolean
): MemberTypeOption[] => {
  if (isYouthWing) return YOUTH_MEMBER_TYPES;
  if (isWomensWing) return WOMENS_MEMBER_TYPES;
  if (isVeteransWing) return VETERANS_MEMBER_TYPES;
  return DEFAULT_MEMBER_TYPES;
};

export const formatCurrency = (amount: number): string => {
  return `R ${amount.toLocaleString('en-ZA')}`;
};

export const buildPhysicalAddress = (formData: AddMemberFormData): string | null => {
  const parts = [
    formData.address_line1?.trim(),
    formData.address_line2?.trim(),
    formData.city?.trim(),
    formData.province?.trim(),
    formData.postal_code?.trim(),
  ].filter(Boolean);
  
  return parts.length > 0 ? parts.join(', ') : null;
};
