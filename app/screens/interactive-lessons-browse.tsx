/**
 * Interactive Lessons Browse Screen
 * 
 * Browse and select interactive lessons for students.
 * Features:
 * - Grid view of available lessons
 * - Filter by subject, difficulty, age group
 * - Search lessons
 * - Show completed lessons with stars earned
 * - Continue in-progress lessons
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { DesktopLayout } from '@/components/layout/DesktopLayout';

interface Activity {
  id: string;
  activity_type: string;
  title: string;
  instructions: string;
  difficulty_level: number;
  age_group_min: number;
  age_group_max: number;
  subject: string;
  stars_reward: number;
  times_played: number;
  // User progress
  completed?: boolean;
  stars_earned?: number;
  best_score?: number;
}

export default function InteractiveLessonsBrowseScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | null>(null);

  const subjects = ['math', 'language', 'science', 'art', 'social'];

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const supabase = assertSupabase();
      
      const { data, error } = await supabase
        .from('interactive_activities')
        .select('*')
        .eq('is_active', true)
        .order('difficulty_level')
        .order('title');

      if (error) throw error;

      // Load user's progress
      if (user?.id && data) {
        const activityIds = data.map(a => a.id);
        const { data: attempts } = await supabase
          .from('activity_attempts')
          .select('activity_id, score, is_submitted')
          .in('activity_id', activityIds)
          .eq('student_id', user.id);

        const progressMap = new Map();
        attempts?.forEach(attempt => {
          if (attempt.is_submitted) {
            const existing = progressMap.get(attempt.activity_id);
            if (!existing || attempt.score > existing.best_score) {
              progressMap.set(attempt.activity_id, {
                completed: true,
                best_score: attempt.score,
                stars_earned: Math.ceil((attempt.score / 100) * 3),
              });
            }
          }
        });

        const activitiesWithProgress = data.map(activity => ({
          ...activity,
          ...progressMap.get(activity.id),
        }));

        setActivities(activitiesWithProgress);
      } else {
        setActivities(data || []);
      }
    } catch (error) {
      console.error('[InteractiveLessonsBrowse] Error loading activities:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      const matchesSearch = activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           activity.instructions.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSubject = !selectedSubject || activity.subject === selectedSubject;
      const matchesDifficulty = !selectedDifficulty || activity.difficulty_level === selectedDifficulty;
      
      return matchesSearch && matchesSubject && matchesDifficulty;
    });
  }, [activities, searchQuery, selectedSubject, selectedDifficulty]);

  const handleActivityPress = (activity: Activity) => {
    router.push({
      pathname: '/screens/interactive-lesson-player' as any,
      params: { activityId: activity.id, studentId: user?.id },
    });
  };

  const getActivityTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      matching: 'link',
      coloring: 'color-palette',
      counting: 'calculator',
      sorting: 'file-tray-stacked',
      tracing: 'pencil',
      puzzle: 'extension-puzzle',
      memory: 'card',
      quiz: 'help-circle',
    };
    return icons[type] || 'game-controller';
  };

  const renderActivity = ({ item }: { item: Activity }) => (
    <TouchableOpacity
      style={[styles.activityCard, { backgroundColor: theme.card }]}
      onPress={() => handleActivityPress(item)}
    >
      {/* Completion Badge */}
      {item.completed && (
        <View style={[styles.completionBadge, { backgroundColor: theme.success }]}>
          <Ionicons name="checkmark" size={16} color="#FFF" />
        </View>
      )}

      {/* Activity Type Icon */}
      <View style={[styles.iconCircle, { backgroundColor: theme.primary + '20' }]}>
        <Ionicons name={getActivityTypeIcon(item.activity_type) as any} size={32} color={theme.primary} />
      </View>

      {/* Title */}
      <Text style={[styles.activityTitle, { color: theme.text }]} numberOfLines={2}>
        {item.title}
      </Text>

      {/* Difficulty */}
      <View style={styles.difficultyRow}>
        {[...Array(5)].map((_, index) => (
          <Ionicons
            key={index}
            name={index < item.difficulty_level ? 'star' : 'star-outline'}
            size={14}
            color={index < item.difficulty_level ? '#F59E0B' : theme.textTertiary}
          />
        ))}
      </View>

      {/* Subject Tag */}
      <View style={[styles.subjectTag, { backgroundColor: theme.cardSecondary }]}>
        <Text style={[styles.subjectText, { color: theme.textSecondary }]}>
          {item.subject}
        </Text>
      </View>

      {/* Progress */}
      {item.completed && (
        <View style={styles.progressRow}>
          <View style={styles.starsRow}>
            {[...Array(item.stars_reward || 3)].map((_, index) => (
              <Ionicons
                key={index}
                name={index < (item.stars_earned || 0) ? 'star' : 'star-outline'}
                size={16}
                color={index < (item.stars_earned || 0) ? '#F59E0B' : theme.textTertiary}
              />
            ))}
          </View>
          <Text style={[styles.scoreText, { color: theme.textSecondary }]}>
            {item.best_score}%
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <DesktopLayout role="student">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading activities...
          </Text>
        </View>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout role="student">
      <Stack.Screen
        options={{
          title: 'Interactive Lessons',
          headerShown: true,
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
        }}
      />
      
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.card }]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search activities..."
            placeholderTextColor={theme.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filters */}
        <View style={styles.filtersSection}>
          {/* Subject Filter */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: theme.card },
                !selectedSubject && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => setSelectedSubject(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: theme.text },
                  !selectedSubject && { color: '#FFF' },
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {subjects.map(subject => (
              <TouchableOpacity
                key={subject}
                style={[
                  styles.filterChip,
                  { backgroundColor: theme.card },
                  selectedSubject === subject && { backgroundColor: theme.primary },
                ]}
                onPress={() => setSelectedSubject(subject)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: theme.text },
                    selectedSubject === subject && { color: '#FFF' },
                  ]}
                >
                  {subject}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Difficulty Filter */}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>
              Difficulty:
            </Text>
            {[1, 2, 3, 4, 5].map(level => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.difficultyChip,
                  { backgroundColor: theme.card },
                  selectedDifficulty === level && { backgroundColor: theme.warning },
                ]}
                onPress={() => setSelectedDifficulty(selectedDifficulty === level ? null : level)}
              >
                <Ionicons
                  name="star"
                  size={16}
                  color={selectedDifficulty === level ? '#FFF' : theme.warning}
                />
                <Text
                  style={[
                    styles.difficultyChipText,
                    { color: theme.text },
                    selectedDifficulty === level && { color: '#FFF' },
                  ]}
                >
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Activities Grid */}
        {filteredActivities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="game-controller-outline" size={80} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.text }]}>
              No activities found
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
              Try adjusting your filters or search query
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredActivities}
            renderItem={renderActivity}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </DesktopLayout>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      gap: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
    },
    filtersSection: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    filterLabel: {
      fontSize: 14,
      fontWeight: '500',
      alignSelf: 'center',
      marginRight: 4,
    },
    filterChip: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
    },
    filterChipText: {
      fontSize: 14,
      fontWeight: '500',
      textTransform: 'capitalize',
    },
    difficultyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
    },
    difficultyChipText: {
      fontSize: 13,
      fontWeight: '600',
    },
    listContent: {
      padding: 8,
    },
    columnWrapper: {
      gap: 12,
      paddingHorizontal: 8,
      marginBottom: 12,
    },
    activityCard: {
      flex: 1,
      padding: 16,
      borderRadius: 16,
      alignItems: 'center',
      position: 'relative',
    },
    completionBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    activityTitle: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 8,
      minHeight: 40,
    },
    difficultyRow: {
      flexDirection: 'row',
      gap: 2,
      marginBottom: 8,
    },
    subjectTag: {
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: 12,
      marginBottom: 8,
    },
    subjectText: {
      fontSize: 12,
      fontWeight: '500',
      textTransform: 'capitalize',
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    starsRow: {
      flexDirection: 'row',
      gap: 2,
    },
    scoreText: {
      fontSize: 12,
      fontWeight: '600',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: '600',
      marginTop: 20,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 15,
      marginTop: 8,
      textAlign: 'center',
    },
  });
