/**
 * Utility functions for AI Quota management
 * @module components/super-admin/ai-quotas/utils
 */

/**
 * Calculate usage percentage (capped at 100%)
 */
export function getUsagePercentage(current: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min((current / limit) * 100, 100);
}

/**
 * Get color based on usage percentage
 */
export function getUsageColor(percentage: number): string {
  if (percentage >= 100) return '#dc2626';
  if (percentage >= 90) return '#ea580c';
  if (percentage >= 75) return '#d97706';
  return '#059669';
}

/**
 * Get color based on plan type
 */
export function getPlanColor(plan: string): string {
  switch (plan) {
    case 'enterprise':
      return '#7c3aed';
    case 'pro':
      return '#059669';
    case 'basic':
      return '#0ea5e9';
    case 'free':
      return '#6b7280';
    default:
      return '#6b7280';
  }
}

/**
 * Format large numbers with K/M suffix
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

/**
 * Format amount as currency
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Get display text for plan filter
 */
export function getPlanFilterLabel(plan: string): string {
  if (plan === 'all') return 'All Plans';
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

/**
 * Get display text for status filter
 */
export function getStatusFilterLabel(status: string): string {
  switch (status) {
    case 'all':
      return 'All Status';
    case 'over_limit':
      return 'Over Limit';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
