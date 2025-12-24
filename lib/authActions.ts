import { router } from 'expo-router';
import { signOut } from '@/lib/sessionManager';
import { Platform } from 'react-native';
import { deactivateCurrentUserTokens } from './pushTokenUtils';

// Prevent duplicate sign-out calls
let isSigningOut = false;

/**
 * Complete sign-out: clears session, storage, and navigates to sign-in
 * This ensures all auth state is properly cleaned up
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
  
  try {
    // Deactivate push notification tokens for this user before sign-out
    if (Platform.OS !== 'web') {
      try {
        const { assertSupabase } = await import('./supabase');
        const { data: { session } } = await assertSupabase().auth.getSession();
        if (session?.user?.id) {
          if (__DEV__) console.log('[authActions] Deactivating push tokens for user:', session.user.id);
          await deactivateCurrentUserTokens(session.user.id);
        }
      } catch (tokenErr) {
        console.warn('[authActions] Failed to deactivate push tokens:', tokenErr);
        // Non-fatal: continue with sign-out
      }
    }
    
    // First, perform complete sign-out (clears Supabase session + storage)
    console.log('[authActions] Performing complete sign-out...');
    await signOut();
    console.log('[authActions] Sign-out successful');
    
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
      // Mobile: Add a small delay to ensure auth state is fully cleared
      // before navigation, as the router may still see the old auth state
      setTimeout(() => {
        try {
          router.replace(targetRoute as any);
          console.log('[authActions] Mobile navigation executed');
        } catch (navErr) {
          console.error('[authActions] Primary navigation failed, trying fallback:', navErr);
          // Fallback: try dismissing all screens first
          try {
            router.dismissAll();
            router.replace('/(auth)/sign-in' as any);
          } catch (fallbackErr) {
            console.error('[authActions] Fallback navigation also failed:', fallbackErr);
          }
        }
      }, 100);
    }
  } catch (error) {
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

