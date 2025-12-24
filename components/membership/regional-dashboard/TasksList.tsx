/**
 * Tasks List Component
 * Shows pending tasks with priority indicators
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Task } from './types';

interface TasksListProps {
  tasks: Task[];
  theme: any;
  onTaskPress?: (task: Task) => void;
}

export function TasksList({ tasks, theme, onTaskPress }: TasksListProps) {
  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <View style={styles.tasksContainer}>
      {tasks.map((task) => (
        <TouchableOpacity
          key={task.id}
          style={[styles.taskCard, { backgroundColor: theme.card }]}
          onPress={() => onTaskPress?.(task)}
        >
          <View style={[styles.taskPriorityBar, { backgroundColor: getPriorityColor(task.priority) }]} />
          <View style={styles.taskContent}>
            <View style={styles.taskHeader}>
              <Text style={[styles.taskTitle, { color: theme.text }]} numberOfLines={1}>
                {task.title}
              </Text>
              <View style={[styles.taskPriorityBadge, { backgroundColor: getPriorityColor(task.priority) + '20' }]}>
                <Text style={[styles.taskPriorityText, { color: getPriorityColor(task.priority) }]}>
                  {task.priority.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={[styles.taskDescription, { color: theme.textSecondary }]} numberOfLines={2}>
              {task.description}
            </Text>
            <View style={styles.taskFooter}>
              <View style={styles.taskDue}>
                <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.taskDueText, { color: theme.textSecondary }]}>
                  Due: {task.dueDate}
                </Text>
              </View>
              {task.assignee && (
                <View style={styles.taskAssignee}>
                  <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.taskAssigneeText, { color: theme.textSecondary }]}>
                    {task.assignee}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tasksContainer: {
    gap: 12,
  },
  taskCard: {
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  taskPriorityBar: {
    width: 4,
  },
  taskContent: {
    flex: 1,
    padding: 14,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  taskPriorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  taskPriorityText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  taskDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskDue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskDueText: {
    fontSize: 12,
  },
  taskAssignee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskAssigneeText: {
    fontSize: 12,
  },
});
