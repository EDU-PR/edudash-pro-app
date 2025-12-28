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
 * 
 * NOTE: Currently uses Android's automatic PiP via manifest configuration.
 * The native PiP library had SDK compatibility issues, so we rely on:
 * 1. withPictureInPicture.js plugin for manifest configuration
 * 2. Android's automatic PiP behavior when backgrounding during video
 * 
 * @module usePictureInPicture
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';

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
  /** Manually enter PiP mode (not available without native module) */
  enterPipMode: () => Promise<boolean>;
  /** Exit PiP mode (returns to full screen) */
  exitPipMode: () => void;
  /** Current app state */
  appState: AppStateStatus;
}

/**
 * Hook to manage Picture-in-Picture mode for calls
 * 
 * NOTE: Without a native PiP library, this hook provides:
 * - State tracking for when app is backgrounded
 * - Callbacks for background/foreground transitions
 * - PiP is handled automatically by Android via manifest config
 * 
 * @example
 * ```tsx
 * const { isInPipMode, isPipSupported, appState } = usePictureInPicture({
 *   autoEnterOnBackground: isCallActive,
 *   onEnterPiP: () => console.log('App backgrounded during call'),
 *   onExitPiP: () => console.log('App foregrounded'),
 * });
 * ```
 */
export function usePictureInPicture({
  autoEnterOnBackground = false,
  onEnterPiP,
  onExitPiP,
}: UsePictureInPictureOptions = {}): UsePictureInPictureReturn {
  const [isInPipMode, setIsInPipMode] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const [currentAppState, setCurrentAppState] = useState<AppStateStatus>(AppState.currentState);

  // PiP is supported on Android 8.0+ via manifest configuration
  const isPipSupported = Platform.OS === 'android' && Platform.Version >= 26;

  /**
   * Enter Picture-in-Picture mode
   * NOTE: Without native module, this just logs. PiP is automatic via manifest.
   */
  const enterPipMode = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      console.log('[PiP] Not available on iOS');
      return false;
    }

    // Without native module, PiP is automatic when backgrounding
    // This is triggered by Android when app has video content and goes to background
    console.log('[PiP] PiP mode will be entered automatically by Android when backgrounding');
    return true;
  }, []);

  /**
   * Exit PiP mode (bring app back to full screen)
   */
  const exitPipMode = useCallback(() => {
    if (!isInPipMode) return;
    
    setIsInPipMode(false);
    onExitPiP?.();
    console.log('[PiP] Exited Picture-in-Picture mode');
  }, [isInPipMode, onExitPiP]);

  // Track app state changes to detect PiP-like behavior
  useEffect(() => {
    if (!autoEnterOnBackground || !isPipSupported) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;
      setCurrentAppState(nextAppState);

      console.log('[PiP] App state change:', previousState, '->', nextAppState);

      // App going to background - Android will auto-enter PiP if configured
      if (previousState === 'active' && nextAppState === 'background') {
        console.log('[PiP] App backgrounded - Android PiP should activate automatically');
        setIsInPipMode(true);
        onEnterPiP?.();
      }

      // App coming back to foreground
      if (previousState === 'background' && nextAppState === 'active') {
        console.log('[PiP] App foregrounded');
        setIsInPipMode(false);
        onExitPiP?.();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [autoEnterOnBackground, isPipSupported, onEnterPiP, onExitPiP]);

  return {
    isPipSupported,
    isInPipMode,
    enterPipMode,
    exitPipMode,
    appState: currentAppState,
  };
}

export default usePictureInPicture;
