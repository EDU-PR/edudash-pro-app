/**
 * Call Prewarming Utility
 * 
 * Pre-initializes Daily.co SDK components to reduce call connection time.
 * This module is imported lazily to avoid loading Daily.co SDK at app startup.
 * 
 * Key optimizations:
 * 1. Pre-create call object when call screen opens (before user initiates)
 * 2. Pre-request audio permissions on Android
 * 3. Pre-configure InCallManager audio routing
 * 4. Cache authenticated session for faster room creation
 * 
 * Usage:
 * - Call `prewarmCallSystem()` when call UI becomes visible
 * - Call `getPrewarmedCallObject()` when actually joining a call
 * - Call `disposePrewarmedCallObject()` when call UI closes without joining
 */

import { Platform, PermissionsAndroid } from 'react-native';
import { assertSupabase } from '@/lib/supabase';

// Lazy load Daily.co SDK
let Daily: any = null;
let dailyLoaded = false;

const loadDaily = () => {
  if (!dailyLoaded) {
    try {
      Daily = require('@daily-co/react-native-daily-js').default;
      dailyLoaded = true;
      console.log('[CallPrewarming] Daily.co SDK loaded');
    } catch (error) {
      console.warn('[CallPrewarming] Daily.co SDK not available:', error);
    }
  }
  return Daily;
};

// Lazy load InCallManager
let InCallManager: any = null;
let inCallManagerLoaded = false;

const loadInCallManager = () => {
  if (!inCallManagerLoaded) {
    try {
      InCallManager = require('react-native-incall-manager').default;
      inCallManagerLoaded = true;
    } catch (error) {
      console.warn('[CallPrewarming] InCallManager not available:', error);
    }
  }
  return InCallManager;
};

// Prewarmed state
interface PrewarmedState {
  callObject: any;
  permissionsGranted: boolean;
  sessionValid: boolean;
  timestamp: number;
}

let prewarmedState: PrewarmedState | null = null;
let prewarmingPromise: Promise<PrewarmedState | null> | null = null;

// Prewarmed state expires after 5 minutes
const PREWARM_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Check if prewarmed state is still valid
 */
function isPrewarmedStateValid(): boolean {
  if (!prewarmedState) return false;
  const age = Date.now() - prewarmedState.timestamp;
  return age < PREWARM_EXPIRY_MS;
}

/**
 * Request microphone permissions early (Android only)
 * Returns true if granted, false otherwise
 */
async function requestAudioPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true; // iOS handles permissions via Info.plist
  }
  
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'This app needs microphone access for voice and video calls.',
        buttonPositive: 'OK',
        buttonNegative: 'Cancel',
      }
    );
    const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
    console.log('[CallPrewarming] Audio permission:', isGranted ? 'granted' : 'denied');
    return isGranted;
  } catch (error) {
    console.warn('[CallPrewarming] Permission request failed:', error);
    return false;
  }
}

/**
 * Verify user session is valid for API calls
 */
async function verifySession(): Promise<boolean> {
  try {
    const supabase = assertSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      console.warn('[CallPrewarming] Session invalid:', error?.message);
      return false;
    }
    console.log('[CallPrewarming] Session verified');
    return true;
  } catch (error) {
    console.warn('[CallPrewarming] Session check failed:', error);
    return false;
  }
}

/**
 * Pre-initialize InCallManager for faster audio routing
 */
function prewarmInCallManager(isVideo: boolean = false): void {
  const manager = loadInCallManager();
  if (!manager) return;
  
  try {
    // Start InCallManager with appropriate media type
    // This pre-initializes audio routing for faster switching later
    manager.start({ media: isVideo ? 'video' : 'audio' });
    
    // For voice calls, default to earpiece (privacy)
    // For video calls, default to speaker (hands-free)
    if (!isVideo) {
      manager.setForceSpeakerphoneOn(false);
    }
    
    console.log('[CallPrewarming] InCallManager prewarmed for', isVideo ? 'video' : 'audio');
  } catch (error) {
    console.warn('[CallPrewarming] InCallManager prewarm failed:', error);
  }
}

/**
 * Create a prewarmed Daily.co call object
 * The object is created but not joined to any room yet
 */
function createPrewarmedCallObject(isVideo: boolean = false): any {
  const DailySDK = loadDaily();
  if (!DailySDK) {
    console.warn('[CallPrewarming] Cannot create call object - Daily.co SDK not available');
    return null;
  }
  
  try {
    const callObject = DailySDK.createCallObject({
      audioSource: true,
      videoSource: isVideo,
    });
    
    console.log('[CallPrewarming] Call object created (prewarmed)');
    return callObject;
  } catch (error) {
    console.warn('[CallPrewarming] Failed to create call object:', error);
    return null;
  }
}

/**
 * Main prewarming function - call this when call UI becomes visible
 * 
 * @param isVideo - Whether this is a video call (affects camera permissions)
 * @returns Promise resolving to prewarmed state or null if failed
 */
export async function prewarmCallSystem(isVideo: boolean = false): Promise<PrewarmedState | null> {
  // Return existing prewarmed state if still valid
  if (isPrewarmedStateValid() && prewarmedState) {
    console.log('[CallPrewarming] Using existing prewarmed state');
    return prewarmedState;
  }
  
  // If already prewarming, wait for that to complete
  if (prewarmingPromise) {
    console.log('[CallPrewarming] Waiting for in-progress prewarming');
    return prewarmingPromise;
  }
  
  console.log('[CallPrewarming] Starting prewarm for', isVideo ? 'video' : 'voice', 'call');
  const startTime = Date.now();
  
  prewarmingPromise = (async () => {
    try {
      // Run permissions and session check in parallel
      const [permissionsGranted, sessionValid] = await Promise.all([
        requestAudioPermissions(),
        verifySession(),
      ]);
      
      // Pre-initialize InCallManager
      prewarmInCallManager(isVideo);
      
      // Create prewarmed call object
      const callObject = createPrewarmedCallObject(isVideo);
      
      prewarmedState = {
        callObject,
        permissionsGranted,
        sessionValid,
        timestamp: Date.now(),
      };
      
      const duration = Date.now() - startTime;
      console.log(`[CallPrewarming] ✅ Prewarm complete in ${duration}ms`, {
        permissionsGranted,
        sessionValid,
        hasCallObject: !!callObject,
      });
      
      return prewarmedState;
    } catch (error) {
      console.error('[CallPrewarming] Prewarm failed:', error);
      return null;
    } finally {
      prewarmingPromise = null;
    }
  })();
  
  return prewarmingPromise;
}

/**
 * Get the prewarmed call object for joining a call
 * This consumes the prewarmed object - it can only be used once
 * 
 * @param isVideo - Whether video should be enabled (updates the object if needed)
 * @returns The prewarmed call object, or creates a new one if none available
 */
export function getPrewarmedCallObject(isVideo: boolean = false): any {
  if (prewarmedState?.callObject && isPrewarmedStateValid()) {
    const callObject = prewarmedState.callObject;
    prewarmedState.callObject = null; // Consume it
    console.log('[CallPrewarming] Using prewarmed call object');
    return callObject;
  }
  
  // No prewarmed object available, create a fresh one
  console.log('[CallPrewarming] No prewarmed object, creating fresh call object');
  return createPrewarmedCallObject(isVideo);
}

/**
 * Dispose of the prewarmed call object if call UI is closed without joining
 * This prevents memory leaks
 */
export function disposePrewarmedCallObject(): void {
  if (prewarmedState?.callObject) {
    try {
      prewarmedState.callObject.destroy();
      console.log('[CallPrewarming] Disposed prewarmed call object');
    } catch (error) {
      console.warn('[CallPrewarming] Error disposing call object:', error);
    }
    prewarmedState.callObject = null;
  }
  
  // Also stop InCallManager if it was prewarmed
  const manager = loadInCallManager();
  if (manager) {
    try {
      manager.stop();
    } catch (error) {
      // Ignore - may not have been started
    }
  }
}

/**
 * Get current prewarmed state (for debugging/logging)
 */
export function getPrewarmedState(): PrewarmedState | null {
  return prewarmedState;
}

/**
 * Check if prewarmed state has valid session
 */
export function hasValidSession(): boolean {
  return prewarmedState?.sessionValid ?? false;
}

/**
 * Check if audio permissions are granted
 */
export function hasAudioPermission(): boolean {
  return prewarmedState?.permissionsGranted ?? false;
}
