/**
 * Progress Stars Component
 * 
 * Displays stars earned by a student with animated fill effect.
 * Used throughout the app for gamification feedback.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

// ====================================================================
// TYPES
// ====================================================================

interface ProgressStarsProps {
  /** Current stars earned */
  stars: number;
  /** Maximum stars possible (default 5) */
  maxStars?: number;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Whether to animate on mount/change */
  animated?: boolean;
  /** Show numeric label */
  showLabel?: boolean;
  /** Custom label text */
  labelText?: string;
  /** Star style variant */
  variant?: 'filled' | 'gradient' | 'emoji';
}

// ====================================================================
// COMPONENT
// ====================================================================

export function ProgressStars({
  stars,
  maxStars = 5,
  size = 'medium',
  animated = true,
  showLabel = false,
  labelText,
  variant = 'emoji',
}: ProgressStarsProps) {
  const { colors } = useTheme();
  const animatedValues = useRef(
    [...Array(maxStars)].map(() => new Animated.Value(0))
  ).current;

  const sizeConfig = {
    small: { starSize: 16, gap: 2, fontSize: 12 },
    medium: { starSize: 24, gap: 4, fontSize: 14 },
    large: { starSize: 36, gap: 6, fontSize: 18 },
  };

  const config = sizeConfig[size];

  useEffect(() => {
    if (!animated) {
      animatedValues.forEach((anim, i) => {
        anim.setValue(i < stars ? 1 : 0);
      });
      return;
    }

    // Animate stars sequentially
    const animations = animatedValues.map((anim, i) => {
      if (i < stars) {
        return Animated.sequence([
          Animated.delay(i * 100),
          Animated.spring(anim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 100,
            friction: 5,
          }),
        ]);
      } else {
        return Animated.timing(anim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        });
      }
    });

    Animated.parallel(animations).start();
  }, [stars, animated]);

  const renderStar = (index: number) => {
    const filled = index < stars;
    const animValue = animatedValues[index];

    if (variant === 'emoji') {
      return (
        <Animated.Text
          key={index}
          style={[
            styles.starEmoji,
            { fontSize: config.starSize },
            animated && {
              transform: [
                {
                  scale: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                },
              ],
              opacity: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1],
              }),
            },
          ]}
        >
          {filled ? '⭐' : '☆'}
        </Animated.Text>
      );
    }

    // Filled/gradient variant using View
    return (
      <Animated.View
        key={index}
        style={[
          styles.starShape,
          {
            width: config.starSize,
            height: config.starSize,
            backgroundColor: filled ? '#FFD700' : colors.border,
          },
          animated && {
            transform: [
              {
                scale: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 1],
                }),
              },
            ],
          },
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.starsRow, { gap: config.gap }]}>
        {[...Array(maxStars)].map((_, i) => renderStar(i))}
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: colors.textSecondary, fontSize: config.fontSize }]}>
          {labelText || `${stars} / ${maxStars}`}
        </Text>
      )}
    </View>
  );
}

// ====================================================================
// STYLES
// ====================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starEmoji: {
    // fontSize set dynamically
  },
  starShape: {
    borderRadius: 4,
    // Star shape could be done with SVG for better visuals
  },
  label: {
    marginTop: 4,
  },
});

export default ProgressStars;
