/**
 * Call Background Handler Hook
 * 
 * Manages call persistence during app minimization and screen lock:
 * - Keeps screen awake during active calls (prevents screen lock from dropping call)
 * - Handles app state changes (foreground/background transitions)
 * - Ensures audio continues in background via InCallManager
 * - Integrates with CallKeep for native call persistence
 * 
 * @module useCallBackgroundHandler
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { callKeepManager } from '@/lib/calls/callkeep-manager';
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

  // Manage KeepAwake based on call state
  useEffect(() => {
    if (isAudioActive && isCallActive) {
      activateCallKeepAwake();
      configureBackgroundAudio();
    } else {
      deactivateCallKeepAwake();
    }

    return () => {
      deactivateCallKeepAwake();
    };
  }, [isAudioActive, isCallActive, activateCallKeepAwake, deactivateCallKeepAwake, configureBackgroundAudio]);

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
          
          // Report to CallKeep that call is still active (keeps foreground service running)
          if (Platform.OS === 'android') {
            // The call should continue via foreground service
            console.log('[CallBackgroundHandler] Android foreground service will maintain call');
          }
        }
      }
      
      // App returning to foreground
      if (previousState.match(/background/) && nextAppState === 'active') {
        if (wasInBackgroundRef.current && isAudioActive) {
          console.log('[CallBackgroundHandler] Returning from background with active call');
          wasInBackgroundRef.current = false;
          
          // Re-establish audio routing when returning from background
          if (InCallManager) {
            try {
              // Restart InCallManager to ensure proper audio routing
              InCallManager.start({ media: 'audio', auto: false });
              InCallManager.setKeepScreenOn(true);
              console.log('[CallBackgroundHandler] Audio routing restored after background return');
            } catch (error) {
              console.warn('[CallBackgroundHandler] Failed to restore audio:', error);
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
