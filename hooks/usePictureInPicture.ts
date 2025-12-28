/**
 * Picture-in-Picture Hook
 * 
 * Provides PiP functionality for voice/video calls on Android.
 * When the app is backgrounded during an active call, automatically
 * enters PiP mode to show a floating window with call controls.
 * 
 * Requirements:
 * - Android 8.0+ (API 26+)
 * - `android:supportsPictureInPicture="true"` in AndroidManifest (via withPictureInPicture plugin)
 * - react-native-pip-android library
 * 
 * @module usePictureInPicture
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

// Conditionally import PiP module (Android only)
let PipHandler: any = null;
if (Platform.OS === 'android') {
  try {
    PipHandler = require('react-native-pip-android').default;
  } catch (error) {
    console.warn('[PiP] react-native-pip-android not available:', error);
  }
}

export interface UsePictureInPictureOptions {
  /** Whether to auto-enter PiP when app goes to background */
  autoEnterOnBackground?: boolean;
  /** Callback when entering PiP mode */
  onEnterPiP?: () => void;
  /** Callback when exiting PiP mode */
  onExitPiP?: () => void;
  /** Aspect ratio width (default: 16) */
  aspectRatioWidth?: number;
  /** Aspect ratio height (default: 9) */
  aspectRatioHeight?: number;
}

export interface UsePictureInPictureReturn {
  /** Whether PiP is supported on this device */
  isPipSupported: boolean;
  /** Whether currently in PiP mode */
  isInPipMode: boolean;
  /** Manually enter PiP mode */
  enterPipMode: () => Promise<boolean>;
  /** Exit PiP mode (returns to full screen) */
  exitPipMode: () => void;
  /** Current app state */
  appState: AppStateStatus;
}

/**
 * Hook to manage Picture-in-Picture mode for calls
 * 
 * @example
 * ```tsx
 * const { isInPipMode, enterPipMode, isPipSupported } = usePictureInPicture({
 *   autoEnterOnBackground: isCallActive,
 *   onEnterPiP: () => console.log('Entered PiP'),
 *   onExitPiP: () => console.log('Exited PiP'),
 * });
 * ```
 */
export function usePictureInPicture({
  autoEnterOnBackground = false,
  onEnterPiP,
  onExitPiP,
  aspectRatioWidth = 9,
  aspectRatioHeight = 16,
}: UsePictureInPictureOptions = {}): UsePictureInPictureReturn {
  const [isInPipMode, setIsInPipMode] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const [currentAppState, setCurrentAppState] = useState<AppStateStatus>(AppState.currentState);

  // Check PiP support on mount
  useEffect(() => {
    if (Platform.OS === 'android' && PipHandler) {
      // react-native-pip-android supports Android 8.0+
      setIsPipSupported(true);
      console.log('[PiP] Picture-in-Picture supported on this device');
    } else {
      setIsPipSupported(false);
      console.log('[PiP] Picture-in-Picture not supported (iOS or library not available)');
    }
  }, []);

  /**
   * Enter Picture-in-Picture mode
   */
  const enterPipMode = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android' || !PipHandler) {
      console.log('[PiP] Cannot enter PiP - not on Android or library not available');
      return false;
    }

    try {
      console.log('[PiP] Entering Picture-in-Picture mode...');
      
      // Configure aspect ratio for calls (portrait-ish for call UI)
      await PipHandler.enterPipMode(aspectRatioWidth, aspectRatioHeight);
      
      setIsInPipMode(true);
      onEnterPiP?.();
      
      console.log('[PiP] Successfully entered PiP mode');
      return true;
    } catch (error) {
      console.error('[PiP] Failed to enter PiP mode:', error);
      return false;
    }
  }, [aspectRatioWidth, aspectRatioHeight, onEnterPiP]);

  /**
   * Exit PiP mode (bring app back to full screen)
   */
  const exitPipMode = useCallback(() => {
    if (!isInPipMode) return;
    
    // PiP exits automatically when user taps to expand
    // This just updates our state
    setIsInPipMode(false);
    onExitPiP?.();
    console.log('[PiP] Exited Picture-in-Picture mode');
  }, [isInPipMode, onExitPiP]);

  // Listen for PiP mode changes via app state
  useEffect(() => {
    if (Platform.OS !== 'android' || !PipHandler) return;

    // Listen for PiP events from the native module
    const handlePipModeChange = (event: { isInPipMode: boolean }) => {
      console.log('[PiP] Mode changed:', event.isInPipMode);
      setIsInPipMode(event.isInPipMode);
      
      if (event.isInPipMode) {
        onEnterPiP?.();
      } else {
        onExitPiP?.();
      }
    };

    // Some versions expose an event emitter
    if (PipHandler.addListener) {
      const subscription = PipHandler.addListener('pipModeChanged', handlePipModeChange);
      return () => subscription?.remove();
    }

    return undefined;
  }, [onEnterPiP, onExitPiP]);

  // Auto-enter PiP when app goes to background (if enabled)
  useEffect(() => {
    if (!autoEnterOnBackground || !isPipSupported) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;
      setCurrentAppState(nextAppState);

      console.log('[PiP] App state change:', previousState, '->', nextAppState);

      // App going to background - enter PiP mode
      if (previousState === 'active' && nextAppState === 'background') {
        console.log('[PiP] App backgrounded, attempting to enter PiP mode...');
        await enterPipMode();
      }

      // App coming back to foreground - exit PiP
      if (previousState === 'background' && nextAppState === 'active') {
        console.log('[PiP] App foregrounded, exiting PiP mode');
        exitPipMode();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [autoEnterOnBackground, isPipSupported, enterPipMode, exitPipMode]);

  return {
    isPipSupported,
    isInPipMode,
    enterPipMode,
    exitPipMode,
    appState: currentAppState,
  };
}

export default usePictureInPicture;
