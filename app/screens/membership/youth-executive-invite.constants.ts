/**
 * Constants for Youth Executive Invite Screen
 */

// Youth Executive Positions - IDs must match database member_type constraint
export const EXECUTIVE_POSITIONS = [
  { id: 'youth_deputy', label: 'Deputy President', icon: 'person', color: '#8B5CF6' },
  { id: 'youth_secretary', label: 'Secretary', icon: 'document-text', color: '#3B82F6' },
  { id: 'youth_treasurer', label: 'Treasurer', icon: 'wallet', color: '#10B981' },
  { id: 'youth_coordinator', label: 'Youth Coordinator', icon: 'people', color: '#06B6D4' },
  { id: 'youth_facilitator', label: 'Youth Facilitator', icon: 'school', color: '#F59E0B' },
  { id: 'youth_mentor', label: 'Youth Mentor', icon: 'heart', color: '#EF4444' },
  { id: 'youth_member', label: 'Youth Member', icon: 'add-circle', color: '#6B7280' },
] as const;

export type ExecutivePosition = typeof EXECUTIVE_POSITIONS[number];

export interface ExecutiveInvite {
  id: string;
  position: string;
  position_label: string;
  email?: string;
  phone?: string;
  invite_code: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  accepted_by?: string;
  accepted_name?: string;
}

// Status colors for badges
export const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  approved: '#10B981',
  rejected: '#EF4444',
  revoked: '#EF4444',
  cancelled: '#EF4444',
  expired: '#6B7280',
};

export const getStatusColor = (status: string): string => {
  return STATUS_COLORS[status] || '#6B7280';
};

// Generate executive invite code with EX- prefix
export const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'EX-';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};
