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
  useEffect(() => {
    if (!InCallManager) return;
    
    const setupAudio = () => {
      if (audioInitializedRef.current) return;
      
      try {
        if (isOwner && (callState === 'connecting' || callState === 'ringing')) {
          // Caller: start with ringback, use earpiece by default
          console.log('[VoiceCallAudio] Caller: Starting InCallManager with ringback');
          InCallManager.start({ media: 'audio', ringback: '_DEFAULT_' });
          InCallManager.setForceSpeakerphoneOn(false);
          audioInitializedRef.current = true;
        } else if (!isOwner && callState === 'connecting') {
          // Callee: start audio with EARPIECE by default (like WhatsApp)
          // User can toggle to speaker if needed
          console.log('[VoiceCallAudio] Callee: Starting InCallManager with EARPIECE default');
          InCallManager.start({ media: 'audio' });
          InCallManager.setForceSpeakerphoneOn(false); // Earpiece for callees (WhatsApp-like)
          setIsSpeakerEnabled(false); // Update state to reflect earpiece is on
          audioInitializedRef.current = true;
        }
      } catch (error) {
        console.error('[VoiceCallAudio] Failed to start InCallManager:', error);
      }
    };
    
    const stopRingback = () => {
      try {
        if (callState === 'connected') {
          console.log('[VoiceCallAudio] Connected: Stopping ringback');
          InCallManager.stopRingback();
        }
      } catch (error) {
        console.warn('[VoiceCallAudio] Failed to stop ringback:', error);
      }
    };
    
    setupAudio();
    stopRingback();
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
