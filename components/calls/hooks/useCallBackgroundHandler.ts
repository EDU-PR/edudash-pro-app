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
 * 3. @voximplant/react-native-foreground-service for Android background execution
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

// Conditionally import Voximplant Foreground Service (Android only)
let VoximplantForegroundService: any = null;
if (Platform.OS === 'android') {
  try {
    VoximplantForegroundService = require('@voximplant/react-native-foreground-service').default;
  } catch (error) {
    console.warn('[CallBackgroundHandler] VoximplantForegroundService not available:', error);
  }
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
   */
  const startForegroundService = useCallback(async () => {
    if (Platform.OS !== 'android' || !VoximplantForegroundService || foregroundServiceActiveRef.current) {
      return;
    }
    
    try {
      // Create notification channel for the foreground service
      const channelConfig = {
        id: 'ongoing-calls',
        name: 'Ongoing Calls',
        description: 'Notification for active voice/video calls',
        enableVibration: false,
        importance: 4, // HIGH importance
      };
      await VoximplantForegroundService.createNotificationChannel(channelConfig);
      
      // Start the foreground service with a notification
      const callTypeEmoji = callType === 'video' ? '📹' : '📞';
      const callTypeText = callType === 'video' ? 'Video call' : 'Voice call';
      const notificationConfig = {
        channelId: 'ongoing-calls',
        id: 1001, // Unique notification ID
        title: `${callTypeEmoji} ${callTypeText} in progress`,
        text: callerName ? `Connected with ${callerName}` : 'Tap to return to call',
        icon: 'ic_notification', // Use app's notification icon
        priority: 1, // HIGH priority
      };
      
      await VoximplantForegroundService.startService(notificationConfig);
      foregroundServiceActiveRef.current = true;
      
      console.log('[CallBackgroundHandler] ✅ Foreground service started - call will persist in background');
    } catch (error) {
      console.error('[CallBackgroundHandler] Failed to start foreground service:', error);
    }
  }, [callerName, callType]);

  /**
   * Stop the foreground service when call ends
   */
  const stopForegroundService = useCallback(async () => {
    if (Platform.OS !== 'android' || !VoximplantForegroundService || !foregroundServiceActiveRef.current) {
      return;
    }
    
    try {
      await VoximplantForegroundService.stopService();
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
      // Start foreground service when call connects to keep WebRTC alive in background
      if (callState === 'connected') {
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
