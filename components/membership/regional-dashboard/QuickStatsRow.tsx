/**
 * Quick Stats Row Component
 * Shows compact stats in a horizontal row
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';

export interface QuickStat {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color: string;
  valueColor?: string;
}

interface QuickStatsRowProps {
  stats: QuickStat[];
  theme: any;
}

export function QuickStatsRow({ stats, theme }: QuickStatsRowProps) {
  return (
    <View style={styles.statsRow}>
      {stats.map((stat) => (
        <Card key={stat.id} padding={14} margin={0} style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: stat.color + '15' }]}>
            <Ionicons name={stat.icon} size={18} color={stat.color} />
          </View>
          <Text style={[styles.statValue, { color: stat.valueColor || theme.text }]}>
            {stat.value}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            {stat.label}
          </Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 4,
  },
});
