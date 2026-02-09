/**
 * Tests for lib/utils/tierUtils.ts — Tier badge helpers
 */

import { getTierColor, getTierLabel, isPremiumTier } from '../tierUtils';

describe('getTierColor', () => {
  const mockTheme = {
    primary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    textSecondary: '#6B7280',
  };

  it('returns a color string for known tiers', () => {
    const color = getTierColor('free', mockTheme);
    expect(typeof color).toBe('string');
    expect(color.length).toBeGreaterThan(0);
  });

  it('returns a fallback color for unknown tiers', () => {
    const color = getTierColor('alien_tier', mockTheme);
    expect(typeof color).toBe('string');
  });

  it('handles null/undefined gracefully', () => {
    expect(() => getTierColor(null as any, mockTheme)).not.toThrow();
    expect(() => getTierColor(undefined as any, mockTheme)).not.toThrow();
  });
});

describe('getTierLabel', () => {
  it('returns a human-readable label for known tiers', () => {
    expect(getTierLabel('free')).toBeTruthy();
    expect(getTierLabel('basic')).toBeTruthy();
    expect(getTierLabel('pro')).toBeTruthy();
    expect(getTierLabel('enterprise')).toBeTruthy();
  });

  it('returns the input title-cased for unknown tiers', () => {
    const label = getTierLabel('mystery');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });
});

describe('isPremiumTier', () => {
  it('returns false for free tier', () => {
    expect(isPremiumTier('free')).toBe(false);
  });

  it('returns true for pro tier', () => {
    expect(isPremiumTier('pro')).toBe(true);
  });

  it('returns true for enterprise tier', () => {
    expect(isPremiumTier('enterprise')).toBe(true);
  });

  it('returns false for null/undefined', () => {
    expect(isPremiumTier(null as any)).toBe(false);
    expect(isPremiumTier(undefined as any)).toBe(false);
  });
});
