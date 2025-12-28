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

  // Continuous earpiece enforcement during ringing/connecting
  // This is needed because Android can switch to speaker when playing ringback
  useEffect(() => {
    if (!InCallManager) return;
    
    const shouldEnforceEarpiece = (callState === 'connecting' || callState === 'ringing') && !isSpeakerEnabled;
    
    if (shouldEnforceEarpiece) {
      console.log('[VoiceCallAudio] Starting continuous earpiece enforcement');
      
      // Immediately enforce earpiece
      try {
        InCallManager.setForceSpeakerphoneOn(false);
      } catch (e) {
        console.warn('[VoiceCallAudio] Initial earpiece enforcement failed:', e);
      }
      
      // Set up periodic enforcement every 500ms during ringing
      // This catches any automatic speaker switches
      earpieceEnforcerRef.current = setInterval(() => {
        try {
          InCallManager.setForceSpeakerphoneOn(false);
          console.log('[VoiceCallAudio] Earpiece re-enforced (periodic)');
        } catch (e) {
          // Ignore errors during enforcement
        }
      }, 500);
    } else {
      // Clear the enforcer when not needed
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

  // Stop ringback when call connects
  useEffect(() => {
    if (callState === 'connected' && InCallManager) {
      try {
        // Stop ringback for caller
        if (isOwner) {
          InCallManager.stopRingback();
          console.log('[VoiceCallAudio] Stopped ringback - call connected');
        }
        
        // Enforce current speaker state (earpiece by default, unless user toggled)
        InCallManager.setForceSpeakerphoneOn(isSpeakerEnabled);
        console.log('[VoiceCallAudio] Audio routed to:', isSpeakerEnabled ? 'speaker' : 'earpiece');
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
