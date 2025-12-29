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

// Module-level handler registry for background events
// This allows the root-level background handler to call the hook's action handler
let globalActionHandler: ((actionId: string | undefined) => Promise<void>) | null = null;

export function setGlobalNotificationActionHandler(
  handler: (actionId: string | undefined) => Promise<void>
): void {
  globalActionHandler = handler;
  console.log('[CallBackgroundHandler] Global action handler registered');
}

export function getGlobalNotificationActionHandler():
  ((actionId: string | undefined) => Promise<void>) | null {
  return globalActionHandler;
}

/**
 * Register root-level background event handler for call notifications
 * This MUST be called at app root (index.js) to work when app is backgrounded/killed
 */
export function registerCallNotificationBackgroundHandler(): void {
  if (Platform.OS !== 'android') return;
  
  // Lazy-load notifee
  let notifee: any = null;
  try {
    notifee = require('@notifee/react-native').default;
  } catch (error) {
    console.warn('[CallBackgroundHandler] Notifee not available for background handler');
    return;
  }

  console.log('[CallBackgroundHandler] Registering root-level background event handler');
  
  // Register background event handler at root level
  // This persists even when app is killed and is called when notification actions are pressed
  notifee.onBackgroundEvent(async ({ type, detail }: any) => {
    const { notification, pressAction } = detail;
    
    // Only handle our call notification
    if (notification?.id !== CALL_NOTIFICATION_ID) return;
    
    // Handle both PRESS (type 1 - notification body tap) and ACTION_PRESS (type 2 - action button)
    if (type === 1 || type === 2) { // PRESS event (body tap) or ACTION_PRESS event (button)
      const actionId = pressAction?.id;
      console.log('[CallBackgroundHandler] Root-level background event received:', { type, actionId });
      
      // Get the global handler (set by the hook)
      const handler = getGlobalNotificationActionHandler();
      if (handler) {
        await handler(actionId);
      } else {
        console.warn('[CallBackgroundHandler] No global handler registered - hook may not be mounted');
      }
    }
  });
  
  console.log('[CallBackgroundHandler] ✅ Root-level background handler registered');
}

/**
 * Register the foreground service task with Notifee
 * CRITICAL: This MUST be called at app root (index.js) BEFORE any asForegroundService notifications
 * Without this, Notifee will warn: "no registered foreground service has been set"
 */
export function registerCallForegroundService(): void {
  if (Platform.OS !== 'android') return;
  
  // Lazy-load notifee
  let notifee: any = null;
  try {
    notifee = require('@notifee/react-native').default;
  } catch (error) {
    console.warn('[CallBackgroundHandler] Notifee not available for foreground service');
    return;
  }

  console.log('[CallBackgroundHandler] Registering foreground service task');
  
  // Register the foreground service runner
  // This is required for notifications with asForegroundService: true
  // The task keeps running while the foreground service is active
  notifee.registerForegroundService((notification: any) => {
    return new Promise((resolve) => {
      // This promise should never resolve while the call is active
      // The foreground service will be stopped when we call stopForegroundService()
      console.log('[CallBackgroundHandler] Foreground service task running for:', notification?.id);
      
      // Keep the service alive - it will be terminated when stopForegroundService() is called
      // We don't resolve this promise - it stays running until the service is stopped
    });
  });
  
  console.log('[CallBackgroundHandler] ✅ Foreground service task registered');
}

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

  // CRITICAL: Store current state values in refs for use in background handlers
  // This ensures notification updates always use the latest values, not stale closures
  const callStateRef = useRef(callState);
  const isAudioEnabledRef = useRef(isAudioEnabled);
  const isSpeakerEnabledRef = useRef(isSpeakerEnabled);
  
  // Update state refs immediately when props change
  useEffect(() => {
    callStateRef.current = callState;
    isAudioEnabledRef.current = isAudioEnabled;
    isSpeakerEnabledRef.current = isSpeakerEnabled;
  }, [callState, isAudioEnabled, isSpeakerEnabled]);

  // Determine if call is in an active audio state
  const isAudioActive = callState === 'connected' || callState === 'connecting' || callState === 'ringing';

  // Store callbacks in refs to prevent handler re-registration
  const onToggleMuteRef = useRef(onToggleMute);
  const onToggleSpeakerRef = useRef(onToggleSpeaker);
  const onEndCallRef = useRef(onEndCall);
  const updateNotificationRef = useRef(updateForegroundServiceNotification);

  // Update refs when callbacks change
  // CRITICAL: This ensures refs are always current when background handler is called
  useEffect(() => {
    console.log('[CallBackgroundHandler] Updating callback refs');
    onToggleMuteRef.current = onToggleMute;
    onToggleSpeakerRef.current = onToggleSpeaker;
    onEndCallRef.current = onEndCall;
    updateNotificationRef.current = updateForegroundServiceNotification;
  }, [onToggleMute, onToggleSpeaker, onEndCall, updateForegroundServiceNotification]);

  // Shared handler function for both foreground and background events
  // Uses refs to always access latest callbacks without re-registering handlers
  const handleNotificationAction = useCallback(async (actionId: string | undefined) => {
    if (!actionId) {
      console.log('[CallBackgroundHandler] No actionId provided');
      return;
    }
    
    console.log('[CallBackgroundHandler] Notification action pressed:', actionId);
    console.log('[CallBackgroundHandler] Callback refs status:', {
      hasToggleMute: !!onToggleMuteRef.current,
      hasToggleSpeaker: !!onToggleSpeakerRef.current,
      hasEndCall: !!onEndCallRef.current,
      hasUpdateNotification: !!updateNotificationRef.current,
    });
    
    switch (actionId) {
      case 'toggle-mute':
        console.log('[CallBackgroundHandler] Executing toggle-mute callback');
        if (onToggleMuteRef.current) {
          onToggleMuteRef.current();
        } else {
          console.warn('[CallBackgroundHandler] toggle-mute callback not available');
        }
        // Update notification after brief delay to reflect new state
        if (foregroundServiceActiveRef.current) {
          setTimeout(() => {
            if (updateNotificationRef.current) {
              updateNotificationRef.current();
            }
          }, 100);
        }
        break;
      case 'toggle-speaker':
        console.log('[CallBackgroundHandler] Executing toggle-speaker callback');
        if (onToggleSpeakerRef.current) {
          onToggleSpeakerRef.current();
        } else {
          console.warn('[CallBackgroundHandler] toggle-speaker callback not available');
        }
        if (foregroundServiceActiveRef.current) {
          setTimeout(() => {
            if (updateNotificationRef.current) {
              updateNotificationRef.current();
            }
          }, 100);
        }
        break;
      case 'end-call':
        console.log('[CallBackgroundHandler] End call action triggered');
        if (onEndCallRef.current) {
          onEndCallRef.current();
        } else {
          console.warn('[CallBackgroundHandler] end-call callback not available');
        }
        break;
      case 'default':
        // User tapped notification body - app is brought to foreground automatically
        console.log('[CallBackgroundHandler] User tapped notification body - app should open');
        break;
      default:
        console.warn('[CallBackgroundHandler] Unknown action ID:', actionId);
    }
  }, []); // Empty deps - uses refs for callbacks

  // Setup notification action handlers ONCE at mount (before any notifications)
  // This ensures handlers are registered before foreground service starts
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!ensureNotifeeLoaded() || !notifee) return;

    console.log('[CallBackgroundHandler] Setting up notification action handlers');
    
    // Register global handler for root-level background events
    setGlobalNotificationActionHandler(handleNotificationAction);
    
    // Register foreground event handler (when app is in foreground)
    const unsubscribeForeground = notifee.onForegroundEvent(async ({ type, detail }) => {
      const { notification, pressAction } = detail;
      
      // Only handle our call notification
      if (notification?.id !== CALL_NOTIFICATION_ID) return;
      
      // Handle both PRESS (type 1 - notification body tap) and ACTION_PRESS (type 2 - action button)
      if (type === 1 || type === 2) { // PRESS event (body tap) or ACTION_PRESS event (button)
        const actionId = pressAction?.id;
        console.log('[CallBackgroundHandler] Foreground event received:', { type, actionId });
        await handleNotificationAction(actionId);
      }
    });

    return () => {
      unsubscribeForeground();
      // Clear global handler on unmount
      setGlobalNotificationActionHandler(null);
    };
  }, [handleNotificationAction]); // Include handleNotificationAction to re-register if it changes

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
   * NOTE: We only start InCallManager here - screen and speaker settings are managed by useVoiceCallAudio
   * to avoid conflicts with proximity sensor and user speaker toggle
   */
  const configureBackgroundAudio = useCallback(() => {
    if (!InCallManager) return;
    
    try {
      // Start InCallManager in media mode for active call
      // NOTE: Do NOT set keepScreenOn or forceSpeakerphone here - those are managed by useVoiceCallAudio
      // Setting them here causes conflicts with proximity sensor and user speaker toggle
      InCallManager.start({ media: 'audio' });
      console.log('[CallBackgroundHandler] Background audio configured with InCallManager (audio only)');
    } catch (error) {
      console.warn('[CallBackgroundHandler] Failed to configure background audio:', error);
    }
  }, []);

  /**
   * Update foreground service notification with current call state
   * This updates the notification when mute/speaker state changes
   * CRITICAL: Uses refs instead of props to always get current values
   */
  const updateForegroundServiceNotification = useCallback(async () => {
    if (Platform.OS !== 'android' || !foregroundServiceActiveRef.current || !notifee) {
      return;
    }

    // CRITICAL: Read current values from refs, not from closure
    // This ensures we always use the latest state when called from background handlers
    const currentCallState = callStateRef.current;
    const currentIsAudioEnabled = isAudioEnabledRef.current;
    const currentIsSpeakerEnabled = isSpeakerEnabledRef.current;

    try {
      const callTypeEmoji = callType === 'video' ? '📹' : '📞';
      const callTypeText = callType === 'video' ? 'Video call' : 'Voice call';
      
      // Improved status text for better visibility
      let statusText: string;
      let notificationTitle: string;
      let notificationBody: string;
      
      if (currentCallState === 'ringing') {
        statusText = 'Ringing...';
        notificationTitle = `${callTypeEmoji} ${callTypeText} - ${statusText}`;
        notificationBody = callerName ? `Calling ${callerName}...` : 'Call in progress...';
      } else if (currentCallState === 'connecting') {
        statusText = 'Connecting...';
        notificationTitle = `${callTypeEmoji} ${callTypeText} - ${statusText}`;
        notificationBody = callerName ? `Connecting to ${callerName}...` : 'Connecting...';
      } else if (currentCallState === 'connected') {
        statusText = currentIsAudioEnabled ? 'Active' : 'Muted';
        notificationTitle = `${callTypeEmoji} ${callTypeText} - ${statusText}`;
        notificationBody = callerName ? `With ${callerName}` : 'Tap to return to call';
      } else {
        // For any other state (idle, ended, failed), still show notification but with generic text
        statusText = 'Call';
        notificationTitle = `${callTypeEmoji} ${callTypeText}`;
        notificationBody = callerName ? `With ${callerName}` : 'Tap to return to call';
      }
      
      // Build foreground service types - must match AndroidManifest.xml declaration
      // Manifest declares: phoneCall only (simplest, most compatible)
      // Only use enum values (no fallback hex) to prevent manifest mismatch crashes
      const serviceTypes: number[] = [];
      
      if (AndroidForegroundServiceType) {
        // Use ONLY phoneCall type (matches manifest declaration)
        // This is sufficient for voice/video calls and avoids manifest mismatch errors
        serviceTypes.push(AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_PHONE_CALL);
      } else {
        // If enum not available, log warning but don't crash
        console.warn('[CallBackgroundHandler] AndroidForegroundServiceType not available - service types may not work');
      }
      
      // Determine notification importance based on call state
      // MAX importance during ringing for maximum visibility
      // Use enum values directly - if not available, skip importance (will use channel default)
      const importance = currentCallState === 'ringing' 
        ? (AndroidImportance?.MAX)  // MAX importance during ringing
        : (AndroidImportance?.HIGH); // HIGH importance otherwise

      // Build notification actions based on call state
      // Always show actions so users can control the call from notification
      const actions = [];
      
      // Mute/Unmute action (show for connecting/ringing/connected)
      if (currentCallState === 'connecting' || currentCallState === 'ringing' || currentCallState === 'connected') {
        actions.push({
          title: currentIsAudioEnabled ? '🔇 Mute' : '🔊 Unmute',
          pressAction: {
            id: 'toggle-mute',
          },
        });
        
        // Speaker toggle (voice calls only, show during all active states)
        if (callType === 'voice') {
          actions.push({
            title: currentIsSpeakerEnabled ? '📱 Earpiece' : '🔊 Speaker',
            pressAction: {
              id: 'toggle-speaker',
            },
          });
        }
      }
      
      // End call action (always available)
      actions.push({
        title: '❌ End Call',
        pressAction: {
          id: 'end-call',
        },
      });

      // Build android notification config
      // CRITICAL: Only include serviceTypes if they're available (prevents manifest mismatch crash)
      const androidConfig: any = {
        channelId: CALL_CHANNEL_ID,
        asForegroundService: true,
        category: AndroidCategory?.CALL,
        ongoing: true, // Persistent notification - cannot be swiped away
        autoCancel: false, // Don't auto-cancel when tapped
        smallIcon: 'notification_icon', // Shows in status bar (must exist in drawable folders)
        largeIcon: 'notification_icon', // Shows in expanded notification/system drawer
        color: '#00f5ff', // Accent color for notification
        // Show in status bar and system drawer
        visibility: 1, // PUBLIC - show on lock screen and status bar
        showTimestamp: true,
        // fullScreenIntent: Show notification even when screen is off (Android 10+)
        // This is CRITICAL for ringing state visibility
        fullScreenIntent: callState === 'ringing', // Only during ringing for maximum visibility
        // Press action on notification body - opens app to foreground
        pressAction: {
          id: 'default',
          launchActivity: 'default',
        },
        // Media controls as notification actions
        // These appear in the notification drawer and lock screen
        actions: actions,
      };
      
      // Only add service types if enum is available and types array is not empty
      // This prevents the manifest mismatch crash
      if (serviceTypes.length > 0) {
        androidConfig.foregroundServiceTypes = serviceTypes;
      } else {
        console.warn('[CallBackgroundHandler] No service types available - using default');
      }
      
      // Only add importance if AndroidImportance is available (enum value, not number)
      if (importance !== undefined) {
        androidConfig.importance = importance;
      }
      
      // Debug logging to understand notification configuration
      console.log('[CallBackgroundHandler] Displaying notification:', {
        title: notificationTitle,
        body: notificationBody,
        hasActions: actions.length > 0,
        actionIds: actions.map(a => a.pressAction.id),
        actionTitles: actions.map(a => a.title),
        channelId: CALL_CHANNEL_ID,
        callState: currentCallState,
        isAudioEnabled: currentIsAudioEnabled,
        isSpeakerEnabled: currentIsSpeakerEnabled,
        asForegroundService: androidConfig.asForegroundService,
      });
      
      await notifee.displayNotification({
        id: CALL_NOTIFICATION_ID,
        title: notificationTitle,
        body: notificationBody,
        android: androidConfig,
      });
      
      console.log('[CallBackgroundHandler] ✅ Notification updated with current state');
    } catch (error: any) {
      // Check if error is related to service type mismatch
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('foregroundServiceType') || errorMessage.includes('not a subset')) {
        console.error('[CallBackgroundHandler] CRITICAL: Service type mismatch - check AndroidManifest.xml');
        console.error('[CallBackgroundHandler] Error details:', errorMessage);
        // Try again without service types as fallback
        try {
          const fallbackConfig = { ...androidConfig };
          delete fallbackConfig.foregroundServiceTypes;
          await notifee.displayNotification({
            id: CALL_NOTIFICATION_ID,
            title: notificationTitle,
            body: notificationBody,
            android: fallbackConfig,
          });
          console.warn('[CallBackgroundHandler] Notification displayed without service types (fallback)');
        } catch (fallbackError) {
          console.error('[CallBackgroundHandler] Fallback notification also failed:', fallbackError);
        }
      } else {
        console.warn('[CallBackgroundHandler] Failed to update notification:', error);
      }
    }
  }, [callType, callerName]); // callState, isAudioEnabled, isSpeakerEnabled are read from refs

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
      // Ensure AndroidImportance is available before creating channel
      if (!AndroidImportance) {
        console.warn('[CallBackgroundHandler] AndroidImportance not available, cannot create channel');
        return;
      }
      
      // Create notification channel for the foreground service (required for Android 8+)
      // Use MAX importance to allow fullScreenIntent and maximum visibility
      await notifee.createChannel({
        id: CALL_CHANNEL_ID,
        name: 'Ongoing Calls',
        description: 'Notification for active voice/video calls',
        importance: AndroidImportance.MAX, // Use enum value directly, not fallback number
        vibration: false,
        sound: undefined, // No sound for ongoing call notification (prevents double sound with ringtone)
        // Show in status bar and lock screen
        visibility: 1, // PUBLIC - show on lock screen
      });
      
      // Initial notification display
      await updateForegroundServiceNotification();
      
      foregroundServiceActiveRef.current = true;
      console.log('[CallBackgroundHandler] ✅ Notifee foreground service started - call will persist in background');
    } catch (error: any) {
      // Check if error is related to service type mismatch
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('foregroundServiceType') || errorMessage.includes('not a subset')) {
        console.error('[CallBackgroundHandler] CRITICAL: Service type mismatch in manifest');
        console.error('[CallBackgroundHandler] Ensure AndroidManifest.xml declares: phoneCall|mediaPlayback|microphone|camera');
        console.error('[CallBackgroundHandler] Error details:', errorMessage);
      } else {
        console.error('[CallBackgroundHandler] Failed to start foreground service:', error);
      }
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
    // Determine if call is active based on state (more reliable than isCallActive flag)
    const isCallInProgress = callState === 'connecting' || callState === 'ringing' || callState === 'connected';
    
    if (isCallInProgress) {
      activateCallKeepAwake();
      configureBackgroundAudio();
      // Start foreground service for all active call states
      // This protects WebRTC and shows notification throughout the call
      startForegroundService();
    } else {
      // Only stop if call is truly ended/failed
      if (callState === 'ended' || callState === 'failed') {
        deactivateCallKeepAwake();
        stopForegroundService();
      }
    }

    // Cleanup only on unmount or when call truly ends
    return () => {
      if (callState === 'ended' || callState === 'failed') {
        deactivateCallKeepAwake();
        stopForegroundService();
      }
    };
  }, [callState, activateCallKeepAwake, deactivateCallKeepAwake, configureBackgroundAudio, startForegroundService, stopForegroundService]);

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
        
        // Check if call is in progress based on state (more reliable than flags)
        const isCallInProgress = callState === 'connecting' || callState === 'ringing' || callState === 'connected';
        
        if (isCallInProgress) {
          console.log('[CallBackgroundHandler] Call active, app going to background');
          console.log('[CallBackgroundHandler] Foreground service active:', foregroundServiceActiveRef.current);
          console.log('[CallBackgroundHandler] Call state:', callState);
          
          // PROACTIVE: Start foreground service immediately if call is active but service isn't running
          // This catches cases where service wasn't started yet (e.g., during connecting/ringing)
          if (!foregroundServiceActiveRef.current) {
            console.log('[CallBackgroundHandler] ⚠️ Service not active - starting proactively');
            startForegroundService();
          } else {
            // CRITICAL: Force immediate notification update when backgrounding
            // This ensures notification is visible immediately with all controls
            console.log('[CallBackgroundHandler] Forcing immediate notification update for background visibility');
            // Update notification immediately (no debounce) to ensure visibility
            updateForegroundServiceNotification();
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
