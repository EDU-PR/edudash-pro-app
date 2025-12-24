/**
 * Regional Hero Card Component
 * Displays regional stats and info at top of dashboard
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { RegionalStats } from './types';

interface RegionalHeroProps {
  regionName: string;
  regionCode: string;
  regionColor: string;
  stats: RegionalStats;
}

export function RegionalHero({ regionName, regionCode, regionColor, stats }: RegionalHeroProps) {
  return (
    <LinearGradient
      colors={[regionColor, regionColor + 'DD', regionColor + 'BB']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroCard}
    >
      <View style={styles.heroHeader}>
        <View>
          <Text style={styles.heroTitle}>{regionName.toUpperCase()}</Text>
          <Text style={styles.heroSubtitle}>Regional Manager Dashboard</Text>
        </View>
        <View style={styles.heroBadge}>
          <Ionicons name="location" size={14} color="#fff" />
          <Text style={styles.heroBadgeText}>{regionCode}</Text>
        </View>
      </View>
      
      <View style={styles.heroStats}>
        <View style={styles.heroStatItem}>
          <Text style={styles.heroStatValue}>{stats.regionMembers}</Text>
          <Text style={styles.heroStatLabel}>Members</Text>
        </View>
        <View style={styles.heroStatDivider} />
        <View style={styles.heroStatItem}>
          <Text style={styles.heroStatValue}>{stats.activeBranches}</Text>
          <Text style={styles.heroStatLabel}>Branches</Text>
        </View>
        <View style={styles.heroStatDivider} />
        <View style={styles.heroStatItem}>
          <Text style={styles.heroStatValue}>+{stats.newMembersThisMonth}</Text>
          <Text style={styles.heroStatLabel}>This Month</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  heroStatItem: {
    alignItems: 'center',
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
});
