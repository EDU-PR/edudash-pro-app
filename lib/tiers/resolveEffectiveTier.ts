import { getCapabilityTier, normalizeTierName, type CapabilityTier } from '@/lib/tiers';

const CAPABILITY_TIER_ORDER: CapabilityTier[] = ['free', 'starter', 'premium', 'enterprise'];

export const resolveCapabilityTier = (rawTier?: string | null): CapabilityTier => {
  const raw = String(rawTier || '').trim().toLowerCase();
  if (!raw) return 'free';

  if (raw === 'free' || raw === 'starter' || raw === 'premium' || raw === 'enterprise') {
    return raw;
  }

  if (raw === 'basic' || raw === 'solo' || raw === 'group_5' || raw === 'trialing') return 'starter';
  if (raw === 'pro' || raw === 'group_10') return 'premium';

  try {
    return getCapabilityTier(normalizeTierName(raw));
  } catch {
    if (raw.includes('enterprise')) return 'enterprise';
    if (raw.includes('premium') || raw.includes('pro') || raw.includes('plus')) return 'premium';
    if (raw.includes('starter') || raw.includes('basic') || raw.includes('trial')) return 'starter';
    return 'free';
  }
};

export const selectEffectiveTier = (tiers: Array<string | null | undefined>): string => {
  let bestTier = 'free';
  let bestRank = 0;

  for (const candidate of tiers) {
    const raw = String(candidate || '').trim();
    if (!raw) continue;
    const capability = resolveCapabilityTier(raw);
    const rank = CAPABILITY_TIER_ORDER.indexOf(capability);
    if (rank > bestRank) {
      bestRank = rank;
      bestTier = raw;
    }
  }

  return bestTier;
};

export interface EffectiveTierResolutionInput {
  role?: string | null;
  profileTier?: string | null;
  organizationTier?: string | null;
  usageTier?: string | null;
  candidates?: Array<string | null | undefined>;
}

export interface EffectiveTierResolutionResult {
  rawTier: string;
  capabilityTier: CapabilityTier;
}

export const resolveEffectiveTier = (
  input: EffectiveTierResolutionInput = {},
): EffectiveTierResolutionResult => {
  const role = String(input.role || '').trim().toLowerCase();
  if (role === 'super_admin' || role === 'superadmin') {
    return { rawTier: 'enterprise', capabilityTier: 'enterprise' };
  }

  const rawTier = selectEffectiveTier([
    input.profileTier,
    input.organizationTier,
    input.usageTier,
    ...(input.candidates || []),
  ]);

  return {
    rawTier,
    capabilityTier: resolveCapabilityTier(rawTier),
  };
};

export const isCapabilityTierAtLeast = (
  rawTier: string | null | undefined,
  required: CapabilityTier
): boolean => {
  const actual = resolveCapabilityTier(rawTier);
  return CAPABILITY_TIER_ORDER.indexOf(actual) >= CAPABILITY_TIER_ORDER.indexOf(required);
};
