import {
  isCapabilityTierAtLeast,
  resolveCapabilityTier,
  selectEffectiveTier,
} from '@/lib/tiers/resolveEffectiveTier';

describe('resolveEffectiveTier', () => {
  it('normalizes mixed tier aliases', () => {
    expect(resolveCapabilityTier('group_5')).toBe('starter');
    expect(resolveCapabilityTier('school_premium')).toBe('premium');
    expect(resolveCapabilityTier('school_enterprise')).toBe('enterprise');
  });

  it('selects the strongest raw tier candidate', () => {
    expect(selectEffectiveTier(['free', 'school_premium', 'starter'])).toBe('school_premium');
    expect(selectEffectiveTier(['teacher_starter', 'pro'])).toBe('pro');
  });

  it('checks minimum capability tiers reliably', () => {
    expect(isCapabilityTierAtLeast('teacher_starter', 'starter')).toBe(true);
    expect(isCapabilityTierAtLeast('teacher_starter', 'premium')).toBe(false);
    expect(isCapabilityTierAtLeast('school_enterprise', 'premium')).toBe(true);
  });
});
