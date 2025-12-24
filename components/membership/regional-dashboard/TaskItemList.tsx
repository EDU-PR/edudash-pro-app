/**
 * Task Item List Component
 * Inline tasks list with urgent badges (simpler than TasksList)
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import type { TaskItem } from './types';

interface TaskItemListProps {
  tasks: TaskItem[];
  theme: any;
  onTaskPress?: (task: TaskItem) => void;
}

export function TaskItemList({ tasks, theme, onTaskPress }: TaskItemListProps) {
  return (
    <Card padding={0} margin={0}>
      {tasks.map((item, index) => (
        <View key={index}>
          <TouchableOpacity 
            style={styles.taskItem}
            onPress={() => onTaskPress?.(item)}
          >
            <View style={[styles.taskIcon, { backgroundColor: item.color + '15' }]}>
              <Ionicons name={item.icon as any} size={20} color={item.color} />
            </View>
            <Text style={[styles.taskText, { color: theme.text }, item.urgent && styles.taskUrgent]}>
              {item.task}
            </Text>
            {item.urgent && (
              <View style={styles.taskUrgentBadge}>
                <Text style={styles.taskUrgentText}>URGENT</Text>
              </View>
            )}
          </TouchableOpacity>
          {index < tasks.length - 1 && (
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
          )}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  taskIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  taskUrgent: {
    fontWeight: '600',
  },
  taskUrgentBadge: {
    backgroundColor: '#EF444415',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  taskUrgentText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
  },
});
