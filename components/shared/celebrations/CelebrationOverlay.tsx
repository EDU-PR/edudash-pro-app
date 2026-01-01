/**
 * Celebration Overlay for ECD/Preschool
 * 
 * Full-screen celebration animation with confetti, stars, and emojis.
 * Used when learners complete milestones or earn achievements.
 * 
 * @module components/shared/celebrations
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type CelebrationType = 
  | 'homework_complete'
  | 'lesson_complete'
  | 'badge_earned'
  | 'perfect_score'
  | 'streak_achieved'
  | 'level_up'
  | 'first_login'
  | 'daily_goal';

export interface CelebrationOverlayProps {
  /** Whether to show the celebration */
  visible: boolean;
  /** Type of celebration (affects emojis and message) */
  type: CelebrationType;
  /** Custom title override */
  title?: string;
  /** Custom message override */
  message?: string;
  /** Optional learner name for personalization */
  learnerName?: string;
  /** Duration in ms before auto-close (default: 3000) */
  duration?: number;
  /** Callback when celebration ends */
  onComplete?: () => void;
}

interface CelebrationConfig {
  emojis: string[];
  title: string;
  message: string;
  colors: string[];
  soundType: 'success' | 'achievement' | 'milestone';
}

const CELEBRATIONS: Record<CelebrationType, CelebrationConfig> = {
  homework_complete: {
    emojis: ['📚', '✅', '🌟', '⭐', '🎉'],
    title: 'Homework Complete! 🎉',
    message: 'Amazing work! You did it!',
    colors: ['#4CAF50', '#8BC34A', '#CDDC39', '#FFD700'],
    soundType: 'success',
  },
  lesson_complete: {
    emojis: ['📖', '✨', '🌈', '🎯', '💫'],
    title: 'Lesson Finished! ✨',
    message: "You're getting smarter every day!",
    colors: ['#2196F3', '#03A9F4', '#00BCD4', '#00E5FF'],
    soundType: 'success',
  },
  badge_earned: {
    emojis: ['🏆', '🥇', '⭐', '✨', '🎖️'],
    title: 'New Badge Earned! 🏆',
    message: "Wow! You're a superstar!",
    colors: ['#FFD700', '#FFA500', '#FF8C00', '#FF6B00'],
    soundType: 'achievement',
  },
  perfect_score: {
    emojis: ['💯', '🌟', '🎯', '✨', '👏'],
    title: 'Perfect Score! 💯',
    message: "Incredible! You got them all right!",
    colors: ['#9C27B0', '#BA68C8', '#E040FB', '#EA80FC'],
    soundType: 'milestone',
  },
  streak_achieved: {
    emojis: ['🔥', '⚡', '💪', '🚀', '⭐'],
    title: "You're on Fire! 🔥",
    message: 'Keep up the amazing streak!',
    colors: ['#FF5722', '#FF7043', '#FF8A65', '#FFD54F'],
    soundType: 'achievement',
  },
  level_up: {
    emojis: ['🆙', '🚀', '⬆️', '🌟', '✨'],
    title: 'Level Up! 🚀',
    message: "You've reached a new level!",
    colors: ['#673AB7', '#7E57C2', '#9575CD', '#B39DDB'],
    soundType: 'milestone',
  },
  first_login: {
    emojis: ['👋', '🌈', '🎈', '🎉', '😊'],
    title: 'Welcome! 👋',
    message: "Let's have fun learning today!",
    colors: ['#E91E63', '#F06292', '#F8BBD9', '#FCE4EC'],
    soundType: 'success',
  },
  daily_goal: {
    emojis: ['🎯', '✅', '🌟', '🏅', '💪'],
    title: 'Daily Goal Complete! 🎯',
    message: 'You reached your goal for today!',
    colors: ['#00BCD4', '#26C6DA', '#4DD0E1', '#80DEEA'],
    soundType: 'success',
  },
};

interface ParticleProps {
  emoji: string;
  delay: number;
  duration: number;
  startX: number;
  startY: number;
}

function Particle({ emoji, delay, duration, startX, startY }: ParticleProps) {
  const translateY = useRef(new Animated.Value(startY)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animations = Animated.parallel([
      // Fall down
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT + 50,
          duration: duration,
          useNativeDriver: true,
        }),
      ]),
      // Horizontal sway
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(translateX, {
              toValue: startX + (Math.random() > 0.5 ? 30 : -30),
              duration: duration / 4,
              useNativeDriver: true,
            }),
            Animated.timing(translateX, {
              toValue: startX,
              duration: duration / 4,
              useNativeDriver: true,
            }),
          ]),
          { iterations: 4 }
        ),
      ]),
      // Fade in then out
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(duration - 600),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Scale pop
      Animated.sequence([
        Animated.delay(delay),
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
      ]),
      // Rotation
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(rotate, {
          toValue: Math.random() > 0.5 ? 2 : -2,
          duration: duration,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animations.start();
  }, [delay, duration, opacity, rotate, scale, startX, startY, translateX, translateY]);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [-2, 0, 2],
    outputRange: ['-360deg', '0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          transform: [
            { translateX },
            { translateY },
            { scale },
            { rotate: rotateInterpolate },
          ],
          opacity,
        },
      ]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
    </Animated.View>
  );
}

export function CelebrationOverlay({
  visible,
  type,
  title,
  message,
  learnerName,
  duration = 3500,
  onComplete,
}: CelebrationOverlayProps) {
  const [particles, setParticles] = useState<ParticleProps[]>([]);
  const config = CELEBRATIONS[type];
  
  // Animation values for center content
  const titleScale = useRef(new Animated.Value(0)).current;
  const messageOpacity = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      // Generate particles
      const newParticles: ParticleProps[] = [];
      const particleCount = 30;
      
      for (let i = 0; i < particleCount; i++) {
        newParticles.push({
          emoji: config.emojis[Math.floor(Math.random() * config.emojis.length)],
          delay: Math.random() * 500,
          duration: 2000 + Math.random() * 1500,
          startX: Math.random() * SCREEN_WIDTH,
          startY: -50 - Math.random() * 100,
        });
      }
      setParticles(newParticles);

      // Haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        // Additional haptics for excitement
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }, 200);
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }, 400);
      }

      // Animate center content
      Animated.parallel([
        Animated.spring(titleScale, {
          toValue: 1,
          friction: 4,
          tension: 100,
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.timing(messageOpacity, {
          toValue: 1,
          duration: 500,
          delay: 600,
          useNativeDriver: true,
        }),
        Animated.spring(contentY, {
          toValue: 0,
          friction: 6,
          tension: 80,
          delay: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-close
      const timer = setTimeout(() => {
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      // Reset animations
      titleScale.setValue(0);
      messageOpacity.setValue(0);
      contentY.setValue(50);
      setParticles([]);
    }
  }, [visible, type, config.emojis, duration, onComplete, titleScale, messageOpacity, contentY]);

  if (!visible) return null;

  const displayTitle = title || config.title;
  const displayMessage = learnerName 
    ? `${learnerName}, ${config.message.toLowerCase()}`
    : message || config.message;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Particles */}
        {particles.map((particle, index) => (
          <Particle key={index} {...particle} />
        ))}

        {/* Center content */}
        <Animated.View
          style={[
            styles.content,
            {
              transform: [
                { scale: titleScale },
                { translateY: contentY },
              ],
            },
          ]}
        >
          {/* Big emoji */}
          <Text style={styles.bigEmoji}>
            {config.emojis[0]}
          </Text>

          {/* Title */}
          <Text style={styles.title}>{displayTitle}</Text>

          {/* Message */}
          <Animated.Text
            style={[
              styles.message,
              { opacity: messageOpacity },
            ]}
          >
            {displayMessage}
          </Animated.Text>
        </Animated.View>

        {/* Bottom stars row */}
        <View style={styles.starsRow}>
          {['⭐', '🌟', '✨', '🌟', '⭐'].map((star, i) => (
            <Text key={i} style={styles.star}>{star}</Text>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  particle: {
    position: 'absolute',
    zIndex: 1,
  },
  emoji: {
    fontSize: 32,
  },
  content: {
    alignItems: 'center',
    padding: 32,
    zIndex: 2,
  },
  bigEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  message: {
    fontSize: 20,
    color: '#E0E0E0',
    textAlign: 'center',
    maxWidth: 300,
  },
  starsRow: {
    position: 'absolute',
    bottom: 100,
    flexDirection: 'row',
    gap: 24,
  },
  star: {
    fontSize: 36,
  },
});

export default CelebrationOverlay;
