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
  AppState,
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
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);

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
          label: 'Attendance',
          value: presentDays,
          max: 5,
          color: '#10B981',
          icon: 'calendar-outline',
        },
        {
          label: 'Homework',
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
          const matchingDef = BADGE_DEFINITIONS.find(
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
              name: achievement.achievement_name,
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
        badges.push({ ...BADGE_DEFINITIONS.find(b => b.id === 'attendance_star')!, earned_at: new Date().toISOString() });
      } else if (presentDays >= 3 && !badges.find(b => b.id === 'attendance_star')) {
        badges.push({ ...BADGE_DEFINITIONS.find(b => b.id === 'attendance_star')!, progress: (presentDays / 5) * 100 });
      }

      // Add homework badge based on current progress
      if (completedHomework >= totalHomework && !badges.find(b => b.id === 'homework_hero')) {
        badges.push({ ...BADGE_DEFINITIONS.find(b => b.id === 'homework_hero')!, earned_at: new Date().toISOString() });
      } else if (completedHomework > 0 && !badges.find(b => b.id === 'homework_hero')) {
        badges.push({ ...BADGE_DEFINITIONS.find(b => b.id === 'homework_hero')!, progress: (completedHomework / totalHomework) * 100 });
      }

      // Add helping_hand and bookworm with real progress from activities
      // Check if student has shared work or helped others (from daily_activities or similar)
      const { data: helpingActivities } = await supabase
        .from('student_achievements')
        .select('id')
        .eq('student_id', studentId)
        .or('achievement_type.eq.helping_hand,achievement_name.ilike.%help%,category.eq.social')
        .limit(5);
      
      const helpingCount = helpingActivities?.length || 0;
      if (helpingCount >= 3 && !badges.find(b => b.id === 'helping_hand')) {
        badges.push({ ...BADGE_DEFINITIONS.find(b => b.id === 'helping_hand')!, earned_at: new Date().toISOString() });
      } else if (!badges.find(b => b.id === 'helping_hand')) {
        badges.push({ ...BADGE_DEFINITIONS.find(b => b.id === 'helping_hand')!, progress: Math.min((helpingCount / 3) * 100, 99) });
      }

      // Check reading/storytime activities for bookworm
      const { data: readingActivities } = await supabase
        .from('student_achievements')
        .select('id')
        .eq('student_id', studentId)
        .or('achievement_type.eq.bookworm,achievement_name.ilike.%read%,achievement_name.ilike.%story%,category.eq.reading')
        .limit(5);
      
      const readingCount = readingActivities?.length || 0;
      if (readingCount >= 5 && !badges.find(b => b.id === 'bookworm')) {
        badges.push({ ...BADGE_DEFINITIONS.find(b => b.id === 'bookworm')!, earned_at: new Date().toISOString() });
      } else if (!badges.find(b => b.id === 'bookworm')) {
        badges.push({ ...BADGE_DEFINITIONS.find(b => b.id === 'bookworm')!, progress: Math.min((readingCount / 5) * 100, 99) });
      }

      setEarnedBadges(badges);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error('[ChildProgressBadges] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadProgress();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [loadProgress]);

  const visibleBadges = useMemo(() => {
    const earned = earnedBadges.filter((badge) => badge.earned_at);
    const inProgress = earnedBadges.filter((badge) => !badge.earned_at);
    const maxBadges = compact ? 3 : 4;
    return [...earned, ...inProgress].slice(0, maxBadges);
  }, [earnedBadges, compact]);

  // Set up realtime subscription for attendance and achievements updates
  useEffect(() => {
    if (!studentId) return;
    
    const supabase = assertSupabase();
    
    // Subscribe to attendance changes for this student
    const attendanceChannel = supabase
      .channel(`child-progress-attendance-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          console.log('[ChildProgressBadges] Attendance updated');
          loadProgress();
        }
      )
      .subscribe();

    // Subscribe to achievement changes for this student
    const achievementsChannel = supabase
      .channel(`child-progress-achievements-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_achievements',
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          console.log('[ChildProgressBadges] Achievements updated');
          loadProgress();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(achievementsChannel);
    };
  }, [studentId, loadProgress]);

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
              Progress & Acknowledgement
            </Text>
          </View>
          {!compact && lastUpdated && (
            <Text style={[styles.headerMeta, { color: theme.textSecondary }]}>
              Updated {new Date(lastUpdated).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
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
        {visibleBadges.map(renderBadge)}
      </ScrollView>

      {/* Encouragement message */}
      {!compact && (
        <View style={[styles.encouragement, { backgroundColor: `${theme.success}10` }]}>
          <Ionicons name="sparkles" size={16} color={theme.success} />
          <Text style={[styles.encouragementText, { color: theme.success }]}>
            {earnedBadges.filter(b => b.earned_at).length > 0 
              ? `Great job! ${earnedBadges.filter(b => b.earned_at).length} badge${earnedBadges.filter(b => b.earned_at).length > 1 ? 's' : ''} earned.`
              : 'Keep going! New updates will show here.'
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
    headerMeta: {
      fontSize: 12,
      fontWeight: '500',
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
