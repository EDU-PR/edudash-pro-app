import React, { useEffect, useRef } from 'react';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '@/contexts/AuthContext';
import MarketingLanding from '@/components/marketing/MarketingLanding';
import { routeAfterLogin } from '@/lib/routeAfterLogin';
import { useTheme } from '@/contexts/ThemeContext';
import { setPasswordRecoveryInProgress } from '@/lib/sessionManager';
import { parseDeepLinkUrl } from '@/lib/utils/deepLink';

// Default theme fallback (used before ThemeProvider mounts)
const defaultTheme = {
  background: '#ffffff',
  primary: '#007AFF',
};

/**
 * Root index route - handles different flows based on platform:
 * - Native app (installed): Skip landing, go directly to sign-in or dashboard
 * - Web (not installed): Show marketing landing page
 * - Authenticated users: Redirect to appropriate dashboard
 */
export default function Index() {
  const { session, user, profile, loading } = useAuth();
  // Safe theme access with fallback
  let theme = defaultTheme;
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
  } catch (err) {
    // ThemeProvider not yet mounted, use default
  }
  const hasNavigatedRef = useRef(false);
  const isNative = Platform.OS !== 'web';

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;
    
    // Prevent duplicate navigation
    if (hasNavigatedRef.current) return;
    
    // Native app: Always skip landing page
    if (isNative) {
      hasNavigatedRef.current = true;

      // If we were launched via a deep link (e.g. PayFast return -> /landing?flow=payment-return),
      // respect it and route there before running our "default" native redirects.
      // This avoids losing deep links on cold start due to the Index screen redirecting immediately.
      (async () => {
        try {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl) {
            const { path, params } = parseDeepLinkUrl(initialUrl);

            // Ignore common "empty" or dev-client URLs
            const shouldHandle =
              !!path &&
              path !== '/' &&
              !path.startsWith('/--/') &&
              !path.startsWith('/expo-development-client');

            if (shouldHandle) {
              const search = new URLSearchParams();
              for (const [k, v] of Object.entries(params)) {
                if (v === undefined || v === null || v === '') continue;
                search.set(k, String(v));
              }
              const target = `${path}${search.toString() ? `?${search.toString()}` : ''}`;
              console.log('[Index] Detected initial deep link, routing to:', target);
              
              // Special handling for auth-related deep links
              if (path === '/reset-password' || path.includes('reset-password')) {
                console.log('[Index] Password reset deep link detected - routing to native reset flow');
                // Set recovery flag early so AuthContext does not auto-route away.
                try { setPasswordRecoveryInProgress(true); } catch { /* non-fatal */ }
                router.replace(`/reset-password${search.toString() ? `?${search.toString()}` : ''}` as `/${string}`);
                return;
              }
              if (path === '/auth-callback' || path.includes('auth-callback')) {
                console.log('[Index] Auth callback deep link detected');
                const flow = String(params.flow || params.type || '').toLowerCase();
                if (flow === 'recovery') {
                  try { setPasswordRecoveryInProgress(true); } catch { /* non-fatal */ }
                }
                router.replace(`/auth-callback${search.toString() ? `?${search.toString()}` : ''}` as `/${string}`);
                return;
              }
              
              router.replace(target as `/${string}`);
              return;
            }
          }
        } catch (e) {
          // Non-fatal: continue with normal routing below
        }

        // If authenticated with profile, go to dashboard
        if (session && user && profile?.role) {
          console.log('[Index] Native + authenticated, routing to dashboard');
          routeAfterLogin(user, profile).catch((err) => {
            console.error('[Index] routeAfterLogin failed:', err);
            router.replace('/profiles-gate');
          });
        } else if (session && user) {
          // Authenticated but no role - go to profiles gate
          console.log('[Index] Native + authenticated but no role, going to profiles-gate');
          router.replace('/profiles-gate');
        } else {
          // Not authenticated - go directly to sign-in
          console.log('[Index] Native + not authenticated, going to sign-in');
          router.replace('/(auth)/sign-in');
        }
      })();
      return;
    }
    
    // Web: Only redirect if authenticated
    if (session && user) {
      hasNavigatedRef.current = true;
      console.log('[Index] Web + authenticated, routing to dashboard');
      
      if (profile?.role) {
        routeAfterLogin(user, profile).catch((err) => {
          console.error('[Index] routeAfterLogin failed:', err);
          router.replace('/profiles-gate');
        });
      } else {
        router.replace('/profiles-gate');
      }
    }
    // Web + not authenticated: Show landing page (default render)
  }, [session, user, profile, loading, isNative]);

  // Native: Show loading indicator while redirecting (NEVER show landing page)
  if (isNative) {
    return (
      <View style={[styles.nativeLoading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }
  
  // Web: Show landing page for unauthenticated users or while loading
  return <MarketingLanding />;
}

const styles = StyleSheet.create({
  nativeLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
