import type { SubscriptionPlan } from '@/lib/subscriptions/rpc-subscriptions';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface PlanChangeSubscription {
  id: string;
  plan_id: string;
  billing_frequency: string;
  seats_total: number;
  school_id: string;
  status?: string;
}

export interface PlanChangeSchool {
  id: string;
  name: string;
}

export interface PlanChangeModalProps {
  visible: boolean;
  onClose: () => void;
  subscription: PlanChangeSubscription | null;
  school: PlanChangeSchool | null;
  onSuccess: () => void;
}

export type ButtonState = 'default' | 'success' | 'error';

export interface PlanChangeFormState {
  selectedPlanId: string;
  billingFrequency: 'monthly' | 'annual';
  seatsTotal: string;
  reason: string;
}

export interface TierDisplayInfo {
  emoji: string;
  level: string;
  color: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

export const TIER_ORDER: Record<string, number> = {
  'free': 0,
  'school_starter': 1,
  'starter': 1,
  'basic': 2,
  'school_premium': 3,
  'premium': 3,
  'school_pro': 4,
  'pro': 4,
  'school_enterprise': 5,
  'enterprise': 5,
};

export const TIER_DISPLAY: Record<string, TierDisplayInfo> = {
  'free': { emoji: '🆓', level: 'Free Tier', color: '#6b7280' },
  'school_starter': { emoji: '🚀', level: 'School Starter', color: '#3b82f6' },
  'school_premium': { emoji: '⭐', level: 'School Premium', color: '#8b5cf6' },
  'school_pro': { emoji: '💎', level: 'School Pro', color: '#f59e0b' },
  'school_enterprise': { emoji: '🏢', level: 'School Enterprise', color: '#ef4444' },
  'starter': { emoji: '🚀', level: 'Starter', color: '#3b82f6' },
  'basic': { emoji: '📊', level: 'Basic', color: '#06b6d4' },
  'premium': { emoji: '⭐', level: 'Premium', color: '#8b5cf6' },
  'pro': { emoji: '💎', level: 'Pro', color: '#f59e0b' },
  'enterprise': { emoji: '🏢', level: 'Enterprise', color: '#ef4444' },
};

export const DEFAULT_TIER_DISPLAY: TierDisplayInfo = { emoji: '📦', level: 'Unknown', color: '#6b7280' };

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getTierDisplayInfo(tier: string): TierDisplayInfo {
  return TIER_DISPLAY[(tier || '').toLowerCase()] ?? DEFAULT_TIER_DISPLAY;
}

export function sortPlansByTier(plans: SubscriptionPlan[]): SubscriptionPlan[] {
  return [...plans].sort((a, b) => {
    const aOrder = TIER_ORDER[(a.tier || '').toLowerCase()] ?? 999;
    const bOrder = TIER_ORDER[(b.tier || '').toLowerCase()] ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.price_monthly || 0) - (b.price_monthly || 0);
  });
}

export function getPlanPrice(
  plan: SubscriptionPlan | undefined,
  frequency: 'monthly' | 'annual',
): number {
  if (!plan) return 0;
  return frequency === 'annual' ? plan.price_annual : plan.price_monthly;
}
