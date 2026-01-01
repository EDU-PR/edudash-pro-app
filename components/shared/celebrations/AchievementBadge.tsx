/**
 * Achievement Badge Component for ECD/Preschool
 * 
 * Displays colorful achievement badges with animations for young learners.
 * Includes celebratory animations when badge is earned.
 * 
 * @module components/shared/celebrations
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export type BadgeType = 
  | 'star_learner'
  | 'homework_hero'
  | 'attendance_champion'
  | 'kindness_award'
  | 'creativity_star'
  | 'reading_wizard'
  | 'math_whiz'
  | 'helper_bee'
  | 'explorer'
  | 'artist'
  | 'musician'
  | 'athlete';

export interface AchievementBadgeProps {
  /** Type of badge to display */
  type: BadgeType;
  /** Size of the badge (default: 'medium') */
  size?: 'small' | 'medium' | 'large';
  /** Whether this badge was just earned (triggers celebration animation) */
  justEarned?: boolean;
  /** Whether badge is locked/not yet earned */
  locked?: boolean;
  /** Custom label override */
  label?: string;
  /** On press callback */
  onPress?: () => void;
  /** Additional styles */
  style?: ViewStyle;
}

interface BadgeConfig {
  icon: string;
  iconFamily: 'ionicons' | 'material';
  label: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  emoji: string;
}

const BADGE_CONFIGS: Record<BadgeType, BadgeConfig> = {
  star_learner: {
    icon: 'star',
    iconFamily: 'ionicons',
    label: 'Star Learner ⭐',
    colors: { primary: '#FFD700', secondary: '#FFA500', accent: '#FF8C00' },
    emoji: '⭐',
  },
  homework_hero: {
    icon: 'checkmark-done-circle',
    iconFamily: 'ionicons',
    label: 'Homework Hero 📚',
    colors: { primary: '#4CAF50', secondary: '#8BC34A', accent: '#CDDC39' },
    emoji: '📚',
  },
  attendance_champion: {
    icon: 'calendar',
    iconFamily: 'ionicons',
    label: 'Attendance Champion 🏆',
    colors: { primary: '#2196F3', secondary: '#03A9F4', accent: '#00BCD4' },
    emoji: '🏆',
  },
  kindness_award: {
    icon: 'heart',
    iconFamily: 'ionicons',
    label: 'Kindness Award 💖',
    colors: { primary: '#E91E63', secondary: '#F06292', accent: '#F8BBD9' },
    emoji: '💖',
  },
  creativity_star: {
    icon: 'color-palette',
    iconFamily: 'ionicons',
    label: 'Creativity Star 🎨',
    colors: { primary: '#9C27B0', secondary: '#BA68C8', accent: '#E1BEE7' },
    emoji: '🎨',
  },
  reading_wizard: {
    icon: 'book',
    iconFamily: 'ionicons',
    label: 'Reading Wizard 📖',
    colors: { primary: '#3F51B5', secondary: '#7986CB', accent: '#C5CAE9' },
    emoji: '📖',
  },
  math_whiz: {
    icon: 'calculator',
    iconFamily: 'ionicons',
    label: 'Math Whiz 🔢',
    colors: { primary: '#00BCD4', secondary: '#4DD0E1', accent: '#B2EBF2' },
    emoji: '🔢',
  },
  helper_bee: {
    icon: 'bee',
    iconFamily: 'material',
    label: 'Helper Bee 🐝',
    colors: { primary: '#FFC107', secondary: '#FFD54F', accent: '#FFECB3' },
    emoji: '🐝',
  },
  explorer: {
    icon: 'compass',
    iconFamily: 'ionicons',
    label: 'Little Explorer 🔍',
    colors: { primary: '#795548', secondary: '#A1887F', accent: '#D7CCC8' },
    emoji: '🔍',
  },
  artist: {
    icon: 'brush',
    iconFamily: 'ionicons',
    label: 'Amazing Artist 🖌️',
    colors: { primary: '#FF5722', secondary: '#FF8A65', accent: '#FFCCBC' },
    emoji: '🖌️',
  },
  musician: {
    icon: 'musical-notes',
    iconFamily: 'ionicons',
    label: 'Music Star 🎵',
    colors: { primary: '#673AB7', secondary: '#9575CD', accent: '#D1C4E9' },
    emoji: '🎵',
  },
  athlete: {
    icon: 'trophy',
    iconFamily: 'ionicons',
    label: 'Super Athlete 🏅',
    colors: { primary: '#FF9800', secondary: '#FFB74D', accent: '#FFE0B2' },
    emoji: '🏅',
  },
};

const SIZES = {
  small: { badge: 48, icon: 20, fontSize: 10 },
  medium: { badge: 72, icon: 32, fontSize: 12 },
  large: { badge: 100, icon: 48, fontSize: 14 },
};

export function AchievementBadge({
  type,
  size = 'medium',
  justEarned = false,
  locked = false,
  label,
  onPress,
  style,
}: AchievementBadgeProps) {
  const config = BADGE_CONFIGS[type];
  const dimensions = SIZES[size];
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(justEarned ? 0 : 1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  
  const [showSparkles, setShowSparkles] = useState(justEarned);

  // Celebration animation when badge is first earned
  useEffect(() => {
    if (justEarned) {
      // Haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      // Scale in with bounce
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Rotate celebration
      Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: -1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 }
      ).start();

      // Glow pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 5 }
      ).start(() => {
        setShowSparkles(false);
      });

      // Float bounce
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: -10,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 6 }
      ).start();
    }
  }, [justEarned, scaleAnim, rotateAnim, glowAnim, bounceAnim]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.8],
  });

  const IconComponent = config.iconFamily === 'material' 
    ? MaterialCommunityIcons 
    : Ionicons;

  const displayLabel = label || config.label;

  return (
    <Pressable 
      onPress={onPress} 
      disabled={!onPress}
      style={({ pressed }) => [
        styles.container,
        style,
        pressed && onPress && { opacity: 0.8 },
      ]}
    >
      <Animated.View
        style={[
          styles.badgeContainer,
          {
            width: dimensions.badge,
            height: dimensions.badge,
            borderRadius: dimensions.badge / 2,
            backgroundColor: locked ? '#E0E0E0' : config.colors.primary,
            transform: [
              { scale: scaleAnim },
              { rotate: rotateInterpolate },
              { translateY: bounceAnim },
            ],
          },
        ]}
      >
        {/* Glow effect */}
        {showSparkles && (
          <Animated.View
            style={[
              styles.glow,
              {
                width: dimensions.badge + 20,
                height: dimensions.badge + 20,
                borderRadius: (dimensions.badge + 20) / 2,
                backgroundColor: config.colors.primary,
                opacity: glowOpacity,
              },
            ]}
          />
        )}

        {/* Inner circle */}
        <View
          style={[
            styles.innerCircle,
            {
              width: dimensions.badge - 8,
              height: dimensions.badge - 8,
              borderRadius: (dimensions.badge - 8) / 2,
              backgroundColor: locked ? '#BDBDBD' : config.colors.secondary,
            },
          ]}
        >
          {/* Icon */}
          <IconComponent
            name={config.icon as any}
            size={dimensions.icon}
            color={locked ? '#9E9E9E' : '#FFFFFF'}
          />
          
          {/* Lock overlay */}
          {locked && (
            <View style={styles.lockOverlay}>
              <Ionicons name="lock-closed" size={dimensions.icon / 2} color="#757575" />
            </View>
          )}
        </View>

        {/* Sparkles for celebration */}
        {showSparkles && (
          <>
            <Text style={[styles.sparkle, styles.sparkle1]}>✨</Text>
            <Text style={[styles.sparkle, styles.sparkle2]}>⭐</Text>
            <Text style={[styles.sparkle, styles.sparkle3]}>✨</Text>
            <Text style={[styles.sparkle, styles.sparkle4]}>🌟</Text>
          </>
        )}
      </Animated.View>

      {/* Label */}
      <Text
        style={[
          styles.label,
          {
            fontSize: dimensions.fontSize,
            color: locked ? '#9E9E9E' : '#333',
          },
        ]}
        numberOfLines={2}
      >
        {displayLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 8,
  },
  badgeContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  glow: {
    position: 'absolute',
    zIndex: -1,
  },
  innerCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 100,
  },
  label: {
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 100,
  },
  sparkle: {
    position: 'absolute',
    fontSize: 16,
  },
  sparkle1: {
    top: -10,
    left: -5,
  },
  sparkle2: {
    top: -5,
    right: -10,
  },
  sparkle3: {
    bottom: -10,
    right: -5,
  },
  sparkle4: {
    bottom: -5,
    left: -10,
  },
});

export default AchievementBadge;
