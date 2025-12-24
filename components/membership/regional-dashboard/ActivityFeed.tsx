/**
 * Activity Feed Component
 * Shows recent regional activity
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivityItem } from './types';

interface ActivityFeedProps {
  activities: ActivityItem[];
  theme: any;
}

export function ActivityFeed({ activities, theme }: ActivityFeedProps) {
  const getActivityIcon = (type: ActivityItem['type']): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'member_joined': return 'person-add';
      case 'payment_received': return 'cash-outline';
      case 'branch_created': return 'git-branch-outline';
      case 'card_issued': return 'card-outline';
      case 'approval_pending': return 'hourglass-outline';
      default: return 'ellipse';
    }
  };

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'member_joined': return '#10b981';
      case 'payment_received': return '#3b82f6';
      case 'branch_created': return '#8b5cf6';
      case 'card_issued': return '#f59e0b';
      case 'approval_pending': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <View style={[styles.activityContainer, { backgroundColor: theme.card }]}>
      {activities.map((activity, index) => (
        <View key={activity.id}>
          <View style={styles.activityItem}>
            <View style={[styles.activityIconContainer, { backgroundColor: getActivityColor(activity.type) + '15' }]}>
              <Ionicons 
                name={getActivityIcon(activity.type)} 
                size={18} 
                color={getActivityColor(activity.type)} 
              />
            </View>
            <View style={styles.activityContent}>
              <Text style={[styles.activityTitle, { color: theme.text }]}>
                {activity.title}
              </Text>
              <Text style={[styles.activityDescription, { color: theme.textSecondary }]}>
                {activity.description}
              </Text>
              <Text style={[styles.activityTime, { color: theme.textSecondary }]}>
                {activity.time}
              </Text>
            </View>
          </View>
          {index < activities.length - 1 && (
            <View style={[styles.activityDivider, { backgroundColor: theme.border }]} />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  activityContainer: {
    borderRadius: 16,
    padding: 4,
  },
  activityItem: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  activityDescription: {
    fontSize: 13,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 11,
  },
  activityDivider: {
    height: 1,
    marginLeft: 64,
  },
});
