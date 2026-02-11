import { resolveIsRecoveryFlow } from '../../../web/src/lib/auth/recoveryFlow';

describe('web recoveryFlow helper', () => {
  const nowMs = Date.UTC(2026, 1, 11, 12, 0, 0);

  it('returns true for explicit type=recovery', () => {
    expect(resolveIsRecoveryFlow({ type: 'recovery' })).toBe(true);
  });

  it('returns true for recent recovery_sent_at without type', () => {
    const recent = new Date(nowMs - 5 * 60 * 1000).toISOString();
    expect(resolveIsRecoveryFlow({ recoverySentAt: recent, nowMs })).toBe(true);
  });

  it('returns false when recovery_sent_at is stale and no recovery markers are set', () => {
    const stale = new Date(nowMs - 90 * 60 * 1000).toISOString();
    expect(resolveIsRecoveryFlow({ recoverySentAt: stale, nowMs })).toBe(false);
  });
});
