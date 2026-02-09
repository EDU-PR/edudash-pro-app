/**
 * VoiceOrb - Refactored
 * 
 * A stunning animated orb with cosmic effects for voice interaction.
 * Integrates with Azure Speech Services for STT/TTS.
 * 
 * Refactored per WARP.md guidelines - split into:
 * - VoiceOrb.tsx (this file) - Main component (~300 lines)
 * - VoiceOrb.styles.ts - Styles
 * - VoiceOrbAnimations.tsx - Animation components
 * - useVoiceRecorder.ts - Recording hook
 * - useVoiceSTT.ts - Speech-to-text hook
 * - useVoiceTTS.ts - Text-to-speech hook
 * 
 * @module components/super-admin/voice-orb/VoiceOrb
 */

import React, { useState, useMemo, useCallback, useEffect, useImperativeHandle, forwardRef, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useOnDeviceVoice } from '@/hooks/useOnDeviceVoice';

// Local imports
import { styles, COLORS, ORB_SIZE } from './VoiceOrb.styles';
import { 
  FloatingParticle, 
  ShootingStar, 
  PulsingRing,
  generateParticles,
  generateShootingStars,
  generateRings,
} from './VoiceOrbAnimations';
import { useVoiceRecorder } from './useVoiceRecorder';
import { useVoiceSTT, SUPPORTED_LANGUAGES, SupportedLanguage, TranscribeLanguage } from './useVoiceSTT';
import { useVoiceTTS } from './useVoiceTTS';
import { canAutoRestartAfterInterrupt, INTERRUPT_RESTART_DELAY_MS } from './interrupt';

// ============================================================================
// Types
// ============================================================================

export interface VoiceOrbRef {
  /** Speak text using TTS */
  speakText: (text: string) => Promise<void>;
  /** Stop TTS playback */
  stopSpeaking: () => Promise<void>;
  /** Get current speaking state */
  isSpeaking: boolean;
}

interface VoiceOrbProps {
  isListening: boolean;
  isSpeaking: boolean;
  /** Whether the parent screen is processing (waiting for AI response). Used for auto-restart. */
  isParentProcessing?: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onTranscript: (text: string, language?: SupportedLanguage) => void;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
  /** Called when TTS starts */
  onTTSStart?: () => void;
  /** Called when TTS ends */
  onTTSEnd?: () => void;
  /** Called when user changes language */
  onLanguageChange?: (lang: SupportedLanguage) => void;
  /** Externally set language (from parent language dropdown) */
  language?: SupportedLanguage;
  /** Auto-start listening when component mounts (default: true) */
  autoStartListening?: boolean;
  /** Auto-restart listening after TTS ends (default: true) */
  autoRestartAfterTTS?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

const VoiceOrb = forwardRef<VoiceOrbRef, VoiceOrbProps>(({
  isListening,
  isSpeaking,
  isParentProcessing = false,
  onStartListening,
  onStopListening,
  onTranscript,
  onSpeakStart,
  onSpeakEnd,
  onTTSStart,
  onTTSEnd,
  onLanguageChange,
  language: externalLanguage,
  autoStartListening = true,
  autoRestartAfterTTS = true,
}, ref) => {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const tenantId = profile?.organization_id || profile?.preschool_id || null;
  const [statusText, setStatusText] = useState('Listening...');
  const hasAutoStarted = useRef(false);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en-ZA');
  const [lastDetectedLanguage, setLastDetectedLanguage] = useState<SupportedLanguage | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Prevent double-processing
  const [liveTranscript, setLiveTranscript] = useState('');
  const [usingLiveSTT, setUsingLiveSTT] = useState(false);

  // Sync external language prop from parent (language dropdown)
  useEffect(() => {
    if (externalLanguage && externalLanguage !== selectedLanguage) {
      setSelectedLanguage(externalLanguage);
    }
  }, [externalLanguage]);

  const LIVE_TRANSCRIPTION_ENABLED = process.env.EXPO_PUBLIC_VOICE_LIVE_TRANSCRIPTION_ENABLED !== 'false';
  const LIVE_SILENCE_TIMEOUT_MS = 2200;
  const LIVE_FINAL_FALLBACK_MS = 700;
  const usingLiveSTTRef = useRef(false);
  const liveSessionRef = useRef(0);
  const liveFinalizedRef = useRef(false);
  const lastPartialRef = useRef('');
  const liveSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Ref to hold the latest transcribe function
  const transcribeRef = useRef<((uri: string) => Promise<void>) | null>(null);
  
  // Voice hooks - pass a stable callback
  const handleSilenceDetected = useCallback(() => {
    transcribeRef.current?.('silence');
  }, []);
  
  const [recorderState, recorderActions] = useVoiceRecorder(handleSilenceDetected);
  const { transcribe, isTranscribing } = useVoiceSTT({ preschoolId: tenantId });
  const { speak, stop: stopSpeaking, isSpeaking: ttsIsSpeaking } = useVoiceTTS();
  const isSpeakingRef = useRef(isSpeaking);
  const ttsSpeakingRef = useRef(ttsIsSpeaking);
  const resetLiveSilenceTimerRef = useRef<(() => void) | null>(null);
  const finalizeLiveRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    ttsSpeakingRef.current = ttsIsSpeaking;
  }, [ttsIsSpeaking]);

  useEffect(() => {
    usingLiveSTTRef.current = usingLiveSTT;
  }, [usingLiveSTT]);

  const clearLiveTimers = useCallback(() => {
    if (liveSilenceTimerRef.current) {
      clearTimeout(liveSilenceTimerRef.current);
      liveSilenceTimerRef.current = null;
    }
    if (liveFallbackTimerRef.current) {
      clearTimeout(liveFallbackTimerRef.current);
      liveFallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearLiveTimers();
  }, [clearLiveTimers]);

  const {
    isAvailable: liveAvailable,
    startListening: startLiveListening,
    stopListening: stopLiveListening,
    cancelListening: cancelLiveListening,
    clearResults: clearLiveResults,
  } = useOnDeviceVoice({
    language: selectedLanguage,
    onPartialResult: (text) => {
      if (!usingLiveSTTRef.current) return;
      lastPartialRef.current = text;
      setLiveTranscript(text);
      resetLiveSilenceTimerRef.current?.();
    },
    onFinalResult: (text) => {
      if (!usingLiveSTTRef.current) return;
      finalizeLiveRef.current?.(text);
    },
    onError: (errorMsg) => {
      console.warn('[VoiceOrb] Live STT error:', errorMsg);
      if (usingLiveSTTRef.current) {
        setUsingLiveSTT(false);
      }
    },
  });

  const finalizeLiveTranscript = useCallback((text: string) => {
    if (liveFinalizedRef.current) return;
    liveFinalizedRef.current = true;
    clearLiveTimers();
    setUsingLiveSTT(false);
    setIsProcessing(false);

    const cleaned = (text || '').trim();
    if (cleaned) {
      setLastDetectedLanguage(selectedLanguage);
      onTranscript(cleaned, selectedLanguage);
      setStatusText('Listening...');
      return;
    }

    const fallback = lastPartialRef.current.trim();
    if (fallback) {
      setLastDetectedLanguage(selectedLanguage);
      onTranscript(fallback, selectedLanguage);
      setStatusText('Listening...');
      return;
    }

    setStatusText('No speech detected');
    setTimeout(() => setStatusText('Listening...'), 2000);
  }, [clearLiveTimers, onTranscript, selectedLanguage]);

  useEffect(() => {
    finalizeLiveRef.current = finalizeLiveTranscript;
  }, [finalizeLiveTranscript]);

  const scheduleLiveFallback = useCallback(() => {
    if (liveFallbackTimerRef.current) {
      clearTimeout(liveFallbackTimerRef.current);
    }
    const sessionId = liveSessionRef.current;
    liveFallbackTimerRef.current = setTimeout(() => {
      if (liveSessionRef.current !== sessionId || liveFinalizedRef.current) return;
      finalizeLiveTranscript('');
    }, LIVE_FINAL_FALLBACK_MS);
  }, [finalizeLiveTranscript]);

  const resetLiveSilenceTimer = useCallback(() => {
    if (liveSilenceTimerRef.current) {
      clearTimeout(liveSilenceTimerRef.current);
    }
    const sessionId = liveSessionRef.current;
    liveSilenceTimerRef.current = setTimeout(() => {
      if (liveSessionRef.current !== sessionId || liveFinalizedRef.current) return;
      console.log('[VoiceOrb] 🔇 Live STT silence detected, stopping...');
      stopLiveListening().catch(() => {});
      onStopListening();
      scheduleLiveFallback();
    }, LIVE_SILENCE_TIMEOUT_MS);
  }, [stopLiveListening, onStopListening, scheduleLiveFallback]);

  useEffect(() => {
    resetLiveSilenceTimerRef.current = resetLiveSilenceTimer;
  }, [resetLiveSilenceTimer]);

  // Handle recording stop and transcribe
  const handleStopAndTranscribe = useCallback(async () => {
    if (isProcessing) return; // Prevent double calls
    setIsProcessing(true);
    
    try {
      if (usingLiveSTTRef.current) {
        setStatusText('Processing...');
        try {
          await stopLiveListening();
        } catch (stopError) {
          console.warn('[VoiceOrb] Live STT stop failed:', stopError);
        }
        onStopListening();
        scheduleLiveFallback();
        return;
      }

      const uri = await recorderActions.stopRecording();
      onStopListening();
      
      if (!uri) {
        setStatusText('No audio recorded');
        setTimeout(() => setStatusText('Listening...'), 2000);
        return;
      }
      
      setStatusText('Transcribing...');
      const sttLanguage: TranscribeLanguage = selectedLanguage === 'en-ZA' ? 'auto' : selectedLanguage;
      const result = await transcribe(uri, sttLanguage);
      
      if (result?.text) {
        const detected = result.language;
        if (detected === 'en-ZA' || detected === 'af-ZA' || detected === 'zu-ZA') {
          setLastDetectedLanguage(detected);
        }
        onTranscript(result.text, result.language as SupportedLanguage | undefined);
        setStatusText('Listening...');
      } else {
        setStatusText('No speech detected');
        setTimeout(() => setStatusText('Listening...'), 2000);
      }
    } finally {
      if (!usingLiveSTTRef.current) {
        setIsProcessing(false);
      }
    }
  }, [recorderActions, onStopListening, transcribe, selectedLanguage, onTranscript, isProcessing, stopLiveListening, scheduleLiveFallback]);
  
  // Update the ref whenever handleStopAndTranscribe changes
  useEffect(() => {
    transcribeRef.current = handleStopAndTranscribe;
  }, [handleStopAndTranscribe]);
  
  // Expose TTS methods via ref
  useImperativeHandle(ref, () => ({
    speakText: async (text: string, language?: SupportedLanguage) => {
      onTTSStart?.();
      try {
        // Priority: passed language > last detected > selected > default
        const ttsLanguage = language || lastDetectedLanguage || selectedLanguage;
        console.log('[VoiceOrb] Speaking with language:', ttsLanguage);
        await speak(text, ttsLanguage);
      } finally {
        onTTSEnd?.();
      }
    },
    stopSpeaking: async () => {
      await stopSpeaking();
    },
    get isSpeaking() {
      return ttsIsSpeaking;
    },
  }), [speak, stopSpeaking, ttsIsSpeaking, selectedLanguage, onTTSStart, onTTSEnd]);
  
  // CRITICAL: Stop recording when TTS starts to prevent feedback loop (Dash hearing itself)
  useEffect(() => {
    if (ttsIsSpeaking || isSpeaking) {
      // Stop any active recording immediately when TTS starts
      if (recorderState.isRecording) {
        console.log('[VoiceOrb] 🔇 Stopping recording - TTS starting (prevent feedback)');
        recorderActions.stopRecording();
        onStopListening();
      }
      if (usingLiveSTTRef.current) {
        console.log('[VoiceOrb] 🔇 Stopping live STT - TTS starting (prevent feedback)');
        cancelLiveListening().catch(() => {});
        clearLiveTimers();
        setUsingLiveSTT(false);
        onStopListening();
      }
      setStatusText('Speaking...');
      onTTSStart?.();
    } else {
      onTTSEnd?.();
    }
  }, [ttsIsSpeaking, isSpeaking, recorderState.isRecording, recorderActions, onStopListening, onTTSStart, onTTSEnd, cancelLiveListening, clearLiveTimers]);
  
  // Auto-start listening when component mounts (only if not speaking)
  useEffect(() => {
    if (autoStartListening && !hasAutoStarted.current && !isMuted && !isSpeaking && !ttsIsSpeaking) {
      hasAutoStarted.current = true;
      console.log('[VoiceOrb] Auto-starting listening on mount...');
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        // Double-check not speaking before starting
        if (!isSpeaking && !ttsIsSpeaking) {
          handleStartRecordingRef.current?.();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStartListening, isMuted, isSpeaking, ttsIsSpeaking]);
  
  // Auto-restart listening after TTS ends (track PARENT isSpeaking state)
  const prevIsSpeaking = useRef(isSpeaking);
  useEffect(() => {
    // Detect TTS just finished (was speaking, now not speaking)
    if (prevIsSpeaking.current && !isSpeaking && !ttsIsSpeaking && autoRestartAfterTTS && !isMuted && !isProcessing) {
      console.log('[VoiceOrb] TTS finished (parent state), auto-restarting listening in 800ms...');
      // Delay before restarting to ensure TTS audio has fully stopped
      const timer = setTimeout(() => {
        // Triple-check not speaking before starting (prevent feedback)
        if (!isSpeaking && !ttsIsSpeaking) {
          console.log('[VoiceOrb] ✅ Safe to start listening - TTS confirmed stopped');
          handleStartRecordingRef.current?.();
        } else {
          console.log('[VoiceOrb] ⚠️ Skipping auto-restart - TTS still active');
        }
      }, 800);
      prevIsSpeaking.current = isSpeaking;
      return () => clearTimeout(timer);
    }
    prevIsSpeaking.current = isSpeaking;
  }, [isSpeaking, ttsIsSpeaking, autoRestartAfterTTS, isMuted, isProcessing]);

  // Always-listening mode: auto-restart after transcription completes (silence/result)
  // This makes the ORB behave like ChatGPT voice — always listening unless muted
  const prevIsProcessingRef = useRef(isProcessing);
  const prevIsParentProcessingRef = useRef(isParentProcessing);
  useEffect(() => {
    // Detect: was processing (transcribing), now idle, and not speaking
    if (prevIsProcessingRef.current && !isProcessing && !isSpeaking && !ttsIsSpeaking && !isMuted && autoRestartAfterTTS) {
      // Only restart if we're not about to start speaking (give TTS a moment to kick in)
      const timer = setTimeout(() => {
        if (!isSpeaking && !ttsIsSpeaking && !isMuted && !recorderState.isRecording && !usingLiveSTTRef.current) {
          console.log('[VoiceOrb] 🔄 Always-listening: auto-restart after transcription');
          handleStartRecordingRef.current?.();
        }
      }, 600); // 600ms — fast whisper-flow restart, provider handles auto-restart internally
      prevIsProcessingRef.current = isProcessing;
      return () => clearTimeout(timer);
    }
    prevIsProcessingRef.current = isProcessing;
  }, [isProcessing, isSpeaking, ttsIsSpeaking, isMuted, autoRestartAfterTTS, recorderState.isRecording]);

  // Always-listening mode: auto-restart after parent finishes processing (AI response + TTS done)
  // This catches the case where the ORB's internal isProcessing ends quickly but the parent
  // is still waiting for the AI response and TTS playback
  useEffect(() => {
    if (prevIsParentProcessingRef.current && !isParentProcessing && !isSpeaking && !ttsIsSpeaking && !isMuted && autoRestartAfterTTS) {
      const timer = setTimeout(() => {
        if (!isSpeaking && !ttsIsSpeaking && !isMuted && !recorderState.isRecording && !usingLiveSTTRef.current && !isParentProcessing) {
          console.log('[VoiceOrb] 🔄 Always-listening: auto-restart after parent processing done');
          handleStartRecordingRef.current?.();
        }
      }, 1000); // 1s delay after parent processing ends to let TTS finish
      prevIsParentProcessingRef.current = isParentProcessing;
      return () => clearTimeout(timer);
    }
    prevIsParentProcessingRef.current = isParentProcessing;
  }, [isParentProcessing, isSpeaking, ttsIsSpeaking, isMuted, autoRestartAfterTTS, recorderState.isRecording]);
  
  // Ref for handleStartRecording to avoid circular dependency
  const handleStartRecordingRef = useRef<(() => Promise<void>) | null>(null);
  
  // Animation values
  const coreScale = useSharedValue(1);
  const corePulse = useSharedValue(1);
  const coreRotation = useSharedValue(0);
  const glowIntensity = useSharedValue(0.5);
  
  // Derived sizes
  const coreSize = ORB_SIZE * 0.35;
  
  // Pre-generate animation data
  const particles = useMemo(() => generateParticles(8), []);
  const shootingStars = useMemo(() => generateShootingStars(3), []);
  const rings = useMemo(() => generateRings(), []);

  // ── Voice amplitude reactive animation ──────────────────────────
  // Track audio level for ORB scale reactivity
  const voiceAmplitude = useSharedValue(1);
  const prevAudioLevel = useRef(0);

  useEffect(() => {
    const level = recorderState.audioLevel;
    if ((isListening || recorderState.isRecording || usingLiveSTT) && !isMuted) {
      // Map dB level (-60..0) to scale factor (1.0..1.25)
      const normalized = Math.max(0, Math.min(1, (level + 60) / 60));
      const targetScale = 1 + normalized * 0.25;
      voiceAmplitude.value = withTiming(targetScale, { duration: 100, easing: Easing.out(Easing.quad) });
    } else {
      voiceAmplitude.value = withTiming(1, { duration: 300 });
    }
    prevAudioLevel.current = level;
  }, [recorderState.audioLevel, isListening, recorderState.isRecording, usingLiveSTT, isMuted]);

  // Also react to live speech detection (on-device STT gives no dB, but we can pulse)
  useEffect(() => {
    if (usingLiveSTT && liveTranscript.trim().length > 0) {
      // Pulse up when speech detected via live STT
      voiceAmplitude.value = withTiming(1.18, { duration: 150 });
      const timer = setTimeout(() => {
        voiceAmplitude.value = withTiming(1.05, { duration: 200 });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [liveTranscript, usingLiveSTT]);

  // Animation effects based on state
  useEffect(() => {
    if (isListening) {
      // Listening mode - gentle pulse (amplitude will modulate on top)
      corePulse.value = withRepeat(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
      glowIntensity.value = withTiming(0.9, { duration: 300 });
    } else if (isSpeaking || ttsIsSpeaking) {
      // Speaking mode - faster pulse
      corePulse.value = withRepeat(
        withTiming(1.12, { duration: 400, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
      glowIntensity.value = withTiming(1, { duration: 200 });
    } else {
      // Idle - subtle breathing
      corePulse.value = withRepeat(
        withTiming(1.03, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        -1,
        true
      );
      glowIntensity.value = withTiming(0.5, { duration: 500 });
    }
    
    // Slow rotation always
    coreRotation.value = withRepeat(
      withTiming(360, { duration: 30000, easing: Easing.linear }),
      -1,
      false
    );
    
    return () => {
      cancelAnimation(corePulse);
      cancelAnimation(coreRotation);
      cancelAnimation(glowIntensity);
    };
  }, [isListening, isSpeaking, ttsIsSpeaking]);

  // Animated styles — multiply voice amplitude for reactive ORB
  const coreAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: coreScale.value * corePulse.value * voiceAmplitude.value },
      { rotate: `${coreRotation.value}deg` },
    ],
  }));

  // Handle recording start - BLOCKS while TTS is playing to prevent feedback
  const handleStartRecording = useCallback(async () => {
    // CRITICAL: Don't start recording while TTS is playing (prevents hearing itself)
    if (isSpeaking || ttsIsSpeaking) {
      console.log('[VoiceOrb] 🚫 Blocking record start - TTS is playing (prevent feedback)');
      return;
    }
    if (isMuted || isProcessing || recorderState.isRecording || usingLiveSTTRef.current) {
      console.log('[VoiceOrb] Skipping start - muted:', isMuted, 'processing:', isProcessing, 'recording:', recorderState.isRecording);
      return;
    }
    console.log('[VoiceOrb] 🎤 Starting recording (TTS confirmed not playing)');

    if (LIVE_TRANSCRIPTION_ENABLED && liveAvailable) {
      liveSessionRef.current += 1;
      liveFinalizedRef.current = false;
      lastPartialRef.current = '';
      setLiveTranscript('');
      clearLiveTimers();
      clearLiveResults();
      setUsingLiveSTT(true);
      try {
        await startLiveListening();
        onStartListening();
        setStatusText('Listening...');
        return;
      } catch (liveError) {
        console.warn('[VoiceOrb] Live STT start failed, falling back to audio:', liveError);
        setUsingLiveSTT(false);
      }
    }

    const success = await recorderActions.startRecording();
    if (success) {
      onStartListening();
      setStatusText('Listening...');
    } else {
      setStatusText('Microphone permission denied');
      setTimeout(() => setStatusText('Listening...'), 2000);
    }
  }, [isMuted, isProcessing, recorderState.isRecording, recorderActions, onStartListening, isSpeaking, ttsIsSpeaking, liveAvailable, startLiveListening, clearLiveResults, clearLiveTimers]);
  
  // Update ref for use in effects
  useEffect(() => {
    handleStartRecordingRef.current = handleStartRecording;
  }, [handleStartRecording]);

  // Handle orb press - allows interrupting TTS
  const handlePress = async () => {
    // If TTS is playing, tap to interrupt and start listening
    if (isSpeaking || ttsIsSpeaking) {
      console.log('[VoiceOrb] 🛑 User interrupted TTS - stopping speech');
      await stopSpeaking();
      setStatusText('Interrupted');
      setTimeout(() => {
        if (
          canAutoRestartAfterInterrupt({
            isMuted,
            isProcessing,
            isRecording: recorderState.isRecording,
            usingLiveSTT: usingLiveSTTRef.current,
            isSpeaking: isSpeakingRef.current,
            ttsIsSpeaking: ttsSpeakingRef.current,
          })
        ) {
          console.log('[VoiceOrb] ✅ One-tap interrupt restart to listening');
          handleStartRecordingRef.current?.();
          setStatusText('Listening...');
        }
      }, INTERRUPT_RESTART_DELAY_MS);
      return;
    }
    
    if (isMuted) {
      setStatusText('Unmute to speak');
      setTimeout(() => setStatusText('Listening...'), 1500);
      return;
    }
    if (isListening || recorderState.isRecording || usingLiveSTTRef.current) {
      handleStopAndTranscribe();
    } else if (!isSpeaking && !ttsIsSpeaking) {
      handleStartRecording();
    }
  };

  // Handle long press to close
  const handleLongPress = () => {
    if (recorderState.isRecording) {
      recorderActions.stopRecording();
      onStopListening();
    }
    if (usingLiveSTTRef.current) {
      cancelLiveListening().catch(() => {});
      clearLiveTimers();
      setUsingLiveSTT(false);
      onStopListening();
    }
    stopSpeaking();
    setStatusText('Listening...');
  };

  // Determine glow color based on state
  const glowColor = isListening 
    ? COLORS.listening 
    : (isSpeaking || ttsIsSpeaking) 
      ? COLORS.speaking 
      : COLORS.violet;
  const liveHasSpeech = liveTranscript.trim().length > 0;
  const speechActive = usingLiveSTT ? liveHasSpeech : recorderState.hasSpeechStarted;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={[styles.orbContainer, { width: ORB_SIZE, height: ORB_SIZE }]}
      >
        {/* Pulsing rings */}
        {rings.map((ring, index) => (
          <PulsingRing key={`ring-${index}`} {...ring} />
        ))}
        
        {/* Shooting stars */}
        {shootingStars.map((star, index) => (
          <ShootingStar key={`star-${index}`} {...star} />
        ))}
        
        {/* Core orb */}
        <Animated.View 
          style={[
            styles.coreContainer, 
            { width: coreSize, height: coreSize, borderRadius: coreSize / 2 },
            coreAnimatedStyle
          ]}
        >
          <LinearGradient
            colors={[glowColor, COLORS.corePink, COLORS.purple]}
            style={[styles.core, { width: coreSize, height: coreSize, borderRadius: coreSize / 2 }]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
          >
            <Image
              source={require('@/assets/branding/png/icon-192.png')}
              style={[styles.logo, { width: coreSize * 0.55, height: coreSize * 0.55 }]}
              resizeMode="contain"
            />
            <View style={[styles.coreHighlight, { width: coreSize * 0.35, height: coreSize * 0.12 }]} />
          </LinearGradient>
        </Animated.View>
        
        {/* Floating particles */}
        {particles.map((particle, index) => (
          <FloatingParticle key={`particle-${index}`} {...particle} />
        ))}
      </TouchableOpacity>
      
      {/* Status text — only show when there's something meaningful */}
      {(isMuted || isTranscribing || statusText === 'No speech detected' || statusText === 'Microphone permission denied') ? (
        <Text style={[styles.statusText, { color: isMuted ? '#ef4444' : theme.textSecondary }]}>
          {isMuted ? 'Muted' : isTranscribing ? 'Transcribing...' : statusText}
        </Text>
      ) : (isListening || recorderState.isRecording || usingLiveSTT) && !isMuted ? (
        <Text style={[styles.statusText, { color: speechActive ? COLORS.listening : theme.textSecondary }]}>
          {speechActive ? 'Hearing you...' : 'Listening...'}
        </Text>
      ) : (isSpeaking || ttsIsSpeaking) ? (
        <Text style={[styles.statusText, { color: COLORS.speaking }]}>Speaking...</Text>
      ) : null}

      {usingLiveSTT && liveHasSpeech && (
        <View style={styles.liveTranscriptContainer}>
          <Text style={[styles.liveTranscriptText, { color: theme.text }]} numberOfLines={4}>
            {liveTranscript}
          </Text>
        </View>
      )}
      
      {/* Mic mute/unmute button — always visible */}
      <TouchableOpacity
        onPress={() => setIsMuted(!isMuted)}
        style={[
          styles.muteButton,
          {
            borderColor: isMuted ? '#ef4444' : theme.border,
            backgroundColor: isMuted ? '#ef444420' : 'transparent',
            marginTop: 16,
          }
        ]}
      >
        <Ionicons
          name={isMuted ? 'mic-off' : 'mic'}
          size={22}
          color={isMuted ? '#ef4444' : theme.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
});

VoiceOrb.displayName = 'VoiceOrb';

const MemoizedVoiceOrb = memo(VoiceOrb);

export default MemoizedVoiceOrb;
