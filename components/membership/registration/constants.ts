/**
 * Registration Flow Constants
 * Static configuration for member registration
 */
import type { Ionicons } from '@expo/vector-icons';
import type { MemberType, MembershipTier } from '@/components/membership/types';

export type RegistrationStep = 'region' | 'personal' | 'membership' | 'payment' | 'complete';

export interface StepConfig {
  key: RegistrationStep;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface RegionConfig {
  id: string;
  name: string;
  code: string;
  members: number;
}

export interface MemberTypeConfig {
  type: MemberType;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface MembershipTierConfig {
  tier: MembershipTier;
  title: string;
  price: number;
  features: string[];
}

export const REGISTRATION_STEPS: StepConfig[] = [
  { key: 'region', title: 'Region', icon: 'location-outline' },
  { key: 'personal', title: 'Personal', icon: 'person-outline' },
  { key: 'membership', title: 'Membership', icon: 'ribbon-outline' },
  { key: 'payment', title: 'Payment', icon: 'card-outline' },
  { key: 'complete', title: 'Complete', icon: 'checkmark-circle-outline' },
];

export const SA_REGIONS: RegionConfig[] = [
  { id: 'r1', name: 'Gauteng', code: 'GP', members: 847 },
  { id: 'r2', name: 'Western Cape', code: 'WC', members: 523 },
  { id: 'r3', name: 'KwaZulu-Natal', code: 'KZN', members: 412 },
  { id: 'r4', name: 'Eastern Cape', code: 'EC', members: 298 },
  { id: 'r5', name: 'Limpopo', code: 'LP', members: 234 },
  { id: 'r6', name: 'Mpumalanga', code: 'MP', members: 189 },
  { id: 'r7', name: 'North West', code: 'NW', members: 156 },
  { id: 'r8', name: 'Free State', code: 'FS', members: 134 },
  { id: 'r9', name: 'Northern Cape', code: 'NC', members: 54 },
];

export const MEMBER_TYPES: MemberTypeConfig[] = [
  { type: 'learner', title: 'Learner', description: 'Join to learn and grow with our programs', icon: 'school-outline' },
  { type: 'facilitator', title: 'Facilitator', description: 'Lead workshops and guide learners', icon: 'people-outline' },
  { type: 'mentor', title: 'Mentor', description: 'Provide guidance and support to members', icon: 'heart-outline' },
];

export const MEMBERSHIP_TIERS: MembershipTierConfig[] = [
  { 
    tier: 'standard', 
    title: 'Standard', 
    price: 600, 
    features: ['Digital ID Card', 'Access to resources', 'Event notifications', 'Community access']
  },
  { 
    tier: 'premium', 
    title: 'Premium', 
    price: 1200, 
    features: ['All Standard features', 'Premium ID Card', 'Priority event booking', 'Exclusive workshops', 'Certificate programs']
  },
  { 
    tier: 'vip', 
    title: 'VIP', 
    price: 2500, 
    features: ['All Premium features', 'Executive ID Card', 'One-on-one mentoring', 'Leadership programs', 'Annual summit access', 'VIP networking events']
  },
];
