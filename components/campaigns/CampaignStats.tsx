/**
 * Campaign Stats Header Component
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface CampaignStatsProps {
  totalCampaigns: number;
  activeCampaigns: number;
  totalConversions: number;
  isDark: boolean;
  theme: any;
}

export function CampaignStats({
  totalCampaigns,
  activeCampaigns,
  totalConversions,
  isDark,
  theme,
}: CampaignStatsProps) {
  return (
    <LinearGradient
      colors={isDark ? ['#1e293b', '#0f172a'] : ['#f8fafc', '#f1f5f9']}
      style={styles.header}
    >
      <View style={styles.headerStats}>
        <View style={styles.headerStat}>
          <Text style={[styles.headerStatValue, { color: '#6366f1' }]}>
            {totalCampaigns}
          </Text>
          <Text style={[styles.headerStatLabel, { color: theme.text }]}>
            Total
          </Text>
        </View>
        <View style={styles.headerStatDivider} />
        <View style={styles.headerStat}>
          <Text style={[styles.headerStatValue, { color: '#22c55e' }]}>
            {activeCampaigns}
          </Text>
          <Text style={[styles.headerStatLabel, { color: theme.text }]}>
            Active
          </Text>
        </View>
        <View style={styles.headerStatDivider} />
        <View style={styles.headerStat}>
          <Text style={[styles.headerStatValue, { color: '#f59e0b' }]}>
            {totalConversions}
          </Text>
          <Text style={[styles.headerStatLabel, { color: theme.text }]}>
            Conversions
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
  },
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  headerStat: {
    alignItems: 'center',
    minWidth: 70,
  },
  headerStatValue: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerStatLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(128,128,128,0.3)',
  },
});
