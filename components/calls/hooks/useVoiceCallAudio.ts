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
 */

import { useEffect, useRef, useCallback } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { CallState } from '../types';

// Conditionally import InCallManager
let InCallManager: any = null;
try {
  InCallManager = require('react-native-incall-manager').default;
} catch (error) {
  console.warn('[VoiceCallAudio] InCallManager not available:', error);
}

// Ringback sound asset - use @/ alias for consistent resolution
// CRITICAL: Must use require() at module level, not inside function
let RINGBACK_SOUND: any = null;
try {
  RINGBACK_SOUND = require('@/assets/sounds/ringback.mp3');
  console.log('[VoiceCallAudio] ✅ Ringback sound loaded');
} catch (error) {
  console.warn('[VoiceCallAudio] ❌ Failed to load ringback sound:', error);
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

  /**
   * Play ringback tone using expo-audio
   * 
   * CRITICAL: This uses expo-audio instead of InCallManager.startRingback() because:
   * 1. InCallManager.startRingback('_DEFAULT_') ignores earpiece setting on Android
   * 2. It always routes to speaker regardless of setForceSpeakerphoneOn(false)
   * 3. expo-audio respects the audio mode set by setAudioModeAsync()
   * 
   * The audio mode MUST be set to route through earpiece BEFORE playing:
   * - shouldRouteThroughEarpiece: true  <-- THIS is the key setting for Android
   */
  const playCustomRingback = useCallback(async () => {
    if (ringbackStartedRef.current) return;
    
    // Check if sound file is loaded
    if (!RINGBACK_SOUND) {
      console.error('[VoiceCallAudio] ❌ Ringback sound not loaded - cannot play');
      return;
    }
    
    try {
      console.log('[VoiceCallAudio] 🔊 Starting ringback via expo-audio (earpiece mode)');
      console.log('[VoiceCallAudio] Ringback sound source:', RINGBACK_SOUND);
      
      // CRITICAL: Set audio mode to route through earpiece BEFORE creating player
      // expo-audio's shouldRouteThroughEarpiece is the key setting for Android
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: 'doNotMix',
        allowsRecording: true, // Needed for calls
        shouldPlayInBackground: true,
        // ANDROID SPECIFIC: Route through earpiece for phone-like experience
        shouldRouteThroughEarpiece: true, // <-- KEY: Routes to earpiece on Android
      });
      console.log('[VoiceCallAudio] ✅ Audio mode set to earpiece routing');
      
      // Also enforce via InCallManager for extra reliability
      if (InCallManager) {
        InCallManager.setForceSpeakerphoneOn(false);
      }
      
      // Create and play the ringback sound using expo-audio
      const player = createAudioPlayer(RINGBACK_SOUND);
      player.loop = true; // Loop until call connects
      player.volume = 1.0;
      player.play();
      
      ringbackPlayerRef.current = player;
      ringbackStartedRef.current = true;
      console.log('[VoiceCallAudio] ✅ Ringback playing through earpiece');
      
    } catch (error) {
      console.error('[VoiceCallAudio] ❌ Failed to start ringback:', error);
      ringbackStartedRef.current = false;
    }
  }, []);

  /**
   * Stop ringback when call connects or ends
   */
  const stopCustomRingback = useCallback(async () => {
    if (!ringbackStartedRef.current && !ringbackPlayerRef.current) return;
    
    try {
      if (ringbackPlayerRef.current) {
        ringbackPlayerRef.current.pause();
        ringbackPlayerRef.current.remove();
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
    
    try {
      console.log('[VoiceCallAudio] Initializing audio for', isOwner ? 'caller' : 'callee');
      
      // CRITICAL: Set earpiece BEFORE starting to prevent any speaker routing
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
        
        // CRITICAL: Set earpiece BEFORE playing ringback
        // This ensures ringback plays through earpiece, not speaker
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
      
      // Default to earpiece (WhatsApp-like)
      InCallManager.setForceSpeakerphoneOn(false);
      setIsSpeakerEnabled(false);
      
      // For earpiece calls: Don't force screen to stay on
      // This allows the proximity sensor to turn off the screen when phone is near ear
      // For speaker calls, we'll enable keepScreenOn in the connected state effect
      InCallManager.setKeepScreenOn(false);
      
      audioInitializedRef.current = true;
      console.log('[VoiceCallAudio] Audio initialized successfully');
    } catch (error) {
      console.error('[VoiceCallAudio] Failed to start InCallManager:', error);
    }
  }, [callState, isOwner, setIsSpeakerEnabled, playCustomRingback]);

  // Stop ringback when call connects and enforce audio routing
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
        
        // CRITICAL: Enforce current speaker state (earpiece by default, unless user toggled)
        // The continuous enforcement hook will maintain this, but we set it here immediately
        InCallManager.setForceSpeakerphoneOn(isSpeakerEnabled);
        
        // Screen control based on speaker state:
        // - Earpiece: Allow proximity sensor to turn off screen when near ear
        // - Speaker: Keep screen on (user is looking at it)
        InCallManager.setKeepScreenOn(isSpeakerEnabled);
        
        console.log('[VoiceCallAudio] Audio routed to:', isSpeakerEnabled ? 'speaker' : 'earpiece');
        console.log('[VoiceCallAudio] Screen keep-on:', isSpeakerEnabled ? 'enabled (speaker mode)' : 'disabled (proximity sensor enabled)');
        
        // Additional enforcement after a short delay to catch any routing changes
        if (!isSpeakerEnabled) {
          setTimeout(() => {
            try {
              InCallManager.setForceSpeakerphoneOn(false);
              InCallManager.setKeepScreenOn(false); // Ensure screen can be turned off by proximity sensor
              console.log('[VoiceCallAudio] Post-connect earpiece enforcement');
            } catch (e) {
              // Silent - continuous enforcement will handle it
            }
          }, 200);
        }
      } catch (error) {
        console.warn('[VoiceCallAudio] Failed to handle connected state:', error);
      }
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
    audioInitializedRef.current = false;
  }, [stopCustomRingback]);

  return {
    toggleSpeaker,
    stopAudio,
    isInCallManagerAvailable: !!InCallManager,
  };
}
