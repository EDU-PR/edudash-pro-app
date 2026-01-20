/**
 * K12 Stats Overview Component
 * Displays aftercare statistics in a grid layout
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AftercareStat } from './types';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

interface K12StatsOverviewProps {
  stats: AftercareStat;
  theme: any;
}

export function K12StatsOverview({ stats, theme }: K12StatsOverviewProps) {
  const styles = createStyles(theme);

  return (
    <View style={styles.statsContainer}>
      <Text style={styles.sectionTitle}>Aftercare Overview</Text>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#3B82F620' }]}>
          <Ionicons name="people" size={24} color="#3B82F6" />
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Registrations</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#F59E0B20' }]}>
          <Ionicons name="time" size={24} color="#F59E0B" />
          <Text style={styles.statNumber}>{stats.pendingPayment}</Text>
          <Text style={styles.statLabel}>Pending Payment</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#10B98120' }]}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={styles.statNumber}>{stats.paid}</Text>
          <Text style={styles.statLabel}>Paid</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#8B5CF620' }]}>
          <Ionicons name="school" size={24} color="#8B5CF6" />
          <Text style={styles.statNumber}>{stats.enrolled}</Text>
          <Text style={styles.statLabel}>Enrolled</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  statsContainer: {
    padding: 20,
    marginTop: -20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  statCard: {
    width: isTablet ? '23%' : '47%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
});

export default K12StatsOverview;
