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

import React, { useState, useMemo, useCallback, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
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
import { useVoiceSTT, SUPPORTED_LANGUAGES, SupportedLanguage } from './useVoiceSTT';
import { useVoiceTTS } from './useVoiceTTS';

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
  onStartListening: () => void;
  onStopListening: () => void;
  onTranscript: (text: string) => void;
  onSpeakStart?: () => void;
  onSpeakEnd?: () => void;
  /** Called when TTS starts */
  onTTSStart?: () => void;
  /** Called when TTS ends */
  onTTSEnd?: () => void;
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
  onStartListening,
  onStopListening,
  onTranscript,
  onSpeakStart,
  onSpeakEnd,
  onTTSStart,
  onTTSEnd,
  autoStartListening = true,
  autoRestartAfterTTS = true,
}, ref) => {
  const { theme } = useTheme();
  const [statusText, setStatusText] = useState('Starting...');
  const hasAutoStarted = useRef(false);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en-ZA');
  const [isMuted, setIsMuted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Prevent double-processing
  
  // Ref to hold the latest transcribe function
  const transcribeRef = useRef<((uri: string) => Promise<void>) | null>(null);
  
  // Voice hooks - pass a stable callback
  const handleSilenceDetected = useCallback(() => {
    transcribeRef.current?.('silence');
  }, []);
  
  const [recorderState, recorderActions] = useVoiceRecorder(handleSilenceDetected);
  const { transcribe, isTranscribing } = useVoiceSTT();
  const { speak, stop: stopSpeaking, isSpeaking: ttsIsSpeaking } = useVoiceTTS();

  // Handle recording stop and transcribe
  const handleStopAndTranscribe = useCallback(async () => {
    if (isProcessing) return; // Prevent double calls
    setIsProcessing(true);
    
    try {
      const uri = await recorderActions.stopRecording();
      onStopListening();
      
      if (!uri) {
        setStatusText('No audio recorded');
        setTimeout(() => setStatusText('Tap to speak'), 2000);
        return;
      }
      
      setStatusText('Transcribing...');
      const result = await transcribe(uri, selectedLanguage);
      
      if (result?.text) {
        onTranscript(result.text);
        setStatusText('Tap to speak');
      } else {
        setStatusText('No speech detected');
        setTimeout(() => setStatusText('Tap to speak'), 2000);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [recorderActions, onStopListening, transcribe, selectedLanguage, onTranscript, isProcessing]);
  
  // Update the ref whenever handleStopAndTranscribe changes
  useEffect(() => {
    transcribeRef.current = handleStopAndTranscribe;
  }, [handleStopAndTranscribe]);
  
  // Expose TTS methods via ref
  useImperativeHandle(ref, () => ({
    speakText: async (text: string) => {
      onTTSStart?.();
      try {
        await speak(text, selectedLanguage);
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
      setStatusText('Speaking...');
      onTTSStart?.();
    } else {
      onTTSEnd?.();
    }
  }, [ttsIsSpeaking, isSpeaking, recorderState.isRecording, recorderActions, onStopListening, onTTSStart, onTTSEnd]);
  
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

  // Animation effects based on state
  useEffect(() => {
    if (isListening) {
      // Listening mode - gentle pulse
      corePulse.value = withRepeat(
        withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.sin) }),
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

  // Animated styles
  const coreAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: coreScale.value * corePulse.value },
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
    if (isMuted || isProcessing || recorderState.isRecording) {
      console.log('[VoiceOrb] Skipping start - muted:', isMuted, 'processing:', isProcessing, 'recording:', recorderState.isRecording);
      return;
    }
    console.log('[VoiceOrb] 🎤 Starting recording (TTS confirmed not playing)');
    const success = await recorderActions.startRecording();
    if (success) {
      onStartListening();
      setStatusText('Listening...');
    } else {
      setStatusText('Microphone permission denied');
      setTimeout(() => setStatusText('Tap to speak'), 2000);
    }
  }, [isMuted, isProcessing, recorderState.isRecording, recorderActions, onStartListening, isSpeaking, ttsIsSpeaking]);
  
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
      setStatusText('Interrupted - tap to speak');
      // Don't auto-start after interrupt - let user tap again
      return;
    }
    
    if (isMuted) {
      setStatusText('Unmute to speak');
      setTimeout(() => setStatusText('Tap to speak'), 1500);
      return;
    }
    if (isListening || recorderState.isRecording) {
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
    stopSpeaking();
    setStatusText('Tap to speak');
  };

  // Determine glow color based on state
  const glowColor = isListening 
    ? COLORS.listening 
    : (isSpeaking || ttsIsSpeaking) 
      ? COLORS.speaking 
      : COLORS.violet;

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
      
      {/* Status text */}
      <Text style={[styles.statusText, { color: isMuted ? '#ef4444' : theme.textSecondary }]}>
        {isMuted ? '🔇 Muted' : isTranscribing ? 'Transcribing...' : statusText}
      </Text>
      
      {/* Speech indicator */}
      {(isListening || recorderState.isRecording) && !isMuted && (
        <Text style={[styles.speechIndicator, { color: recorderState.hasSpeechStarted ? COLORS.listening : theme.textTertiary }]}>
          {recorderState.hasSpeechStarted ? '🎤 Hearing you...' : '🔇 Waiting for speech...'}
        </Text>
      )}
      
      {/* Controls row - mute and language selector */}
      {!isListening && !recorderState.isRecording && !isSpeaking && !ttsIsSpeaking && (
        <View style={styles.controlsRow}>
          {/* Mute toggle */}
          <TouchableOpacity
            onPress={() => setIsMuted(!isMuted)}
            style={[
              styles.muteButton,
              {
                borderColor: isMuted ? '#ef4444' : theme.border,
                backgroundColor: isMuted ? '#ef444420' : 'transparent',
              }
            ]}
          >
            <Text style={[styles.muteButtonText, { color: isMuted ? '#ef4444' : theme.textSecondary }]}>
              {isMuted ? '🔇' : '🔊'}
            </Text>
          </TouchableOpacity>
          
          {/* Language selector */}
          <View style={styles.languageSelector}>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                onPress={() => setSelectedLanguage(lang.code)}
                style={[
                  styles.languageOption,
                  selectedLanguage === lang.code && styles.languageOptionSelected,
                  { 
                    borderColor: selectedLanguage === lang.code ? COLORS.violet : theme.border,
                    backgroundColor: selectedLanguage === lang.code ? `${COLORS.violet}20` : 'transparent',
                  }
                ]}
              >
                <Text style={[
                  styles.languageText,
                  { color: selectedLanguage === lang.code ? COLORS.violet : theme.textSecondary }
                ]}>
                  {lang.code === 'en-ZA' ? 'EN' : lang.code === 'af-ZA' ? 'AF' : 'ZU'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      
      {/* Hint text */}
      <Text style={[styles.hintText, { color: theme.textTertiary || theme.textSecondary }]}>
        Long press to close
      </Text>
    </View>
  );
});

VoiceOrb.displayName = 'VoiceOrb';

export default VoiceOrb;
