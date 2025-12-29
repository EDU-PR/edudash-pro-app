/**
 * Voice Call Audio Hook
 * 
 * Manages audio routing via InCallManager:
 * - Ringback for caller while waiting
 * - Earpiece/speaker routing
 * - Audio cleanup
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import type { CallState } from '../types';

// Conditionally import InCallManager
let InCallManager: any = null;
try {
  InCallManager = require('react-native-incall-manager').default;
} catch (error) {
  console.warn('[VoiceCallAudio] InCallManager not available:', error);
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
  const ringbackPlayerRef = useRef<AudioPlayer | null>(null);

  // Custom ringback playback function (respects earpiece routing)
  // Uses expo-audio which respects InCallManager's audio routing settings
  const playCustomRingback = useCallback(async () => {
    // Stop any existing ringback first
    if (ringbackPlayerRef.current) {
      try {
        ringbackPlayerRef.current.pause();
        ringbackPlayerRef.current.release();
      } catch (e) {
        // Ignore errors
      }
      ringbackPlayerRef.current = null;
    }

    try {
      // Configure audio mode for call audio (respects InCallManager routing)
      if (Platform.OS !== 'web') {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'doNotMix', // Don't mix with other audio
          interruptionModeAndroid: 'doNotMix',
        });
      }

      // Create audio player with ringback.mp3 as ringback tone
      // This will respect the earpiece routing set by InCallManager
      const ringbackPlayer = createAudioPlayer(
        require('@/assets/sounds/ringback.mp3')
      );
      
      // Configure for ringback: loop, moderate volume
      ringbackPlayer.loop = true;
      ringbackPlayer.volume = 0.7; // Slightly louder for ringback
      
      ringbackPlayerRef.current = ringbackPlayer;
      
      // Play ringback - expo-audio respects InCallManager routing
      ringbackPlayer.play();
      
      console.log('[VoiceCallAudio] ✅ Playing custom ringback via expo-audio (respects earpiece routing)');
      console.log('[VoiceCallAudio] Ringback player state:', {
        playing: ringbackPlayer.playing,
        volume: ringbackPlayer.volume,
        loop: ringbackPlayer.loop,
      });
    } catch (error) {
      console.error('[VoiceCallAudio] ❌ Failed to play custom ringback:', error);
      console.error('[VoiceCallAudio] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      ringbackPlayerRef.current = null;
    }
  }, []);

  // Stop custom ringback when call connects
  const stopCustomRingback = useCallback(async () => {
    if (ringbackPlayerRef.current) {
      const player = ringbackPlayerRef.current;
      ringbackPlayerRef.current = null; // Clear ref first to prevent double cleanup
      
      try {
        // Pause and release - don't call seekTo as it may fail if player is being released
        player.pause();
        player.release();
        console.log('[VoiceCallAudio] Stopped custom ringback');
      } catch (error) {
        // Ignore errors during cleanup (player may already be released)
        console.warn('[VoiceCallAudio] Cleanup warning (non-critical):', error);
      }
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
