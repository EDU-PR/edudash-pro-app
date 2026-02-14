/**
 * Navigation lock utilities — prevent concurrent `routeAfterLogin` calls
 * for the same user from queueing duplicate navigations.
 *
 * Module-level Map so locks survive React re-renders.
 */

const debugEnabled = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true' || __DEV__;
const debugLog = (...args: unknown[]) => {
  if (debugEnabled) console.log(...args);
};

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────
const navigationLocks: Map<string, number> = new Map();
export const NAVIGATION_LOCK_TIMEOUT = 16000; // 16s — 1s longer than routeAfterLogin's 15s overall timeout

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/** Returns `true` when a non-expired lock exists for `userId`. */
export function isNavigationLocked(userId: string): boolean {
  const lockTime = navigationLocks.get(userId);
  debugLog('[DEBUG_AGENT] NavLock-CHECK', JSON.stringify({
    userId,
    hasLock: !!lockTime,
    lockAge: lockTime ? Date.now() - lockTime : null,
    lockCount: navigationLocks.size,
    timestamp: Date.now(),
  }));
  if (!lockTime) return false;
  // Auto-expire old locks
  if (Date.now() - lockTime > NAVIGATION_LOCK_TIMEOUT) {
    console.log('🚦 [ROUTE] Auto-expiring stale navigation lock for user:', userId);
    navigationLocks.delete(userId);
    return false;
  }
  return true;
}

/** Acquire a lock for `userId`. */
export function setNavigationLock(userId: string): void {
  navigationLocks.set(userId, Date.now());
  console.log('🚦 [ROUTE] Navigation lock set for user:', userId, 'at', new Date().toISOString());
}

/** Release a lock for `userId`. */
export function clearNavigationLock(userId: string): void {
  const hadLock = navigationLocks.has(userId);
  navigationLocks.delete(userId);
  if (hadLock) {
    console.log('🚦 [ROUTE] Navigation lock cleared for user:', userId);
  }
}

/** Clear ALL locks (used during sign-out to prevent stale locks). */
export function clearAllNavigationLocks(): void {
  const count = navigationLocks.size;
  debugLog('[DEBUG_AGENT] NavLock-CLEARALL', JSON.stringify({
    lockCount: count,
    locks: Array.from(navigationLocks.keys()),
    timestamp: Date.now(),
  }));
  navigationLocks.clear();
  if (count > 0) {
    console.log('🚦 [ROUTE] Cleared all navigation locks:', count, 'locks removed');
  }
}

/**
 * Read the raw lock timestamp for a user.
 * Only used internally by `routeAfterLogin` to clear stale locks.
 */
export function getNavigationLockTime(userId: string): number | undefined {
  return navigationLocks.get(userId);
}

/** Delete a single lock entry without logging. */
export function deleteNavigationLock(userId: string): void {
  navigationLocks.delete(userId);
}
