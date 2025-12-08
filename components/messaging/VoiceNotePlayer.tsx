/**
 * VoiceNotePlayer
 * 
 * WhatsApp-style voice note player with animated waveform visualization,
 * playback controls, and seek functionality for React Native.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const WAVEFORM_BAR_COUNT = 32;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VoiceNotePlayerProps {
  url: string;
  duration?: number; // in ms
  isOwn?: boolean;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: Error) => void;
  theme?: {
    primary: string;
    secondary: string;
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

// Generate fake waveform pattern for visualization
const generateWaveformBars = (count: number): number[] => {
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    // Create a smooth wave pattern with some randomness
    const base = Math.sin((i / count) * Math.PI) * 0.5 + 0.5;
    const randomness = Math.random() * 0.3;
    bars.push(Math.max(0.2, Math.min(1, base + randomness)));
  }
  return bars;
};

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  url,
  duration,
  isOwn = false,
  onPlaybackStart,
  onPlaybackEnd,
  onError,
  theme = defaultTheme,
}) => {
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [progress, setProgress] = useState(0);
  
  // Refs
  const soundRef = useRef<Audio.Sound | null>(null);
  const waveformBars = useRef<number[]>(generateWaveformBars(WAVEFORM_BAR_COUNT)).current;
  
  // Animation values
  const playButtonScale = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Load audio on mount
  useEffect(() => {
    let isMounted = true;

    const loadAudio = async () => {
      try {
        // Configure audio mode for playback
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        // Create and load sound
        const { sound, status } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: false },
          onPlaybackStatusUpdate
        );

        if (!isMounted) {
          sound.unloadAsync();
          return;
        }

        soundRef.current = sound;
        
        if (status.isLoaded) {
          setTotalDuration(status.durationMillis || duration || 0);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[VoiceNotePlayer] Failed to load audio:', error);
        if (isMounted) {
          setIsLoading(false);
          onError?.(error as Error);
        }
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [url, duration, onError]);

  // Playback status update handler
  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setCurrentPosition(status.positionMillis);
    
    if (status.durationMillis) {
      const newProgress = status.positionMillis / status.durationMillis;
      setProgress(newProgress);
      progressAnim.setValue(newProgress);
    }

    if (status.didJustFinish) {
      setIsPlaying(false);
      setCurrentPosition(0);
      setProgress(0);
      progressAnim.setValue(0);
      onPlaybackEnd?.();
    }
  }, [onPlaybackEnd, progressAnim]);

  // Toggle playback
  const togglePlayback = useCallback(async () => {
    if (!soundRef.current || isLoading) return;

    // Button press animation
    Animated.sequence([
      Animated.timing(playButtonScale, {
        toValue: 0.9,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.spring(playButtonScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }),
    ]).start();

    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        // Reset to beginning if finished
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.positionMillis === status.durationMillis) {
          await soundRef.current.setPositionAsync(0);
        }
        
        await soundRef.current.playAsync();
        setIsPlaying(true);
        onPlaybackStart?.();
      }
    } catch (error) {
      console.error('[VoiceNotePlayer] Playback error:', error);
      onError?.(error as Error);
    }
  }, [isPlaying, isLoading, onPlaybackStart, onError, playButtonScale]);

  // Seek to position
  const seekToPosition = useCallback(async (percentage: number) => {
    if (!soundRef.current || isLoading) return;

    try {
      const position = Math.floor(percentage * totalDuration);
      await soundRef.current.setPositionAsync(position);
      setCurrentPosition(position);
      setProgress(percentage);
      progressAnim.setValue(percentage);
    } catch (error) {
      console.error('[VoiceNotePlayer] Seek error:', error);
    }
  }, [totalDuration, isLoading, progressAnim]);

  // Pan responder for waveform seeking
  const waveformWidth = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const percentage = Math.max(0, Math.min(1, x / waveformWidth.current));
        seekToPosition(percentage);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const percentage = Math.max(0, Math.min(1, x / waveformWidth.current));
        seekToPosition(percentage);
      },
    })
  ).current;

  // Determine display time
  const displayTime = isPlaying || currentPosition > 0
    ? formatDuration(currentPosition)
    : formatDuration(totalDuration);

  // Color variants based on ownership
  const primaryColor = isOwn ? theme.onPrimary : theme.primary;
  const secondaryColor = isOwn
    ? 'rgba(255, 255, 255, 0.4)'
    : 'rgba(124, 58, 237, 0.4)';

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minWidth: 200,
      maxWidth: 280,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    playButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    playButtonGradient: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    playButtonOwn: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    contentContainer: {
      flex: 1,
      flexDirection: 'column',
      gap: 6,
    },
    waveformContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 28,
      gap: 2,
    },
    waveformBar: {
      width: 3,
      borderRadius: 2,
    },
    timeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    timeText: {
      fontSize: 11,
      fontWeight: '500',
      fontVariant: ['tabular-nums'],
      color: isOwn ? 'rgba(255, 255, 255, 0.8)' : theme.textSecondary,
    },
    micIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    loadingContainer: {
      flex: 1,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
  });

  return (
    <View style={styles.container}>
      {/* Play/Pause Button */}
      <Animated.View style={{ transform: [{ scale: playButtonScale }] }}>
        <TouchableOpacity
          onPress={togglePlayback}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isOwn ? (
            <View style={[styles.playButton, styles.playButtonOwn]}>
              {isLoading ? (
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color={theme.onPrimary}
                />
              ) : isPlaying ? (
                <Ionicons name="pause" size={20} color={theme.onPrimary} />
              ) : (
                <Ionicons
                  name="play"
                  size={20}
                  color={theme.onPrimary}
                  style={{ marginLeft: 2 }}
                />
              )}
            </View>
          ) : (
            <LinearGradient
              colors={[theme.primary, theme.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.playButton}
            >
              {isLoading ? (
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color={theme.onPrimary}
                />
              ) : isPlaying ? (
                <Ionicons name="pause" size={20} color={theme.onPrimary} />
              ) : (
                <Ionicons
                  name="play"
                  size={20}
                  color={theme.onPrimary}
                  style={{ marginLeft: 2 }}
                />
              )}
            </LinearGradient>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Waveform and Time */}
      <View style={styles.contentContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <>
            {/* Waveform Visualization */}
            <View
              style={styles.waveformContainer}
              onLayout={(e) => {
                waveformWidth.current = e.nativeEvent.layout.width;
              }}
              {...panResponder.panHandlers}
            >
              {waveformBars.map((height, index) => {
                const barProgress = (index / waveformBars.length);
                const isActive = barProgress <= progress;
                return (
                  <View
                    key={index}
                    style={[
                      styles.waveformBar,
                      {
                        height: height * 28,
                        minHeight: 4,
                        maxHeight: 28,
                        backgroundColor: isActive ? primaryColor : secondaryColor,
                      },
                    ]}
                  />
                );
              })}
            </View>

            {/* Time Display */}
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{displayTime}</Text>
              <View style={styles.micIndicator}>
                <Ionicons
                  name="mic"
                  size={12}
                  color={
                    isOwn
                      ? 'rgba(255, 255, 255, 0.6)'
                      : 'rgba(148, 163, 184, 0.7)'
                  }
                />
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

export default VoiceNotePlayer;
