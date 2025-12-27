// CRITICAL: Load Promise polyfills FIRST (required by Daily.co SDK)
import '../polyfills/promise';
import '../polyfills/react-use';

import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, LogBox } from 'react-native';
// Initialize i18n globally (web + native)
import '../lib/i18n';

// Suppress known dev warnings
if (__DEV__) {
  LogBox.ignoreLogs([
    'shadow* style props are deprecated',
    'textShadow* style props are deprecated',
    'props.pointerEvents is deprecated',
    'Require cycle:', // Suppress circular dependency warnings in dev
  ]);
}

// Initialize notification router for multi-account support
import { setupNotificationRouter } from '../lib/NotificationRouter';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { Stack, router, usePathname } from 'expo-router';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import ToastProvider from '../components/ui/ToastProvider';
import { QueryProvider } from '../lib/query/queryClient';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DashboardPreferencesProvider } from '../contexts/DashboardPreferencesContext';
import { UpdatesProvider } from '../contexts/UpdatesProvider';
import { TermsProvider } from '../contexts/TerminologyContext';
import { OnboardingProvider } from '../contexts/OnboardingContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AlertProvider } from '../components/ui/StyledAlert';
import DashWakeWordListener from '../components/ai/DashWakeWordListener';
import type { IDashAIAssistant } from '../services/dash-ai/DashAICompat';
import { DraggableDashFAB } from '../components/ui/DraggableDashFAB';
import { BottomTabBar } from '../components/navigation/BottomTabBar';
import { AnimatedSplash } from '../components/ui/AnimatedSplash';
import { CallProvider } from '../components/calls/CallProvider';
import { NotificationProvider } from '../contexts/NotificationContext';
// GlobalUpdateBanner removed - using system notifications instead
import { AppPreferencesProvider, useAppPreferencesSafe } from '../contexts/AppPreferencesContext';
import { OrganizationBrandingProvider } from '../contexts/OrganizationBrandingContext';
import { AppTutorial } from '../components/onboarding/AppTutorial';
import { FloatingCallOverlay } from '../components/calls/FloatingCallOverlay';

// Extracted utilities and hooks (WARP.md refactoring)
import { useAuthGuard, useMobileWebGuard } from '../hooks/useRouteGuard';
import { useFABVisibility } from '../hooks/useFABVisibility';
import { setupPWAMetaTags } from '../lib/utils/pwa';
import { injectWebStyles } from '../lib/utils/web-styles';
import * as Linking from 'expo-linking';

// Inner component with access to AuthContext
function LayoutContent() {
  const pathname = usePathname();
  const { loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const [showFAB, setShowFAB] = useState(false);
  const [statusBarKey, setStatusBarKey] = useState(0);
  
  // App preferences for FAB visibility
  const { showDashFAB, tutorialCompleted } = useAppPreferencesSafe();
  
  // Route guards (auth + mobile web)
  useAuthGuard();
  useMobileWebGuard();
  
  // Force StatusBar re-render when theme changes
  useEffect(() => {
    setStatusBarKey((prev) => prev + 1);
  }, [isDark]);
  
  // Configure Android navigation bar to match theme
  useEffect(() => {
    if (Platform.OS === 'android') {
      const configureNavigationBar = async () => {
        try {
          // Set navigation bar background color to match theme
          await NavigationBar.setBackgroundColorAsync(isDark ? '#0a0a0f' : '#ffffff');
          // Set button style (light buttons for dark bg, dark buttons for light bg)
          await NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
          // Set border color to match or be slightly different
          await NavigationBar.setBorderColorAsync(isDark ? '#1a1a2e' : '#e5e7eb');
        } catch (error) {
          // Navigation bar API may not be available on all devices
          console.log('NavigationBar setup skipped:', error);
        }
      };
      configureNavigationBar();
    }
  }, [isDark]);
  
  // FAB visibility logic
  const { shouldHideFAB } = useFABVisibility(pathname);
  
  // Determine if on auth route for FAB delay logic
  const isAuthRoute =
    typeof pathname === 'string' &&
    (pathname.startsWith('/(auth)') ||
      pathname === '/sign-in' ||
      pathname === '/(auth)/sign-in' ||
      pathname === '/landing' ||
      pathname === '/' ||
      pathname.includes('auth-callback'));
  
  // Show FAB after auth loads and brief delay
  useEffect(() => {
    if (!authLoading && !isAuthRoute) {
      const timer = setTimeout(() => setShowFAB(true), 800);
      return () => clearTimeout(timer);
    } else {
      setShowFAB(false);
    }
  }, [authLoading, isAuthRoute]);
  
  // Determine if FAB should be visible (user pref + route logic)
  const shouldShowFAB = showFAB && !shouldHideFAB && showDashFAB;
  
  return (
    <View style={styles.container}>
      <StatusBar key={statusBarKey} style={isDark ? 'light' : 'dark'} animated />
      
      {/* App Tutorial - shows on first launch */}
      {Platform.OS !== 'web' && !tutorialCompleted && (
        <AppTutorial />
      )}
      
      {/* Update Banner removed - using system notifications instead */}
      
      {Platform.OS !== 'web' && <DashWakeWordListener />}
      
      {/* Main content area - leave space for bottom nav */}
      <View style={styles.contentContainer}>
        <Stack
          screenOptions={{
            headerShown: false,
            presentation: 'card',
            animationTypeForReplace: 'push',
          }}
        >
          {/* Let Expo Router auto-discover screens */}
        </Stack>
      </View>
      
      {/* Draggable Dash Chat FAB - visible on dashboards and main screens */}
      {shouldShowFAB && (
        <DraggableDashFAB />
      )}
      
      {/* Persistent Bottom Navigation - positioned at bottom */}
      <BottomTabBar />
      
      {/* Floating Call Overlay - persists across all screens and when backgrounded */}
      <FloatingCallOverlay />
      
      {/* Call Interfaces are rendered by CallProvider - no duplicates needed here */}
    </View>
  );
}

export default function RootLayout() {
  if (__DEV__) console.log('[RootLayout] Rendering...');
  
  // Setup PWA meta tags on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      setupPWAMetaTags();
    }
  }, []);
  
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <ThemeProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <UpdatesProvider>
                <AppPreferencesProvider>
                  <NotificationProvider>
                    <CallProvider>
                      <OnboardingProvider>
                        <OrganizationBrandingProvider>
                        <DashboardPreferencesProvider>
                        <TermsProvider>
                          <ToastProvider>
                            <AlertProvider>
                              <GestureHandlerRootView style={{ flex: 1 }}>
                                <RootLayoutContent />
                              </GestureHandlerRootView>
                            </AlertProvider>
                          </ToastProvider>
                        </TermsProvider>
                      </DashboardPreferencesProvider>
                      </OrganizationBrandingProvider>
                      </OnboardingProvider>
                    </CallProvider>
                  </NotificationProvider>
                </AppPreferencesProvider>
              </UpdatesProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutContent() {
  const [dashInstance, setDashInstance] = useState<IDashAIAssistant | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const { session } = useAuth();
  
  if (__DEV__) console.log('[RootLayoutContent] Rendering...');
  
  // Setup notification router on native (once per app lifecycle)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    console.log('[RootLayout] Setting up notification router...');
    const cleanup = setupNotificationRouter();
    
    return () => {
      console.log('[RootLayout] Cleaning up notification router');
      cleanup();
    };
  }, []);

  // Handle runtime deep links (e.g. returning from PayFast while the app is already open).
  // Cold-start deep links are handled by Expo Router + `app/index.tsx` safeguards, but warm-start
  // needs an explicit listener because the app may resume to the previous screen.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleUrl = (url: string) => {
      try {
        const parsed = Linking.parse(url);
        const rawPath = typeof parsed.path === 'string' ? parsed.path : '';
        // Expo Linking.parse() returns hostname on the parsed object
        const host = typeof parsed.hostname === 'string' ? String(parsed.hostname) : '';
        const qp = (parsed.queryParams || {}) as Record<string, unknown>;

        const flow = String(qp.flow || '').toLowerCase();
        if (flow === 'payment-return' || flow === 'payment-cancel') {
          const paymentPath = flow === 'payment-return' ? 'return' : 'cancel';
          const search = new URLSearchParams();
          for (const [k, v] of Object.entries(qp)) {
            if (k === 'flow') continue;
            if (v === undefined || v === null) continue;
            search.set(k, String(v));
          }
          const target = `/screens/payments/${paymentPath}${search.toString() ? `?${search.toString()}` : ''}`;
          router.replace(target as `/${string}`);
          return;
        }

        // Handle direct custom-scheme links (edudashpro://screens/payments/return?...).
        const combined = host ? `${host}${rawPath ? `/${rawPath}` : ''}` : rawPath;
        const normalized = combined ? `/${combined.replace(/^\/+/, '')}` : '';
        if (normalized.startsWith('/screens/payments/return') || normalized.startsWith('/screens/payments/cancel')) {
          const search = new URLSearchParams();
          for (const [k, v] of Object.entries(qp)) {
            if (v === undefined || v === null) continue;
            search.set(k, String(v));
          }
          const target = `${normalized}${search.toString() ? `?${search.toString()}` : ''}`;
          router.replace(target as `/${string}`);
        }
      } catch {
        // ignore
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);
  
  // Register service worker for PWA (web-only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    const n = typeof navigator !== 'undefined' ? navigator : undefined;
    
    if (n?.serviceWorker) {
      n.serviceWorker
        .register('/sw.js')
        .then((registration: ServiceWorkerRegistration) => {
          console.log('[PWA] Service worker registered:', registration.scope);
        })
        .catch((error: Error) => {
          console.warn('[PWA] Service worker registration failed:', error);
        });
    } else {
      console.log('[PWA] Service workers not supported in this browser');
    }
  }, []);
  
  // Initialize Dash AI Assistant at root level and sync context
  useEffect(() => {
    // Skip Dash AI on web platform
    if (Platform.OS === 'web') {
      console.log('[RootLayoutContent] Skipping Dash AI on web');
      return;
    }
    
    // Skip initialization if no session (unauthenticated)
    if (!session) {
      return;
    }
    
    (async () => {
      try {
        const module = await import('../services/dash-ai/DashAICompat');
        type DashModule = { DashAIAssistant?: { getInstance?: () => IDashAIAssistant }; default?: { getInstance?: () => IDashAIAssistant } };
        const typedModule = module as DashModule;
        const DashClass = typedModule.DashAIAssistant || typedModule.default;
        const dash: IDashAIAssistant | null = DashClass?.getInstance?.() || null;
        if (dash) {
          await dash.initialize();
          setDashInstance(dash);
          // Best-effort: sync Dash user context (language, traits)
          // Only call Edge Functions when authenticated
          try {
            const { getCurrentLanguage } = await import('../lib/i18n');
            const { syncDashContext } = await import('../lib/agent/dashContextSync');
            const { getAgenticCapabilities } = await import('../lib/utils/agentic-mode');
            const { getCurrentProfile } = await import('../lib/sessionManager');
            const profile = await getCurrentProfile().catch(() => null);
            const role = profile?.role as string | undefined;
            const caps = getAgenticCapabilities(role);
            await syncDashContext({ language: getCurrentLanguage(), traits: { agentic: caps, role: role || null } });
          } catch (syncErr) {
            if (__DEV__) console.warn('[RootLayout] dash-context-sync skipped:', syncErr);
          }
        }
      } catch (e) {
        console.error('[RootLayout] Failed to initialize Dash:', e);
      }
    })();
  }, [session]); // Re-run when session changes
  
  // Inject web-specific styles (Expo dev nav hiding, full viewport height)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const cleanup = injectWebStyles();
      return cleanup;
    }
  }, []);
  
  // Show splash screen only on native
  if (showSplash && Platform.OS !== 'web') {
    return <AnimatedSplash onFinish={() => setShowSplash(false)} />;
  }
  
  return <LayoutContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    flex: 1,
  },
});
