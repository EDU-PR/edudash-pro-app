import { router } from 'expo-router';
import { signOut } from '@/lib/sessionManager';
import { Platform, BackHandler } from 'react-native';
import { deactivateCurrentUserTokens } from './pushTokenUtils';

let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  AsyncStorage = null;
}

// Prevent duplicate sign-out calls with timestamp tracking
let isSigningOut = false;
let signOutStartTime = 0;
let signOutSequence = 0;
let activeSignOutId = 0;
const STALE_SIGNOUT_THRESHOLD = 35000; // Consider sign-out stale after 35 seconds

// ── Account switch flag ──────────────────────────────────────────
// Set synchronously BEFORE calling router.push to guarantee the
// route guard sees it on its very next render — even before the
// URL search params have propagated.
let _accountSwitchPending = false;
let _accountSwitchTimestamp = 0;
const ACCOUNT_SWITCH_STALE_MS = 30_000; // auto-expire after 30s (slow networks need more time)

/** Mark that an add-account navigation is about to happen. */
export function setAccountSwitchPending(): void {
  _accountSwitchPending = true;
  _accountSwitchTimestamp = Date.now();
}

/** Clear the add-account flag (called from sign-in mount). */
export function clearAccountSwitchPending(): void {
  _accountSwitchPending = false;
  _accountSwitchTimestamp = 0;
}

/** Check if an account-switch intent is pending (auto-expires). */
export function isAccountSwitchPending(): boolean {
  if (!_accountSwitchPending) return false;
  if (_accountSwitchTimestamp && Date.now() - _accountSwitchTimestamp > ACCOUNT_SWITCH_STALE_MS) {
    _accountSwitchPending = false;
    _accountSwitchTimestamp = 0;
    return false;
  }
  return true;
}

// ── Account switch in progress (biometric restore) ─────────────────────────
// When true, SIGNED_OUT is ignored (no clear, no redirect) so the next SIGNED_IN can complete the switch.
let _accountSwitchInProgress = false;
let _accountSwitchInProgressStartedAt = 0;
const ACCOUNT_SWITCH_IN_PROGRESS_STALE_MS = 45_000;

export function setAccountSwitchInProgress(value: boolean): void {
  _accountSwitchInProgress = value;
  _accountSwitchInProgressStartedAt = value ? Date.now() : 0;
}

export function isAccountSwitchInProgress(): boolean {
  if (
    _accountSwitchInProgress &&
    _accountSwitchInProgressStartedAt > 0 &&
    Date.now() - _accountSwitchInProgressStartedAt > ACCOUNT_SWITCH_IN_PROGRESS_STALE_MS
  ) {
    console.warn('[authActions] accountSwitchInProgress flag became stale, resetting');
    _accountSwitchInProgress = false;
    _accountSwitchInProgressStartedAt = 0;
    return false;
  }
  return _accountSwitchInProgress;
}

// Timeout constants for sign-out operations
const TOKEN_DEACTIVATION_TIMEOUT = 6000; // 6 seconds
const SIGNOUT_TIMEOUT = 8000; // 8 seconds
const OVERALL_SIGNOUT_TIMEOUT = 30000; // 30 seconds max total
const FORCE_SIGNOUT_DELAY = 5000; // Show force button after 5 seconds

/**
 * Force reset the sign-out state (used when stuck)
 */
export function resetSignOutState(): void {
  console.log('[authActions] Manually resetting sign-out state');
  isSigningOut = false;
  signOutStartTime = 0;
  activeSignOutId = 0;
}

/**
 * Check if sign-out is currently in progress
 */
export function isSignOutInProgress(): boolean {
  // If sign-out has been running for too long, consider it stale and allow retry
  if (isSigningOut && signOutStartTime > 0) {
    const elapsed = Date.now() - signOutStartTime;
    if (elapsed > STALE_SIGNOUT_THRESHOLD) {
      console.warn('[authActions] Sign-out appears stale, resetting flag');
      isSigningOut = false;
      signOutStartTime = 0;
      activeSignOutId = 0;
      return false;
    }
  }
  return isSigningOut;
}

/**
 * Helper to wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, operation: string, fallback: T, silent = false): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => {
        if (!silent) {
          console.warn(`[authActions] ${operation} timed out after ${ms}ms - continuing`);
        } else if (__DEV__) {
          console.debug(`[authActions] ${operation} timed out after ${ms}ms - continuing`);
        }
        resolve(fallback);
      }, ms)
    ),
  ]);
}

/**
 * Force navigation to target route (used when sign-out times out)
 */
function forceNavigate(targetRoute: string): void {
  console.log('[authActions] Force navigating to:', targetRoute);
  try {
    if (Platform.OS === 'web') {
      const w = globalThis as any;
      if (w?.location) {
        w.location.replace(targetRoute);
      } else {
        router.replace(targetRoute);
      }
    } else {
      router.replace(targetRoute as any);
    }
  } catch (err) {
    console.error('[authActions] Force navigation failed:', err);
    try { router.replace('/(auth)/sign-in' as any); } catch { /* silent */ }
  }
}

/**
 * Complete sign-out: clears session, storage, and navigates to sign-in
 * This ensures all auth state is properly cleaned up
 * Includes timeout protection to prevent hanging
 */
type SignOutOptions = {
  clearBiometrics?: boolean;
  redirectTo?: string;
  exitApp?: boolean;
  resetApp?: boolean;
  preserveOtherSessions?: boolean;
};

export async function signOutAndRedirect(optionsOrEvent?: SignOutOptions | any): Promise<void> {
  // Check if sign-out is in progress, but also handle stale sign-outs
  if (isSignOutInProgress()) {
    console.log('[authActions] Sign-out already in progress, skipping...');
    return;
  }
  isSigningOut = true;
  signOutStartTime = Date.now();
  const opId = ++signOutSequence;
  activeSignOutId = opId;
  
  // If invoked as onPress handler, first argument will be an event; ignore it
  const options = (optionsOrEvent && typeof optionsOrEvent === 'object' && (
    Object.prototype.hasOwnProperty.call(optionsOrEvent, 'clearBiometrics') ||
    Object.prototype.hasOwnProperty.call(optionsOrEvent, 'redirectTo') ||
    Object.prototype.hasOwnProperty.call(optionsOrEvent, 'exitApp') ||
    Object.prototype.hasOwnProperty.call(optionsOrEvent, 'resetApp') ||
    Object.prototype.hasOwnProperty.call(optionsOrEvent, 'preserveOtherSessions')
  )) ? (optionsOrEvent as SignOutOptions) : undefined;

  const targetRoute = options?.redirectTo ?? '/(auth)/sign-in';
  const targetRouteWithFresh =
    targetRoute.includes('sign-in') && !targetRoute.includes('fresh=1')
      ? `${targetRoute}${targetRoute.includes('?') ? '&' : '?'}fresh=1`
      : targetRoute;
  const shouldExitApp = Platform.OS === 'android' && options?.exitApp === true;
  // Default OFF: full app reset during sign-out can briefly remount into an empty shell
  // on slower devices. Keep it opt-in for explicit recovery flows.
  const shouldResetApp = options?.resetApp === true;
  const preserveOtherSessions =
    options?.preserveOtherSessions !== false; // default: true (local sign-out preserves biometric sessions)
  
  // Overall timeout to prevent infinite hang - force navigation after 15 seconds
  const overallTimeoutId = setTimeout(() => {
    if (activeSignOutId !== opId) {
      return;
    }
    console.error('[authActions] Sign-out overall timeout reached, forcing navigation');
    forceNavigate(targetRouteWithFresh);
    isSigningOut = false;
  }, OVERALL_SIGNOUT_TIMEOUT);
  
  try {
    // Best-effort: prevent immediate biometric auto-sign-in after sign-out
    if (AsyncStorage) {
      try {
        const skipUntil = Date.now() + 60_000;
        await AsyncStorage.setItem('auth_skip_biometrics_until', String(skipUntil));
      } catch {
        // non-fatal
      }
    }

    // CRITICAL: Clear all navigation locks before sign-out to prevent stale locks
    // This prevents sign-in freeze caused by leftover locks from previous session
    try {
      const { clearAllNavigationLocks } = await import('./routeAfterLogin');
      clearAllNavigationLocks();
      console.log('[authActions] All navigation locks cleared before sign-out');
    } catch (lockErr) {
      console.warn('[authActions] Failed to clear navigation locks (non-fatal):', lockErr);
    }
    
    // Deactivate push notification tokens for this user before sign-out (with timeout)
    if (Platform.OS !== 'web') {
      try {
        const { assertSupabase } = await import('./supabase');
        const { data: { session } } = await assertSupabase().auth.getSession();
        if (session?.user?.id) {
          if (__DEV__) console.log('[authActions] Deactivating push tokens for user:', session.user.id);
          await withTimeout(
            deactivateCurrentUserTokens(session.user.id),
            TOKEN_DEACTIVATION_TIMEOUT,
            'Token deactivation',
            null as any,
            true
          );
        }
      } catch (tokenErr) {
        console.warn('[authActions] Push token deactivation failed or timed out:', tokenErr);
        // Non-fatal: continue with sign-out
      }
    }
    
    // Perform complete sign-out with timeout (clears Supabase session + storage)
    console.log('[authActions] Performing complete sign-out...');
    await withTimeout(
      signOut({ preserveOtherSessions }),
      SIGNOUT_TIMEOUT,
      'Sign-out',
      undefined,
    );
    console.log('[authActions] Sign-out successful');
    
    // Clear overall timeout since we succeeded
    clearTimeout(overallTimeoutId);

    // If a newer auth flow has started, stop here to avoid stomping navigation
    if (activeSignOutId !== opId) {
      return;
    }
    
    // Give the Supabase auth state change event time to propagate
    // This ensures AuthContext receives the SIGNED_OUT event
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Optionally exit app after sign-out (Android only)
    if (shouldExitApp) {
      console.log('[authActions] Exiting app after sign-out');
      try {
        BackHandler.exitApp();
      } catch (exitErr) {
        console.warn('[authActions] Exit app failed, falling back to navigation:', exitErr);
      }
      return;
    }

    if (shouldResetApp) {
      try {
        const { requestAppReset } = await import('./appReset');
        requestAppReset();
      } catch (resetErr) {
        console.warn('[authActions] App reset failed (non-fatal):', resetErr);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Then navigate to sign-in
    console.log('[authActions] Navigating to:', targetRouteWithFresh);
    
    // Web-specific: use location.replace to clear history
    if (Platform.OS === 'web') {
      try {
        const w = globalThis as any;
        if (w?.location) {
          w.location.replace(targetRouteWithFresh);
          console.log('[authActions] Browser history cleared and navigated');
        } else {
          router.replace(targetRouteWithFresh);
        }
      } catch (historyErr) {
        console.warn('[authActions] Browser history clear failed:', historyErr);
        router.replace(targetRouteWithFresh);
      }
    } else {
      // Mobile: Navigate to auth screen without dismissAll to avoid "POP_TO_TOP was not handled"
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          try {
            if (activeSignOutId !== opId) {
              resolve();
              return;
            }
            router.replace(targetRouteWithFresh as any);
            console.log('[authActions] Mobile navigation executed');
          } catch (navErr) {
            console.error('[authActions] Primary navigation failed, trying fallback:', navErr);
            try {
              router.replace('/(auth)/sign-in?fresh=1' as any);
            } catch (fallbackErr) {
              console.error('[authActions] Fallback navigation also failed:', fallbackErr);
            }
          }
          resolve();
        }, 100);
      });
    }
  } catch (error) {
    clearTimeout(overallTimeoutId);
    console.error('[authActions] Sign-out failed:', error);
    
    // Even on error, try to navigate to sign-in
    try {
      if (Platform.OS === 'web') {
        const w = globalThis as any;
        if (w?.location) {
          w.location.replace(targetRouteWithFresh);
        } else {
          router.replace(targetRouteWithFresh);
        }
      } else {
        router.replace(targetRouteWithFresh);
      }
    } catch (navError) {
      console.error('[authActions] Navigation failed:', navError);
      // Try fallback routes
      try { router.replace('/(auth)/sign-in'); } catch { /* Intentional: non-fatal */ }
      try { router.replace('/sign-in'); } catch { /* Intentional: non-fatal */ }
    }
  } finally {
    clearTimeout(overallTimeoutId);
    // Only reset flags if THIS sign-out still owns them.
    // Prevents sign-out A's finally from stomping sign-out B's state.
    if (activeSignOutId === opId) {
      if (shouldExitApp) {
        // Delay reset to avoid auth guard flicker before app exits
        setTimeout(() => {
          if (activeSignOutId === opId) {
            isSigningOut = false;
            signOutStartTime = 0;
            activeSignOutId = 0;
            console.log('[authActions] Sign-out flag reset after exit delay');
          }
        }, 2500);
        return;
      }
      // Reset flag immediately — allows immediate sign-in after sign-out
      isSigningOut = false;
      signOutStartTime = 0;
      activeSignOutId = 0;
      console.log('[authActions] Sign-out flag reset, ready for new sign-in');
    } else {
      console.log('[authActions] Sign-out superseded (opId', opId, 'vs active', activeSignOutId, '), skipping flag reset');
    }
  }
}
