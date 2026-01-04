/**
 * Constants for Youth Executive Invite Screen
 */

// Youth Executive Positions
export const EXECUTIVE_POSITIONS = [
  { id: 'deputy_president', label: 'Deputy President', icon: 'person', color: '#8B5CF6' },
  { id: 'secretary', label: 'Secretary', icon: 'document-text', color: '#3B82F6' },
  { id: 'treasurer', label: 'Treasurer', icon: 'wallet', color: '#10B981' },
  { id: 'organizer', label: 'Organizer', icon: 'calendar', color: '#F59E0B' },
  { id: 'communications', label: 'Communications Officer', icon: 'megaphone', color: '#EF4444' },
  { id: 'coordinator', label: 'Youth Coordinator', icon: 'people', color: '#06B6D4' },
  { id: 'additional_member', label: 'Additional Member', icon: 'add-circle', color: '#6B7280' },
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
