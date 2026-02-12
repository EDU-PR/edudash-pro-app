import React, { useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTeacherLessons, type TeacherLesson } from '@/hooks/useTeacherLessons';

type SortMode = 'newest' | 'oldest' | 'title';

export default function LessonsSearchScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const params = useLocalSearchParams<{ query?: string; sort?: string }>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [searchQuery, setSearchQuery] = useState((params.query as string) || '');
  const [sortMode, setSortMode] = useState<SortMode>(
    params.sort === 'oldest' || params.sort === 'title' ? (params.sort as SortMode) : 'newest',
  );
  const [refreshing, setRefreshing] = useState(false);

  const teacherId = user?.id || (profile as any)?.id;
  const { lessons, isLoading, error, refetch } = useTeacherLessons({
    includeOrganization: true,
    limit: 250,
  });

  const filteredLessons = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let items = lessons.filter((lesson) => {
      const scopeMatch =
        lesson.teacher_id === teacherId ||
        lesson.preschool_id === (profile as any)?.organization_id ||
        lesson.preschool_id === (profile as any)?.preschool_id;
      if (!scopeMatch) return false;

      if (!query) return true;
      return (
        lesson.title.toLowerCase().includes(query) ||
        String(lesson.subject || '').toLowerCase().includes(query) ||
        String(lesson.description || '').toLowerCase().includes(query) ||
        String(lesson.age_group || '').toLowerCase().includes(query)
      );
    });

    items = [...items].sort((a, b) => {
      if (sortMode === 'title') return a.title.localeCompare(b.title);
      if (sortMode === 'oldest') return a.created_at.localeCompare(b.created_at);
      return b.created_at.localeCompare(a.created_at);
    });

    return items;
  }, [lessons, profile, searchQuery, sortMode, teacherId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const onLessonPress = (lesson: TeacherLesson) => {
    router.push({
      pathname: '/screens/lesson-viewer',
      params: { lessonId: lesson.id },
    });
  };

  const renderSortChip = (mode: SortMode, label: string) => {
    const selected = sortMode === mode;
    return (
      <TouchableOpacity
        key={mode}
        onPress={() => setSortMode(mode)}
        style={[styles.sortChip, selected && styles.sortChipActive]}
      >
        <Text style={[styles.sortChipText, selected && styles.sortChipTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderLesson = ({ item }: { item: TeacherLesson }) => {
    const isMine = item.teacher_id === teacherId;
    return (
      <TouchableOpacity style={styles.lessonCard} onPress={() => onLessonPress(item)}>
        <View style={styles.lessonHeader}>
          <Text style={styles.lessonTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.is_ai_generated ? (
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={12} color={theme.primary} />
            </View>
          ) : null}
        </View>
        <Text style={styles.lessonMeta}>
          {item.subject || 'General'} • {item.age_group || '3-6'} • {item.duration_minutes || 30} min
        </Text>
        {item.description ? (
          <Text style={styles.lessonDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <Text style={styles.lessonFooter}>
          {isMine ? 'Created by you' : 'School lesson'} • {new Date(item.created_at).toLocaleDateString('en-ZA')}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Lessons</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search title, subject, age group..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.sortRow}>
        {renderSortChip('newest', 'Newest')}
        {renderSortChip('oldest', 'Oldest')}
        {renderSortChip('title', 'A-Z')}
      </View>

      <FlatList
        data={filteredLessons}
        keyExtractor={(item) => item.id}
        renderItem={renderLesson}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={56} color={theme.textSecondary} />
              <Text style={styles.emptyTitle}>No lessons found</Text>
              <Text style={styles.emptySubtitle}>
                {error
                  ? 'Could not load lessons right now.'
                  : searchQuery
                    ? 'Try a broader search term.'
                    : 'Your school has no lessons yet.'}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 56,
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 10,
    },
    backButton: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.text,
    },
    searchContainer: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: theme.card,
    },
    searchInput: {
      flex: 1,
      color: theme.text,
      paddingVertical: 10,
      marginLeft: 8,
      fontSize: 15,
    },
    sortRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    sortChip: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.card,
    },
    sortChipActive: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}22`,
    },
    sortChipText: {
      color: theme.textSecondary,
      fontWeight: '600',
      fontSize: 12,
    },
    sortChipTextActive: {
      color: theme.primary,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 20,
      gap: 10,
    },
    lessonCard: {
      backgroundColor: theme.card,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    lessonHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 8,
    },
    lessonTitle: {
      flex: 1,
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    aiBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.primary}22`,
    },
    lessonMeta: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    lessonDescription: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    lessonFooter: {
      marginTop: 2,
      color: theme.textSecondary,
      fontSize: 11,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
      gap: 8,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '700',
    },
    emptySubtitle: {
      color: theme.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
  });
