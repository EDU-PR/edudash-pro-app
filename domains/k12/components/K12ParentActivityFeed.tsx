/**
 * K12ParentActivityFeed
 *
 * Unified activity timeline merging Recent Activity, Learning Snapshot,
 * and Upcoming Events. Sorted by recency, limited to 5 items with "See All".
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '@/components/nextgen/GlassCard';
import type { ThemeColors } from '@/contexts/ThemeContext';
import type { RecentUpdate, UpcomingEvent } from '@/domains/k12/hooks/useK12ParentData';
import type { LearningCompletion } from '@/domains/k12/hooks/useK12ParentDashboard';
import { styles } from './K12ParentDashboard.styles';

interface TimelineEntry {
  id: string;
  category: 'activity' | 'learning' | 'event';
  icon: string;
  iconColor: string;
  child: string;
  message: string;
  time: string;
  onPress?: () => void;
}

interface K12ParentActivityFeedProps {
  recentUpdates: RecentUpdate[];
  recentLearningCompletions: LearningCompletion[];
  upcomingEvents: UpcomingEvent[];
  onSeeAll: () => void;
  onEventPress: (eventId: string, eventDate: string) => void;
  theme: ThemeColors;
  quickWinsEnabled: boolean;
}

export function K12ParentActivityFeed({
  recentUpdates,
  recentLearningCompletions,
  upcomingEvents,
  onSeeAll,
  onEventPress,
  theme,
  quickWinsEnabled,
}: K12ParentActivityFeedProps) {
  const { t } = useTranslation();

  const timelineEntries: TimelineEntry[] = useMemo(() => {
    const entries: TimelineEntry[] = [];

    recentUpdates.forEach((update) => {
      entries.push({
        id: update.id,
        category: 'activity',
        icon: update.icon,
        iconColor: update.color,
        child: update.child,
        message: update.message,
        time: update.time,
      });
    });

    recentLearningCompletions.forEach((entry) => {
      entries.push({
        id: `learn-${entry.id}`,
        category: 'learning',
        icon: 'checkmark-done',
        iconColor: '#10B981',
        child: entry.child,
        message: entry.averageScore != null
          ? `Avg score ${entry.averageScore}% • completion ${entry.completionRate}%`
          : `Completion ${entry.completionRate}%`,
        time: entry.averageStars != null ? `${entry.averageStars}/3★` : '--',
      });
    });

    upcomingEvents.forEach((event) => {
      entries.push({
        id: `event-${event.id}`,
        category: 'event',
        icon: 'calendar',
        iconColor: '#8B5CF6',
        child: event.date,
        message: event.title,
        time: event.time,
        onPress: () => onEventPress(event.id, event.date),
      });
    });

    return entries.slice(0, 5);
  }, [recentUpdates, recentLearningCompletions, upcomingEvents, onEventPress]);

  const isEmpty = timelineEntries.length === 0;

  return (
    <View style={styles.section}>
      <GlassCard style={styles.sectionHeaderCard} padding={14}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeaderTitle, { color: theme.text }]}>
            {t('dashboard.recent_activity', { defaultValue: 'Recent Activity' })}
          </Text>
          {!isEmpty && (
            <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={[styles.sectionHeaderAction, { color: theme.primary }]}>
                {t('common.see_all', { defaultValue: 'See All' })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.sectionHeaderHint, { color: theme.textSecondary }]}>
          {t('dashboard.recent_activity_hint', { defaultValue: 'Latest updates from teachers and classwork.' })}
        </Text>
      </GlassCard>

      {isEmpty ? (
        <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
          <Ionicons name="newspaper-outline" size={32} color={theme.textSecondary} />
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
            {t('dashboard.noActivity', { defaultValue: 'No recent activity' })}
          </Text>
        </View>
      ) : (
        <View style={styles.activityTimelineContainer}>
          {timelineEntries.map((entry) => {
            const Wrapper = entry.onPress ? TouchableOpacity : View;
            const wrapperProps = entry.onPress
              ? { onPress: entry.onPress, activeOpacity: 0.7 }
              : {};
            return (
              <Wrapper
                key={entry.id}
                style={[
                  styles.activityTimelineItem,
                  {
                    backgroundColor: theme.surface,
                    borderColor: quickWinsEnabled ? 'rgba(255,255,255,0.1)' : theme.border,
                    borderWidth: quickWinsEnabled ? 1 : 0,
                  },
                ]}
                {...wrapperProps}
              >
                <View style={[styles.activityTimelineIcon, { backgroundColor: entry.iconColor + '20' }]}>
                  <Ionicons name={entry.icon as keyof typeof Ionicons.glyphMap} size={18} color={entry.iconColor} />
                </View>
                <View style={styles.activityTimelineInfo}>
                  <Text style={[styles.activityTimelineChild, { color: theme.textSecondary }]}>
                    {entry.child}
                  </Text>
                  <Text style={[styles.activityTimelineMessage, { color: theme.text }]}>
                    {entry.message}
                  </Text>
                </View>
                <Text style={[styles.activityTimelineTime, { color: theme.textSecondary }]}>
                  {entry.time}
                </Text>
              </Wrapper>
            );
          })}
        </View>
      )}
    </View>
  );
}
