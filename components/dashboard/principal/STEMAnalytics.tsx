/**
 * STEM Analytics Component
 * 
 * Displays STEM engagement metrics for principals
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSchoolAnalytics } from '@/hooks/useSchoolAnalytics';
import { Brain, Cpu, Laptop } from 'lucide-react';

interface STEMAnalyticsProps {
  preschoolId: string;
}

export function STEMAnalytics({ preschoolId }: STEMAnalyticsProps) {
  const { theme } = useTheme();
  const { data: analytics, isLoading } = useSchoolAnalytics(preschoolId);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={{ color: theme.textSecondary }}>Loading analytics...</Text>
      </View>
    );
  }

  if (!analytics) {
    return null;
  }

  const programs = [
    {
      id: 'ai',
      name: 'AI Program',
      icon: Brain,
      color: '#8b5cf6',
      data: analytics.stemEngagement.ai,
    },
    {
      id: 'robotics',
      name: 'Robotics Program',
      icon: Cpu,
      color: '#f59e0b',
      data: analytics.stemEngagement.robotics,
    },
    {
    id: 'computer_literacy',
      name: 'Computer Literacy',
      icon: Laptop,
      color: '#06b6d4',
      data: analytics.stemEngagement.computer_literacy,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>STEM Engagement</Text>
      <View style={styles.grid}>
        {programs.map((program) => {
          const Icon = program.icon;
          return (
            <View key={program.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.iconContainer, { backgroundColor: `${program.color}20` }]}>
                <Icon size={24} color={program.color} />
              </View>
              <Text style={[styles.cardTitle, { color: theme.text }]}>{program.name}</Text>
              <View style={styles.metrics}>
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: theme.text }]}>
                    {program.data.lessonsCompleted}
                  </Text>
                  <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Lessons</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: theme.text }]}>
                    {program.data.activitiesCompleted}
                  </Text>
                  <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Activities</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={[styles.metricValue, { color: theme.primary }]}>
                    {program.data.engagementScore}%
                  </Text>
                  <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Engagement</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  metrics: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
  },
});
