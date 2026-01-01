/**
 * Progress Sticker Component for ECD/Preschool
 * 
 * Collectible sticker that shows progress toward a goal.
 * Displays a cute character or object that "fills up" as progress is made.
 * 
 * @module components/shared/celebrations
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

export type StickerTheme = 
  | 'rocket'
  | 'rainbow'
  | 'star_jar'
  | 'flower_garden'
  | 'book_stack'
  | 'treasure_chest'
  | 'sun'
  | 'caterpillar';

export interface ProgressStickerProps {
  /** Theme of the sticker */
  theme: StickerTheme;
  /** Current progress (0-100) */
  progress: number;
  /** Whether sticker just reached 100% (triggers celebration) */
  justCompleted?: boolean;
  /** Optional label */
  label?: string;
  /** Size of the sticker */
  size?: 'small' | 'medium' | 'large';
  /** Additional styles */
  style?: ViewStyle;
}

interface StickerConfig {
  emptyEmoji: string;
  progressEmoji: string;
  completeEmoji: string;
  label: string;
  progressColor: string;
  backgroundColor: string;
}

const STICKER_CONFIGS: Record<StickerTheme, StickerConfig> = {
  rocket: {
    emptyEmoji: '🚀',
    progressEmoji: '💨',
    completeEmoji: '🌟🚀✨',
    label: 'Blast Off!',
    progressColor: '#FF5722',
    backgroundColor: '#FBE9E7',
  },
  rainbow: {
    emptyEmoji: '🌧️',
    progressEmoji: '☁️',
    completeEmoji: '🌈✨',
    label: 'Rainbow!',
    progressColor: '#E91E63',
    backgroundColor: '#FCE4EC',
  },
  star_jar: {
    emptyEmoji: '🫙',
    progressEmoji: '⭐',
    completeEmoji: '🏆🌟',
    label: 'Star Jar',
    progressColor: '#FFD700',
    backgroundColor: '#FFF8E1',
  },
  flower_garden: {
    emptyEmoji: '🌱',
    progressEmoji: '🌿',
    completeEmoji: '🌸🌺🌼',
    label: 'Garden',
    progressColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  book_stack: {
    emptyEmoji: '📕',
    progressEmoji: '📚',
    completeEmoji: '📚🎓✨',
    label: 'Reading',
    progressColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  treasure_chest: {
    emptyEmoji: '🗝️',
    progressEmoji: '💎',
    completeEmoji: '💰🎁✨',
    label: 'Treasure',
    progressColor: '#FF9800',
    backgroundColor: '#FFF3E0',
  },
  sun: {
    emptyEmoji: '🌙',
    progressEmoji: '⛅',
    completeEmoji: '☀️✨🌈',
    label: 'Sunshine',
    progressColor: '#FFC107',
    backgroundColor: '#FFFDE7',
  },
  caterpillar: {
    emptyEmoji: '🐛',
    progressEmoji: '🐛',
    completeEmoji: '🦋✨',
    label: 'Butterfly!',
    progressColor: '#9C27B0',
    backgroundColor: '#F3E5F5',
  },
};

const SIZES = {
  small: { container: 80, emoji: 24, progress: 4 },
  medium: { container: 120, emoji: 36, progress: 6 },
  large: { container: 160, emoji: 48, progress: 8 },
};

export function ProgressSticker({
  theme,
  progress,
  justCompleted = false,
  label,
  size = 'medium',
  style,
}: ProgressStickerProps) {
  const config = STICKER_CONFIGS[theme];
  const dimensions = SIZES[size];
  
  // Clamp progress
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const isComplete = clampedProgress >= 100;
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const wiggleAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(clampedProgress)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Animate progress changes
  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: clampedProgress,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [clampedProgress, progressAnim]);

  // Celebration animation when completed
  useEffect(() => {
    if (justCompleted) {
      // Haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      // Scale bounce
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Wiggle dance
      Animated.loop(
        Animated.sequence([
          Animated.timing(wiggleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: -1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(wiggleAnim, {
            toValue: 0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 5 }
      ).start();

      // Glow pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 4 }
      ).start();
    }
  }, [justCompleted, scaleAnim, wiggleAnim, glowAnim]);

  const wiggleInterpolate = wiggleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  // Get current emoji based on progress
  const getCurrentEmoji = () => {
    if (isComplete) return config.completeEmoji;
    if (clampedProgress >= 50) return config.progressEmoji;
    return config.emptyEmoji;
  };

  // Get progress display text
  const getProgressText = () => {
    if (isComplete) return '100%';
    return `${Math.round(clampedProgress)}%`;
  };

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.stickerContainer,
          {
            width: dimensions.container,
            height: dimensions.container,
            borderRadius: dimensions.container / 2,
            backgroundColor: config.backgroundColor,
            transform: [
              { scale: scaleAnim },
              { rotate: wiggleInterpolate },
            ],
          },
        ]}
      >
        {/* Glow effect for completion */}
        {justCompleted && (
          <Animated.View
            style={[
              styles.glow,
              {
                width: dimensions.container,
                height: dimensions.container,
                borderRadius: dimensions.container / 2,
                backgroundColor: config.progressColor,
                transform: [{ scale: glowScale }],
                opacity: glowAnim,
              },
            ]}
          />
        )}

        {/* Progress ring */}
        <View
          style={[
            styles.progressRing,
            {
              width: dimensions.container - 8,
              height: dimensions.container - 8,
              borderRadius: (dimensions.container - 8) / 2,
              borderWidth: dimensions.progress,
              borderColor: '#E0E0E0',
            },
          ]}
        >
          {/* Filled progress arc (simplified as opacity fill) */}
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: config.progressColor,
                opacity: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: [0.1, 0.4],
                }),
              },
            ]}
          />
        </View>

        {/* Center emoji */}
        <Text style={[styles.emoji, { fontSize: dimensions.emoji }]}>
          {getCurrentEmoji()}
        </Text>

        {/* Progress text */}
        <View style={styles.progressBadge}>
          <Text style={styles.progressText}>{getProgressText()}</Text>
        </View>
      </Animated.View>

      {/* Label */}
      {(label || config.label) && (
        <Text style={styles.label}>
          {label || (isComplete ? config.label : `${config.label}`)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  stickerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  glow: {
    position: 'absolute',
    zIndex: -1,
  },
  progressRing: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 100,
  },
  emoji: {
    textAlign: 'center',
  },
  progressBadge: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  label: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});

export default ProgressSticker;
