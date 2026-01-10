/**
 * Interactive Lesson Card Component
 * 
 * Displays an interactive lesson assignment card
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

interface InteractiveLessonCardProps {
  title: string;
  description?: string;
  activityType: string;
  dueDate?: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue';
  stemCategory?: 'ai' | 'robotics' | 'computer_literacy' | 'none';
  onPress?: () => void;
}

export function InteractiveLessonCard({
  title,
  description,
  activityType,
  dueDate,
  status,
  stemCategory,
  onPress,
}: InteractiveLessonCardProps) {
  const { theme } = useTheme();

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'overdue':
        return '#ef4444';
      case 'in_progress':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const getStemBadge = () => {
    const badges: Record<string, { label: string; color: string; bg: string }> = {
      ai: { label: 'AI', color: '#8b5cf6', bg: '#f3e8ff' },
      robotics: { label: 'Robotics', color: '#f59e0b', bg: '#fef3c7' },
      computer_literacy: { label: 'Computer Literacy', color: '#06b6d4', bg: '#cffafe' },
    };

    if (!stemCategory || stemCategory === 'none') return null;
    const badge = badges[stemCategory];
    if (!badge) return null;

    return (
      <View style={[styles.stemBadge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.stemBadgeText, { color: badge.color }]}>{badge.label}</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {getStemBadge()}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
          </Text>
        </View>
      </View>

      {description && (
        <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
          {description}
        </Text>
      )}

      <View style={styles.footer}>
        <View style={styles.meta}>
          <Ionicons name="game-controller-outline" size={16} color={theme.textSecondary} />
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>
            {activityType}
          </Text>
        </View>
        {dueDate && (
          <View style={styles.meta}>
            <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>
              Due: {new Date(dueDate).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  stemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  stemBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
});
