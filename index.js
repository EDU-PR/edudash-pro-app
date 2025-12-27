/**
 * Entry point for EduDash Pro mobile app
 * 
 * Note: Promise.any polyfill is loaded via Metro's getModulesRunBeforeMainModule
 * in metro.config.js, which ensures it runs before any module initialization.
 */

// CRITICAL: Install Promise.any polyfill FIRST (before any other imports)
// This must be imported before any library that uses Promise.any (like Daily.co)
import 'promise.any/auto';

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

// Load expo-router entry
import 'expo-router/entry';
