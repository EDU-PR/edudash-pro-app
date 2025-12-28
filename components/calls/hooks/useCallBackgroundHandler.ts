/**
 * Call Background Handler Hook
 * 
 * Manages call persistence during app minimization and screen lock:
 * - Keeps screen awake during active calls (prevents screen lock from dropping call)
 * - Handles app state changes (foreground/background transitions)
 * - Ensures audio continues in background via InCallManager
 * - Shows ongoing call notification for Android foreground service
 * 
 * NOTE: CallKeep has been removed due to Expo SDK 54+ compatibility issues.
 * Background call persistence now relies on:
 * 1. expo-keep-awake for screen wake
 * 2. InCallManager for audio routing
 * 3. Ongoing notification for Android foreground service requirement
 * 
 * @module useCallBackgroundHandler
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';
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

export interface CallBackgroundHandlerOptions {
  /** Current call state */
  callState: CallState;
  /** Whether a call is currently active (connected or connecting) */
  isCallActive: boolean;
  /** Call ID for CallKeep integration */
  callId?: string | null;
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
  onReturnFromBackground,
}: CallBackgroundHandlerOptions): CallBackgroundHandlerReturn {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const keepAwakeActiveRef = useRef(false);
  const wasInBackgroundRef = useRef(false);
  const ongoingNotificationIdRef = useRef<string | null>(null);

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
   * Show ongoing call notification (Android foreground service)
   * This keeps the app alive when backgrounded on Android
   */
  const showOngoingCallNotification = useCallback(async (callerName?: string) => {
    if (Platform.OS !== 'android' || ongoingNotificationIdRef.current) return;
    
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📞 Call in progress',
          body: callerName ? `Connected with ${callerName}` : 'Voice call active',
          data: { type: 'ongoing_call', call_id: callId },
          sound: null, // No sound for ongoing notification
          sticky: true, // Sticky notification (harder to dismiss)
          autoDismiss: false, // Don't auto-dismiss
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
        identifier: `ongoing-call-${callId || 'active'}`, // Unique identifier
      });
      
      ongoingNotificationIdRef.current = notificationId;
      console.log('[CallBackgroundHandler] Ongoing call notification shown:', notificationId);
    } catch (error) {
      console.warn('[CallBackgroundHandler] Failed to show ongoing notification:', error);
    }
  }, [callId]);

  /**
   * Dismiss ongoing call notification
   */
  const dismissOngoingCallNotification = useCallback(async () => {
    if (!ongoingNotificationIdRef.current) return;
    
    try {
      await Notifications.dismissNotificationAsync(ongoingNotificationIdRef.current);
      console.log('[CallBackgroundHandler] Ongoing call notification dismissed');
      ongoingNotificationIdRef.current = null;
    } catch (error) {
      console.warn('[CallBackgroundHandler] Failed to dismiss notification:', error);
    }
  }, []);

  // Manage KeepAwake and ongoing notification based on call state
  useEffect(() => {
    if (isAudioActive && isCallActive) {
      activateCallKeepAwake();
      configureBackgroundAudio();
      // Show ongoing notification when call connects (for Android foreground service)
      if (callState === 'connected') {
        showOngoingCallNotification();
      }
    } else {
      deactivateCallKeepAwake();
      dismissOngoingCallNotification();
    }

    return () => {
      deactivateCallKeepAwake();
      dismissOngoingCallNotification();
    };
  }, [isAudioActive, isCallActive, callState, activateCallKeepAwake, deactivateCallKeepAwake, configureBackgroundAudio, showOngoingCallNotification, dismissOngoingCallNotification]);

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
          
          // The ongoing notification serves as our foreground service
          // Android will keep the app alive due to the sticky notification
          if (Platform.OS === 'android') {
            console.log('[CallBackgroundHandler] Ongoing notification will maintain call in background');
          }
        }
      }
      
      // App returning to foreground
      if (previousState.match(/background/) && nextAppState === 'active') {
        if (wasInBackgroundRef.current && isAudioActive) {
          console.log('[CallBackgroundHandler] Returning from background with active call');
          wasInBackgroundRef.current = false;
          
          // Restore audio settings when returning from background
          // IMPORTANT: Don't call start() again - just restore settings
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
