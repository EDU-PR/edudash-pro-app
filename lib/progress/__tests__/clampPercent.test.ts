jest.mock('@/lib/analytics', () => ({
  track: jest.fn(),
}), { virtual: true });

import { clampPercent, ratioToPercent } from '../clampPercent';

describe('clampPercent', () => {
  it('clamps negative values to 0', () => {
    expect(clampPercent(-25)).toBe(0);
  });

  it('clamps values above 100 to 100', () => {
    expect(clampPercent(140)).toBe(100);
  });

  it('uses default fallback for non-finite values', () => {
    expect(clampPercent(Number.NaN, { defaultValue: 35 })).toBe(35);
    expect(clampPercent('not-a-number', { defaultValue: 12 })).toBe(12);
  });
});

describe('ratioToPercent', () => {
  it('returns clamped ratio in [0, 100]', () => {
    expect(ratioToPercent(5, 10)).toBe(50);
    expect(ratioToPercent(50, 10)).toBe(100);
  });

  it('returns fallback when denominator is invalid', () => {
    expect(ratioToPercent(5, 0, { defaultValue: 9 })).toBe(9);
    expect(ratioToPercent(5, Number.NaN, { defaultValue: 7 })).toBe(7);
  });
});

