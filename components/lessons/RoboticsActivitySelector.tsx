/**
 * Robotics Activity Selector Component
 * 
 * Allows teachers to select and assign robotics activities
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';

interface RoboticsActivity {
  id: string;
  title: string;
  description: string | null;
  activity_type: string;
  difficulty_level: number;
  age_group: string;
}

interface RoboticsActivitySelectorProps {
  preschoolId: string;
  onSelect?: (activityId: string) => void;
}

export function RoboticsActivitySelector({ preschoolId, onSelect }: RoboticsActivitySelectorProps) {
  const { theme } = useTheme();
  const [activities, setActivities] = useState<RoboticsActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const loadActivities = async () => {
      try {
        const supabase = assertSupabase();
        const { data, error } = await supabase
          .from('interactive_activities')
          .select('*')
          .eq('preschool_id', preschoolId)
          .eq('stem_category', 'robotics')
          .eq('is_published', true)
          .order('title');

        if (error) throw error;
        setActivities((data || []) as RoboticsActivity[]);
      } catch (error) {
        console.error('Error loading robotics activities:', error);
      } finally {
        setLoading(false);
      }
    };

    if (preschoolId) {
      loadActivities();
    }
  }, [preschoolId]);

  const handleSelect = (activityId: string) => {
    setSelectedId(activityId);
    onSelect?.(activityId);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>Select Robotics Activity</Text>
      {activities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="hardware-chip-outline" size={48} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No robotics activities available yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.activityCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: selectedId === item.id ? theme.primary : theme.border,
                  borderWidth: selectedId === item.id ? 2 : 1,
                },
              ]}
              onPress={() => handleSelect(item.id)}
            >
              <View style={styles.activityHeader}>
                <Text style={[styles.activityTitle, { color: theme.text }]}>{item.title}</Text>
                {selectedId === item.id && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                )}
              </View>
              {item.description && (
                <Text style={[styles.activityDescription, { color: theme.textSecondary }]}>
                  {item.description}
                </Text>
              )}
              <View style={styles.activityMeta}>
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                  Age: {item.age_group} • Level: {item.difficulty_level}/5
                </Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    gap: 12,
  },
  activityCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  activityMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaText: {
    fontSize: 12,
  },
});
