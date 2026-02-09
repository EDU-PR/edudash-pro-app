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
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { Badge, ProgressStat, getAppState, createStyles } from './ChildProgressBadges.styles';

interface ChildProgressBadgesProps {
  studentId: string;
  compact?: boolean;
  showHeader?: boolean;
  onBadgePress?: (badge: Badge) => void;
}

export function ChildProgressBadges({
  studentId,
  compact = false,
  showHeader = true,
  onBadgePress,
}: ChildProgressBadgesProps) {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [progressStats, setProgressStats] = useState<ProgressStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);

  const badgeDefinitions = useMemo<Badge[]>(() => [
    { id: 'attendance_star', name: t('dashboard.parent.progress.badges.attendance_star.name', { defaultValue: 'Attendance Star' }), description: t('dashboard.parent.progress.badges.attendance_star.description', { defaultValue: '5-day attendance streak!' }), icon: 'star', color: '#F59E0B' },
    { id: 'homework_hero', name: t('dashboard.parent.progress.badges.homework_hero.name', { defaultValue: 'Homework Hero' }), description: t('dashboard.parent.progress.badges.homework_hero.description', { defaultValue: 'Completed all homework this week' }), icon: 'trophy', color: '#10B981' },
    { id: 'helping_hand', name: t('dashboard.parent.progress.badges.helping_hand.name', { defaultValue: 'Helping Hand' }), description: t('dashboard.parent.progress.badges.helping_hand.description', { defaultValue: 'Helped a friend today' }), icon: 'heart', color: '#EC4899' },
    { id: 'creative_genius', name: t('dashboard.parent.progress.badges.creative_genius.name', { defaultValue: 'Creative Genius' }), description: t('dashboard.parent.progress.badges.creative_genius.description', { defaultValue: 'Outstanding artwork' }), icon: 'color-palette', color: '#8B5CF6' },
    { id: 'math_wizard', name: t('dashboard.parent.progress.badges.math_wizard.name', { defaultValue: 'Math Wizard' }), description: t('dashboard.parent.progress.badges.math_wizard.description', { defaultValue: 'Excellent counting skills' }), icon: 'calculator', color: '#3B82F6' },
    { id: 'bookworm', name: t('dashboard.parent.progress.badges.bookworm.name', { defaultValue: 'Bookworm' }), description: t('dashboard.parent.progress.badges.bookworm.description', { defaultValue: 'Loves story time' }), icon: 'book', color: '#6366F1' },
    { id: 'super_listener', name: t('dashboard.parent.progress.badges.super_listener.name', { defaultValue: 'Super Listener' }), description: t('dashboard.parent.progress.badges.super_listener.description', { defaultValue: 'Always follows instructions' }), icon: 'ear', color: '#06B6D4' },
    { id: 'kindness_champ', name: t('dashboard.parent.progress.badges.kindness_champ.name', { defaultValue: 'Kindness Champion' }), description: t('dashboard.parent.progress.badges.kindness_champ.description', { defaultValue: 'Shows kindness to everyone' }), icon: 'happy', color: '#F472B6' },
  ], [t]);

  const loadProgress = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    try {
      const supabase = assertSupabase();

      // Attendance progress (last 7 days, deduped per date)
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
      const windowStart = new Date(today);
      windowStart.setDate(today.getDate() - 6);

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('attendance_date, status')
        .eq('student_id', studentId)
        .gte('attendance_date', windowStart.toISOString().split('T')[0])
        .order('attendance_date', { ascending: false });

      const seenDates = new Set<string>();
      const recentAttendance = (attendanceData || [])
        .filter((row) => {
          if (!row.attendance_date || seenDates.has(row.attendance_date)) return false;
          seenDates.add(row.attendance_date);
          return true;
        })
        .slice(0, 5);

      const presentDays = recentAttendance.filter(a => a.status === 'present').length || 0;

      // Get student's class_id for homework queries
      const { data: studentData } = await supabase
        .from('students')
        .select('class_id')
        .eq('id', studentId)
        .single();

      // Calculate homework completion - out of 4 per week
      let completedHomework = 0;
      let totalHomework = 4; // Weekly homework target is 4

      if (studentData?.class_id) {
        // Get assignments for this week
        const { data: assignments } = await supabase
          .from('homework_assignments')
          .select('id')
          .eq('class_id', studentData.class_id)
          .eq('is_published', true)
          .gte('created_at', weekStart.toISOString())
          .lte('due_date', new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());

        const assignmentIds = assignments?.map(a => a.id) || [];

        if (assignmentIds.length > 0) {
          const { data: submissions } = await supabase
            .from('homework_submissions')
            .select('assignment_id, status')
            .eq('student_id', studentId)
            .in('assignment_id', assignmentIds);

          completedHomework = submissions?.filter(h =>
            h.status === 'submitted' || h.status === 'graded'
          ).length || 0;

          // Use actual assignments count, but default to 4 if less
          totalHomework = Math.max(assignmentIds.length, 4);
        }
      }

      // Set progress stats
      setProgressStats([
        {
          label: t('dashboard.parent.progress.stats.attendance', { defaultValue: 'Attendance' }),
          value: presentDays,
          max: 5,
          color: '#10B981',
          icon: 'calendar-outline',
        },
        {
          label: t('dashboard.parent.progress.stats.homework', { defaultValue: 'Homework' }),
          value: completedHomework,
          max: totalHomework,
          color: '#3B82F6',
          icon: 'document-text-outline',
        },
      ]);

      // Fetch real achievements from student_achievements table
      const { data: achievementsData } = await supabase
        .from('student_achievements')
        .select('*')
        .eq('student_id', studentId)
        .order('earned_at', { ascending: false });

      const badges: Badge[] = [];

      // Map database achievements to badges
      if (achievementsData && achievementsData.length > 0) {
        achievementsData.forEach((achievement: any) => {
          const matchingDef = badgeDefinitions.find(
            b => b.id === achievement.achievement_type ||
                 b.name.toLowerCase() === achievement.achievement_name.toLowerCase()
          );

          if (matchingDef) {
            badges.push({
              ...matchingDef,
              name: achievement.achievement_name || matchingDef.name,
              description: achievement.description || matchingDef.description,
              icon: achievement.achievement_icon || matchingDef.icon,
              color: achievement.achievement_color || matchingDef.color,
              earned_at: achievement.earned_at || achievement.created_at,
            });
          } else {
            // Custom achievement not in predefined list
            badges.push({
              id: achievement.id,
              name: achievement.achievement_name || t('dashboard.parent.progress.badges.default_name', { defaultValue: 'Achievement' }),
              description: achievement.description || '',
              icon: achievement.achievement_icon || 'star',
              color: achievement.achievement_color || '#F59E0B',
              earned_at: achievement.earned_at || achievement.created_at,
            });
          }
        });
      }

      // Add attendance badge based on current progress
      if (presentDays >= 5 && !badges.find(b => b.id === 'attendance_star')) {
        badges.push({ ...badgeDefinitions.find(b => b.id === 'attendance_star')!, earned_at: new Date().toISOString() });
      } else if (presentDays >= 3 && !badges.find(b => b.id === 'attendance_star')) {
        badges.push({ ...badgeDefinitions.find(b => b.id === 'attendance_star')!, progress: (presentDays / 5) * 100 });
      }

      // Add homework badge based on current progress
      if (completedHomework >= totalHomework && !badges.find(b => b.id === 'homework_hero')) {
        badges.push({ ...badgeDefinitions.find(b => b.id === 'homework_hero')!, earned_at: new Date().toISOString() });
      } else if (completedHomework > 0 && !badges.find(b => b.id === 'homework_hero')) {
        badges.push({ ...badgeDefinitions.find(b => b.id === 'homework_hero')!, progress: (completedHomework / totalHomework) * 100 });
      }

      setEarnedBadges(badges);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [badgeDefinitions, studentId, t]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  // AppState listener to refresh data when app becomes active
  useEffect(() => {
    const appState = getAppState();
    if (!appState?.addEventListener) {
      return;
    }
    const subscription = appState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadProgress();
      }
    });

    return () => subscription.remove();
  }, [loadProgress]);

  // Real-time updates for attendance & achievements
  useEffect(() => {
    if (!studentId) return;

    const supabase = assertSupabase();
    const attendanceSub = supabase
      .channel(`attendance_${studentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `student_id=eq.${studentId}` },
        () => {
          loadProgress();
        }
      )
      .subscribe();

    const achievementsSub = supabase
      .channel(`achievements_${studentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'student_achievements', filter: `student_id=eq.${studentId}` },
        () => {
          loadProgress();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceSub);
      supabase.removeChannel(achievementsSub);
    };
  }, [studentId, loadProgress]);

  const visibleBadges = useMemo(() => {
    const earned = earnedBadges.filter((badge) => badge.earned_at);
    const inProgress = earnedBadges.filter((badge) => !badge.earned_at);
    const maxBadges = compact ? 3 : 4;
    return [...earned, ...inProgress].slice(0, maxBadges);
  }, [earnedBadges, compact]);

  const renderProgressRing = (stat: ProgressStat) => {
    const progress = Math.round((stat.value / stat.max) * 100);

    return (
      <View key={stat.label} style={styles.progressItem}>
        <View style={[styles.progressRing, { borderColor: `${stat.color}30` }]}
        >
          {/* Progress indicator (simplified - in production use SVG) */}
          <View style={[styles.progressRingProgress, { backgroundColor: stat.color, height: `${progress}%` }]} />
          <Text style={[styles.progressValue, { color: theme.text }]}
          >
            {stat.value}/{stat.max}
          </Text>
        </View>
        <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
          {stat.label}
        </Text>
      </View>
    );
  };

  const renderBadge = (badge: Badge) => {
    const isEarned = !!badge.earned_at;

    return (
      <TouchableOpacity
        key={badge.id}
        style={[
          styles.badgeItem,
          { backgroundColor: isEarned ? `${badge.color}15` : theme.card },
          !isEarned && styles.badgeItemLocked,
        ]}
        onPress={() => onBadgePress?.(badge)}
      >
        <View style={[styles.badgeIcon, { backgroundColor: isEarned ? badge.color : `${badge.color}30` }]}>
          <Ionicons
            name={badge.icon as any}
            size={20}
            color={isEarned ? '#FFF' : badge.color}
          />
          {!isEarned && (
            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>{Math.round(badge.progress || 0)}%</Text>
            </View>
          )}
        </View>

        <View style={styles.badgeInfo}>
          <Text style={[styles.badgeName, { color: theme.text }]}>{badge.name}</Text>
          <Text style={[styles.badgeDescription, { color: theme.textSecondary }]}>
            {badge.description}
          </Text>
        </View>

        {isEarned && (
          <View style={[styles.earnedBadge, { backgroundColor: badge.color }]}
          >
            <Ionicons name="checkmark" size={12} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <EduDashSpinner size="small" color={theme.primary} />
      </View>
    );
  }

  // Don't render if no data
  if (progressStats.length === 0 && earnedBadges.length === 0) {
    return null;
  }

  const earnedCount = earnedBadges.filter(b => b.earned_at).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="ribbon" size={20} color={theme.primary} />
            <Text style={[styles.headerTitle, { color: theme.text }]}
            >
              {t('dashboard.parent.progress.title', { defaultValue: 'Progress & Achievements' })}
            </Text>
          </View>
          {!compact && lastUpdated && (
            <Text style={[styles.lastUpdated, { color: theme.textTertiary }]}>
              {t('dashboard.parent.progress.last_updated', { defaultValue: 'Updated {{time}}', time: new Date(lastUpdated).toLocaleTimeString(i18n.language || 'en-ZA', { hour: '2-digit', minute: '2-digit' }) })}
            </Text>
          )}
        </View>
      )}

      {/* Progress Stats */}
      <View style={styles.progressStatsContainer}>
        {progressStats.map(renderProgressRing)}
      </View>

      {/* Badges */}
      <View style={styles.badgesContainer}>
        {visibleBadges.map(renderBadge)}
      </View>

      {/* Summary */}
      {!compact && (
        <View style={[styles.summaryContainer, { backgroundColor: theme.background }]}>
          <Text style={[styles.summaryText, { color: theme.textSecondary }]}>
            {earnedCount > 0
              ? t('dashboard.parent.progress.summary.great_job', {
                  defaultValue: 'Great job! {{count}} badge earned.',
                  count: earnedCount,
                })
              : t('dashboard.parent.progress.summary.keep_going', { defaultValue: 'Keep going! Your child is making progress.' })}
          </Text>
        </View>
      )}
    </View>
  );
}

export default ChildProgressBadges;
