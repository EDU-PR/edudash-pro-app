/**
 * Legacy Activity List Component
 * Shows activity with icons and subtitles (older format)
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import type { LegacyActivityItem } from './types';

interface LegacyActivityListProps {
  activities: LegacyActivityItem[];
  theme: any;
}

export function LegacyActivityList({ activities, theme }: LegacyActivityListProps) {
  return (
    <Card padding={0} margin={0}>
      {activities.map((activity, index) => (
        <View key={index}>
          <View style={styles.activityItem}>
            <View style={[styles.activityIcon, { backgroundColor: activity.color + '15' }]}>
              <Ionicons name={activity.icon as any} size={18} color={activity.color} />
            </View>
            <View style={styles.activityInfo}>
              <Text style={[styles.activityTitle, { color: theme.text }]}>{activity.title}</Text>
              <Text style={[styles.activitySubtitle, { color: theme.textSecondary }]}>
                {activity.subtitle}
              </Text>
            </View>
            <Text style={[styles.activityTime, { color: theme.textSecondary }]}>{activity.time}</Text>
          </View>
          {index < activities.length - 1 && (
            <View style={[styles.activityDivider, { backgroundColor: theme.border }]} />
          )}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  activitySubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 11,
  },
  activityDivider: {
    height: 1,
    marginLeft: 62,
  },
});
