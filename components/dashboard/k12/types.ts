/**
 * K12 Dashboard Types
 * Shared types for K12 admin dashboard components
 */

export interface AftercareStat {
  total: number;
  pendingPayment: number;
  paid: number;
  enrolled: number;
}

export interface GradeCount {
  grade: string;
  count: number;
}

export interface Registration {
  id: string;
  status: string;
  child_grade: string;
  child_first_name: string;
  child_last_name: string;
  created_at: string;
}

export interface QuickAction {
  id: string;
  title: string;
  icon: string;
  color: string;
  badge?: number;
  onPress: () => void;
}

// Status color helper
export function getStatusColor(status: string): string {
  switch (status) {
    case 'pending_payment': return '#F59E0B';
    case 'paid': return '#10B981';
    case 'enrolled': return '#3B82F6';
    case 'cancelled': return '#EF4444';
    default: return '#64748B';
  }
}

// Status format helper
export function formatStatus(status: string): string {
  switch (status) {
    case 'pending_payment': return 'Pending';
    case 'paid': return 'Paid';
    case 'enrolled': return 'Enrolled';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}
