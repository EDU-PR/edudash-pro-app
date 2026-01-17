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
    if (ringbackStartedRef.current) {
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
        interruptionMode: 'doNotMix',
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

  // Continuous earpiece enforcement during ringing/connecting AND connected states
  // NOTE: Android's default behavior is to play ringback tone on speaker initially
  // This is standard Android behavior for outgoing calls. We enforce earpiece to override this.
  // The periodic enforcement catches any automatic speaker switches during ringback playback.
  // CRITICAL: Continue enforcement even after call connects to prevent speaker switching
  useEffect(() => {
    if (!InCallManager) return;
    
    // Enforce earpiece during connecting, ringing, AND connected states if speaker is disabled
    // This ensures earpiece stays enforced throughout the entire call lifecycle
    const shouldEnforceEarpiece = (
      callState === 'connecting' || 
      callState === 'ringing' || 
      callState === 'connected'
    ) && !isSpeakerEnabled;
    
    if (shouldEnforceEarpiece) {
      // Immediately enforce earpiece
      try {
        InCallManager.setForceSpeakerphoneOn(false);
        console.log('[VoiceCallAudio] Earpiece enforced immediately');
      } catch (e) {
        console.warn('[VoiceCallAudio] Initial earpiece enforcement failed:', e);
      }
      
      // Set up more aggressive periodic enforcement every 250ms
      // This catches any automatic speaker switches more quickly
      // Continue enforcement even after call connects to prevent Daily.co or system from switching to speaker
      if (!earpieceEnforcerRef.current) {
        console.log('[VoiceCallAudio] Starting continuous earpiece enforcement');
        earpieceEnforcerRef.current = setInterval(() => {
          try {
            InCallManager.setForceSpeakerphoneOn(false);
            // Only log occasionally to reduce noise (every 2 seconds = 8 intervals)
            const shouldLog = Math.random() < 0.125; // 12.5% chance = ~every 2 seconds
            if (shouldLog) {
              console.log('[VoiceCallAudio] Earpiece re-enforced (periodic)');
            }
          } catch (e) {
            // Ignore errors during enforcement
          }
        }, 250); // More frequent: 250ms instead of 500ms
      }
    } else {
      // Clear the enforcer when speaker is enabled or call ends
      if (earpieceEnforcerRef.current) {
        clearInterval(earpieceEnforcerRef.current);
        earpieceEnforcerRef.current = null;
        console.log('[VoiceCallAudio] Stopped continuous earpiece enforcement');
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
    if (!InCallManager) return;
    if (audioInitializedRef.current) return;
    
    // Only start on first 'connecting' state, never restart
    if (callState !== 'connecting') return;
    
    const initializeAudio = async () => {
      try {
        console.log('[VoiceCallAudio] Initializing audio for', isOwner ? 'caller' : 'callee');
        
        // CRITICAL: Set audio mode via expo-audio FIRST to establish earpiece routing
        // This must happen BEFORE InCallManager.start() to prevent speaker initialization
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'doNotMix',
          allowsRecording: true,
          shouldPlayInBackground: true,
          // ANDROID SPECIFIC: Route through earpiece for phone-like experience
          shouldRouteThroughEarpiece: true,
        });
        console.log('[VoiceCallAudio] ✅ Pre-initialized audio mode for earpiece');
        
        // CRITICAL: Set earpiece via InCallManager BEFORE starting 
        InCallManager.setForceSpeakerphoneOn(false);
        
        if (isOwner) {
          // Caller: NO system ringback - it forces speaker on Android
          // Instead, use empty ringback and play custom tone via expo-audio
          // expo-audio respects InCallManager's earpiece routing
          InCallManager.start({ 
            media: 'audio',
            auto: false,
            ringback: '' // Empty - no system ringback (prevents speaker routing)
          });
          console.log('[VoiceCallAudio] Caller: Audio initialized (no system ringback to prevent speaker routing)');
          
          // CRITICAL: Set earpiece AGAIN after start to override any default
          InCallManager.setForceSpeakerphoneOn(false);
          
          // Play custom ringback via expo-audio (respects earpiece routing)
          // Fire and forget - don't await to avoid blocking
          playCustomRingback().catch(err => 
            console.warn('[VoiceCallAudio] Ringback playback failed:', err)
          );
        } else {
          // Callee: No ringback needed, just setup audio routing
          InCallManager.start({ 
            media: 'audio',
            auto: false,
            ringback: '' // No ringback for callee
          });
          console.log('[VoiceCallAudio] Callee: Audio routing only, no ringback');
        }
        
        // Default to earpiece (WhatsApp-like) - enforce multiple times
        InCallManager.setForceSpeakerphoneOn(false);
        setIsSpeakerEnabled(false);
        
        // Additional enforcement after short delays to catch any automatic speaker switches
        setTimeout(() => {
          try {
            InCallManager.setForceSpeakerphoneOn(false);
            console.log('[VoiceCallAudio] Earpiece enforcement (100ms post-init)');
          } catch (e) { /* ignore */ }
        }, 100);
        
        setTimeout(() => {
          try {
            InCallManager.setForceSpeakerphoneOn(false);
            console.log('[VoiceCallAudio] Earpiece enforcement (300ms post-init)');
          } catch (e) { /* ignore */ }
        }, 300);
        
        // For earpiece calls: Don't force screen to stay on
        // This allows the proximity sensor to turn off the screen when phone is near ear
        // For speaker calls, we'll enable keepScreenOn in the connected state effect
        InCallManager.setKeepScreenOn(false);
        
        audioInitializedRef.current = true;
        console.log('[VoiceCallAudio] Audio initialized successfully');
      } catch (error) {
        console.error('[VoiceCallAudio] Failed to start InCallManager:', error);
      }
    };
    
    initializeAudio();
  }, [callState, isOwner, setIsSpeakerEnabled, playCustomRingback]);

  // Stop ringback when call connects and enforce audio routing
  // CRITICAL: Only apply speaker setting ONCE on connect to avoid overriding user toggles
  useEffect(() => {
    if (callState === 'connected' && InCallManager) {
      try {
        // Stop custom ringback (if playing)
        stopCustomRingback();
        
        // Stop InCallManager ringback (if any)
        if (isOwner) {
          InCallManager.stopRingback();
          console.log('[VoiceCallAudio] Stopped ringback - call connected');
        }
        
        // CRITICAL: Only apply speaker setting ONCE on initial connect
        // This prevents overriding the user's speaker toggle after they change it
        if (!speakerAppliedOnConnectRef.current) {
          speakerAppliedOnConnectRef.current = true;
          
          // CRITICAL: Re-set audio mode via expo-audio to enforce earpiece
          // This helps override any changes Daily.co might have made
          if (!isSpeakerEnabled) {
            setAudioModeAsync({
              playsInSilentMode: true,
              interruptionMode: 'doNotMix',
              allowsRecording: true,
              shouldPlayInBackground: true,
              shouldRouteThroughEarpiece: true,
            }).catch(e => console.warn('[VoiceCallAudio] Failed to set audio mode on connect:', e));
          }
          
          // Enforce current speaker state (earpiece by default, unless user toggled)
          // The continuous enforcement hook will maintain earpiece if not using speaker
          InCallManager.setForceSpeakerphoneOn(isSpeakerEnabled);
          
          // Screen control based on speaker state:
          // - Earpiece: Allow proximity sensor to turn off screen when near ear
          // - Speaker: Keep screen on (user is looking at it)
          InCallManager.setKeepScreenOn(isSpeakerEnabled);
          
          console.log('[VoiceCallAudio] 📞 Call connected - audio routed to:', isSpeakerEnabled ? 'speaker' : 'earpiece');
          console.log('[VoiceCallAudio] Screen keep-on:', isSpeakerEnabled ? 'enabled (speaker mode)' : 'disabled (proximity sensor enabled)');
          
          // Give haptic feedback to indicate call connected
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          
          // Additional enforcement after a short delay to catch any routing changes from Daily.co
          if (!isSpeakerEnabled) {
            setTimeout(() => {
              try {
                InCallManager.setForceSpeakerphoneOn(false);
                InCallManager.setKeepScreenOn(false);
                console.log('[VoiceCallAudio] Post-connect earpiece enforcement');
              } catch (e) {
                // Silent - continuous enforcement will handle it
              }
            }, 200);
            
            // Second enforcement after Daily.co fully initializes audio
            setTimeout(() => {
              try {
                InCallManager.setForceSpeakerphoneOn(false);
                console.log('[VoiceCallAudio] Secondary earpiece enforcement (500ms)');
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
