/**
 * ActivityComplete — Star Rating & Celebration Screen
 *
 * Shown when a child completes an activity. Displays:
 * - Stars earned (1-3)
 * - Stats (time, correct answers)
 * - Parent tip
 * - "Continue with Dash" CTA to open AI conversation
 * - "Play Again" option
 *
 * ≤400 lines (WARP.md compliant)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import type { PreschoolActivity, ActivityResult } from '@/lib/activities/preschoolActivities.types';

interface ActivityCompleteProps {
  activity: PreschoolActivity;
  result: ActivityResult;
  onPlayAgain: () => void;
  onContinueWithDash: () => void;
  onUploadAndGrade: () => void;
  onClose: () => void;
}

export function ActivityComplete({
  activity,
  result,
  onPlayAgain,
  onContinueWithDash,
  onUploadAndGrade,
  onClose,
}: ActivityCompleteProps) {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const star1 = useRef(new Animated.Value(0)).current;
  const star2 = useRef(new Animated.Value(0)).current;
  const star3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    // Staggered star animations
    const starAnims = [star1, star2, star3];
    starAnims.forEach((anim, i) => {
      if (i < result.stars) {
        setTimeout(() => {
          Animated.spring(anim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
        }, 400 + i * 300);
      }
    });
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getMessage = () => {
    if (result.stars === 3) return "You're a SUPERSTAR! Perfect score!";
    if (result.stars === 2) return 'Amazing work! You did so well!';
    return "Great effort! Let's try again!";
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <LinearGradient colors={activity.gradient} style={styles.gradient}>
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          {/* Close */}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>

          {/* Stars */}
          <View style={styles.starsRow}>
            {[star1, star2, star3].map((anim, i) => (
              <Animated.Text
                key={i}
                style={[
                  styles.star,
                  {
                    opacity: i < result.stars ? anim : 0.2,
                    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
                  },
                ]}
              >
                ⭐
              </Animated.Text>
            ))}
          </View>

          {/* Message */}
          <Text style={styles.emoji}>{activity.emoji}</Text>
          <Text style={styles.title}>{getMessage()}</Text>
          <Text style={styles.subtitle}>{activity.title} Complete!</Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.statValue}>{result.correctAnswers}/{result.totalRounds}</Text>
              <Text style={styles.statLabel}>Correct</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Ionicons name="time" size={20} color="#6366F1" />
              <Text style={styles.statValue}>{formatTime(result.timeSpentSeconds)}</Text>
              <Text style={styles.statLabel}>Time</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Ionicons name="star" size={20} color="#F59E0B" />
              <Text style={styles.statValue}>{result.stars}/3</Text>
              <Text style={styles.statLabel}>Stars</Text>
            </View>
          </View>

          {/* Parent Tip */}
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>Parent Tip 💡</Text>
            <Text style={styles.tipText}>{activity.parentTip}</Text>
          </View>

          {/* CTAs */}
          <TouchableOpacity style={styles.dashBtn} onPress={onContinueWithDash} activeOpacity={0.85}>
            <LinearGradient colors={['#6D28D9', '#8B5CF6']} style={styles.dashBtnGradient}>
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.dashBtnText}>Continue with Dash</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryActionBtn} onPress={onUploadAndGrade} activeOpacity={0.85}>
            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
            <Text style={styles.primaryActionText}>Upload & Grade</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.replayBtn} onPress={onPlayAgain}>
            <Ionicons name="refresh" size={18} color={theme.primary} />
            <Text style={[styles.replayText, { color: theme.primary }]}>Play Again</Text>
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    gradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 24,
      padding: 28,
      width: '100%',
      maxWidth: 400,
      alignItems: 'center',
      gap: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
    closeBtn: {
      position: 'absolute',
      top: 16,
      right: 16,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    starsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    star: {
      fontSize: 44,
    },
    emoji: {
      fontSize: 56,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.elevated,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    statLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    statDivider: {
      width: 1,
      height: 32,
      backgroundColor: theme.border,
    },
    tipCard: {
      backgroundColor: '#FEF3C7',
      borderRadius: 14,
      padding: 14,
      width: '100%',
      gap: 6,
    },
    tipTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#92400E',
    },
    tipText: {
      fontSize: 13,
      color: '#78350F',
      lineHeight: 19,
    },
    dashBtn: {
      width: '100%',
      borderRadius: 16,
      overflow: 'hidden',
    },
    dashBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 16,
    },
    dashBtnText: {
      color: '#fff',
      fontSize: 17,
      fontWeight: '700',
    },
    primaryActionBtn: {
      width: '100%',
      borderRadius: 14,
      paddingVertical: 14,
      backgroundColor: '#0EA5E9',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryActionText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    replayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
    },
    replayText: {
      fontSize: 15,
      fontWeight: '600',
    },
  });
