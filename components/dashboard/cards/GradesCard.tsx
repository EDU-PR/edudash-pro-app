import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { DashboardCard } from './DashboardCard';
import { useTheme } from '@/contexts/ThemeContext';

export function GradesCard() {
  const { theme } = useTheme();

  // TODO: Replace with real grades data
  const grades = [
    { subject: 'Mathematics', grade: 'A', percentage: 92 },
    { subject: 'Science', grade: 'B+', percentage: 87 },
    { subject: 'English', grade: 'A-', percentage: 90 },
  ];

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return theme.colors?.success || theme.success || '#10b981';
    if (percentage >= 80) return theme.colors?.info || theme.info || '#3b82f6';
    if (percentage >= 70) return theme.colors?.warning || theme.warning || '#f59e0b';
    return theme.colors?.error || theme.error || '#ef4444';
  };

  return (
    <DashboardCard title="Recent Grades" icon="school-outline">
      <View style={styles.list}>
        {grades.map((item, idx) => (
          <View key={idx} style={styles.item}>
            <View style={styles.subjectRow}>
              <Text style={[styles.subject, { color: theme.text }]}>{item.subject}</Text>
              <View style={styles.gradeContainer}>
                <Text
                  style={[styles.grade, { color: getGradeColor(item.percentage) }]}
                >
                  {item.grade}
                </Text>
                <Text style={[styles.percentage, { color: theme.textSecondary }]}>({item.percentage}%)</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  item: {
    paddingVertical: 4,
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subject: {
    fontSize: 14,
    fontWeight: '500',
  },
  gradeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  grade: {
    fontSize: 16,
    fontWeight: '700',
  },
  percentage: {
    fontSize: 12,
    opacity: 0.6,
  },
});
