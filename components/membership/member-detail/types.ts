/**
 * Member Detail Types
 * Shared types for member detail components
 */
import type { OrganizationMember, MemberIDCard } from '@/components/membership/types';

export interface ExtendedMember extends OrganizationMember {
  address_line1?: string;
  address_line2?: string;
  postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  type: string;
  status: 'paid' | 'pending' | 'failed';
  reference: string;
}

export interface ActivityRecord {
  id: string;
  date: string;
  action: string;
  details: string;
  icon: string;
  color: string;
}

export interface ProfileHeaderProps {
  member: ExtendedMember;
  theme: any;
}

export interface QuickActionsProps {
  member: ExtendedMember;
  onAction: (action: string) => void;
  theme: any;
}

export interface ProfileTabProps {
  member: ExtendedMember;
  theme: any;
}

export interface PaymentsTabProps {
  payments: PaymentRecord[];
  theme: any;
}

export interface ActivityTabProps {
  activities: ActivityRecord[];
  theme: any;
}

// Mock data
export const MOCK_PAYMENT_HISTORY: PaymentRecord[] = [
  { id: '1', date: '2024-12-01', amount: 1200, type: 'Annual Membership', status: 'paid', reference: 'PF-202412-001' },
  { id: '2', date: '2024-06-15', amount: 500, type: 'Workshop Fee', status: 'paid', reference: 'PF-202406-045' },
  { id: '3', date: '2024-01-15', amount: 1200, type: 'Annual Membership', status: 'paid', reference: 'PF-202401-089' },
  { id: '4', date: '2023-06-01', amount: 350, type: 'Training Materials', status: 'paid', reference: 'PF-202306-012' },
];

export const MOCK_ACTIVITY_LOG: ActivityRecord[] = [
  { id: '1', date: '2024-12-20', action: 'Event Registration', details: 'Registered for National Leadership Summit 2025', icon: 'calendar-outline', color: '#3B82F6' },
  { id: '2', date: '2024-12-15', action: 'Resource Download', details: 'Downloaded Facilitator Onboarding Guide', icon: 'download-outline', color: '#10B981' },
  { id: '3', date: '2024-12-01', action: 'Payment Received', details: 'Annual membership fee - R1,200', icon: 'cash-outline', color: '#F59E0B' },
  { id: '4', date: '2024-11-28', action: 'ID Card Generated', details: 'Premium facilitator ID card issued', icon: 'card-outline', color: '#8B5CF6' },
  { id: '5', date: '2024-11-15', action: 'Profile Updated', details: 'Contact information updated', icon: 'create-outline', color: '#06B6D4' },
];
