/**
 * Sign-in form handlers — handleSignIn + handleGoogleSignIn.
 * Extracted from sign-in.tsx to comply with WARP.md (screens ≤500 excl. StyleSheet).
 *
 * @module hooks/auth/useSignInHandlers
 */

import { useCallback, useRef, useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';
import { router } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import { signInWithSession } from '@/lib/sessionManager';
import { resetSignOutState } from '@/lib/authActions';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { EnhancedBiometricAuth } from '@/services/EnhancedBiometricAuth';
import { logger } from '@/lib/logger';
import type { TFunction } from 'i18next';
import type { TextInput } from 'react-native';

export interface SignInFormState {
  email: string;
  password: string;
  rememberMe: boolean;
  loading: boolean;
}

export interface SignInFormDeps {
  state: SignInFormState;
  setLoading: (v: boolean) => void;
  setGoogleLoading: (v: boolean) => void;
  emailInputRef: React.RefObject<TextInput | null>;
  passwordInputRef: React.RefObject<TextInput | null>;
  showAlert: (opts: any) => void;
  t: TFunction;
}

export function useSignInHandlers(deps: SignInFormDeps) {
  const isMountedRef = useRef(true);
  const signInWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSignInWatchdog = useCallback(() => {
    if (signInWatchdogRef.current) {
      clearTimeout(signInWatchdogRef.current);
      signInWatchdogRef.current = null;
    }
  }, []);

  const stopLoadingState = useCallback(() => {
    clearSignInWatchdog();
    deps.setLoading(false);
  }, [clearSignInWatchdog]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearSignInWatchdog();
    };
  }, [clearSignInWatchdog]);

  // ── handleSignIn ──────────────────────────

  const handleSignIn = useCallback(async () => {
    const { email, password, rememberMe } = deps.state;

    if (!email || !password) {
      deps.showAlert({
        title: deps.t('common.error', { defaultValue: 'Error' }),
        message: deps.t('auth.sign_in.enter_email_password', { defaultValue: 'Please enter email and password' }),
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    Keyboard.dismiss();
    deps.emailInputRef.current?.blur();
    deps.passwordInputRef.current?.blur();
    resetSignOutState();
    deps.setLoading(true);
    await new Promise((r) => setTimeout(r, 50));

    try {
      const res = await signInWithSession(email.trim(), password);
      if (res.error) {
        const errorLower = res.error.toLowerCase();
        // Timeout error — auth may have succeeded
        if (errorLower.includes('timed out')) {
          try {
            const supabase = assertSupabase();
            for (let attempt = 0; attempt < 2; attempt++) {
              const { data } = await supabase.auth.getSession();
              if (data?.session?.user) { stopLoadingState(); return; }
              await new Promise((r) => setTimeout(r, 1200));
            }
          } catch { /* fall through */ }
        }
        // Email not confirmed
        if (errorLower.includes('email not confirmed') || errorLower.includes('email_not_confirmed')) {
          deps.showAlert({
            title: deps.t('auth.sign_in.email_not_verified', { defaultValue: 'Email Not Verified' }),
            message: deps.t('auth.sign_in.email_not_verified_message', {
              defaultValue: 'Your email address has not been verified. Please check your inbox for the verification email, or request a new one.',
            }),
            type: 'warning',
            buttons: [
              { text: deps.t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
              {
                text: deps.t('auth.sign_in.resend_verification', { defaultValue: 'Resend Email' }),
                style: 'default',
                onPress: () => resendVerification(email.trim(), deps),
              },
            ],
          });
          stopLoadingState();
          return;
        }
        // Generic error
        deps.showAlert({
          title: deps.t('auth.sign_in.failed', { defaultValue: 'Sign In Failed' }),
          message: res.error,
          type: 'error',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        stopLoadingState();
        return;
      }

      logger.debug('SignIn', 'Sign in successful:', email.trim());

      // Remember me
      saveCredentials(email.trim(), password, rememberMe).catch(() => {});

      // Store biometric session
      const userId = res.session?.user_id;
      if (userId) {
        EnhancedBiometricAuth.storeBiometricSession(
          userId,
          res.session?.email || email.trim(),
          res.profile || undefined,
          res.session?.refresh_token,
        ).catch(() => {});
      }

      // Clear stale locks
      try {
        const { clearAllNavigationLocks } = await import('@/lib/routeAfterLogin');
        clearAllNavigationLocks();
      } catch { /* noop */ }

      // Watchdog — only stops spinner, does NOT navigate
      clearSignInWatchdog();
      signInWatchdogRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        logger.warn('SignIn', 'Post sign-in watchdog fired — stopping spinner');
        stopLoadingState();
      }, 10000);
    } catch (_error: any) {
      logger.error('SignIn', 'Sign in error:', _error?.message);
      deps.showAlert({
        title: deps.t('common.error', { defaultValue: 'Error' }),
        message: _error?.message || deps.t('common.unexpected_error', { defaultValue: 'An unexpected error occurred' }),
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      stopLoadingState();
    }
  }, [deps.state, stopLoadingState, clearSignInWatchdog]);

  // ── handleGoogleSignIn ────────────────────

  const handleGoogleSignIn = useCallback(async () => {
    deps.setGoogleLoading(true);
    try {
      const supabase = await assertSupabase();
      const redirectTo = Platform.select({
        web: typeof window !== 'undefined'
          ? `${window.location.origin}/auth-callback`
          : 'http://localhost:8081/auth-callback',
        default: makeRedirectUri({ scheme: 'edudashpro', path: 'auth-callback' }),
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { access_type: 'offline', prompt: 'consent' } },
      });
      if (error) throw error;

      if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo!);
        if (result.type === 'success') router.push('/auth-callback' as any);
        else if (result.type === 'cancel') deps.setGoogleLoading(false);
      }
    } catch (error: any) {
      logger.error('SignIn', 'Google Sign-In Error:', error);
      deps.showAlert({
        title: deps.t('auth.sign_in.failed', { defaultValue: 'Sign In Failed' }),
        message: error.message || deps.t('auth.oauth.config_error', { defaultValue: 'Failed to sign in with Google. Please try again.' }),
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      deps.setGoogleLoading(false);
    }
  }, []);

  return { handleSignIn, handleGoogleSignIn, stopLoadingState, clearSignInWatchdog, isMountedRef };
}

// ── Helpers ─────────────────────────────────

async function saveCredentials(email: string, password: string, remember: boolean): Promise<void> {
  const { storage } = await import('@/lib/storage');
  const { secureStore } = await import('@/lib/secure-store');
  const key = `password_${email.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  if (remember) {
    await storage.setItem('rememberMe', 'true');
    await storage.setItem('savedEmail', email);
    await secureStore.setItem(key, password);
  } else {
    await storage.removeItem('rememberMe');
    await storage.removeItem('savedEmail');
    try { await secureStore.deleteItem(key); } catch { /* noop */ }
  }
}

async function resendVerification(email: string, deps: SignInFormDeps): Promise<void> {
  try {
    const { error } = await assertSupabase().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: 'https://www.edudashpro.org.za/landing?flow=email-confirm' },
    });
    if (error) {
      deps.showAlert({
        title: deps.t('common.error', { defaultValue: 'Error' }),
        message: error.message,
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } else {
      deps.showAlert({
        title: deps.t('auth.sign_in.email_sent', { defaultValue: 'Email Sent' }),
        message: deps.t('auth.sign_in.verification_email_sent', {
          defaultValue: 'A new verification email has been sent to your inbox.',
        }),
        type: 'success',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    }
  } catch (e: any) {
    deps.showAlert({
      title: deps.t('common.error', { defaultValue: 'Error' }),
      message: e?.message || 'Failed to resend verification email.',
      type: 'error',
      buttons: [{ text: 'OK', style: 'default' }],
    });
  }
}
