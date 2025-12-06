/**
 * VoiceRecorderWithWaveform
 * 
 * Enhanced voice recorder with real-time animated waveform visualization
 * using expo-av audio metering. WhatsApp-style hold-to-record interface.
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Vibration,
  Platform,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Number of waveform bars to display
const WAVEFORM_BAR_COUNT = 24;
const MIN_RECORDING_DURATION = 500; // Minimum 500ms recording
const CANCEL_THRESHOLD = -100; // Slide left 100px to cancel
const METERING_UPDATE_INTERVAL = 50; // ms between metering updates

interface VoiceRecorderWithWaveformProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onRecordingCancel?: () => void;
  onRecordingStart?: () => void;
  disabled?: boolean;
  size?: number;
  theme?: {
    primary: string;
    secondary: string;
    error: string;
    textPrimary: string;
    textSecondary: string;
    surface: string;
    onPrimary: string;
  };
}

// Default theme
const defaultTheme = {
  primary: '#7c3aed',
  secondary: '#ec4899',
  error: '#ef4444',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  surface: '#1e293b',
  onPrimary: '#ffffff',
};

// Format duration in mm:ss
const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const VoiceRecorderWithWaveform: React.FC<VoiceRecorderWithWaveformProps> = ({
  onRecordingComplete,
  onRecordingCancel,
  onRecordingStart,
  disabled = false,
  size = 48,
  theme = defaultTheme,
}) => {
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [slideOffset, setSlideOffset] = useState(0);
  const [meteringValues, setMeteringValues] = useState<number[]>(
    Array(WAVEFORM_BAR_COUNT).fill(0)
  );
  
  // Refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingStartTime = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const meteringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const cancelOpacity = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(1)).current;
  const waveformAnims = useRef<Animated.Value[]>(
    Array(WAVEFORM_BAR_COUNT).fill(0).map(() => new Animated.Value(0.1))
  ).current;

  // Glow animation loop when recording
  useEffect(() => {
    let glowAnimation: Animated.CompositeAnimation | null = null;
    
    if (isRecording) {
      glowAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      glowAnimation.start();
    } else {
      glowAnim.setValue(1);
    }

    return () => {
      if (glowAnimation) {
        glowAnimation.stop();
      }
    };
  }, [isRecording, glowAnim]);

  // Animate waveform bars based on metering values
  useEffect(() => {
    meteringValues.forEach((value, index) => {
      Animated.spring(waveformAnims[index], {
        toValue: Math.max(0.1, value),
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    });
  }, [meteringValues, waveformAnims]);

  // Process metering value and update waveform
  const updateMeteringValue = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      const status = await recordingRef.current.getStatusAsync();
      
      if (status.isRecording && status.metering !== undefined) {
        // Convert dB to normalized value (0-1)
        // Metering typically ranges from -160dB (silence) to 0dB (max)
        const db = status.metering;
        const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
        
        // Shift values left and add new value at the end
        setMeteringValues(prev => {
          const newValues = [...prev.slice(1), normalized];
          return newValues;
        });
      }
    } catch (error) {
      // Ignore errors during metering
    }
  }, []);

  const startRecording = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('Audio recording permissions not granted');
        return;
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create recording with metering enabled
      const recordingOptions: Audio.RecordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        android: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
        },
        ios: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
        isMeteringEnabled: true,
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      
      recordingRef.current = recording;
      recordingStartTime.current = Date.now();
      setIsRecording(true);
      setRecordingDuration(0);
      setMeteringValues(Array(WAVEFORM_BAR_COUNT).fill(0));
      
      // Vibrate to indicate start
      Vibration.vibrate(50);
      
      // Notify parent
      onRecordingStart?.();

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Date.now() - recordingStartTime.current);
      }, 100);

      // Start metering updates
      meteringIntervalRef.current = setInterval(updateMeteringValue, METERING_UPDATE_INTERVAL);

      // Scale up animation
      Animated.spring(scaleAnim, {
        toValue: 1.3,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      // Show cancel hint
      Animated.timing(cancelOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = async (cancelled: boolean = false) => {
    if (!recordingRef.current) return;

    // Clear intervals
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }

    const duration = Date.now() - recordingStartTime.current;

    try {
      await recordingRef.current.stopAndUnloadAsync();

      if (cancelled || duration < MIN_RECORDING_DURATION) {
        // Recording cancelled or too short
        Vibration.vibrate(30);
        onRecordingCancel?.();
      } else {
        // Recording complete
        const uri = recordingRef.current.getURI();
        if (uri) {
          Vibration.vibrate([0, 30, 50, 30]); // Success vibration pattern
          onRecordingComplete(uri, duration);
        }
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    } finally {
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
      setSlideOffset(0);
      setMeteringValues(Array(WAVEFORM_BAR_COUNT).fill(0));

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      // Reset animations
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(cancelOpacity, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  // Pan responder for slide-to-cancel
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return isRecording && gestureState.dx < -10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          const offset = Math.max(gestureState.dx, CANCEL_THRESHOLD * 1.5);
          setSlideOffset(offset);
          slideAnim.setValue(offset);

          // Change cancel hint opacity based on slide progress
          const progress = Math.min(Math.abs(offset) / Math.abs(CANCEL_THRESHOLD), 1);
          cancelOpacity.setValue(1 + progress);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < CANCEL_THRESHOLD) {
          // Cancelled
          stopRecording(true);
        }
        setSlideOffset(0);
        slideAnim.setValue(0);
      },
    })
  ).current;

  const handlePressIn = useCallback(() => {
    if (!disabled && !isRecording) {
      startRecording();
    }
  }, [disabled, isRecording]);

  const handlePressOut = useCallback(() => {
    if (isRecording && slideOffset > CANCEL_THRESHOLD) {
      stopRecording(false);
    }
  }, [isRecording, slideOffset]);

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    recordingOverlay: {
      position: 'absolute',
      right: size + 16,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    waveformContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 32,
      gap: 2,
      marginRight: 12,
    },
    waveformBar: {
      width: 3,
      borderRadius: 2,
      backgroundColor: theme.secondary,
    },
    recordingTime: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.error,
      marginLeft: 8,
      fontVariant: ['tabular-nums'],
    },
    recordingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.error,
    },
    cancelHint: {
      position: 'absolute',
      right: size + 200,
      flexDirection: 'row',
      alignItems: 'center',
    },
    cancelText: {
      fontSize: 13,
      color: theme.textSecondary,
      marginLeft: 4,
    },
    micButton: {
      width: size,
      height: size,
      borderRadius: size / 2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    micButtonGlow: {
      shadowColor: theme.secondary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 12,
      elevation: 8,
    },
  });

  // Animated pulse for recording dot
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    let pulseAnimation: Animated.CompositeAnimation | null = null;
    
    if (isRecording) {
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
    }

    return () => {
      if (pulseAnimation) {
        pulseAnimation.stop();
      }
    };
  }, [isRecording, pulseAnim]);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Cancel hint */}
      {isRecording && (
        <Animated.View
          style={[
            styles.cancelHint,
            {
              opacity: cancelOpacity,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <Ionicons name="chevron-back" size={16} color={theme.textSecondary} />
          <Text style={styles.cancelText}>Slide to cancel</Text>
        </Animated.View>
      )}

      {/* Recording overlay with waveform */}
      {isRecording && (
        <Animated.View
          style={[
            styles.recordingOverlay,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          {/* Real-time waveform */}
          <View style={styles.waveformContainer}>
            {waveformAnims.map((anim, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    transform: [{ scaleY: anim }],
                    height: 24,
                    opacity: Animated.add(0.4, Animated.multiply(anim, 0.6)),
                  },
                ]}
              />
            ))}
          </View>

          {/* Recording indicator */}
          <Animated.View
            style={[
              styles.recordingDot,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />

          <Text style={styles.recordingTime}>
            {formatDuration(recordingDuration)}
          </Text>
        </Animated.View>
      )}

      {/* Record button with glow */}
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
      >
        <Animated.View
          style={[
            styles.micButtonGlow,
            {
              transform: [
                { scale: isRecording ? scaleAnim : glowAnim },
                { translateX: slideAnim },
              ],
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        >
          <LinearGradient
            colors={
              isRecording
                ? [theme.error, '#dc2626']
                : [theme.primary, theme.secondary]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.micButton}
          >
            <Ionicons
              name={isRecording ? 'mic' : 'mic-outline'}
              size={size * 0.5}
              color={theme.onPrimary}
            />
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

export default VoiceRecorderWithWaveform;
