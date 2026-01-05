/**
 * ChildProgressBadges Component
 * 
 * Displays visual progress indicators and achievement badges for children.
 * Shows learning milestones, attendance streaks, and special achievements.
 * 
 * Features:
 * - Animated progress rings
 * - Achievement badges with icons
 * - Streaks and milestones
 * - Weekly/monthly progress summary
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned_at?: string;
  progress?: number; // 0-100, undefined = fully earned
}

interface ProgressStat {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: string;
}

interface ChildProgressBadgesProps {
  studentId: string;
  compact?: boolean;
  showHeader?: boolean;
  onBadgePress?: (badge: Badge) => void;
}

// Predefined badge definitions
const BADGE_DEFINITIONS: Omit<Badge, 'earned_at' | 'progress'>[] = [
  { id: 'attendance_star', name: 'Attendance Star', description: '5-day attendance streak!', icon: 'star', color: '#F59E0B' },
  { id: 'homework_hero', name: 'Homework Hero', description: 'Completed all homework this week', icon: 'trophy', color: '#10B981' },
  { id: 'helping_hand', name: 'Helping Hand', description: 'Helped a friend today', icon: 'heart', color: '#EC4899' },
  { id: 'creative_genius', name: 'Creative Genius', description: 'Outstanding artwork', icon: 'color-palette', color: '#8B5CF6' },
  { id: 'math_wizard', name: 'Math Wizard', description: 'Excellent counting skills', icon: 'calculator', color: '#3B82F6' },
  { id: 'bookworm', name: 'Bookworm', description: 'Loves story time', icon: 'book', color: '#6366F1' },
  { id: 'super_listener', name: 'Super Listener', description: 'Always follows instructions', icon: 'ear', color: '#06B6D4' },
  { id: 'kindness_champ', name: 'Kindness Champion', description: 'Shows kindness to everyone', icon: 'happy', color: '#F472B6' },
];

export function ChildProgressBadges({
  studentId,
  compact = false,
  showHeader = true,
  onBadgePress,
}: ChildProgressBadgesProps) {
  const { theme } = useTheme();
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [progressStats, setProgressStats] = useState<ProgressStat[]>([]);
  const [loading, setLoading] = useState(true);
  
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);

  const loadProgress = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    try {
      const supabase = assertSupabase();
      
      // Calculate attendance streak
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
      
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('date, status')
        .eq('student_id', studentId)
        .gte('date', weekStart.toISOString().split('T')[0])
        .order('date', { ascending: false });
      
      const presentDays = attendanceData?.filter(a => a.status === 'present').length || 0;
      const totalDays = attendanceData?.length || 0;

      // Calculate homework completion
      const { data: homeworkData } = await supabase
        .from('homework_submissions')
        .select('status')
        .eq('student_id', studentId)
        .gte('created_at', weekStart.toISOString());
      
      const completedHomework = homeworkData?.filter(h => h.status === 'submitted' || h.status === 'graded').length || 0;
      const totalHomework = homeworkData?.length || 0;

      // Set progress stats
      setProgressStats([
        {
          label: 'Attendance',
          value: presentDays,
          max: Math.max(totalDays, 5),
          color: '#10B981',
          icon: 'calendar-outline',
        },
        {
          label: 'Homework',
          value: completedHomework,
          max: Math.max(totalHomework, 3),
          color: '#3B82F6',
          icon: 'document-text-outline',
        },
      ]);

      // Generate earned badges based on progress
      const badges: Badge[] = [];
      
      if (presentDays >= 5) {
        badges.push({ ...BADGE_DEFINITIONS.find(b => b.id === 'attendance_star')!, earned_at: new Date().toISOString() });
      } else if (presentDays >= 3) {
        badges.push({ ...BADGE_DEFINITIONS.find(b => b.id === 'attendance_star')!, progress: (presentDays / 5) * 100 });
      }

      if (totalHomework > 0 && completedHomework === totalHomework) {
        badges.push({ ...BADGE_DEFINITIONS.find(b => b.id === 'homework_hero')!, earned_at: new Date().toISOString() });
      }

      // Add some aspirational badges with progress
      if (!badges.find(b => b.id === 'helping_hand')) {
        badges.push({ ...BADGE_DEFINITIONS.find(b => b.id === 'helping_hand')!, progress: 60 });
      }
      if (!badges.find(b => b.id === 'bookworm')) {
        badges.push({ ...BADGE_DEFINITIONS.find(b => b.id === 'bookworm')!, progress: 40 });
      }

      setEarnedBadges(badges);
    } catch (err) {
      console.error('[ChildProgressBadges] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const renderProgressRing = (stat: ProgressStat) => {
    const percentage = stat.max > 0 ? Math.min((stat.value / stat.max) * 100, 100) : 0;
    const ringSize = compact ? 50 : 60;
    const strokeWidth = compact ? 4 : 5;

    return (
      <View key={stat.label} style={styles.progressRingContainer}>
        <View style={[styles.progressRing, { width: ringSize, height: ringSize }]}>
          {/* Background circle */}
          <View style={[styles.progressRingBg, { borderColor: `${stat.color}20`, borderWidth: strokeWidth }]} />
          {/* Progress indicator (simplified - in production use SVG) */}
          <View style={[styles.progressRingProgress, { backgroundColor: stat.color }]}>
            <Ionicons name={stat.icon as any} size={compact ? 18 : 22} color="#FFF" />
          </View>
        </View>
        <Text style={[styles.progressLabel, { color: theme.text }]}>{stat.label}</Text>
        <Text style={[styles.progressValue, { color: stat.color }]}>
          {stat.value}/{stat.max}
        </Text>
      </View>
    );
  };

  const renderBadge = (badge: Badge) => {
    const isEarned = !!badge.earned_at;
    const progress = badge.progress || 100;

    return (
      <TouchableOpacity
        key={badge.id}
        style={[
          styles.badgeItem,
          { backgroundColor: isEarned ? `${badge.color}15` : theme.card },
          !isEarned && styles.badgeItemLocked,
        ]}
        onPress={() => onBadgePress?.(badge)}
        activeOpacity={0.7}
      >
        <View style={[styles.badgeIcon, { backgroundColor: isEarned ? badge.color : `${badge.color}30` }]}>
          <Ionicons 
            name={badge.icon as any} 
            size={compact ? 18 : 22} 
            color={isEarned ? '#FFF' : badge.color} 
          />
          {!isEarned && (
            <View style={[styles.progressOverlay, { backgroundColor: badge.color }]}>
              <Text style={styles.progressText}>{Math.round(progress)}%</Text>
            </View>
          )}
        </View>
        {!compact && (
          <>
            <Text style={[styles.badgeName, { color: theme.text }]} numberOfLines={1}>
              {badge.name}
            </Text>
            <Text style={[styles.badgeDesc, { color: theme.textSecondary }]} numberOfLines={1}>
              {badge.description}
            </Text>
          </>
        )}
        {isEarned && (
          <View style={[styles.earnedIndicator, { backgroundColor: badge.color }]}>
            <Ionicons name="checkmark" size={10} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="ribbon" size={20} color="#F59E0B" />
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Progress & Achievements
            </Text>
          </View>
        </View>
      )}

      {/* Progress Stats */}
      {!compact && progressStats.length > 0 && (
        <View style={styles.progressStatsRow}>
          {progressStats.map(renderProgressRing)}
        </View>
      )}

      {/* Badges */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.badgesContainer}
      >
        {earnedBadges.map(renderBadge)}
      </ScrollView>

      {/* Encouragement message */}
      {!compact && (
        <View style={[styles.encouragement, { backgroundColor: `${theme.success}10` }]}>
          <Ionicons name="sparkles" size={16} color={theme.success} />
          <Text style={[styles.encouragementText, { color: theme.success }]}>
            {earnedBadges.filter(b => b.earned_at).length > 0 
              ? `Great job! ${earnedBadges.filter(b => b.earned_at).length} badge${earnedBadges.filter(b => b.earned_at).length > 1 ? 's' : ''} earned this week!`
              : 'Keep going! You\'re making great progress!'
            }
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any, compact: boolean) =>
  StyleSheet.create({
    container: {
      borderRadius: 16,
      padding: compact ? 12 : 16,
      marginBottom: 16,
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    progressStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(128, 128, 128, 0.1)',
    },
    progressRingContainer: {
      alignItems: 'center',
    },
    progressRing: {
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    progressRingBg: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: 100,
    },
    progressRingProgress: {
      width: '70%',
      height: '70%',
      borderRadius: 100,
      justifyContent: 'center',
      alignItems: 'center',
    },
    progressLabel: {
      fontSize: 13,
      fontWeight: '500',
      marginTop: 6,
    },
    progressValue: {
      fontSize: 12,
      fontWeight: '600',
    },
    badgesContainer: {
      paddingVertical: 4,
      gap: 10,
    },
    badgeItem: {
      padding: compact ? 8 : 12,
      borderRadius: 12,
      alignItems: 'center',
      minWidth: compact ? 60 : 90,
      marginRight: 10,
    },
    badgeItemLocked: {
      opacity: 0.7,
    },
    badgeIcon: {
      width: compact ? 36 : 48,
      height: compact ? 36 : 48,
      borderRadius: compact ? 18 : 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: compact ? 0 : 8,
      position: 'relative',
    },
    progressOverlay: {
      position: 'absolute',
      bottom: -4,
      right: -4,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 8,
    },
    progressText: {
      color: '#FFF',
      fontSize: 8,
      fontWeight: '700',
    },
    badgeName: {
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    badgeDesc: {
      fontSize: 10,
      textAlign: 'center',
      marginTop: 2,
    },
    earnedIndicator: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 16,
      height: 16,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    encouragement: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      marginTop: 12,
      gap: 8,
    },
    encouragementText: {
      fontSize: 13,
      fontWeight: '500',
      flex: 1,
    },
  });

export default ChildProgressBadges;
