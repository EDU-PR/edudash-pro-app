import { router } from 'expo-router';
import { signOut } from '@/lib/sessionManager';
import { Platform } from 'react-native';
import { deactivateCurrentUserTokens } from './pushTokenUtils';

// Prevent duplicate sign-out calls
let isSigningOut = false;

// Timeout constants for sign-out operations
const TOKEN_DEACTIVATION_TIMEOUT = 5000; // 5 seconds
const SIGNOUT_TIMEOUT = 5000; // 5 seconds
const OVERALL_SIGNOUT_TIMEOUT = 15000; // 15 seconds max total

/**
 * Helper to wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
    )
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
export async function signOutAndRedirect(optionsOrEvent?: { clearBiometrics?: boolean; redirectTo?: string } | any): Promise<void> {
  if (isSigningOut) {
    console.log('[authActions] Sign-out already in progress, skipping...');
    return;
  }
  isSigningOut = true;
  
  // If invoked as onPress handler, first argument will be an event; ignore it
  const options = (optionsOrEvent && typeof optionsOrEvent === 'object' && (
    Object.prototype.hasOwnProperty.call(optionsOrEvent, 'clearBiometrics') ||
    Object.prototype.hasOwnProperty.call(optionsOrEvent, 'redirectTo')
  )) ? (optionsOrEvent as { clearBiometrics?: boolean; redirectTo?: string }) : undefined;

  const targetRoute = options?.redirectTo ?? '/(auth)/sign-in';
  
  // Overall timeout to prevent infinite hang - force navigation after 15 seconds
  const overallTimeoutId = setTimeout(() => {
    console.error('[authActions] Sign-out overall timeout reached, forcing navigation');
    forceNavigate(targetRoute);
    isSigningOut = false;
  }, OVERALL_SIGNOUT_TIMEOUT);
  
  try {
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
            'Token deactivation'
          );
        }
      } catch (tokenErr) {
        console.warn('[authActions] Push token deactivation failed or timed out:', tokenErr);
        // Non-fatal: continue with sign-out
      }
    }
    
    // Perform complete sign-out with timeout (clears Supabase session + storage)
    console.log('[authActions] Performing complete sign-out...');
    await withTimeout(signOut(), SIGNOUT_TIMEOUT, 'Sign-out');
    console.log('[authActions] Sign-out successful');
    
    // Clear overall timeout since we succeeded
    clearTimeout(overallTimeoutId);
    
    // Give the Supabase auth state change event time to propagate
    // This ensures AuthContext receives the SIGNED_OUT event
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Then navigate to sign-in
    console.log('[authActions] Navigating to:', targetRoute);
    
    // Web-specific: use location.replace to clear history
    if (Platform.OS === 'web') {
      try {
        const w = globalThis as any;
        if (w?.location) {
          w.location.replace(targetRoute);
          console.log('[authActions] Browser history cleared and navigated');
        } else {
          router.replace(targetRoute);
        }
      } catch (historyErr) {
        console.warn('[authActions] Browser history clear failed:', historyErr);
        router.replace(targetRoute);
      }
    } else {
      // Mobile: Use dismissAll first to clear the entire navigation stack
      // This prevents back button from going to authenticated screens
      try {
        console.log('[authActions] Clearing navigation stack...');
        router.dismissAll();
      } catch (dismissErr) {
        console.debug('[authActions] dismissAll not available:', dismissErr);
      }
      
      // Then navigate to sign-in with a small delay to ensure stack is cleared
      setTimeout(() => {
        try {
          router.replace(targetRoute as any);
          console.log('[authActions] Mobile navigation executed');
        } catch (navErr) {
          console.error('[authActions] Primary navigation failed, trying fallback:', navErr);
          // Fallback: try direct sign-in route
          try {
            router.replace('/(auth)/sign-in' as any);
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
          w.location.replace(targetRoute);
        } else {
          router.replace(targetRoute);
        }
      } else {
        router.replace(targetRoute);
      }
    } catch (navError) {
      console.error('[authActions] Navigation failed:', navError);
      // Try fallback routes
      try { router.replace('/(auth)/sign-in'); } catch { /* Intentional: non-fatal */ }
      try { router.replace('/sign-in'); } catch { /* Intentional: non-fatal */ }
    }
  } finally {
    // Reset flag after a longer delay to ensure all async operations complete
    // This prevents race conditions when immediately signing in with a new account
    setTimeout(() => {
      isSigningOut = false;
      console.log('[authActions] Sign-out flag reset, ready for new sign-in');
    }, 500);
  }
}

