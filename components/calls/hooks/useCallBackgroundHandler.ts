/**
 * Call Background Handler Hook
 * 
 * Manages call persistence during app minimization and screen lock:
 * - Keeps screen awake during active calls (prevents screen lock from dropping call)
 * - Handles app state changes (foreground/background transitions)
 * - Ensures audio continues in background via InCallManager
 * - Starts Android foreground service to keep WebRTC alive in background
 * 
 * NOTE: CallKeep has been removed due to Expo SDK 54+ compatibility issues.
 * Background call persistence now relies on:
 * 1. expo-keep-awake for screen wake
 * 2. InCallManager for audio routing
 * 3. @notifee/react-native for Android foreground service (2025 best practice)
 * 
 * @module useCallBackgroundHandler
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import type { CallState } from '../types';

// Unique tag for KeepAwake during calls
const CALL_KEEP_AWAKE_TAG = 'active-voice-call';

// Feature flag to disable foreground service while debugging crash
// Set to false to completely skip foreground service (for debugging)
const ENABLE_FOREGROUND_SERVICE = false; // TEMPORARY: disabled to debug crash

// Conditionally import InCallManager
let InCallManager: any = null;
try {
  InCallManager = require('react-native-incall-manager').default;
} catch (error) {
  console.warn('[CallBackgroundHandler] InCallManager not available');
}

// Conditionally import Notifee for foreground service (Android only)
// Using lazy loading to prevent crashes during module initialization
let notifee: typeof import('@notifee/react-native').default | null = null;
let AndroidImportance: typeof import('@notifee/react-native').AndroidImportance | null = null;
let AndroidCategory: typeof import('@notifee/react-native').AndroidCategory | null = null;
let AndroidForegroundServiceType: typeof import('@notifee/react-native').AndroidForegroundServiceType | null = null;
let notifeeLoaded = false;
let notifeeLoadError: Error | null = null;

/**
 * Lazy-load notifee to prevent app crashes during initialization
 * Returns true if notifee is available
 */
function ensureNotifeeLoaded(): boolean {
  if (Platform.OS !== 'android') return false;
  if (notifeeLoaded) return notifee !== null;
  
  try {
    const notifeeModule = require('@notifee/react-native');
    notifee = notifeeModule.default;
    AndroidImportance = notifeeModule.AndroidImportance;
    AndroidCategory = notifeeModule.AndroidCategory;
    AndroidForegroundServiceType = notifeeModule.AndroidForegroundServiceType;
    notifeeLoaded = true;
    console.log('[CallBackgroundHandler] Notifee loaded successfully');
    return true;
  } catch (error) {
    notifeeLoadError = error as Error;
    notifeeLoaded = true; // Mark as attempted
    console.warn('[CallBackgroundHandler] Notifee not available:', error);
    return false;
  }
}

/**
 * Register the foreground service runner for call notifications.
 * MUST be called at app startup (in index.js) before any notifications are displayed.
 * 
 * This creates a long-running task that keeps the service alive while a call is active.
 * The service persists until stopForegroundService() is called when the call ends.
 */
export function registerCallForegroundService(): void {
  if (Platform.OS !== 'android') return;
  
  if (!ensureNotifeeLoaded() || !notifee) {
    console.log('[CallBackgroundHandler] Skipping foreground service registration - notifee not available');
    return;
  }
  
  try {
    notifee.registerForegroundService((notification) => {
      return new Promise(() => {
        // This promise intentionally never resolves - the service runs until
        // stopForegroundService() is called when the call ends.
        console.log('[CallBackgroundHandler] Foreground service runner started for:', notification.id);
        
        // Listen for foreground events within the service context
        notifee?.onForegroundEvent(({ type, detail }) => {
          const EventType = require('@notifee/react-native').EventType;
          // Handle "End Call" action press from notification
          if (type === EventType.ACTION_PRESS && detail?.pressAction?.id === 'end-call') {
            console.log('[CallBackgroundHandler] End call action pressed from notification');
            // Note: Actual call termination is handled by the CallProvider
            // This just stops the foreground service
            notifee?.stopForegroundService();
          }
        });
      });
    });
    console.log('[CallBackgroundHandler] ✅ Foreground service runner registered');
  } catch (error) {
    console.error('[CallBackgroundHandler] Failed to register foreground service:', error);
  }
}

/**
 * Register background event handler for call notifications.
 * MUST be called at app startup (in index.js) to handle events when app is backgrounded/killed.
 * 
 * Handles notification interactions when the app is in background or killed state.
 */
export function registerCallNotificationBackgroundHandler(): void {
  if (Platform.OS !== 'android') return;
  
  if (!ensureNotifeeLoaded() || !notifee) {
    console.log('[CallBackgroundHandler] Skipping background handler registration - notifee not available');
    return;
  }
  
  try {
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      const EventType = require('@notifee/react-native').EventType;
      console.log('[CallBackgroundHandler] Background event:', type, detail?.notification?.id);
      
      // Handle "End Call" action from notification when app is backgrounded
      if (type === EventType.ACTION_PRESS && detail?.pressAction?.id === 'end-call') {
        console.log('[CallBackgroundHandler] End call action pressed (background)');
        // Stop the foreground service - this removes the ongoing notification
        await notifee?.stopForegroundService();
        // Note: The actual call termination needs to be handled when app returns to foreground
        // via CallProvider's event handling
      }
      
      // Handle notification press - return to app/call screen
      if (type === EventType.PRESS) {
        console.log('[CallBackgroundHandler] Notification pressed - app will be opened');
        // App will open automatically via pressAction.launchActivity: 'default'
      }
    });
    console.log('[CallBackgroundHandler] ✅ Background event handler registered');
  } catch (error) {
    console.error('[CallBackgroundHandler] Failed to register background handler:', error);
  }
}

// Foreground service notification channel ID
const CALL_CHANNEL_ID = 'ongoing-calls';
const CALL_NOTIFICATION_ID = 'ongoing-call-notification';

export interface CallBackgroundHandlerOptions {
  /** Current call state */
  callState: CallState;
  /** Whether a call is currently active (connected or connecting) */
  isCallActive: boolean;
  /** Call ID for CallKeep integration */
  callId?: string | null;
  /** Name of the person in the call (for notification) */
  callerName?: string;
  /** Type of call */
  callType?: 'voice' | 'video';
  /** Callback when app returns from background during call */
  onReturnFromBackground?: () => void;
}

export interface CallBackgroundHandlerReturn {
  /** Current app state */
  appState: AppStateStatus;
  /** Whether app is in background */
  isInBackground: boolean;
}

/**
 * Hook to handle call persistence during app background/foreground transitions
 * and screen lock/unlock events.
 */
export function useCallBackgroundHandler({
  callState,
  isCallActive,
  callId,
  callerName,
  callType = 'voice',
  onReturnFromBackground,
}: CallBackgroundHandlerOptions): CallBackgroundHandlerReturn {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const keepAwakeActiveRef = useRef(false);
  const wasInBackgroundRef = useRef(false);
  const foregroundServiceActiveRef = useRef(false);

  // Determine if call is in an active audio state
  const isAudioActive = callState === 'connected' || callState === 'connecting' || callState === 'ringing';

  /**
   * Activate KeepAwake to prevent screen from sleeping during call
   */
  const activateCallKeepAwake = useCallback(async () => {
    if (keepAwakeActiveRef.current) return;
    
    try {
      await activateKeepAwakeAsync(CALL_KEEP_AWAKE_TAG);
      keepAwakeActiveRef.current = true;
      console.log('[CallBackgroundHandler] KeepAwake activated - screen will stay on during call');
    } catch (error) {
      console.warn('[CallBackgroundHandler] Failed to activate KeepAwake:', error);
    }
  }, []);

  /**
   * Deactivate KeepAwake when call ends
   */
  const deactivateCallKeepAwake = useCallback(() => {
    if (!keepAwakeActiveRef.current) return;
    
    try {
      deactivateKeepAwake(CALL_KEEP_AWAKE_TAG);
      keepAwakeActiveRef.current = false;
      console.log('[CallBackgroundHandler] KeepAwake deactivated');
    } catch (error) {
      console.warn('[CallBackgroundHandler] Failed to deactivate KeepAwake:', error);
    }
  }, []);

  /**
   * Configure audio session for background playback (Android)
   */
  const configureBackgroundAudio = useCallback(() => {
    if (!InCallManager) return;
    
    try {
      // Start InCallManager in media mode for active call
      InCallManager.start({ media: 'audio' });
      // Keep screen on during active call
      InCallManager.setKeepScreenOn(true);
      // Use earpiece by default
      InCallManager.setForceSpeakerphoneOn(false);
      console.log('[CallBackgroundHandler] Background audio configured with InCallManager');
    } catch (error) {
      console.warn('[CallBackgroundHandler] Failed to configure background audio:', error);
    }
  }, []);

  /**
   * Start Android foreground service to keep WebRTC alive in background
   * This is REQUIRED for voice/video calls to continue when app is backgrounded
   * Uses Notifee's foreground service API (2025 best practice)
   */
  const startForegroundService = useCallback(async () => {
    // Skip if feature disabled (for debugging)
    if (!ENABLE_FOREGROUND_SERVICE) {
      console.log('[CallBackgroundHandler] Foreground service disabled via feature flag');
      return;
    }
    
    // Skip if not Android or already active
    if (Platform.OS !== 'android' || foregroundServiceActiveRef.current) {
      return;
    }
    
    // Lazy-load notifee to prevent crashes
    if (!ensureNotifeeLoaded() || !notifee) {
      console.log('[CallBackgroundHandler] Notifee not available, skipping foreground service');
      return;
    }
    
    try {
      // Create notification channel for the foreground service (required for Android 8+)
      await notifee.createChannel({
        id: CALL_CHANNEL_ID,
        name: 'Ongoing Calls',
        description: 'Notification for active voice/video calls',
        importance: AndroidImportance?.HIGH ?? 4,
        vibration: false,
        sound: undefined, // No sound for ongoing call notification
      });
      
      // Display foreground service notification
      const callTypeEmoji = callType === 'video' ? '📹' : '📞';
      const callTypeText = callType === 'video' ? 'Video call' : 'Voice call';
      
      // Show different body text based on call state
      let bodyText = 'Tap to return to call';
      if (callState === 'connected' && callerName) {
        bodyText = `Connected with ${callerName}`;
      } else if (callState === 'connecting') {
        bodyText = callerName ? `Connecting to ${callerName}...` : 'Connecting...';
      } else if (callState === 'ringing') {
        bodyText = callerName ? `Calling ${callerName}...` : 'Ringing...';
      }
      
      console.log('[CallBackgroundHandler] Starting foreground service with state:', callState);
      
      // Check if we have notification permission first (Android 13+)
      const settings = await notifee.getNotificationSettings();
      if (settings.authorizationStatus < 1) {
        console.log('[CallBackgroundHandler] No notification permission, skipping foreground service');
        return;
      }
      
      await notifee.displayNotification({
        id: CALL_NOTIFICATION_ID,
        title: `${callTypeEmoji} ${callTypeText} in progress`,
        body: bodyText,
        android: {
          channelId: CALL_CHANNEL_ID,
          asForegroundService: true,
          // Required for Android 14+ (API 34) - specify foreground service type
          // Using enum values: PHONE_CALL=4, MEDIA_PLAYBACK=2, MICROPHONE=128
          foregroundServiceTypes: [
            AndroidForegroundServiceType?.FOREGROUND_SERVICE_TYPE_PHONE_CALL ?? 4,
            AndroidForegroundServiceType?.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK ?? 2,
            AndroidForegroundServiceType?.FOREGROUND_SERVICE_TYPE_MICROPHONE ?? 128,
          ],
          category: AndroidCategory?.CALL,
          ongoing: true,
          autoCancel: false,
          smallIcon: 'ic_notification', // Use app's notification icon
          color: '#00f5ff', // App accent color
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          // Show call actions in notification
          actions: [
            {
              title: 'End Call',
              pressAction: {
                id: 'end-call',
              },
            },
          ],
        },
      });
      
      foregroundServiceActiveRef.current = true;
      console.log('[CallBackgroundHandler] ✅ Notifee foreground service started - call will persist in background');
    } catch (error) {
      // Log but don't crash - foreground service is enhancement, not critical for calls
      console.error('[CallBackgroundHandler] Failed to start foreground service:', error);
      // Mark as not active so we don't try to stop a service that didn't start
      foregroundServiceActiveRef.current = false;
    }
  }, [callerName, callType, callState]);

  /**
   * Stop the foreground service when call ends
   */
  const stopForegroundService = useCallback(async () => {
    // Skip if not Android or not active
    if (Platform.OS !== 'android' || !foregroundServiceActiveRef.current) {
      return;
    }
    
    // Check if notifee is available
    if (!notifee) {
      foregroundServiceActiveRef.current = false;
      return;
    }
    
    try {
      await notifee.stopForegroundService();
      await notifee.cancelNotification(CALL_NOTIFICATION_ID);
      foregroundServiceActiveRef.current = false;
      console.log('[CallBackgroundHandler] Foreground service stopped');
    } catch (error) {
      console.warn('[CallBackgroundHandler] Failed to stop foreground service:', error);
    }
  }, []);

  // Manage KeepAwake and foreground service based on call state
  useEffect(() => {
    if (isAudioActive && isCallActive) {
      activateCallKeepAwake();
      configureBackgroundAudio();
      // Start foreground service when call is active (connected OR connecting)
      // This ensures the notification shows even during call setup
      // Note: We use isAudioActive which includes connected, connecting, and ringing states
      // Wrap in async IIFE to properly catch errors and delay slightly
      (async () => {
        try {
          // Small delay to ensure call is fully initialized before starting service
          await new Promise(resolve => setTimeout(resolve, 500));
          await startForegroundService();
        } catch (error) {
          console.error('[CallBackgroundHandler] Error starting foreground service:', error);
          // Don't crash the app - foreground service is nice-to-have, not critical
        }
      })();
    } else {
      deactivateCallKeepAwake();
      // Wrap stop in async IIFE to catch errors
      (async () => {
        try {
          await stopForegroundService();
        } catch (error) {
          console.warn('[CallBackgroundHandler] Error stopping foreground service:', error);
        }
      })();
    }

    return () => {
      deactivateCallKeepAwake();
      // Cleanup - wrap in async IIFE
      (async () => {
        try {
          await stopForegroundService();
        } catch (error) {
          console.warn('[CallBackgroundHandler] Error in cleanup:', error);
        }
      })();
    };
  }, [isAudioActive, isCallActive, callState, activateCallKeepAwake, deactivateCallKeepAwake, configureBackgroundAudio, startForegroundService, stopForegroundService]);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;
      
      console.log('[CallBackgroundHandler] App state:', previousState, '->', nextAppState);
      
      // App going to background
      if (previousState.match(/active/) && nextAppState === 'background') {
        wasInBackgroundRef.current = true;
        
        if (isAudioActive && callId) {
          console.log('[CallBackgroundHandler] Call active, app going to background');
          console.log('[CallBackgroundHandler] Foreground service active:', foregroundServiceActiveRef.current);
        }
      }
      
      // App returning to foreground
      if (previousState.match(/background/) && nextAppState === 'active') {
        if (wasInBackgroundRef.current && isAudioActive) {
          console.log('[CallBackgroundHandler] Returning from background with active call');
          wasInBackgroundRef.current = false;
          
          // Restore audio settings when returning from background
          if (InCallManager) {
            try {
              InCallManager.setKeepScreenOn(true);
              console.log('[CallBackgroundHandler] Audio settings restored after background return');
            } catch (error) {
              console.warn('[CallBackgroundHandler] Failed to restore settings:', error);
            }
          }
          
          onReturnFromBackground?.();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [isAudioActive, callId, onReturnFromBackground]);

  return {
    appState: appStateRef.current,
    isInBackground: appStateRef.current === 'background',
  };
}

export default useCallBackgroundHandler;
