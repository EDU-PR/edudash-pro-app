/**
 * Tier Utilities - Shared helpers for subscription tier display
 *
 * Extracted from NewEnhancedTeacherDashboard.tsx per WARP.md §
 * "Keep screens thin — delegate to components".
 *
 * @module lib/utils/tierUtils
 */

/** Get badge color for a subscription tier */
export function getTierColor(tier: string, theme: { textSecondary: string }): string {
  switch (tier?.toLowerCase()) {
    case 'enterprise':
    case 'school_enterprise': return '#8B5CF6'; // Purple
    case 'premium':
    case 'school_premium':
    case 'school_pro':
    case 'group_10': return '#F59E0B'; // Amber/Gold
    case 'starter':
    case 'school_starter':
    case 'group_5': return '#3B82F6'; // Blue
    case 'solo':
    case 'free':
    default: return theme.textSecondary; // Gray
  }
}

/** Format tier string for display */
export function getTierLabel(tier: string): string {
  switch (tier?.toLowerCase()) {
    case 'enterprise':
    case 'school_enterprise': return 'Enterprise';
    case 'premium':
    case 'school_premium':
    case 'school_pro': return 'Premium';
    case 'group_10': return 'Group 10';
    case 'starter':
    case 'school_starter': return 'Starter';
    case 'group_5': return 'Group 5';
    case 'solo': return 'Solo';
    case 'free':
    default: return 'Free';
  }
}

/** Check if a tier is considered premium (has paid features) */
export function isPremiumTier(tier: string): boolean {
  return ['premium', 'pro', 'enterprise', 'school_premium', 'school_pro', 'school_enterprise', 'group_10'].includes(
    tier?.toLowerCase() || ''
  );
}
