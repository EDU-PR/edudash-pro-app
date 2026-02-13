import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { resolveEffectiveTier, type EffectiveTierResolutionInput } from '@/lib/tiers/resolveEffectiveTier';

const PREMIUM_ACTIVITY_LIMIT_FREE = 3;
const STORAGE_PREFIX = '@dash_voice_premium_usage_v1';

export type VoiceFallbackReason =
  | 'none'
  | 'free_quota_exhausted'
  | 'service_unavailable'
  | 'phonics_requires_cloud';

export interface VoicePolicyDecision {
  capabilityTier: 'free' | 'starter' | 'premium' | 'enterprise';
  isPremiumTier: boolean;
  premiumActivitiesTotal: number;
  premiumActivitiesUsed: number;
  premiumActivitiesRemaining: number;
  shouldUseCloudVoice: boolean;
  fallbackReason: VoiceFallbackReason;
}

function getUsagePeriodKey(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function buildStorageKey(userId: string | null | undefined, period = getUsagePeriodKey()): string {
  return `${STORAGE_PREFIX}:${String(userId || 'anonymous')}:${period}`;
}

async function getPremiumActivityUsage(userId?: string | null): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(buildStorageKey(userId));
    const value = Number.parseInt(String(raw || '0'), 10);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, value);
  } catch {
    return 0;
  }
}

export async function consumePremiumVoiceActivity(userId?: string | null): Promise<number> {
  const next = (await getPremiumActivityUsage(userId)) + 1;
  try {
    await AsyncStorage.setItem(buildStorageKey(userId), String(next));
  } catch {
    // Non-fatal; decision path still guards with runtime count.
  }
  return next;
}

export async function getVoicePolicyDecision(
  tierInput: EffectiveTierResolutionInput,
  userId?: string | null,
): Promise<VoicePolicyDecision> {
  const flags = getFeatureFlagsSync();
  const capabilityTier = resolveEffectiveTier(tierInput).capabilityTier;
  const isPremiumTier = capabilityTier !== 'free';
  const premiumActivitiesTotal = PREMIUM_ACTIVITY_LIMIT_FREE;
  const premiumActivitiesUsed = isPremiumTier ? 0 : await getPremiumActivityUsage(userId);
  const premiumActivitiesRemaining = isPremiumTier
    ? Number.MAX_SAFE_INTEGER
    : Math.max(0, premiumActivitiesTotal - premiumActivitiesUsed);

  if (!flags.dash_voice_policy_v1) {
    return {
      capabilityTier,
      isPremiumTier,
      premiumActivitiesTotal,
      premiumActivitiesUsed,
      premiumActivitiesRemaining,
      shouldUseCloudVoice: true,
      fallbackReason: 'none',
    };
  }

  const shouldUseCloudVoice = isPremiumTier || premiumActivitiesRemaining > 0;

  return {
    capabilityTier,
    isPremiumTier,
    premiumActivitiesTotal,
    premiumActivitiesUsed,
    premiumActivitiesRemaining,
    shouldUseCloudVoice,
    fallbackReason: shouldUseCloudVoice ? 'none' : 'free_quota_exhausted',
  };
}
