import {
  resolveDashPolicy,
  resolveEffectiveTier,
  shouldAllowPremiumVoice,
} from '../DashPolicyResolver';

describe('DashPolicyResolver', () => {
  it('defaults parents in preschool to tutor mode', () => {
    const policy = resolveDashPolicy({
      profile: {
        role: 'parent',
        subscription_tier: 'parent_starter',
        organization_type: 'preschool',
      },
    });

    expect(policy.defaultMode).toBe('tutor');
    expect(policy.availableModes).toEqual(['tutor', 'orb']);
    expect(policy.quickActions.some((action) => action.id === 'phonics')).toBe(true);
  });

  it('defaults staff to advisor mode with school-focused actions', () => {
    const policy = resolveDashPolicy({
      profile: {
        role: 'teacher',
        subscription_tier: 'premium',
        organization_type: 'k12_school',
      },
    });

    expect(policy.defaultMode).toBe('advisor');
    expect(policy.availableModes).toEqual(['advisor', 'tutor', 'orb']);
    expect(policy.toolShortcuts).toContain('caps_lookup');
  });

  it('uses advisor-orb mode set for membership org types', () => {
    const policy = resolveDashPolicy({
      profile: {
        role: 'admin',
        organization_type: 'skills_development',
      },
    });

    expect(policy.defaultMode).toBe('advisor');
    expect(policy.availableModes).toEqual(['advisor', 'orb']);
  });

  it('resolves effective tier from explicit profile tier first', () => {
    expect(resolveEffectiveTier('parent', 'parent_premium', 'starter')).toBe('parent_premium');
    expect(resolveEffectiveTier('teacher', null, 'premium')).toBe('premium');
    expect(resolveEffectiveTier('teacher', null, null)).toBe('premium');
  });

  it('applies freemium premium voice quota correctly', () => {
    expect(shouldAllowPremiumVoice('free', { premiumVoiceQuota: 3, premiumVoiceUsed: 2 })).toBe(true);
    expect(shouldAllowPremiumVoice('free', { premiumVoiceQuota: 3, premiumVoiceUsed: 3 })).toBe(false);
    expect(shouldAllowPremiumVoice('premium', { premiumVoiceQuota: 3, premiumVoiceUsed: 99 })).toBe(true);
  });
});
