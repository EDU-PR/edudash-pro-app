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
 * - react-native-pip-android package for native PiP control
 * 
 * @module usePictureInPicture
 */
import { useEffect, useCallback, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform, NativeModules } from 'react-native';
import { logger } from '@/lib/logger';
// Import react-native-pip-android for programmatic PiP control
let PipHandler: {
  enterPipMode: (width?: number, height?: number) => Promise<void>;
  isPipSupported: () => Promise<boolean>;
} | null = null;
try {
  // react-native-pip-android provides enterPipMode and isPipSupported
  PipHandler = require('react-native-pip-android').default;
} catch (err) {
  logger.warn('[PiP] react-native-pip-android not available:', err);
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
 * Uses react-native-pip-android for programmatic PiP control on Android.
 * When app is backgrounded during an active call, automatically enters PiP mode.
 * 
 * @example
 * ```tsx
 * const { isInPipMode, isPipSupported, enterPipMode, appState } = usePictureInPicture({
 *   autoEnterOnBackground: isCallActive,
 *   onEnterPiP: () => logger.debug('Entered PiP mode'),
 *   onExitPiP: () => logger.debug('Exited PiP mode'),
 *   aspectRatioWidth: 16,
 *   aspectRatioHeight: 9,
 * });
 * ```
 */
export function usePictureInPicture({
  autoEnterOnBackground = false,
  onEnterPiP,
  onExitPiP,
  aspectRatioWidth = 16,
  aspectRatioHeight = 9,
}: UsePictureInPictureOptions = {}): UsePictureInPictureReturn {
  const [isInPipMode, setIsInPipMode] = useState(false);
  const [isPipSupportedState, setIsPipSupportedState] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const [currentAppState, setCurrentAppState] = useState<AppStateStatus>(AppState.currentState);
  // Check if PiP is supported on device
  useEffect(() => {
    const checkSupport = async () => {
      if (Platform.OS !== 'android' || Platform.Version < 26) {
        setIsPipSupportedState(false);
        return;
      }
      
      if (PipHandler?.isPipSupported) {
        try {
          const supported = await PipHandler.isPipSupported();
          setIsPipSupportedState(supported);
          logger.debug('[PiP] Device PiP support:', supported);
        } catch (err) {
          logger.warn('[PiP] Error checking PiP support:', err);
          // Fallback: assume supported on Android 8.0+
          setIsPipSupportedState(true);
        }
      } else {
        // Library not available, assume supported on Android 8.0+
        setIsPipSupportedState(Platform.OS === 'android' && Platform.Version >= 26);
      }
    };
    
    checkSupport();
  }, []);
  /**
   * Enter Picture-in-Picture mode programmatically
   */
  const enterPipMode = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      logger.debug('[PiP] PiP not available on iOS');
      return false;
    }
    if (!isPipSupportedState) {
      logger.debug('[PiP] PiP not supported on this device');
      return false;
    }
    if (!PipHandler?.enterPipMode) {
      logger.warn('[PiP] PipHandler.enterPipMode not available');
      return false;
    }
    try {
      logger.debug('[PiP] Entering PiP mode with aspect ratio:', aspectRatioWidth, 'x', aspectRatioHeight);
      await PipHandler.enterPipMode(aspectRatioWidth, aspectRatioHeight);
      setIsInPipMode(true);
      onEnterPiP?.();
      logger.debug('[PiP] ✅ Entered PiP mode successfully');
      return true;
    } catch (err) {
      logger.error('[PiP] Failed to enter PiP mode:', err);
      return false;
    }
  }, [isPipSupportedState, aspectRatioWidth, aspectRatioHeight, onEnterPiP]);
  /**
   * Exit PiP mode (bring app back to full screen)
   * Note: On Android, user typically taps PiP window to exit
   */
  const exitPipMode = useCallback(() => {
    if (!isInPipMode) return;
    
    setIsInPipMode(false);
    onExitPiP?.();
    logger.debug('[PiP] Exited Picture-in-Picture mode');
  }, [isInPipMode, onExitPiP]);
  // Auto-enter PiP when app goes to background during active call
  useEffect(() => {
    if (!autoEnterOnBackground || !isPipSupportedState) return;
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;
      setCurrentAppState(nextAppState);
      logger.debug('[PiP] App state change:', previousState, '->', nextAppState);
      // App going to background - enter PiP mode
      if (previousState === 'active' && nextAppState === 'background') {
        logger.debug('[PiP] App backgrounding - attempting to enter PiP mode');
        
        // Programmatically enter PiP mode
        if (PipHandler?.enterPipMode) {
          try {
            await PipHandler.enterPipMode(aspectRatioWidth, aspectRatioHeight);
            setIsInPipMode(true);
            onEnterPiP?.();
            logger.debug('[PiP] ✅ Auto-entered PiP mode on background');
          } catch (err) {
            logger.warn('[PiP] Failed to auto-enter PiP:', err);
          }
        } else {
          // Fallback: just track state (Android may auto-PiP)
          setIsInPipMode(true);
          onEnterPiP?.();
        }
      }
      // App coming back to foreground
      if ((previousState === 'background' || previousState === 'inactive') && nextAppState === 'active') {
        logger.debug('[PiP] App foregrounded');
        setIsInPipMode(false);
        onExitPiP?.();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [autoEnterOnBackground, isPipSupportedState, aspectRatioWidth, aspectRatioHeight, onEnterPiP, onExitPiP]);
  return {
    isPipSupported: isPipSupportedState,
    isInPipMode,
    enterPipMode,
    exitPipMode,
    appState: currentAppState,
  };
}
export default usePictureInPicture;
