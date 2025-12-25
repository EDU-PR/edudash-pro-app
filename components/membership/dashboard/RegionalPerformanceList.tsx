/**
 * Regional Performance List Component
 * Shows performance metrics for each region
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { RegionalPerformance } from './types';

interface RegionalPerformanceListProps {
  regions: RegionalPerformance[];
  theme: any;
  onRegionPress?: (region: RegionalPerformance) => void;
}

export function RegionalPerformanceList({ regions, theme, onRegionPress }: RegionalPerformanceListProps) {
  const formatCurrency = (amount: number) => {
    return `R ${(amount / 1000).toFixed(0)}K`;
  };

  return (
    <View>
      {regions.map((region) => (
        <TouchableOpacity 
          key={region.region}
          style={[styles.regionCard, { backgroundColor: theme.card }]}
          onPress={() => onRegionPress?.(region)}
        >
          <View style={styles.regionHeader}>
            <View style={styles.regionTitleRow}>
              <Text style={[styles.regionName, { color: theme.text }]}>{region.region}</Text>
              {region.manager === 'Vacant' && (
                <View style={styles.vacantBadge}>
                  <Text style={styles.vacantText}>Vacant</Text>
                </View>
              )}
            </View>
            <Text style={[styles.regionManager, { color: theme.textSecondary }]}>
              {region.manager === 'Vacant' ? 'Manager needed' : region.manager}
            </Text>
          </View>
          
          <View style={styles.regionMetrics}>
            <View style={styles.regionMetric}>
              <Text style={[styles.regionMetricValue, { color: theme.text }]}>
                {region.members}
              </Text>
              <Text style={[styles.regionMetricLabel, { color: theme.textSecondary }]}>
                Members
              </Text>
            </View>
            
            <View style={styles.regionMetric}>
              <Text style={[styles.regionMetricValue, { color: theme.text }]}>
                {formatCurrency(region.revenue)}
              </Text>
              <Text style={[styles.regionMetricLabel, { color: theme.textSecondary }]}>
                Revenue
              </Text>
            </View>
            
            <View style={styles.regionMetric}>
              <Text style={[styles.regionMetricValue, { color: region.growth > 10 ? '#10B981' : '#F59E0B' }]}>
                +{region.growth}%
              </Text>
              <Text style={[styles.regionMetricLabel, { color: theme.textSecondary }]}>
                Growth
              </Text>
            </View>
            
            <View style={styles.regionMetric}>
              <Text style={[styles.regionMetricValue, { color: theme.text }]}>
                {region.satisfaction}%
              </Text>
              <Text style={[styles.regionMetricLabel, { color: theme.textSecondary }]}>
                Satisfaction
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  regionCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  regionHeader: {
    marginBottom: 12,
  },
  regionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  regionName: {
    fontSize: 16,
    fontWeight: '700',
  },
  vacantBadge: {
    backgroundColor: '#EF444420',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  vacantText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
  },
  regionManager: {
    fontSize: 13,
    marginTop: 2,
  },
  regionMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  regionMetric: {
    alignItems: 'center',
  },
  regionMetricValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  regionMetricLabel: {
    fontSize: 10,
    marginTop: 2,
  },
});
