/**
 * Entry point for EduDash Pro mobile app
 * 
 * Note: Promise.any polyfill is loaded via Metro's getModulesRunBeforeMainModule
 * in metro.config.js, which ensures it runs before any module initialization.
 */

// CRITICAL: Install Promise.any polyfill FIRST (before any other imports)
// This must be imported before any library that uses Promise.any (like Daily.co)
import './polyfills/promise';

// =====================================================
// SENTRY INITIALIZATION - MUST BE EARLY FOR CRASH TRACKING
// =====================================================
import * as Sentry from 'sentry-expo';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN && /https?:\/\/.+@.+/i.test(SENTRY_DSN)) {
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      enableInExpoDevelopment: true, // Track in dev too for testing
      debug: __DEV__,
      environment: process.env.EXPO_PUBLIC_ENVIRONMENT || (__DEV__ ? 'development' : 'production'),
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      // Enable native crash handling for production
      enableNative: true,
      enableNativeCrashHandling: true,
      enableAutoPerformanceTracing: !__DEV__,
      // Breadcrumbs for better debugging
      enableAutoBreadcrumbTracking: true,
    });
    console.log('[Sentry] ✅ Initialized at app entry point');
  } catch (e) {
    console.warn('[Sentry] ❌ Failed to initialize:', e);
  }
} else {
  console.log('[Sentry] ⚠️ No valid DSN, skipping initialization');
}

// Suppress known harmless warnings from third-party libraries
import { LogBox, Platform } from 'react-native';
if (Platform.OS !== 'web') {
  // Suppress NativeEventEmitter warnings from react-native-webrtc and similar modules
  // These are harmless warnings from third-party libraries with incomplete bridge implementations
  LogBox.ignoreLogs([
    'new NativeEventEmitter',
    'Require cycle:',
  ]);
}

// Load React polyfills before expo-router
import './polyfills/react-use';

// Register HeadlessJS task for background call handling (MUST be before expo-router)
// This enables incoming calls to display when the app is killed or backgrounded on Android
import { registerCallHeadlessTask } from './lib/calls/CallHeadlessTask';
registerCallHeadlessTask();

// Register Expo background notification task for incoming calls
// This handles notifications when app is backgrounded (works without Firebase)
import { registerBackgroundNotificationTask } from './lib/calls/CallBackgroundNotification';

// CRITICAL: Await registration to ensure channel is setup before notifications arrive
registerBackgroundNotificationTask()
  .then(() => {
    console.log('[App] ✅ Background notifications ready');
  })
  .catch((error) => {
    console.error('[App] ❌ Background notification setup failed:', error);
  });

// Register Notifee foreground service and background event handler for call notifications
// CRITICAL: Both must be at root level to work when app is backgrounded/killed
import { 
  registerCallNotificationBackgroundHandler, 
  registerCallForegroundService 
} from './components/calls/hooks/useCallBackgroundHandler';

// Register the foreground service task FIRST (required for asForegroundService notifications)
registerCallForegroundService();

// Then register background event handler
registerCallNotificationBackgroundHandler();

// Load expo-router entry
import 'expo-router/entry';
