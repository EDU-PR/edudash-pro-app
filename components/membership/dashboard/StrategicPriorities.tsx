/**
 * Strategic Priorities Component
 * Shows strategic initiatives and progress
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import type { StrategicPriority } from './types';

interface StrategicPrioritiesProps {
  priorities: StrategicPriority[];
  theme: any;
  onPriorityPress?: (priority: StrategicPriority) => void;
}

export function StrategicPriorities({ priorities, theme, onPriorityPress }: StrategicPrioritiesProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  return (
    <Card padding={0} margin={0}>
      {priorities.map((priority, index) => (
        <View key={priority.id}>
          <TouchableOpacity 
            style={styles.priorityItem}
            onPress={() => onPriorityPress?.(priority)}
          >
            <View style={styles.priorityLeft}>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(priority.priority) + '15' }]}>
                <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(priority.priority) }]} />
              </View>
              <View style={styles.priorityInfo}>
                <Text style={[styles.priorityTitle, { color: theme.text }]}>{priority.title}</Text>
                <View style={styles.priorityMeta}>
                  <Text style={[styles.priorityStatus, { color: theme.textSecondary }]}>
                    {priority.status}
                  </Text>
                  <Text style={[styles.priorityProgress, { color: theme.textSecondary }]}>
                    • {priority.progress}% complete
                  </Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
          {index < priorities.length - 1 && (
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
          )}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  priorityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  priorityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  priorityBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  priorityInfo: {
    flex: 1,
  },
  priorityTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  priorityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  priorityStatus: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  priorityProgress: {
    fontSize: 12,
    marginLeft: 4,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
});
