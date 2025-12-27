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

  // Audio management via InCallManager
  // CRITICAL: Only initialize audio ONCE to prevent ringtone changes
  useEffect(() => {
    if (!InCallManager) return;
    if (audioInitializedRef.current) return;
    
    // Only start on first 'connecting' state, never restart
    if (callState !== 'connecting') return;
    
    try {
      console.log('[VoiceCallAudio] Initializing audio for', isOwner ? 'caller' : 'callee');
      
      // Start InCallManager in audio mode (no ringback ringtone)
      // We handle ringing UI separately with Expo Audio
      InCallManager.start({ 
        media: 'audio',
        auto: false, // Prevent auto focus release
        ringback: '' // No ringback tone to prevent ringtone changes
      });
      
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
