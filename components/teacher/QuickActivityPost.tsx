/**
 * Quick Activity Post Widget
 * 
 * Compact widget for teacher dashboard with one-tap activity posting.
 * Features:
 * - Large icon buttons for common activities
 * - Quick photo snap + send
 * - Minimal taps to post
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface QuickActivityPostProps {
  theme: any;
}

const QUICK_ACTIVITIES = [
  { type: 'learning', icon: 'school', color: '#3B82F6', label: 'Learning' },
  { type: 'play', icon: 'game-controller', color: '#10B981', label: 'Play' },
  { type: 'meal', icon: 'restaurant', color: '#EF4444', label: 'Meal' },
  { type: 'rest', icon: 'moon', color: '#6366F1', label: 'Rest' },
];

export function QuickActivityPost({ theme }: QuickActivityPostProps) {
  const handleQuickPost = (activityType: string) => {
    router.push('/screens/teacher-post-activity' as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <Ionicons name="add-circle" size={24} color={theme.primary} />
        <Text style={[styles.title, { color: theme.text }]}>Quick Post Activity</Text>
      </View>
      
      <View style={styles.buttonGrid}>
        {QUICK_ACTIVITIES.map(({ type, icon, color, label }) => (
          <TouchableOpacity
            key={type}
            style={[styles.quickButton, { backgroundColor: color }]}
            onPress={() => handleQuickPost(type)}
            activeOpacity={0.7}
          >
            <Ionicons name={icon as any} size={32} color="#FFF" />
            <Text style={styles.buttonLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.fullButton, { borderColor: theme.border }]}
        onPress={() => router.push('/screens/teacher-post-activity' as any)}
      >
        <Ionicons name="create" size={20} color={theme.primary} />
        <Text style={[styles.fullButtonText, { color: theme.primary }]}>
          Create Detailed Activity
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  quickButton: {
    width: '47%',
    aspectRatio: 1.5,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  fullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  fullButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
