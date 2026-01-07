/**
 * Home Activity Card Component
 * 
 * Displays a single home activity suggestion in a card format.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface HomeActivityCardProps {
  activity: string;
  index: number;
  theme: any;
}

const ACTIVITY_ICONS = ['book', 'color-palette', 'musical-notes', 'football', 'calculator', 'leaf'];

export function HomeActivityCard({ activity, index, theme }: HomeActivityCardProps) {
  const icon = ACTIVITY_ICONS[index % ACTIVITY_ICONS.length];
  
  return (
    <View style={[styles.card, { backgroundColor: theme.cardSecondary }]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.primary + '20' }]}>
        <Ionicons name={icon as any} size={24} color={theme.primary} />
      </View>
      <Text style={[styles.activityText, { color: theme.textSecondary }]}>
        {activity}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },
});
