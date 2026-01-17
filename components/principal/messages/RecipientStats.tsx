// Recipient Stats Component

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { RecipientCounts } from './types';

interface RecipientStatsProps {
  counts: RecipientCounts;
  loading: boolean;
}

export function RecipientStats({ counts, loading }: RecipientStatsProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.statsRow}>
      <View style={[styles.statCard, { backgroundColor: '#10B981' + '20' }]}>
        <Ionicons name="people" size={24} color="#10B981" />
        <Text style={[styles.statNumber, { color: '#10B981' }]}>
          {loading ? '...' : counts.parents}
        </Text>
        <Text style={styles.statLabel}>Parents</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: '#3B82F6' + '20' }]}>
        <Ionicons name="school" size={24} color="#3B82F6" />
        <Text style={[styles.statNumber, { color: '#3B82F6' }]}>
          {loading ? '...' : counts.teachers}
        </Text>
        <Text style={styles.statLabel}>Teachers</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: '#8B5CF6' + '20' }]}>
        <Ionicons name="briefcase" size={24} color="#8B5CF6" />
        <Text style={[styles.statNumber, { color: '#8B5CF6' }]}>
          {loading ? '...' : counts.staff}
        </Text>
        <Text style={styles.statLabel}>Staff</Text>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    color: theme?.textSecondary || '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
