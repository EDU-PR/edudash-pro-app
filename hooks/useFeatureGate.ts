/**
 * useFeatureGate
 *
 * Unified hook for checking feature availability across subscription
 * tiers, user roles, and feature flags. Consolidates the scattered
 * tier/role checks throughout the codebase into a single source of truth.
 *
 * Usage:
 *   const { allowed, reason, tier, role } = useFeatureGate('ai_tutor');
 *   if (!allowed) return <UpgradeBanner reason={reason} />;
 *
 * ≤200 lines per WARP.md
 */

import { useMemo } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FeatureKey =
  // AI features
  | 'ai_chat'
  | 'ai_tutor'
  | 'ai_homework_gen'
  | 'ai_batch_grading'
  | 'ai_lesson_gen'
  | 'ai_image_analysis'
  // Communication
  | 'video_calls'
  | 'voice_calls'
  | 'messaging'
  // Content
  | 'stem_activities'
  | 'report_download'
  | 'media_upload'
  // Admin
  | 'school_analytics'
  | 'teacher_management';

type Tier = 'free' | 'trial' | 'starter' | 'basic' | 'premium' | 'pro' | 'enterprise';
type Role = 'super_admin' | 'principal' | 'teacher' | 'parent' | 'student';

interface FeatureRule {
  minTier: Tier;
  allowedRoles?: Role[];
  description: string;
}

interface FeatureGateResult {
  allowed: boolean;
  reason: string | null;
  tier: string;
  role: string;
  /** The minimum tier required for this feature */
  requiredTier: Tier;
}

// ─── Feature Rules ───────────────────────────────────────────────────────────

const TIER_ORDER: Tier[] = ['free', 'trial', 'starter', 'basic', 'premium', 'pro', 'enterprise'];

const FEATURE_RULES: Record<FeatureKey, FeatureRule> = {
  ai_chat:            { minTier: 'free', description: 'AI Chat Assistant' },
  ai_tutor:           { minTier: 'starter', description: 'AI Tutor with D→T→P→C pipeline' },
  ai_homework_gen:    { minTier: 'starter', allowedRoles: ['teacher', 'principal', 'super_admin'], description: 'AI Homework Generation' },
  ai_batch_grading:   { minTier: 'starter', allowedRoles: ['teacher', 'principal', 'super_admin'], description: 'AI Batch Grading' },
  ai_lesson_gen:      { minTier: 'starter', allowedRoles: ['teacher', 'principal', 'super_admin'], description: 'AI Lesson Generation' },
  ai_image_analysis:  { minTier: 'starter', description: 'AI Image Analysis (OCR)' },
  video_calls:        { minTier: 'starter', description: 'Video Calls' },
  voice_calls:        { minTier: 'starter', description: 'Voice Calls' },
  messaging:          { minTier: 'free', description: 'In-app Messaging' },
  stem_activities:    { minTier: 'free', description: 'STEM Activities' },
  report_download:    { minTier: 'starter', description: 'Report Downloads' },
  media_upload:       { minTier: 'free', description: 'Media Uploads' },
  school_analytics:   { minTier: 'starter', allowedRoles: ['principal', 'super_admin'], description: 'School Analytics' },
  teacher_management: { minTier: 'starter', allowedRoles: ['principal', 'super_admin'], description: 'Teacher Management' },
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useFeatureGate(feature: FeatureKey): FeatureGateResult {
  const { tier: rawTier } = useSubscription();
  const { profile } = useAuth();

  return useMemo(() => {
    const rule = FEATURE_RULES[feature];
    const tier = (rawTier || 'free') as Tier;
    const role = (profile?.role || 'parent') as Role;

    // Super admins bypass all gates
    if (role === 'super_admin') {
      return { allowed: true, reason: null, tier, role, requiredTier: rule.minTier };
    }

    // Check tier
    const userTierIdx = TIER_ORDER.indexOf(tier);
    const requiredTierIdx = TIER_ORDER.indexOf(rule.minTier);
    if (userTierIdx < requiredTierIdx) {
      return {
        allowed: false,
        reason: `${rule.description} requires ${rule.minTier} plan or higher`,
        tier,
        role,
        requiredTier: rule.minTier,
      };
    }

    // Check role restriction
    if (rule.allowedRoles && !rule.allowedRoles.includes(role)) {
      return {
        allowed: false,
        reason: `${rule.description} is only available for ${rule.allowedRoles.join(', ')}`,
        tier,
        role,
        requiredTier: rule.minTier,
      };
    }

    return { allowed: true, reason: null, tier, role, requiredTier: rule.minTier };
  }, [feature, rawTier, profile?.role]);
}

/**
 * Check multiple features at once.
 * Returns a record of feature keys to gate results.
 */
export function useFeatureGates(features: FeatureKey[]): Record<FeatureKey, FeatureGateResult> {
  const { tier: rawTier } = useSubscription();
  const { profile } = useAuth();

  return useMemo(() => {
    const tier = (rawTier || 'free') as Tier;
    const role = (profile?.role || 'parent') as Role;
    const isSuperAdmin = role === 'super_admin';
    const userTierIdx = TIER_ORDER.indexOf(tier);

    const results: Partial<Record<FeatureKey, FeatureGateResult>> = {};

    for (const feature of features) {
      const rule = FEATURE_RULES[feature];
      if (isSuperAdmin) {
        results[feature] = { allowed: true, reason: null, tier, role, requiredTier: rule.minTier };
        continue;
      }

      const requiredTierIdx = TIER_ORDER.indexOf(rule.minTier);
      if (userTierIdx < requiredTierIdx) {
        results[feature] = {
          allowed: false,
          reason: `Requires ${rule.minTier} plan`,
          tier, role, requiredTier: rule.minTier,
        };
        continue;
      }

      if (rule.allowedRoles && !rule.allowedRoles.includes(role)) {
        results[feature] = {
          allowed: false,
          reason: `Not available for ${role}`,
          tier, role, requiredTier: rule.minTier,
        };
        continue;
      }

      results[feature] = { allowed: true, reason: null, tier, role, requiredTier: rule.minTier };
    }

    return results as Record<FeatureKey, FeatureGateResult>;
  }, [features, rawTier, profile?.role]);
}
