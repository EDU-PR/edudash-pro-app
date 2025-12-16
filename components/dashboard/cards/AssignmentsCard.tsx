import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { DashboardCard } from './DashboardCard';
import { useTerm } from '@/contexts/TerminologyContext';
import { useTheme } from '@/contexts/ThemeContext';

export function AssignmentsCard() {
  const taskTerm = useTerm('task'); // "Assignment" / "Task" / "Project"
  const { theme } = useTheme();

  // TODO: Replace with real assignments data
  const assignments = [
    { title: 'Math Problem Set 5', dueDate: 'Due Tomorrow', status: 'pending' },
    { title: 'Science Lab Report', dueDate: 'Due in 3 days', status: 'in_progress' },
    { title: 'History Essay', dueDate: 'Due next week', status: 'pending' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return theme.colors?.warning || theme.warning || '#f59e0b';
      case 'in_progress':
        return theme.colors?.info || theme.info || '#3b82f6';
      case 'completed':
        return theme.colors?.success || theme.success || '#10b981';
      default:
        return theme.text;
    }
  };

  return (
    <DashboardCard title={`My ${taskTerm}s`} icon="document-text-outline">
      <View style={styles.list}>
        {assignments.map((item, idx) => (
          <View
            key={idx}
            style={[styles.item, { borderLeftColor: getStatusColor(item.status) }]}
          >
            <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.dueDate, { color: theme.textSecondary }]}>{item.dueDate}</Text>
          </View>
        ))}
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  item: {
    paddingLeft: 12,
    paddingVertical: 8,
    borderLeftWidth: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  dueDate: {
    fontSize: 12,
    opacity: 0.6,
  },
});
