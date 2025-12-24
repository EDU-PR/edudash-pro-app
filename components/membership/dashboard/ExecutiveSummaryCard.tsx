/**
 * Executive Summary Card Component
 * Main stats card for CEO dashboard
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ExecutiveStats } from './types';

interface ExecutiveSummaryCardProps {
  stats: ExecutiveStats;
  organizationName?: string;
}

export function ExecutiveSummaryCard({ stats, organizationName = 'SOIL OF AFRICA' }: ExecutiveSummaryCardProps) {
  const formatCurrency = (amount: number) => {
    return `R ${(amount / 1000).toFixed(0)}K`;
  };

  return (
    <LinearGradient
      colors={['#0F172A', '#1E293B', '#334155']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.executiveCard}
    >
      <View style={styles.executiveHeader}>
        <View>
          <Text style={styles.executiveTitle}>{organizationName}</Text>
          <Text style={styles.executiveSubtitle}>Executive Overview</Text>
        </View>
        <View style={styles.healthBadge}>
          <View style={[styles.healthIndicator, { backgroundColor: '#10B981' }]} />
          <Text style={styles.healthText}>{stats.organizationHealth}% Health</Text>
        </View>
      </View>
      
      <View style={styles.executiveMetrics}>
        <View style={styles.executiveMetric}>
          <Text style={styles.executiveValue}>{stats.totalMembers.toLocaleString()}</Text>
          <Text style={styles.executiveLabel}>Total Members</Text>
          <View style={styles.executiveTrend}>
            <Ionicons name="trending-up" size={14} color="#10B981" />
            <Text style={[styles.executiveTrendText, { color: '#10B981' }]}>
              +{stats.membershipGrowth}%
            </Text>
          </View>
        </View>
        
        <View style={styles.executiveMetricDivider} />
        
        <View style={styles.executiveMetric}>
          <Text style={styles.executiveValue}>{formatCurrency(stats.totalRevenue)}</Text>
          <Text style={styles.executiveLabel}>Annual Revenue</Text>
          <View style={styles.executiveTrend}>
            <Ionicons name="trending-up" size={14} color="#10B981" />
            <Text style={[styles.executiveTrendText, { color: '#10B981' }]}>
              +{stats.revenueGrowth}%
            </Text>
          </View>
        </View>
        
        <View style={styles.executiveMetricDivider} />
        
        <View style={styles.executiveMetric}>
          <Text style={styles.executiveValue}>{stats.memberRetention}%</Text>
          <Text style={styles.executiveLabel}>Retention Rate</Text>
          <View style={styles.executiveTrend}>
            <Ionicons name="trending-up" size={14} color="#10B981" />
            <Text style={[styles.executiveTrendText, { color: '#10B981' }]}>+2.3%</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  executiveCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  executiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  executiveTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  executiveSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 4,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  healthIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  healthText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  executiveMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  executiveMetric: {
    alignItems: 'center',
  },
  executiveValue: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '700',
  },
  executiveLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 4,
  },
  executiveTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  executiveTrendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  executiveMetricDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
