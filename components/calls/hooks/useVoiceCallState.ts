/**
 * Voice Call State Hook
 * 
 * Manages all state for voice calls including:
 * - Call state (idle, connecting, ringing, connected, ended, failed)
 * - Audio/speaker toggles
 * - Call duration timer
 * - Error handling
 * - Participant count
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Animated } from 'react-native';
import type { CallState } from '../types';

export interface VoiceCallStateOptions {
  isOpen: boolean;
  callId?: string;
  onCallStateChange?: (state: CallState) => void;
}

export interface VoiceCallStateReturn {
  // State values
  callState: CallState;
  isAudioEnabled: boolean;
  isSpeakerEnabled: boolean;
  isMinimized: boolean;
  error: string | null;
  participantCount: number;
  callDuration: number;
  
  // Refs
  callIdRef: React.MutableRefObject<string | null>;
  dailyRef: React.MutableRefObject<any>;
  
  // Animations
  fadeAnim: Animated.Value;
  pulseAnim: Animated.Value;
  
  // Setters
  setCallState: (state: CallState) => void;
  setIsAudioEnabled: (enabled: boolean) => void;
  setIsSpeakerEnabled: (enabled: boolean) => void;
  setIsMinimized: (minimized: boolean) => void;
  setError: (error: string | null) => void;
  setParticipantCount: (count: number) => void;
  setCallDuration: (duration: number) => void;
  
  // Helpers
  formatDuration: (seconds: number) => string;
  resetState: () => void;
}

export function useVoiceCallState({
  isOpen,
  callId,
  onCallStateChange,
}: VoiceCallStateOptions): VoiceCallStateReturn {
  // Core state
  const [callState, setCallState] = useState<CallState>('idle');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [callDuration, setCallDuration] = useState(0);

  // Refs
  const dailyRef = useRef<any>(null);
  const callIdRef = useRef<string | null>(callId || null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Update callIdRef when prop changes
  useEffect(() => {
    if (callId && !callIdRef.current) {
      callIdRef.current = callId;
    }
  }, [callId]);

  // Notify parent of state changes
  useEffect(() => {
    onCallStateChange?.(callState);
  }, [callState, onCallStateChange]);

  // Fade animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOpen, fadeAnim]);

  // Pulsing animation for ringing state
  useEffect(() => {
    if (callState === 'connecting' || callState === 'ringing') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [callState, pulseAnim]);

  // Call duration timer
  useEffect(() => {
    if (callState === 'connected' && participantCount > 1) {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callState, participantCount]);

  // Format duration as MM:SS
  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Reset all state
  const resetState = useCallback(() => {
    setError(null);
    setCallState('idle');
    setParticipantCount(0);
    setCallDuration(0);
    setIsAudioEnabled(true);
    setIsSpeakerEnabled(false);
    setIsMinimized(false);
  }, []);

  return {
    // State values
    callState,
    isAudioEnabled,
    isSpeakerEnabled,
    isMinimized,
    error,
    participantCount,
    callDuration,
    
    // Refs
    callIdRef,
    dailyRef,
    
    // Animations
    fadeAnim,
    pulseAnim,
    
    // Setters
    setCallState,
    setIsAudioEnabled,
    setIsSpeakerEnabled,
    setIsMinimized,
    setError,
    setParticipantCount,
    setCallDuration,
    
    // Helpers
    formatDuration,
    resetState,
  };
}
