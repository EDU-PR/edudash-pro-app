/**
 * Daily Streak Component
 * 
 * Displays the student's daily engagement streak with
 * fire animations and motivational messages.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

// ====================================================================
// TYPES
// ====================================================================

interface DailyStreakProps {
  /** Current streak count */
  currentStreak: number;
  /** Longest streak ever */
  longestStreak?: number;
  /** Whether to show the "at risk" state (hasn't done activity today) */
  isAtRisk?: boolean;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Show motivational message */
  showMessage?: boolean;
  /** Custom messages by streak milestone */
  messages?: Record<number, string>;
  /** Streak type label */
  streakType?: string;
}

// ====================================================================
// DEFAULT MESSAGES
// ====================================================================

const DEFAULT_MESSAGES: Record<number, string> = {
  0: "Start your streak today! 🌟",
  1: "Great start! Keep going! 🔥",
  3: "3 days strong! 💪",
  5: "High five! 5 day streak! ✋",
  7: "One week streak! Amazing! 🎉",
  10: "Double digits! You're on fire! 🔥🔥",
  14: "Two weeks! Incredible! 🏆",
  21: "3 weeks! You're unstoppable! 🚀",
  30: "One month streak! Legend! 👑",
  50: "50 days! Superstar! ⭐",
  100: "100 DAYS! EPIC! 🏅",
};

// ====================================================================
// COMPONENT
// ====================================================================

export function DailyStreak({
  currentStreak,
  longestStreak,
  isAtRisk = false,
  size = 'medium',
  showMessage = true,
  messages = DEFAULT_MESSAGES,
  streakType = 'Learning',
}: DailyStreakProps) {
  const { colors, isDarkMode } = useTheme();
  const fireAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const sizeConfig = {
    small: { fireSize: 32, countSize: 20, labelSize: 10 },
    medium: { fireSize: 48, countSize: 28, labelSize: 12 },
    large: { fireSize: 72, countSize: 40, labelSize: 16 },
  };

  const config = sizeConfig[size];

  // Fire flickering animation
  useEffect(() => {
    if (currentStreak > 0 && !isAtRisk) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(fireAnim, {
            toValue: 1.1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(fireAnim, {
            toValue: 0.9,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [currentStreak, isAtRisk]);

  // Pulse animation for at-risk state
  useEffect(() => {
    if (isAtRisk) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isAtRisk]);

  // Get motivational message
  const getMessage = () => {
    if (isAtRisk) {
      return currentStreak > 0 
        ? "Don't lose your streak! Do something today! ⚠️"
        : messages[0];
    }

    // Find closest milestone message
    const milestones = Object.keys(messages)
      .map(Number)
      .sort((a, b) => b - a);
    
    for (const milestone of milestones) {
      if (currentStreak >= milestone) {
        return messages[milestone];
      }
    }
    return messages[0];
  };

  // Get streak color based on length
  const getStreakColor = () => {
    if (isAtRisk) return '#FF9800';
    if (currentStreak >= 30) return '#FFD700';
    if (currentStreak >= 14) return '#FF5722';
    if (currentStreak >= 7) return '#FF9800';
    if (currentStreak >= 3) return '#FFC107';
    return '#9E9E9E';
  };

  const streakColor = getStreakColor();

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
      {/* Fire Icon */}
      <Animated.View
        style={[
          styles.fireContainer,
          {
            transform: [
              { scale: currentStreak > 0 ? fireAnim : pulseAnim },
            ],
          },
        ]}
      >
        <Text style={{ fontSize: config.fireSize }}>
          {currentStreak === 0 ? '💤' : isAtRisk ? '🔥' : '🔥'}
        </Text>
        {isAtRisk && (
          <View style={styles.riskBadge}>
            <Text style={styles.riskText}>!</Text>
          </View>
        )}
      </Animated.View>

      {/* Streak Count */}
      <View style={styles.streakInfo}>
        <Text style={[styles.streakCount, { color: streakColor, fontSize: config.countSize }]}>
          {currentStreak}
        </Text>
        <Text style={[styles.streakLabel, { color: colors.textSecondary, fontSize: config.labelSize }]}>
          Day{currentStreak !== 1 ? 's' : ''} {streakType} Streak
        </Text>
      </View>

      {/* Longest Streak (if different) */}
      {longestStreak !== undefined && longestStreak > currentStreak && (
        <View style={[styles.longestStreak, { backgroundColor: colors.border }]}>
          <Text style={[styles.longestLabel, { color: colors.textSecondary }]}>
            Best: {longestStreak} 🏆
          </Text>
        </View>
      )}

      {/* Motivational Message */}
      {showMessage && (
        <Text style={[styles.message, { color: colors.text }]}>
          {getMessage()}
        </Text>
      )}

      {/* Weekly Progress Dots */}
      {currentStreak > 0 && (
        <View style={styles.weekDots}>
          {[...Array(7)].map((_, i) => {
            const dayInStreak = i < (currentStreak % 7 || 7);
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: dayInStreak ? streakColor : colors.border,
                  },
                ]}
              />
            );
          })}
        </View>
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
    padding: 20,
    borderRadius: 20,
  },
  fireContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  riskBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF5252',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riskText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  streakInfo: {
    alignItems: 'center',
    marginBottom: 8,
  },
  streakCount: {
    fontWeight: 'bold',
  },
  streakLabel: {
    marginTop: 2,
  },
  longestStreak: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  longestLabel: {
    fontSize: 12,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  weekDots: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default DailyStreak;
