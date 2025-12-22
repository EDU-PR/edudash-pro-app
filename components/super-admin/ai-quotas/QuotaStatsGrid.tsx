/**
 * Stats grid component for AI Quota overview
 * @module components/super-admin/ai-quotas/QuotaStatsGrid
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { UsageStatistics } from './types';
import { formatNumber, formatCurrency } from './utils';

interface QuotaStatsGridProps {
  stats: UsageStatistics;
}

export function QuotaStatsGrid({ stats }: QuotaStatsGridProps) {
  return (
    <View style={styles.statsGrid}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{formatNumber(stats.total_tokens_used)}</Text>
        <Text style={styles.statLabel}>Total Tokens Used</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{formatCurrency(stats.total_cost)}</Text>
        <Text style={styles.statLabel}>Total Overage Cost</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.schools_over_limit}</Text>
        <Text style={styles.statLabel}>Schools Over Limit</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.schools_suspended}</Text>
        <Text style={styles.statLabel}>Suspended Schools</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: 80,
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  statValue: {
    color: '#00f5ff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 10,
    textAlign: 'center',
  },
});
