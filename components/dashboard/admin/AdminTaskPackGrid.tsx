import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { AdminOperationalCounters, AdminTaskDefinition } from '@/lib/dashboard/admin/types';

interface AdminTaskPackGridProps {
  tasks: AdminTaskDefinition[];
  counters: AdminOperationalCounters;
  onOpenTask: (task: AdminTaskDefinition) => void;
}

export function AdminTaskPackGrid({ tasks, counters, onOpenTask }: AdminTaskPackGridProps) {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Task Pack</Text>
      <Text style={styles.subtitle}>Organization-tailored modules for admin execution</Text>

      <View style={styles.grid}>
        {tasks.map((task) => {
          const badgeValue = task.badgeKey ? counters[task.badgeKey] : 0;
          return (
            <TouchableOpacity
              key={task.id}
              style={styles.taskCard}
              onPress={() => onOpenTask(task)}
              activeOpacity={0.8}
            >
              <View style={styles.taskHeader}>
                <Ionicons name={task.icon as any} size={18} color={theme.primary} />
                {badgeValue > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badgeValue > 99 ? '99+' : badgeValue}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.taskTitle} numberOfLines={2}>
                {task.title}
              </Text>
              <Text style={styles.taskDescription} numberOfLines={3}>
                {task.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      marginHorizontal: 16,
      marginTop: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 12,
    },
    title: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
    },
    subtitle: {
      marginTop: 3,
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 12,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    taskCard: {
      flexBasis: '48%',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 10,
      minHeight: 128,
    },
    taskHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    badge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#1D4ED8',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '900',
    },
    taskTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 6,
      minHeight: 34,
    },
    taskDescription: {
      color: theme.textSecondary,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '600',
    },
  });
