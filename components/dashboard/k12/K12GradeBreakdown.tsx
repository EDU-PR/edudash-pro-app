/**
 * K12 Grade Breakdown Component
 * Displays student count by grade in a horizontal scroll
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { GradeCount } from './types';

interface K12GradeBreakdownProps {
  gradeBreakdown: GradeCount[];
  theme: any;
}

export function K12GradeBreakdown({ gradeBreakdown, theme }: K12GradeBreakdownProps) {
  const styles = createStyles(theme);

  if (gradeBreakdown.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Students by Grade</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.gradeScroll}
      >
        {gradeBreakdown.map(({ grade, count }) => (
          <View key={grade} style={styles.gradeCard}>
            <Text style={styles.gradeLabel}>Grade {grade}</Text>
            <Text style={styles.gradeCount}>{count}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  section: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  gradeScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  gradeCard: {
    backgroundColor: theme.card,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  gradeLabel: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  gradeCount: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
    marginTop: 4,
  },
});

export default K12GradeBreakdown;
