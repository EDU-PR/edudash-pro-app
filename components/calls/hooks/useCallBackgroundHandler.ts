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
  /** Whether audio is muted */
  isAudioEnabled?: boolean;
  /** Whether speaker is enabled */
  isSpeakerEnabled?: boolean;
  /** Callback when app returns from background during call */
  onReturnFromBackground?: () => void;
  /** Callback to toggle mute */
  onToggleMute?: () => void;
  /** Callback to toggle speaker */
  onToggleSpeaker?: () => void;
  /** Callback to end call */
  onEndCall?: () => void;
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
  isAudioEnabled = true,
  isSpeakerEnabled = false,
  onReturnFromBackground,
  onToggleMute,
  onToggleSpeaker,
  onEndCall,
}: CallBackgroundHandlerOptions): CallBackgroundHandlerReturn {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const keepAwakeActiveRef = useRef(false);
  const wasInBackgroundRef = useRef(false);
  const foregroundServiceActiveRef = useRef(false);
  const notificationUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if call is in an active audio state
  const isAudioActive = callState === 'connected' || callState === 'connecting' || callState === 'ringing';

  // Shared handler function for both foreground and background events
  const handleNotificationAction = useCallback(async (actionId: string | undefined) => {
    if (!actionId) return;
    
    console.log('[CallBackgroundHandler] Notification action pressed:', actionId);
    
    switch (actionId) {
      case 'toggle-mute':
        onToggleMute?.();
        // Update notification after brief delay to reflect new state
        if (foregroundServiceActiveRef.current) {
          setTimeout(() => updateForegroundServiceNotification(), 100);
        }
        break;
      case 'toggle-speaker':
        onToggleSpeaker?.();
        if (foregroundServiceActiveRef.current) {
          setTimeout(() => updateForegroundServiceNotification(), 100);
        }
        break;
      case 'end-call':
        console.log('[CallBackgroundHandler] End call action triggered');
        onEndCall?.();
        break;
      case 'default':
        // User tapped notification body - app is brought to foreground automatically
        console.log('[CallBackgroundHandler] User tapped notification body');
        break;
    }
  }, [onToggleMute, onToggleSpeaker, onEndCall, updateForegroundServiceNotification]);

  // Setup notification action handlers at mount (not in startForegroundService)
  // This ensures handlers are registered before notifications are shown
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!ensureNotifeeLoaded() || !notifee) return;

    console.log('[CallBackgroundHandler] Setting up notification action handlers (foreground + background)');
    
    // Register foreground event handler (when app is in foreground)
    const unsubscribeForeground = notifee.onForegroundEvent(async ({ type, detail }) => {
      const { notification, pressAction } = detail;
      
      // Only handle our call notification
      if (notification?.id !== CALL_NOTIFICATION_ID) return;
      
      if (type === 1) { // PRESS event
        await handleNotificationAction(pressAction?.id);
      }
    });

    // Register background event handler (when app is backgrounded or killed)
    // This is CRITICAL for notification actions to work when app is not in foreground
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      const { notification, pressAction } = detail;
      
      // Only handle our call notification
      if (notification?.id !== CALL_NOTIFICATION_ID) return;
      
      if (type === 1) { // PRESS event
        console.log('[CallBackgroundHandler] Background event received:', pressAction?.id);
        await handleNotificationAction(pressAction?.id);
      }
    });

    return () => {
      unsubscribeForeground();
      // Note: onBackgroundEvent doesn't return an unsubscribe function
      // It's registered globally and persists until app restart
    };
  }, [handleNotificationAction]);

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
   * Update foreground service notification with current call state
   * This updates the notification when mute/speaker state changes
   */
  const updateForegroundServiceNotification = useCallback(async () => {
    if (Platform.OS !== 'android' || !foregroundServiceActiveRef.current || !notifee) {
      return;
    }

    try {
      const callTypeEmoji = callType === 'video' ? '📹' : '📞';
      const callTypeText = callType === 'video' ? 'Video call' : 'Voice call';
      
      // Improved status text for better visibility
      let statusText: string;
      let notificationTitle: string;
      let notificationBody: string;
      
      if (callState === 'ringing') {
        statusText = 'Ringing...';
        notificationTitle = `${callTypeEmoji} ${callTypeText} - ${statusText}`;
        notificationBody = callerName ? `Calling ${callerName}...` : 'Call in progress...';
      } else if (callState === 'connecting') {
        statusText = 'Connecting...';
        notificationTitle = `${callTypeEmoji} ${callTypeText} - ${statusText}`;
        notificationBody = callerName ? `Connecting to ${callerName}...` : 'Connecting...';
      } else {
        statusText = isAudioEnabled ? 'Active' : 'Muted';
        notificationTitle = `${callTypeEmoji} ${callTypeText} - ${statusText}`;
        notificationBody = callerName ? `With ${callerName}` : 'Tap to return to call';
      }
      
      // Build foreground service types - include CAMERA for video calls
      const serviceTypes = [
        AndroidForegroundServiceType?.FOREGROUND_SERVICE_TYPE_PHONE_CALL ?? 4,
        AndroidForegroundServiceType?.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK ?? 2,
        AndroidForegroundServiceType?.FOREGROUND_SERVICE_TYPE_MICROPHONE ?? 128,
      ];
      
      // Add CAMERA type for video calls (Android 14+)
      if (callType === 'video') {
        serviceTypes.push(AndroidForegroundServiceType?.FOREGROUND_SERVICE_TYPE_CAMERA ?? 256);
      }
      
      // Determine notification importance based on call state
      // MAX importance during ringing for maximum visibility
      const importance = callState === 'ringing' 
        ? (AndroidImportance?.MAX ?? 5)  // MAX importance during ringing
        : (AndroidImportance?.HIGH ?? 4); // HIGH importance otherwise

      // Build notification actions based on call state
      const actions = [];
      
      // Mute/Unmute action
      if (callState === 'connected') {
        actions.push({
          title: isAudioEnabled ? '🔇 Mute' : '🔊 Unmute',
          pressAction: {
            id: 'toggle-mute',
          },
          icon: isAudioEnabled ? 'ic_stat_name' : 'ic_stat_name', // Use appropriate icon
        });
        
        // Speaker toggle (voice calls only)
        if (callType === 'voice') {
          actions.push({
            title: isSpeakerEnabled ? '📱 Earpiece' : '🔊 Speaker',
            pressAction: {
              id: 'toggle-speaker',
            },
          });
        }
      }
      
      // End call action
      actions.push({
        title: '❌ End Call',
        pressAction: {
          id: 'end-call',
        },
        icon: 'ic_stat_name',
      });

      await notifee.displayNotification({
        id: CALL_NOTIFICATION_ID,
        title: notificationTitle,
        body: notificationBody,
        android: {
          channelId: CALL_CHANNEL_ID,
          asForegroundService: true,
          foregroundServiceTypes: serviceTypes,
          category: AndroidCategory?.CALL,
          ongoing: true,
          autoCancel: false,
          smallIcon: 'ic_notification', // Shows in status bar
          largeIcon: 'ic_notification', // Shows in expanded notification/system drawer
          color: '#00f5ff', // Accent color for notification
          // Show in status bar and system drawer
          visibility: 1, // PUBLIC - show on lock screen and status bar
          importance: importance, // MAX during ringing, HIGH otherwise
          showTimestamp: true,
          // fullScreenIntent: Show notification even when screen is off (Android 10+)
          // This is CRITICAL for ringing state visibility
          fullScreenIntent: callState === 'ringing', // Only during ringing for maximum visibility
          pressAction: {
            id: 'default',
            launchActivity: 'default', // Brings app to foreground
          },
          // Media controls as notification actions
          // These appear in the notification drawer and lock screen
          actions: actions,
        },
      });
      
      console.log('[CallBackgroundHandler] ✅ Notification updated with current state');
    } catch (error) {
      console.warn('[CallBackgroundHandler] Failed to update notification:', error);
    }
  }, [callState, callType, callerName, isAudioEnabled, isSpeakerEnabled]);

  /**
   * Start Android foreground service to keep WebRTC alive in background
   * This is REQUIRED for voice/video calls to continue when app is backgrounded
   * Uses Notifee's foreground service API (2025 best practice)
   */
  const startForegroundService = useCallback(async () => {
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
      // Use MAX importance to allow fullScreenIntent and maximum visibility
      await notifee.createChannel({
        id: CALL_CHANNEL_ID,
        name: 'Ongoing Calls',
        description: 'Notification for active voice/video calls',
        importance: AndroidImportance?.MAX ?? 5, // MAX importance to support fullScreenIntent
        vibration: false,
        sound: undefined, // No sound for ongoing call notification (prevents double sound with ringtone)
        // Show in status bar and lock screen
        visibility: 1, // PUBLIC - show on lock screen
      });
      
      // Initial notification display
      await updateForegroundServiceNotification();
      
      foregroundServiceActiveRef.current = true;
      console.log('[CallBackgroundHandler] ✅ Notifee foreground service started - call will persist in background');
    } catch (error) {
      console.error('[CallBackgroundHandler] Failed to start foreground service:', error);
    }
  }, [callType, updateForegroundServiceNotification]);

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
      // Start foreground service earlier - on connecting/ringing, not just connected
      // This protects WebRTC before the call fully connects
      if (callState === 'connecting' || callState === 'ringing' || callState === 'connected') {
        startForegroundService();
      }
    } else {
      deactivateCallKeepAwake();
      stopForegroundService();
    }

    return () => {
      deactivateCallKeepAwake();
      stopForegroundService();
    };
  }, [isAudioActive, isCallActive, callState, activateCallKeepAwake, deactivateCallKeepAwake, configureBackgroundAudio, startForegroundService, stopForegroundService]);

  // Update notification when call state or audio/speaker state changes
  useEffect(() => {
    if (foregroundServiceActiveRef.current) {
      // Debounce notification updates to avoid excessive updates
      if (notificationUpdateTimeoutRef.current) {
        clearTimeout(notificationUpdateTimeoutRef.current);
      }
      
      notificationUpdateTimeoutRef.current = setTimeout(() => {
        updateForegroundServiceNotification();
      }, 200);
    }
    
    return () => {
      if (notificationUpdateTimeoutRef.current) {
        clearTimeout(notificationUpdateTimeoutRef.current);
      }
    };
  }, [callState, isAudioEnabled, isSpeakerEnabled, callerName, callType, updateForegroundServiceNotification]);

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
          console.log('[CallBackgroundHandler] Call state:', callState);
          
          // PROACTIVE: Start foreground service immediately if call is active but service isn't running
          // This catches cases where service wasn't started yet (e.g., during connecting/ringing)
          if (!foregroundServiceActiveRef.current && isCallActive) {
            console.log('[CallBackgroundHandler] ⚠️ Service not active - starting proactively');
            startForegroundService();
          } else if (foregroundServiceActiveRef.current) {
            // CRITICAL: Force immediate notification update when backgrounding during ringing
            // This ensures notification is visible immediately, especially during ringing state
            if (callState === 'ringing' || callState === 'connecting') {
              console.log('[CallBackgroundHandler] Forcing immediate notification update during ringing/connecting');
              // Update notification immediately (no debounce) to ensure visibility
              updateForegroundServiceNotification();
            }
          }
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
          
          // Update notification to reflect current state
          if (foregroundServiceActiveRef.current) {
            updateForegroundServiceNotification();
          }
          
          onReturnFromBackground?.();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [isAudioActive, callId, isCallActive, onReturnFromBackground, startForegroundService, updateForegroundServiceNotification]);

  return {
    appState: appStateRef.current,
    isInBackground: appStateRef.current === 'background',
  };
}

export default useCallBackgroundHandler;
