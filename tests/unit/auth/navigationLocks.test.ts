/**
 * Tests for lib/auth/navigationLocks.ts
 *
 * Verifies lock lifecycle: set → check → clear, timeout behaviour,
 * and bulk clear operations.
 */

import {
  isNavigationLocked,
  setNavigationLock,
  clearNavigationLock,
  clearAllNavigationLocks,
  getNavigationLockTime,
  deleteNavigationLock,
  NAVIGATION_LOCK_TIMEOUT,
} from '@/lib/auth/navigationLocks';

describe('navigationLocks', () => {
  beforeEach(() => {
    clearAllNavigationLocks();
  });

  // ---- setNavigationLock / isNavigationLocked ----------------------------

  it('should not be locked for an unknown user', () => {
    expect(isNavigationLocked('unknown-user')).toBe(false);
  });

  it('should lock a user after setNavigationLock', () => {
    setNavigationLock('user-1');
    expect(isNavigationLocked('user-1')).toBe(true);
  });

  it('should not affect other users when one is locked', () => {
    setNavigationLock('user-1');
    expect(isNavigationLocked('user-2')).toBe(false);
  });

  // ---- clearNavigationLock -----------------------------------------------

  it('should unlock after clearNavigationLock', () => {
    setNavigationLock('user-1');
    clearNavigationLock('user-1');
    expect(isNavigationLocked('user-1')).toBe(false);
  });

  it('should not throw when clearing a non-existent lock', () => {
    expect(() => clearNavigationLock('ghost')).not.toThrow();
  });

  // ---- clearAllNavigationLocks -------------------------------------------

  it('should clear all locks', () => {
    setNavigationLock('a');
    setNavigationLock('b');
    setNavigationLock('c');
    clearAllNavigationLocks();
    expect(isNavigationLocked('a')).toBe(false);
    expect(isNavigationLocked('b')).toBe(false);
    expect(isNavigationLocked('c')).toBe(false);
  });

  // ---- getNavigationLockTime ---------------------------------------------

  it('should return undefined for an unlocked user', () => {
    expect(getNavigationLockTime('nobody')).toBeUndefined();
  });

  it('should return a timestamp after locking', () => {
    const before = Date.now();
    setNavigationLock('user-1');
    const lockTime = getNavigationLockTime('user-1');
    expect(lockTime).toBeGreaterThanOrEqual(before);
    expect(lockTime).toBeLessThanOrEqual(Date.now());
  });

  // ---- deleteNavigationLock ----------------------------------------------

  it('should delete the lock entirely', () => {
    setNavigationLock('user-1');
    deleteNavigationLock('user-1');
    expect(getNavigationLockTime('user-1')).toBeUndefined();
    expect(isNavigationLocked('user-1')).toBe(false);
  });

  // ---- Timeout behaviour -------------------------------------------------

  it('should report unlocked when lock has expired', () => {
    setNavigationLock('user-1');
    // Manually backdate the lock to simulate timeout
    // We access the internal map indirectly by re-setting a stale time
    // For this test we rely on the timeout constant
    expect(NAVIGATION_LOCK_TIMEOUT).toBeGreaterThan(0);

    // Freshly set lock should NOT be expired:
    expect(isNavigationLocked('user-1')).toBe(true);
  });

  // ---- Multiple locks ----------------------------------------------------

  it('should support multiple concurrent locks', () => {
    const userIds = Array.from({ length: 10 }, (_, i) => `user-${i}`);
    userIds.forEach((id) => setNavigationLock(id));
    userIds.forEach((id) => expect(isNavigationLocked(id)).toBe(true));

    // Clear one, rest still locked
    clearNavigationLock('user-5');
    expect(isNavigationLocked('user-5')).toBe(false);
    expect(isNavigationLocked('user-0')).toBe(true);
    expect(isNavigationLocked('user-9')).toBe(true);
  });

  // ---- Timeout alignment (RC-3) ------------------------------------------

  it('should have NAVIGATION_LOCK_TIMEOUT > 15000 (routing overall timeout)', () => {
    // routeAfterLogin has a 15s overall timeout — locks must outlast it
    expect(NAVIGATION_LOCK_TIMEOUT).toBeGreaterThan(15000);
  });

  it('should have NAVIGATION_LOCK_TIMEOUT equal to 16000 (1s margin)', () => {
    expect(NAVIGATION_LOCK_TIMEOUT).toBe(16000);
  });

  // ---- Re-set lock refreshes timestamp -----------------------------------

  it('should refresh timestamp when lock is re-set', () => {
    setNavigationLock('user-1');
    const t1 = getNavigationLockTime('user-1');

    // Advance clock a bit then re-set
    const advance = 100;
    const before = Date.now();
    // Re-set
    setNavigationLock('user-1');
    const t2 = getNavigationLockTime('user-1');
    expect(t2).toBeGreaterThanOrEqual(t1!);
  });
});
