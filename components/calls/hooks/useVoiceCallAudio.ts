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
        // Caller: Use system default ringback tone while waiting for answer
        InCallManager.start({ 
          media: 'audio',
          auto: false,
          ringback: '_DEFAULT_' // System default ringback (KRING KRING)
        });
        console.log('[VoiceCallAudio] Caller: Playing system ringback tone');
        
        // Immediately re-enforce earpiece after start (ringback may trigger speaker)
        setTimeout(() => {
          try {
            InCallManager.setForceSpeakerphoneOn(false);
            console.log('[VoiceCallAudio] Post-start earpiece enforcement');
          } catch (e) {}
        }, 100);
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
      InCallManager.setKeepScreenOn(true);
      
      audioInitializedRef.current = true;
      console.log('[VoiceCallAudio] Audio initialized successfully');
    } catch (error) {
      console.error('[VoiceCallAudio] Failed to start InCallManager:', error);
    }
  }, [callState, isOwner, setIsSpeakerEnabled]);

  // Stop ringback when call connects and enforce audio routing
  useEffect(() => {
    if (callState === 'connected' && InCallManager) {
      try {
        // Stop ringback for caller
        if (isOwner) {
          InCallManager.stopRingback();
          console.log('[VoiceCallAudio] Stopped ringback - call connected');
        }
        
        // CRITICAL: Enforce current speaker state (earpiece by default, unless user toggled)
        // The continuous enforcement hook will maintain this, but we set it here immediately
        InCallManager.setForceSpeakerphoneOn(isSpeakerEnabled);
        console.log('[VoiceCallAudio] Audio routed to:', isSpeakerEnabled ? 'speaker' : 'earpiece');
        
        // Additional enforcement after a short delay to catch any routing changes
        if (!isSpeakerEnabled) {
          setTimeout(() => {
            try {
              InCallManager.setForceSpeakerphoneOn(false);
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
  }, [callState, isOwner, isSpeakerEnabled]);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    const newSpeakerState = !isSpeakerEnabled;
    console.log('[VoiceCallAudio] Toggling speaker:', { from: isSpeakerEnabled, to: newSpeakerState });
    
    try {
      if (InCallManager) {
        InCallManager.setForceSpeakerphoneOn(newSpeakerState);
        setIsSpeakerEnabled(newSpeakerState);
        console.log('[VoiceCallAudio] Speaker toggled successfully to:', newSpeakerState ? 'speaker' : 'earpiece');
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
  const stopAudio = useCallback(() => {
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
  }, []);

  return {
    toggleSpeaker,
    stopAudio,
    isInCallManagerAvailable: !!InCallManager,
  };
}
