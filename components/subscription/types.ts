/**
 * Subscription upgrade screen types
 */

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: string;
  price_monthly: number;
  price_annual: number;
  max_teachers: number;
  max_students: number;
  features: string[];
  is_active: boolean;
  school_types: string[];
}

export interface RouteParams {
  currentTier?: string | string[];
  reason?: string | string[];
  feature?: string | string[];
}

export interface UpgradeReason {
  icon: string;
  color: string;
  title: string;
  subtitle: string;
}

// Predefined reasons with safe defaults
export const UPGRADE_REASONS: Record<string, UpgradeReason> = {
  limit_reached: {
    icon: 'warning',
    color: '#f59e0b',
    title: 'Upgrade Required',
    subtitle: "You've reached your current plan limits"
  },
  feature_needed: {
    icon: 'lock-closed',
    color: '#8b5cf6',
    title: 'Unlock Premium Features',
    subtitle: 'This feature requires a higher tier plan'
  },
  manual_upgrade: {
    icon: 'trending-up',
    color: '#10b981',
    title: 'Upgrade Your Plan',
    subtitle: 'Get access to more features and higher limits'
  }
};

export const DEFAULT_REASON = UPGRADE_REASONS.manual_upgrade;
