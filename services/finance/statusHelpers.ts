/**
 * Payment / petty-cash status mapping and display helpers.
 */

export function mapPaymentStatus(
  status: string,
): 'completed' | 'pending' | 'overdue' | 'approved' | 'rejected' {
  switch (status) {
    case 'completed':
    case 'approved':
      return 'completed';
    case 'pending':
    case 'proof_submitted':
    case 'under_review':
      return 'pending';
    case 'failed':
    case 'rejected':
    case 'reversed':
    case 'voided':
    case 'cancelled':
      return 'rejected';
    case 'overdue':
      return 'overdue';
    default:
      return 'pending';
  }
}

export function mapPettyCashStatus(
  status: string,
): 'completed' | 'pending' | 'overdue' | 'approved' | 'rejected' {
  switch (status) {
    case 'approved':
      return 'completed';
    case 'pending':
      return 'pending';
    case 'rejected':
      return 'rejected';
    default:
      return 'pending';
  }
}

export function normalizeCategoryLabel(value?: string | null): string {
  if (!value) return 'Other';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount);
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'approved':
      return '#10B981';
    case 'pending':
    case 'proof_submitted':
    case 'under_review':
      return '#F59E0B';
    case 'failed':
    case 'rejected':
      return '#EF4444';
    default:
      return '#6B7280';
  }
}

export function getDisplayStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'proof_submitted':
      return 'Proof Submitted';
    case 'under_review':
      return 'Under Review';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
