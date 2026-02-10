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
    Object.prototype.hasOwnProperty.call(optionsOrEvent, 'resetApp')
  )) ? (optionsOrEvent as SignOutOptions) : undefined;

  const targetRoute = options?.redirectTo ?? '/(auth)/sign-in';
  const targetRouteWithFresh =
    targetRoute.includes('sign-in') && !targetRoute.includes('fresh=1')
      ? `${targetRoute}${targetRoute.includes('?') ? '&' : '?'}fresh=1`
      : targetRoute;
  const shouldExitApp = Platform.OS === 'android' && options?.exitApp === true;
  const shouldResetApp = options?.resetApp !== false;
  const preserveOtherSessions =
    options?.preserveOtherSessions === true ||
    options?.clearBiometrics === false ||
    targetRouteWithFresh.includes('switch=1');
  
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
      // Mobile: Use dismissAll first to clear the entire navigation stack
      // This prevents back button from going to authenticated screens
      try {
        // Only call dismissAll if there are screens to dismiss
        // This prevents "POP_TO_TOP was not handled" warning when already at root
        if (router.canDismiss && router.canDismiss()) {
          console.log('[authActions] Clearing navigation stack...');
          router.dismissAll();
        } else {
          console.debug('[authActions] No screens to dismiss, skipping dismissAll');
        }
      } catch (dismissErr) {
        console.debug('[authActions] dismissAll not available:', dismissErr);
      }
      
      // Then navigate to sign-in with a small delay to ensure stack is cleared
      setTimeout(() => {
        try {
          if (activeSignOutId !== opId) {
            return;
          }
          router.replace(targetRouteWithFresh as any);
          console.log('[authActions] Mobile navigation executed');
        } catch (navErr) {
          console.error('[authActions] Primary navigation failed, trying fallback:', navErr);
          // Fallback: try direct sign-in route
          try {
            router.replace('/(auth)/sign-in?fresh=1' as any);
          } catch (fallbackErr) {
            console.error('[authActions] Fallback navigation also failed:', fallbackErr);
          }
        }
      }, 100);
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
    if (shouldExitApp) {
      // Delay reset to avoid auth guard flicker before app exits
      setTimeout(() => {
        isSigningOut = false;
        signOutStartTime = 0;
        activeSignOutId = 0;
        console.log('[authActions] Sign-out flag reset after exit delay');
      }, 2500);
      return;
    }
    // Reset flag immediately - no delay needed since we use timestamp tracking
    // This allows immediate sign-in after sign-out completes
    isSigningOut = false;
    signOutStartTime = 0;
    activeSignOutId = 0;
    console.log('[authActions] Sign-out flag reset, ready for new sign-in');
  }
}
