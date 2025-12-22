/**
 * Utility functions for Super Admin Subscriptions
 * Extracted from app/screens/super-admin-subscriptions.tsx
 */

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return '#10b981';
    case 'pending_payment':
      return '#f59e0b';
    case 'cancelled':
      return '#ef4444';
    case 'expired':
      return '#6b7280';
    default:
      return '#6b7280';
  }
}

export const INITIAL_CREATE_FORM = {
  school_id: '',
  plan_tier: 'basic',
  plan_id: '',
  billing_frequency: 'monthly',
  seats_total: '10',
};

export const SUBSCRIPTION_FILTERS = ['all', 'active', 'pending_payment', 'cancelled', 'expired'] as const;
