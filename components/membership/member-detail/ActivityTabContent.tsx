/**
 * Activity Tab Content Component
 * Activity timeline for member
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivityTabProps } from './types';

export function ActivityTabContent({ activities, theme }: ActivityTabProps) {
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <View>
      {activities.map((activity, index) => (
        <View key={activity.id} style={styles.activityItem}>
          {/* Timeline connector */}
          {index < activities.length - 1 && (
            <View style={[styles.timelineConnector, { backgroundColor: theme.border }]} />
          )}
          
          <View style={[styles.activityIcon, { backgroundColor: activity.color + '20' }]}>
            <Ionicons name={activity.icon as any} size={16} color={activity.color} />
          </View>
          
          <View style={[styles.activityContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.activityAction, { color: theme.text }]}>{activity.action}</Text>
            <Text style={[styles.activityDetails, { color: theme.textSecondary }]}>{activity.details}</Text>
            <Text style={[styles.activityDate, { color: theme.textSecondary }]}>{formatDate(activity.date)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  activityItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    left: 15,
    top: 36,
    width: 2,
    height: 'calc(100% + 12px)' as any,
    bottom: -12,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  activityDetails: {
    fontSize: 13,
    marginBottom: 6,
  },
  activityDate: {
    fontSize: 11,
  },
});
