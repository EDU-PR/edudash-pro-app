/**
 * Top consuming schools section
 * @module components/super-admin/ai-quotas/TopConsumingSchools
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TopConsumingSchool } from './types';
import { formatNumber } from './utils';

interface TopConsumingSchoolsProps {
  schools: TopConsumingSchool[];
}

export function TopConsumingSchools({ schools }: TopConsumingSchoolsProps) {
  if (schools.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Top Consuming Schools</Text>
      {schools.map((school, index) => (
        <View key={index} style={styles.topSchoolItem}>
          <View style={styles.topSchoolInfo}>
            <Text style={styles.topSchoolRank}>#{index + 1}</Text>
            <Text style={styles.topSchoolName}>{school.school_name}</Text>
          </View>
          <View style={styles.topSchoolStats}>
            <Text style={styles.topSchoolUsage}>{formatNumber(school.usage)} tokens</Text>
            <Text style={styles.topSchoolPercentage}>{school.percentage.toFixed(1)}%</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  topSchoolItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  topSchoolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  topSchoolRank: {
    color: '#00f5ff',
    fontSize: 14,
    fontWeight: '600',
    width: 24,
  },
  topSchoolName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  topSchoolStats: {
    alignItems: 'flex-end',
  },
  topSchoolUsage: {
    color: '#9ca3af',
    fontSize: 12,
  },
  topSchoolPercentage: {
    color: '#9ca3af',
    fontSize: 10,
  },
});
