/**
 * VoiceWaveform — Animated waveform visualizer for voice messages
 * 
 * Shows an animated bar waveform during playback and a static
 * waveform when paused. Includes play/pause button and duration.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface VoiceWaveformProps {
  /** Duration in seconds */
  duration: number;
  /** Current playback position in seconds */
  currentTime?: number;
  /** Whether the voice message is playing */
  isPlaying?: boolean;
  /** Called when play/pause is tapped */
  onPlayPause?: () => void;
  /** Whether this is the sender's own message */
  isOwnMessage?: boolean;
  /** Number of bars to display */
  barCount?: number;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VoiceWaveform({
  duration,
  currentTime = 0,
  isPlaying = false,
  onPlayPause,
  isOwnMessage = false,
  barCount = 30,
}: VoiceWaveformProps) {
  const { theme } = useTheme();

  // Generate pseudo-random bar heights (deterministic based on duration)
  const barHeights = useMemo(() => {
    const heights: number[] = [];
    let seed = Math.round(duration * 100);
    for (let i = 0; i < barCount; i++) {
      seed = (seed * 16807 + 7) % 2147483647;
      heights.push(0.2 + (seed % 100) / 125); // Range 0.2 - 1.0
    }
    return heights;
  }, [duration, barCount]);

  // Animation values for each bar
  const barAnims = useRef(barHeights.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (isPlaying) {
      // Staggered wave animation
      const animations = barAnims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 300 + (i % 5) * 80,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 300 + (i % 5) * 80,
              useNativeDriver: true,
            }),
          ])
        )
      );
      Animated.stagger(30, animations).start();
    } else {
      // Reset to static
      barAnims.forEach((anim) => {
        anim.stopAnimation();
        anim.setValue(0);
      });
    }
  }, [isPlaying, barAnims]);

  const progress = duration > 0 ? currentTime / duration : 0;
  const playedBars = Math.floor(progress * barCount);

  const primaryColor = isOwnMessage ? 'rgba(255,255,255,0.9)' : theme.primary;
  const secondaryColor = isOwnMessage ? 'rgba(255,255,255,0.35)' : theme.primary + '40';
  const textColor = isOwnMessage ? 'rgba(255,255,255,0.8)' : theme.textSecondary;

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      gap: 10,
      minWidth: 200,
    },
    playButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : theme.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    barsContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      height: 32,
      gap: 1.5,
    },
    bar: {
      width: 3,
      borderRadius: 1.5,
    },
    durationText: {
      fontSize: 11,
      fontWeight: '500',
      color: textColor,
      minWidth: 32,
      textAlign: 'right',
    },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.playButton} onPress={onPlayPause} activeOpacity={0.6}>
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={18}
          color={primaryColor}
          style={isPlaying ? undefined : { marginLeft: 2 }}
        />
      </TouchableOpacity>

      <View style={styles.barsContainer}>
        {barHeights.map((height, i) => {
          const isPlayed = i < playedBars;
          const barColor = isPlayed ? primaryColor : secondaryColor;
          const baseHeight = height * 28;

          if (isPlaying) {
            const scale = barAnims[i].interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.4 + height * 0.6],
            });

            return (
              <Animated.View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: baseHeight,
                    backgroundColor: barColor,
                    transform: [{ scaleY: scale }],
                  },
                ]}
              />
            );
          }

          return (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: baseHeight,
                  backgroundColor: barColor,
                },
              ]}
            />
          );
        })}
      </View>

      <Text style={styles.durationText}>
        {isPlaying ? formatDuration(currentTime) : formatDuration(duration)}
      </Text>
    </View>
  );
}

export default VoiceWaveform;
