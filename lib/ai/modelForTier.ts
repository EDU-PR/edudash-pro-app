/**
 * Tier → default AI model mapping.
 * Single source of truth for "which model to use when client doesn't send one".
 * Aligned with lib/ai/models.ts getDefaultModelForTier; safe to use from client and server.
 *
 * @module lib/ai/modelForTier
 */

import type { SubscriptionTier } from './models';
import { getDefaultModelForTier } from './models';

const TIER_ORDER: SubscriptionTier[] = ['free', 'starter', 'premium', 'enterprise'];

/**
 * Normalize any product/legacy tier string to SubscriptionTier.
 */
export function normalizeTierToSubscription(tier: string | null | undefined): SubscriptionTier {
  const raw = String(tier ?? '')
    .trim()
    .toLowerCase();
  if (!raw) return 'free';
  if (raw === 'trial') return 'starter';
  if (raw.includes('starter') || raw.includes('parent_starter') || raw.includes('teacher_starter') || raw.includes('school_starter'))
    return 'starter';
  if (
    raw.includes('premium') ||
    raw.includes('pro') ||
    raw.includes('plus') ||
    raw.includes('parent_plus') ||
    raw.includes('teacher_pro') ||
    raw.includes('school_pro') ||
    raw.includes('school_premium') ||
    raw.includes('basic')
  )
    return 'premium';
  if (raw.includes('enterprise') || raw.includes('school_enterprise') || raw === 'superadmin' || raw === 'super_admin')
    return 'enterprise';
  return 'free';
}

/**
 * Return the default model ID for a given tier (string).
 * Use when the client does not send a model and we have tier from quota/profile.
 */
export function getDefaultModelIdForTier(tier: string | null | undefined): string {
  const normalized = normalizeTierToSubscription(tier);
  return getDefaultModelForTier(normalized);
}
