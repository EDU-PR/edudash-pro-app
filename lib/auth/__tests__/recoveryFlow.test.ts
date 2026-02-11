import { isRecentRecoverySentAt, resolveIsRecoveryFlow } from '@/lib/auth/recoveryFlow';

describe('recoveryFlow helpers', () => {
  const nowMs = Date.UTC(2026, 1, 11, 12, 0, 0);

  it('returns true when type is recovery', () => {
    expect(resolveIsRecoveryFlow({ type: 'recovery' })).toBe(true);
  });

  it('returns true when recovery_sent_at is recent even without type', () => {
    const recent = new Date(nowMs - 10 * 60 * 1000).toISOString();
    expect(resolveIsRecoveryFlow({ recoverySentAt: recent, nowMs })).toBe(true);
  });

  it('returns false when recovery_sent_at is stale and no recovery flags are set', () => {
    const stale = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();
    expect(resolveIsRecoveryFlow({ recoverySentAt: stale, nowMs })).toBe(false);
  });

  it('isRecentRecoverySentAt handles invalid and missing timestamps', () => {
    expect(isRecentRecoverySentAt(undefined, nowMs)).toBe(false);
    expect(isRecentRecoverySentAt('not-a-date', nowMs)).toBe(false);
  });
});
