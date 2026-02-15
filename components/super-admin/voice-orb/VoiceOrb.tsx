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
import { formatTranscript } from '@/lib/voice/formatTranscript';

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
import { useVoiceTTS, type TTSOptions } from './useVoiceTTS';
import { canAutoRestartAfterInterrupt, INTERRUPT_RESTART_DELAY_MS } from './interrupt';

// ============================================================================
// Types
// ============================================================================

export interface VoiceOrbRef {
  /** Speak text using TTS */
  speakText: (text: string, language?: SupportedLanguage, options?: TTSOptions) => Promise<void>;
  /** Stop TTS playback */
  stopSpeaking: () => Promise<void>;
  /** Get current speaking state */
  isSpeaking: boolean;
}

export interface VoiceTranscriptMeta {
  source: 'live' | 'recorded';
  capturedAt: number;
  audioBase64?: string;
  audioContentType?: string;
}

interface VoiceOrbProps {
  isListening: boolean;
  isSpeaking: boolean;
  /** Whether the parent screen is processing (waiting for AI response). Used for auto-restart. */
  isParentProcessing?: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onTranscript: (text: string, language?: SupportedLanguage, meta?: VoiceTranscriptMeta) => void;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
  /** Called when TTS starts */
  onTTSStart?: () => void;
  /** Called when TTS ends */
  onTTSEnd?: () => void;
  /** Called when voice capture/transcription fails */
  onVoiceError?: (message: string) => void;
  /** Called when user changes language */
  onLanguageChange?: (lang: SupportedLanguage) => void;
  /** Externally set language (from parent language dropdown) */
  language?: SupportedLanguage;
  /** Optional orb size override for compact layouts */
  size?: number;
  /** Auto-start listening when component mounts (default: true) */
  autoStartListening?: boolean;
  /** Auto-restart listening after TTS ends (default: true) */
  autoRestartAfterTTS?: boolean;
  /** Preschool mode: longer silence timeout, lower speech threshold for children */
  preschoolMode?: boolean;
  /** Show the live transcription bubble while listening (default: true). */
  showLiveTranscript?: boolean;
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
  onVoiceError,
  onLanguageChange,
  language: externalLanguage,
  size = ORB_SIZE,
  autoStartListening = true,
  autoRestartAfterTTS = true,
  preschoolMode = false,
  showLiveTranscript = true,
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
  // Perceived latency is dominated by "silence → final transcript → send".
  // Keep preschool more forgiving, but default faster for staff/older learners.
  const defaultLiveSilenceMs = preschoolMode ? 3200 : 1800;
  const liveSilenceTimeoutRaw = Number.parseInt(
    process.env.EXPO_PUBLIC_VOICE_LIVE_SILENCE_TIMEOUT_MS || String(defaultLiveSilenceMs),
    10
  );
  const liveSilenceMin = preschoolMode ? 1800 : 1200;
  const LIVE_SILENCE_TIMEOUT_MS = Number.isFinite(liveSilenceTimeoutRaw)
    ? Math.min(12000, Math.max(liveSilenceMin, liveSilenceTimeoutRaw))
    : defaultLiveSilenceMs;
  const LIVE_FINAL_FALLBACK_MS = preschoolMode ? 1100 : 650;
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
  
  const [recorderState, recorderActions] = useVoiceRecorder(handleSilenceDetected, preschoolMode
    ? { speechThreshold: -35, silenceDuration: 4000 }
    : undefined,
  );
  const { transcribe, isTranscribing, error: sttError } = useVoiceSTT({ preschoolId: tenantId });
  const { speak, stop: stopSpeaking, isSpeaking: ttsIsSpeaking, error: ttsError } = useVoiceTTS();
  const isSpeakingRef = useRef(isSpeaking);
  const ttsSpeakingRef = useRef(ttsIsSpeaking);
  const skipNextAutoRestartRef = useRef(false);
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

  useEffect(() => {
    if (!sttError) return;
    setStatusText('Voice recognition error');
    onVoiceError?.(sttError);
    const timer = setTimeout(() => setStatusText('Listening...'), 2500);
    return () => clearTimeout(timer);
  }, [sttError, onVoiceError]);

  useEffect(() => {
    if (!ttsError) return;
    skipNextAutoRestartRef.current = true;
    setStatusText('Voice synthesis error');
    onVoiceError?.(ttsError);
    const timer = setTimeout(() => setStatusText('Listening...'), 3000);
    return () => clearTimeout(timer);
  }, [ttsError, onVoiceError]);

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
      setStatusText('Voice recognition error');
      onVoiceError?.(errorMsg);
    },
  });

  const finalizeLiveTranscript = useCallback((text: string) => {
    if (liveFinalizedRef.current) return;
    liveFinalizedRef.current = true;
    clearLiveTimers();
    setUsingLiveSTT(false);
    setIsProcessing(false);

    const formatted = formatTranscript(text || '', selectedLanguage, {
      whisperFlow: true,
      summarize: true,
      preschoolMode: (profile as any)?.school_type === 'preschool' || (profile as any)?.organization_type === 'preschool',
      maxSummaryWords: 16,
    });
    const cleaned = formatted.trim();
    if (cleaned) {
      setLastDetectedLanguage(selectedLanguage);
      onTranscript(cleaned, selectedLanguage, {
        source: 'live',
        capturedAt: Date.now(),
      });
      setStatusText('Listening...');
      return;
    }

    const fallback = formatTranscript(lastPartialRef.current, selectedLanguage, {
      whisperFlow: true,
      summarize: true,
      preschoolMode: (profile as any)?.school_type === 'preschool' || (profile as any)?.organization_type === 'preschool',
      maxSummaryWords: 16,
    }).trim();
    if (fallback) {
      setLastDetectedLanguage(selectedLanguage);
      onTranscript(fallback, selectedLanguage, {
        source: 'live',
        capturedAt: Date.now(),
      });
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
      const result = await transcribe(uri, sttLanguage, { includeAudioBase64: true });
      
      if (result?.text) {
        const detected = result.language;
        if (detected === 'en-ZA' || detected === 'af-ZA' || detected === 'zu-ZA') {
          setLastDetectedLanguage(detected);
        }
        onTranscript(
          result.text,
          result.language as SupportedLanguage | undefined,
          {
            source: 'recorded',
            capturedAt: Date.now(),
            audioBase64: result.audio_base64,
            audioContentType: result.audio_content_type,
          }
        );
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

  const suspendListeningForTTS = useCallback(async () => {
    if (recorderState.isRecording) {
      try {
        await recorderActions.stopRecording();
      } catch (stopError) {
        console.warn('[VoiceOrb] Failed to stop recorder before TTS:', stopError);
      }
    }
    if (usingLiveSTTRef.current) {
      try {
        await cancelLiveListening();
      } catch (stopError) {
        console.warn('[VoiceOrb] Failed to cancel live STT before TTS:', stopError);
      }
      clearLiveTimers();
      setUsingLiveSTT(false);
    }
    onStopListening();
    setStatusText('Speaking...');
  }, [cancelLiveListening, clearLiveTimers, onStopListening, recorderActions, recorderState.isRecording]);
  
  // Update the ref whenever handleStopAndTranscribe changes
  useEffect(() => {
    transcribeRef.current = handleStopAndTranscribe;
  }, [handleStopAndTranscribe]);
  
  // Expose TTS methods via ref
  useImperativeHandle(ref, () => ({
    speakText: async (text: string, language?: SupportedLanguage, options?: TTSOptions) => {
      await suspendListeningForTTS();
      onTTSStart?.();
      try {
        // Priority: passed language > last detected > selected > default
        const ttsLanguage = language || lastDetectedLanguage || selectedLanguage;
        console.log('[VoiceOrb] Speaking with language:', ttsLanguage);
        await speak(text, ttsLanguage, options);
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
  }), [speak, stopSpeaking, ttsIsSpeaking, selectedLanguage, onTTSStart, onTTSEnd, suspendListeningForTTS]);
  
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
  
  // Auto-restart listening after local TTS confirms stop transition.
  const prevTtsSpeaking = useRef(ttsIsSpeaking);
  useEffect(() => {
    // Detect real TTS stop transition (was speaking, now stopped)
    if (prevTtsSpeaking.current && !ttsIsSpeaking && !isSpeaking && autoRestartAfterTTS && !isMuted && !isProcessing) {
      if (skipNextAutoRestartRef.current) {
        skipNextAutoRestartRef.current = false;
        prevTtsSpeaking.current = ttsIsSpeaking;
        return;
      }
      console.log('[VoiceOrb] TTS finished (confirmed stop), auto-restarting listening in 800ms...');
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
      prevTtsSpeaking.current = ttsIsSpeaking;
      return () => clearTimeout(timer);
    }
    prevTtsSpeaking.current = ttsIsSpeaking;
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
  const orbSize = Math.max(110, size);
  const ringThickness = Math.max(10, Math.round(orbSize * 0.08));
  const innerSize = orbSize - ringThickness * 2;
  const coreSize = Math.max(44, Math.round(orbSize * 0.32));
  
  // Pre-generate animation data
  const particles = useMemo(() => generateParticles(10, orbSize), [orbSize]);
  const shootingStars = useMemo(() => generateShootingStars(4, orbSize), [orbSize]);
  const rings = useMemo(() => generateRings(orbSize), [orbSize]);
  const starfield = useMemo(() => {
    const count = Math.max(26, Math.min(56, Math.round(orbSize * 0.22)));
    const radius = innerSize / 2;
    const colors = [COLORS.starlight, COLORS.lavender, COLORS.particle, COLORS.shooting] as const;

    return Array.from({ length: count }).map((_, idx) => {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * radius * 0.92;
      const x = radius + Math.cos(angle) * dist;
      const y = radius + Math.sin(angle) * dist;
      const size = 1 + Math.random() * 2.2;
      const opacity = 0.35 + Math.random() * 0.55;
      const color = colors[idx % colors.length];
      return { x, y, size, opacity, color };
    });
  }, [innerSize, orbSize]);

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
    
    // Rotation: faster when thinking/speaking, slower when idle.
    const rotationMs = isParentProcessing
      ? 9000
      : (isSpeaking || ttsIsSpeaking)
        ? 14000
        : isListening
          ? 24000
          : 42000;
    coreRotation.value = withRepeat(
      withTiming(360, { duration: rotationMs, easing: Easing.linear }),
      -1,
      false
    );
    
    return () => {
      cancelAnimation(corePulse);
      cancelAnimation(coreRotation);
      cancelAnimation(glowIntensity);
    };
  }, [isListening, isSpeaking, ttsIsSpeaking, isParentProcessing]);

  // Animated styles — multiply voice amplitude for reactive ORB
  const orbScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coreScale.value * corePulse.value * voiceAmplitude.value }] as any,
  }));

  const ringRotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${coreRotation.value}deg` }] as any,
  }));

  const auraRotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-coreRotation.value * 0.65}deg` }] as any,
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
        onVoiceError?.(liveError instanceof Error ? liveError.message : 'Live voice recognition unavailable');
        setUsingLiveSTT(false);
      }
    }

    const success = await recorderActions.startRecording();
    if (success) {
      onStartListening();
      setStatusText('Listening...');
    } else {
      setStatusText('Microphone permission denied');
      onVoiceError?.('Microphone permission denied');
      setTimeout(() => setStatusText('Listening...'), 2000);
    }
  }, [isMuted, isProcessing, recorderState.isRecording, recorderActions, onStartListening, isSpeaking, ttsIsSpeaking, liveAvailable, startLiveListening, clearLiveResults, clearLiveTimers, onVoiceError]);
  
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
  const liveHasSpeech = liveTranscript.trim().length > 0;
  const listeningActive = isListening || recorderState.isRecording || usingLiveSTT;
  const speechActive = usingLiveSTT ? liveHasSpeech : recorderState.hasSpeechStarted;

  // Per UX:
  // - Idle / waiting for speech: white core
  // - Listening and hearing speech: green core
  // - Speaking: red core
  const isCurrentlySpeaking = isSpeaking || ttsIsSpeaking;
  const coreColor = isCurrentlySpeaking
    ? '#ef4444'
    : (listeningActive && speechActive)
      ? COLORS.listening
      : 'rgba(255, 255, 255, 0.98)';

  // Keep the core glow readable. Idle keeps a subtle violet halo.
  const glowColor = isCurrentlySpeaking
    ? coreColor
    : (listeningActive && speechActive)
      ? coreColor
      : COLORS.violet;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={[styles.orbContainer, { width: orbSize, height: orbSize }]}
      >
        {/* Pulsing rings */}
        {rings.map((ring, index) => (
          <PulsingRing key={`ring-${index}`} {...ring} />
        ))}
        
        {/* Shooting stars */}
        {shootingStars.map((star, index) => (
          <ShootingStar key={`star-${index}`} {...star} />
        ))}
        
        {/* Next-Gen Orb Core (cosmic ring + starfield) */}
        <Animated.View
          style={[
            styles.orbShell,
            { width: orbSize, height: orbSize, borderRadius: orbSize / 2 },
            orbScaleStyle,
          ]}
        >
          <Animated.View
            style={[
              styles.ringShell,
              { width: orbSize, height: orbSize, borderRadius: orbSize / 2, padding: ringThickness },
              ringRotateStyle,
            ]}
          >
            <LinearGradient
              colors={['#ff6ad5', '#c774e8', '#6ee7ff', '#ffd670', '#ff6ad5']}
              style={[styles.ringGradient, { borderRadius: orbSize / 2 }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View
              style={[
                styles.innerSphere,
                {
                  width: innerSize,
                  height: innerSize,
                  borderRadius: innerSize / 2,
                },
              ]}
            >
              {/* Starfield */}
              {starfield.map((s0, idx) => (
                <View
                  key={`star-${idx}`}
                  style={[
                    styles.star,
                    {
                      left: s0.x - s0.size / 2,
                      top: s0.y - s0.size / 2,
                      width: s0.size,
                      height: s0.size,
                      borderRadius: s0.size / 2,
                      opacity: s0.opacity,
                      backgroundColor: s0.color,
                    },
                  ]}
                />
              ))}

              {/* Aurora overlay */}
              <Animated.View style={[styles.auroraOverlay, auraRotateStyle]}>
                <LinearGradient
                  colors={['rgba(255,106,213,0.20)', 'transparent', 'rgba(110,231,255,0.20)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.auroraGradient}
                />
              </Animated.View>

              {/* Center "voice core" */}
              <View
                style={[
                  styles.centerCore,
                  {
                    width: coreSize,
                    height: coreSize,
                    borderRadius: coreSize / 2,
                    backgroundColor: coreColor,
                    shadowColor: glowColor,
                  },
                ]}
              />
              <View
                style={[
                  styles.centerCoreHighlight,
                  {
                    width: Math.round(coreSize * 0.42),
                    height: Math.round(coreSize * 0.16),
                    borderRadius: 999,
                  },
                ]}
              />
            </View>
          </Animated.View>
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
      ) : null}

      {showLiveTranscript && usingLiveSTT && liveHasSpeech && (
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
