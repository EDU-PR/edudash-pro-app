/**
 * Branch Performance List Component
 * Shows branches with performance indicators
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { Branch } from './types';

interface BranchPerformanceListProps {
  branches: Branch[];
  theme: any;
}

export function BranchPerformanceList({ branches, theme }: BranchPerformanceListProps) {
  const getPerformanceColor = (growth: number) => {
    if (growth >= 10) return '#10b981';
    if (growth >= 0) return '#f59e0b';
    return '#ef4444';
  };

  const getPerformanceIcon = (growth: number): keyof typeof Ionicons.glyphMap => {
    if (growth >= 10) return 'trending-up';
    if (growth >= 0) return 'remove-outline';
    return 'trending-down';
  };

  return (
    <View style={styles.branchesContainer}>
      {branches.map((branch) => (
        <TouchableOpacity
          key={branch.id}
          style={[styles.branchCard, { backgroundColor: theme.card }]}
          onPress={() => router.push(`/screens/membership/branch-detail?id=${branch.id}`)}
        >
          <View style={styles.branchHeader}>
            <View style={styles.branchInfo}>
              <Text style={[styles.branchName, { color: theme.text }]}>{branch.name}</Text>
              <Text style={[styles.branchLeader, { color: theme.textSecondary }]}>
                {branch.leader}
              </Text>
            </View>
            <View style={[styles.branchPerformance, { backgroundColor: getPerformanceColor(branch.growth) + '15' }]}>
              <Ionicons 
                name={getPerformanceIcon(branch.growth)} 
                size={18} 
                color={getPerformanceColor(branch.growth)} 
              />
              <Text style={[styles.branchGrowth, { color: getPerformanceColor(branch.growth) }]}>
                {branch.growth > 0 ? '+' : ''}{branch.growth}%
              </Text>
            </View>
          </View>
          <View style={styles.branchStats}>
            <View style={styles.branchStat}>
              <Text style={[styles.branchStatValue, { color: theme.text }]}>{branch.members}</Text>
              <Text style={[styles.branchStatLabel, { color: theme.textSecondary }]}>Members</Text>
            </View>
            <View style={[styles.branchStatDivider, { backgroundColor: theme.border }]} />
            <View style={styles.branchStat}>
              <Text style={[styles.branchStatValue, { color: theme.text }]}>
                R {branch.collections.toLocaleString()}
              </Text>
              <Text style={[styles.branchStatLabel, { color: theme.textSecondary }]}>Collections</Text>
            </View>
            <View style={[styles.branchStatDivider, { backgroundColor: theme.border }]} />
            <View style={styles.branchStat}>
              <Text style={[styles.branchStatValue, { color: theme.text }]}>{branch.pending}</Text>
              <Text style={[styles.branchStatLabel, { color: theme.textSecondary }]}>Pending</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  branchesContainer: {
    gap: 12,
  },
  branchCard: {
    borderRadius: 16,
    padding: 16,
  },
  branchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  branchInfo: {
    flex: 1,
  },
  branchName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  branchLeader: {
    fontSize: 13,
  },
  branchPerformance: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  branchGrowth: {
    fontSize: 13,
    fontWeight: '600',
  },
  branchStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  branchStat: {
    alignItems: 'center',
    flex: 1,
  },
  branchStatValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  branchStatLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  branchStatDivider: {
    width: 1,
    height: 32,
  },
});
