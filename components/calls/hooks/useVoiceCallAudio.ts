/**
 * Voice Call Audio Hook
 * 
 * Manages audio routing via InCallManager:
 * - Ringback for caller while waiting (via expo-audio for earpiece support)
 * - Earpiece/speaker routing
 * - Audio cleanup
 * 
 * CRITICAL: Uses expo-audio for ringback instead of InCallManager.startRingback()
 * because InCallManager.startRingback() ignores earpiece setting on Android
 * and always plays through speaker. expo-audio respects the audio mode settings.
 * 
 * ROBUSTNESS: Includes retry logic for ringback playback and proper cleanup
 */

import { useEffect, useRef, useCallback } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform, AppState, type AppStateStatus } from 'react-native';
import type { CallState } from '../types';

// Conditionally import InCallManager
let InCallManager: any = null;
try {
  InCallManager = require('react-native-incall-manager').default;
} catch (error) {
  console.warn('[VoiceCallAudio] InCallManager not available:', error);
}

// CRITICAL: Preload ringback sound at module level for instant playback
// This ensures the audio is ready when making outgoing calls
let RINGBACK_SOUND: any = null;
let RINGBACK_LOAD_ERROR: string | null = null;

// Try to load ringback sound immediately
try {
  RINGBACK_SOUND = require('@/assets/sounds/ringback.mp3');
  console.log('[VoiceCallAudio] ✅ Ringback sound loaded:', typeof RINGBACK_SOUND, RINGBACK_SOUND);
} catch (error) {
  RINGBACK_LOAD_ERROR = String(error);
  console.error('[VoiceCallAudio] ❌ Failed to load ringback.mp3:', error);
  // Try fallback to notification sound
  try {
    RINGBACK_SOUND = require('@/assets/sounds/notification.wav');
    RINGBACK_LOAD_ERROR = null;
    console.log('[VoiceCallAudio] ✅ Using notification.wav as ringback fallback');
  } catch (e2) {
    console.error('[VoiceCallAudio] ❌ Fallback notification.wav also failed:', e2);
    // Final fallback - try ringtone
    try {
      RINGBACK_SOUND = require('@/assets/sounds/ringtone.mp3');
      RINGBACK_LOAD_ERROR = null;
      console.log('[VoiceCallAudio] ✅ Using ringtone.mp3 as final fallback');
    } catch (e3) {
      console.error('[VoiceCallAudio] ❌ All sound fallbacks failed:', e3);
    }
  }
}

export interface VoiceCallAudioOptions {
  callState: CallState;
  isOwner: boolean;
  isSpeakerEnabled: boolean;
  setIsSpeakerEnabled: (enabled: boolean) => void;
}

export interface VoiceCallAudioReturn {
  toggleSpeaker: () => void;
  stopAudio: () => void;
  isInCallManagerAvailable: boolean;
}

export function useVoiceCallAudio({
  callState,
  isOwner,
  isSpeakerEnabled,
  setIsSpeakerEnabled,
}: VoiceCallAudioOptions): VoiceCallAudioReturn {
  const audioInitializedRef = useRef(false);
  const earpieceEnforcerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringbackStartedRef = useRef(false);
  const ringbackPlayerRef = useRef<AudioPlayer | null>(null);
  const ringbackRetryCountRef = useRef(0);
  const ringbackRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakerAppliedOnConnectRef = useRef(false);

  /**
   * Play ringback tone using expo-audio with retry logic
   * 
   * CRITICAL: This uses expo-audio instead of InCallManager.startRingback() because:
   * 1. InCallManager.startRingback('_DEFAULT_') ignores earpiece setting on Android
   * 2. It always routes to speaker regardless of setForceSpeakerphoneOn(false)
   * 3. expo-audio respects the audio mode set by setAudioModeAsync()
   * 
   * The audio mode MUST be set to route through earpiece BEFORE playing:
   * - shouldRouteThroughEarpiece: true  <-- THIS is the key setting for Android
   * 
   * ROBUSTNESS: Includes retry logic (up to 3 attempts) with exponential backoff
   * 
   * UPDATE: InCallManager.startRingback() is COMPLETELY SKIPPED now because
   * it routes to speaker on most Android devices even when earpiece is requested.
   * expo-audio is the PRIMARY and ONLY method for ringback playback.
   */
  const playCustomRingback = useCallback(async (retryAttempt = 0) => {
    // Allow retry if player exists but isn't actually playing
    if (ringbackStartedRef.current && ringbackPlayerRef.current?.playing) {
      console.log('[VoiceCallAudio] Ringback already playing, skipping');
      return;
    }
    
    console.log('[VoiceCallAudio] 🔊 playCustomRingback called', {
      attempt: retryAttempt + 1,
      hasAsset: !!RINGBACK_SOUND,
      assetType: typeof RINGBACK_SOUND,
      loadError: RINGBACK_LOAD_ERROR,
      hasInCallManager: !!InCallManager,
      isSpeakerEnabled,
    });
    
    const MAX_RETRIES = 3;
    const retryDelay = Math.min(500 * Math.pow(2, retryAttempt), 2000);
    
    // CRITICAL: Enforce earpiece setting BEFORE playing any audio
    // This must be done regardless of playback method
    if (InCallManager && !isSpeakerEnabled) {
      try {
        InCallManager.setForceSpeakerphoneOn(false);
        console.log('[VoiceCallAudio] Earpiece enforced before ringback');
      } catch (e) {
        console.warn('[VoiceCallAudio] Failed to enforce earpiece:', e);
      }
    }
    
    // NOTE: InCallManager.startRingback() is INTENTIONALLY NOT USED
    // It ignores earpiece settings on most Android devices and always
    // routes to speaker. Using expo-audio exclusively for ringback.
    
    // Use expo-audio player (respects earpiece routing)
    if (!RINGBACK_SOUND) {
      console.error('[VoiceCallAudio] ❌ No ringback sound available');
      return;
    }
    
    try {
      console.log(`[VoiceCallAudio] 🔊 Starting expo-audio ringback (attempt ${retryAttempt + 1}/${MAX_RETRIES})`);
      
      // Set audio mode - CRITICAL: shouldRouteThroughEarpiece controls speaker/earpiece
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        allowsRecording: true,
        shouldPlayInBackground: true,
        shouldRouteThroughEarpiece: !isSpeakerEnabled,
      });
      console.log('[VoiceCallAudio] ✅ Audio mode set, creating player...');
      
      const player = createAudioPlayer(RINGBACK_SOUND);
      console.log('[VoiceCallAudio] ✅ Player created, configuring...');
      
      player.loop = true;
      player.volume = 1.0;
      
      // CRITICAL: Use async play() and verify it actually starts
      try {
        player.play();
        console.log('[VoiceCallAudio] ✅ player.play() called');
      } catch (playError) {
        console.error('[VoiceCallAudio] ❌ player.play() threw:', playError);
        throw playError;
      }
      
      // Wait a bit longer to ensure playback starts
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Verify playback started by checking player state
      const isPlaying = player.playing;
      console.log('[VoiceCallAudio] Player state after play():', { isPlaying, volume: player.volume, loop: player.loop });
      
      if (!isPlaying) {
        console.warn('[VoiceCallAudio] ⚠️ Player not playing after play() call, retrying...');
        player.play();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      ringbackPlayerRef.current = player;
      ringbackStartedRef.current = true;
      console.log('[VoiceCallAudio] ✅ expo-audio ringback started and verified');
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      
    } catch (error) {
      console.error(`[VoiceCallAudio] ❌ expo-audio ringback failed (attempt ${retryAttempt + 1}):`, error);
      ringbackStartedRef.current = false;
      
      if (retryAttempt < MAX_RETRIES - 1) {
        console.log(`[VoiceCallAudio] 🔄 Retrying in ${retryDelay}ms...`);
        ringbackRetryTimeoutRef.current = setTimeout(() => {
          playCustomRingback(retryAttempt + 1);
        }, retryDelay);
      }
    }
  }, [isSpeakerEnabled]);

  /**
   * Stop ringback when call connects or ends
   * Also clears any pending retry timeouts
   */
  const stopCustomRingback = useCallback(async () => {
    // Clear any pending retry timeouts
    if (ringbackRetryTimeoutRef.current) {
      clearTimeout(ringbackRetryTimeoutRef.current);
      ringbackRetryTimeoutRef.current = null;
    }
    
    if (!ringbackStartedRef.current && !ringbackPlayerRef.current) return;
    
    try {
      if (ringbackPlayerRef.current) {
        try {
          ringbackPlayerRef.current.pause();
        } catch (e) {
          // May already be paused
        }
        try {
          ringbackPlayerRef.current.remove();
        } catch (e) {
          // May already be removed
        }
        ringbackPlayerRef.current = null;
      }
      
      // Also stop InCallManager ringback in case it was started elsewhere
      if (InCallManager) {
        try {
          InCallManager.stopRingback();
        } catch (e) {
          // Ignore - may not have been started
        }
      }
      
      ringbackStartedRef.current = false;
      ringbackRetryCountRef.current = 0;
      console.log('[VoiceCallAudio] ✅ Stopped ringback');
    } catch (error) {
      console.warn('[VoiceCallAudio] Failed to stop ringback:', error);
      ringbackPlayerRef.current = null;
      ringbackStartedRef.current = false;
    }
  }, []);

  // Earpiece enforcement during ringing/connecting states ONLY
  // Single enforcement on state transition — no interval loop, which disrupts
  // the expo-audio ringback pipeline. WebRTC manages routing when connected.
  useEffect(() => {
    if (!InCallManager) return;
    
    const shouldEnforceEarpiece = (
      callState === 'connecting' || 
      callState === 'ringing'
    ) && !isSpeakerEnabled;
    
    if (shouldEnforceEarpiece) {
      try {
        InCallManager.setForceSpeakerphoneOn(false);
        console.log('[VoiceCallAudio] Earpiece enforced on state transition');
      } catch (e) {
        console.warn('[VoiceCallAudio] Earpiece enforcement failed:', e);
      }
    }
    
    return () => {
      if (earpieceEnforcerRef.current) {
        clearInterval(earpieceEnforcerRef.current);
        earpieceEnforcerRef.current = null;
      }
    };
  }, [callState, isSpeakerEnabled]);

  // Audio management via InCallManager
  // CRITICAL: Only initialize audio ONCE to prevent ringtone changes
  useEffect(() => {
    if (audioInitializedRef.current) return;
    
    // Only start on first 'connecting' state, never restart
    if (callState !== 'connecting') return;
    
    const initializeAudio = async () => {
      try {
        console.log('[VoiceCallAudio] Initializing audio for', isOwner ? 'caller' : 'callee');
        
        if (InCallManager) {
          // STEP 1: Start InCallManager FIRST — this acquires the audio session.
          // Must be done before setAudioModeAsync, otherwise InCallManager.start()
          // resets the expo-audio mode and kills ringback playback.
          if (isOwner) {
            InCallManager.start({ 
              media: 'audio',
              auto: false,
              ringback: '' // Empty — we use expo-audio for ringback
            });
          } else {
            InCallManager.start({ 
              media: 'audio',
              auto: false,
              ringback: ''
            });
          }
          console.log('[VoiceCallAudio] ✅ InCallManager started');
          
          // STEP 2: Set earpiece routing after InCallManager owns the session
          InCallManager.setForceSpeakerphoneOn(false);
          setIsSpeakerEnabled(false);
          
          // STEP 3: Small delay to let system audio session stabilize
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        // STEP 4: Set expo-audio mode AFTER InCallManager is stable
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
          allowsRecording: true,
          shouldPlayInBackground: true,
          shouldRouteThroughEarpiece: !isSpeakerEnabled,
        });
        console.log('[VoiceCallAudio] ✅ Audio mode set');
        
        // STEP 5: Play ringback for caller AFTER audio pipeline is stable
        if (isOwner) {
          await playCustomRingback();
          console.log('[VoiceCallAudio] ✅ Ringback initiated');
        }
        
        if (InCallManager) {
          InCallManager.setKeepScreenOn(false);
        }
        
        audioInitializedRef.current = true;
        console.log('[VoiceCallAudio] Audio initialized successfully');
      } catch (error) {
        console.error('[VoiceCallAudio] Failed to start audio routing:', error);
      }
    };
    
    initializeAudio();
  }, [callState, isOwner, setIsSpeakerEnabled, playCustomRingback, isSpeakerEnabled]);

  // Stop ringback when call connects and configure audio for two-way communication
  // CRITICAL FIX: Set audio mode to allow BOTH recording AND playback simultaneously.
  // Previous code had multiple competing setAudioModeAsync calls and aggressive earpiece 
  // enforcement that disrupted WebRTC's audio pipeline, causing users to not hear each other.
  useEffect(() => {
    if (callState === 'connected') {
      try {
        // Stop custom ringback (if playing)
        stopCustomRingback();
        
        // Stop InCallManager ringback (if any)
        if (InCallManager && isOwner) {
          InCallManager.stopRingback();
          console.log('[VoiceCallAudio] Stopped ringback - call connected');
        }
        
        // CRITICAL: Only apply audio setup ONCE on initial connect
        if (!speakerAppliedOnConnectRef.current) {
          speakerAppliedOnConnectRef.current = true;
          
          // CRITICAL FIX: Set audio mode that enables BOTH mic input AND speaker output
          // Use 'duckOthers' instead of 'doNotMix' to prevent blocking WebRTC audio
          // This single call replaces the multiple competing setAudioModeAsync calls
          setAudioModeAsync({
            playsInSilentMode: true,
            interruptionMode: 'duckOthers', // Allow WebRTC audio alongside our audio session
            allowsRecording: true, // Required for microphone
            shouldPlayInBackground: true,
            shouldRouteThroughEarpiece: !isSpeakerEnabled,
          }).then(() => {
            console.log('[VoiceCallAudio] ✅ Audio mode configured for two-way communication');
          }).catch(e => console.warn('[VoiceCallAudio] Failed to set audio mode on connect:', e));
          
          // Single earpiece enforcement (no loop during connected state)
          if (InCallManager) {
            InCallManager.setForceSpeakerphoneOn(isSpeakerEnabled);
            InCallManager.setKeepScreenOn(isSpeakerEnabled);
          }
          
          console.log('[VoiceCallAudio] 📞 Call connected - audio routed to:', isSpeakerEnabled ? 'speaker' : 'earpiece');
          
          // Give haptic feedback to indicate call connected
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          
          // One final enforcement after Daily.co stabilizes audio (no loop)
          if (!isSpeakerEnabled && InCallManager) {
            setTimeout(() => {
              try {
                InCallManager.setForceSpeakerphoneOn(false);
                InCallManager.setKeepScreenOn(false);
                console.log('[VoiceCallAudio] Post-connect earpiece set');
              } catch (e) {
                // Silent
              }
            }, 500);
          }
        }
      } catch (error) {
        console.warn('[VoiceCallAudio] Failed to handle connected state:', error);
      }
    }
    
    // Reset the flag when call ends so next call can apply speaker setting
    if (callState === 'ended' || callState === 'idle') {
      speakerAppliedOnConnectRef.current = false;
    }
  }, [callState, isOwner, isSpeakerEnabled, stopCustomRingback]);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    const newSpeakerState = !isSpeakerEnabled;
    console.log('[VoiceCallAudio] Toggling speaker:', { from: isSpeakerEnabled, to: newSpeakerState });
    
    try {
      if (InCallManager) {
        InCallManager.setForceSpeakerphoneOn(newSpeakerState);
        // Update screen keep-on based on speaker state
        // Earpiece: Allow proximity sensor to turn off screen
        // Speaker: Keep screen on (user is looking at it)
        InCallManager.setKeepScreenOn(newSpeakerState);
        setIsSpeakerEnabled(newSpeakerState);
        console.log('[VoiceCallAudio] Speaker toggled successfully to:', newSpeakerState ? 'speaker' : 'earpiece');
        console.log('[VoiceCallAudio] Screen keep-on:', newSpeakerState ? 'enabled (speaker mode)' : 'disabled (proximity sensor enabled)');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } else {
        console.warn('[VoiceCallAudio] InCallManager not available for speaker toggle');
        // Still update state for UI feedback
        setIsSpeakerEnabled(newSpeakerState);
      }
      
      // Keep expo-audio routing in sync as a fallback
      setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        allowsRecording: true,
        shouldPlayInBackground: true,
        shouldRouteThroughEarpiece: !newSpeakerState,
      }).catch(error => {
        console.warn('[VoiceCallAudio] Failed to update audio mode for speaker toggle:', error);
      });
    } catch (error) {
      console.error('[VoiceCallAudio] Failed to toggle speaker:', error);
      // Revert state on error
      setIsSpeakerEnabled(isSpeakerEnabled);
    }
  }, [isSpeakerEnabled, setIsSpeakerEnabled]);

  // Stop audio and cleanup
  const stopAudio = useCallback(async () => {
    // Clear any pending retry timeouts
    if (ringbackRetryTimeoutRef.current) {
      clearTimeout(ringbackRetryTimeoutRef.current);
      ringbackRetryTimeoutRef.current = null;
    }
    
    // Stop custom ringback first
    await stopCustomRingback();
    
    if (InCallManager) {
      try {
        InCallManager.stopRingback();
        InCallManager.stop();
        console.log('[VoiceCallAudio] InCallManager stopped');
      } catch (err) {
        console.warn('[VoiceCallAudio] InCallManager stop error:', err);
      }
    }
    
    // Reset all refs for clean state
    audioInitializedRef.current = false;
    speakerAppliedOnConnectRef.current = false;
    ringbackRetryCountRef.current = 0;
  }, [stopCustomRingback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ringbackRetryTimeoutRef.current) {
        clearTimeout(ringbackRetryTimeoutRef.current);
      }
      if (earpieceEnforcerRef.current) {
        clearInterval(earpieceEnforcerRef.current);
      }
    };
  }, []);

  // CRITICAL: Ensure ringback plays for caller during ringing state
  // This handles the case where call state transitions from connecting -> ringing
  // and we need to ensure ringback is playing
  useEffect(() => {
    // Only play ringback for caller (isOwner) during connecting or ringing states
    if (isOwner && (callState === 'connecting' || callState === 'ringing')) {
      // If ringback isn't already playing, start it
      if (!ringbackStartedRef.current && !ringbackPlayerRef.current) {
        console.log('[VoiceCallAudio] 🔊 Triggering ringback for state:', callState);
        playCustomRingback().catch(err => 
          console.warn('[VoiceCallAudio] Ringback trigger failed:', err)
        );
      }
    }
    
    // Stop ringback when call connects, ends, or fails
    if (callState === 'connected' || callState === 'ended' || callState === 'failed' || callState === 'idle') {
      if (ringbackStartedRef.current || ringbackPlayerRef.current) {
        console.log('[VoiceCallAudio] 🔇 Stopping ringback for state:', callState);
        stopCustomRingback().catch(err =>
          console.warn('[VoiceCallAudio] Ringback stop failed:', err)
        );
      }
    }
  }, [callState, isOwner, playCustomRingback, stopCustomRingback]);

  return {
    toggleSpeaker,
    stopAudio,
    isInCallManagerAvailable: !!InCallManager,
  };
}
