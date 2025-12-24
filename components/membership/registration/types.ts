/**
 * Registration Data Types
 * Shared types for registration flow components
 */
import type { MemberType, MembershipTier } from '@/components/membership/types';

export interface RegistrationData {
  // Region
  region_id: string;
  region_name: string;
  region_code: string;
  // Personal
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  id_number: string;
  date_of_birth: string;
  address_line1: string;
  city: string;
  postal_code: string;
  // Membership
  member_type: MemberType;
  membership_tier: MembershipTier;
  // Emergency contact
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

export const initialRegistrationData: RegistrationData = {
  region_id: '',
  region_name: '',
  region_code: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  id_number: '',
  date_of_birth: '',
  address_line1: '',
  city: '',
  postal_code: '',
  member_type: 'learner',
  membership_tier: 'standard',
  emergency_contact_name: '',
  emergency_contact_phone: '',
};

export interface StepProps {
  data: RegistrationData;
  onUpdate: (field: keyof RegistrationData, value: string) => void;
  theme: any;
}
