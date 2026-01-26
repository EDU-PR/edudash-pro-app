/**
 * Teacher Lessons Browser Screen
 * 
 * A simple, reliable screen for teachers to browse and select lessons.
 * Can navigate to lesson assignment or lesson viewing.
 * 
 * @module app/screens/teacher-lessons
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { format } from 'date-fns';

import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useTeacherLessons, TeacherLesson } from '@/hooks/useTeacherLessons';

type FilterStatus = 'all' | 'active' | 'draft' | 'mine';

export default function TeacherLessonsScreen() {
  const { theme, isDark } = useTheme();
  const { profile, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [refreshing, setRefreshing] = useState(false);

  const {
    lessons,
    isLoading,
    error,
    isEmpty,
    refetch,
    myLessons,
    activeLessons,
    stats,
  } = useTeacherLessons({
    includeOrganization: true,
    limit: 100,
  });

  const styles = useMemo(() => createStyles(theme), [theme]);
  const teacherId = user?.id || profile?.id;

  // Filter lessons based on search and status
  const filteredLessons = useMemo(() => {
    let result = lessons;

    // Apply status filter
    switch (filterStatus) {
      case 'active':
        result = result.filter(l => l.status === 'active' || l.status === 'published');
        break;
      case 'draft':
        result = result.filter(l => l.status === 'draft');
        break;
      case 'mine':
        result = result.filter(l => l.teacher_id === teacherId);
        break;
      default:
        break;
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.title.toLowerCase().includes(query) ||
        l.subject?.toLowerCase().includes(query) ||
        l.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [lessons, filterStatus, searchQuery, teacherId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDeleteLesson = useCallback(async (lesson: TeacherLesson) => {
    const isOwner = lesson.teacher_id === teacherId;
    const isPrincipal = profile?.role === 'principal' || profile?.role === 'principal_admin';
    
    if (!isOwner && !isPrincipal) {
      Alert.alert('Permission Denied', 'You can only delete lessons you created.');
      return;
    }

    Alert.alert(
      'Delete Lesson',
      `Are you sure you want to delete "${lesson.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = (await import('@/lib/supabase')).assertSupabase();
              
              // Delete any related activities first
              await supabase.from('lesson_activities').delete().eq('lesson_id', lesson.id);
              
              // Delete the lesson
              const { error } = await supabase.from('lessons').delete().eq('id', lesson.id);
              
              if (error) throw error;
              
              Alert.alert('Success', 'Lesson deleted successfully');
              refetch();
            } catch (error) {
              console.error('[TeacherLessons] Delete error:', error);
              Alert.alert('Error', 'Failed to delete lesson');
            }
          },
        },
      ]
    );
  }, [teacherId, profile, refetch]);

  const handleLessonPress = useCallback((lesson: TeacherLesson) => {
    const isOwner = lesson.teacher_id === teacherId;
    const isPrincipal = profile?.role === 'principal' || profile?.role === 'principal_admin';
    const canEditDelete = isOwner || isPrincipal;

    // Build action options
    const actions: any[] = [
      {
        text: 'View Lesson',
        onPress: () => router.push({
          pathname: '/screens/lesson-viewer',
          params: { lessonId: lesson.id },
        }),
      },
      {
        text: 'Assign to Students',
        onPress: () => router.push({
          pathname: '/screens/assign-lesson',
          params: { lessonId: lesson.id },
        }),
      },
    ];

    // Add edit option if user can edit
    if (canEditDelete) {
      actions.push({
        text: '✏️ Edit Lesson',
        onPress: () => router.push({
          pathname: '/screens/lesson-edit',
          params: { lessonId: lesson.id },
        }),
      });
    }

    // Add delete option if user can delete
    if (canEditDelete) {
      actions.push({
        text: '🗑️ Delete Lesson',
        style: 'destructive',
        onPress: () => handleDeleteLesson(lesson),
      });
    }

    actions.push({ text: 'Cancel', style: 'cancel' });

    // Show action sheet
    Alert.alert(
      lesson.title,
      `${lesson.subject} • ${lesson.duration_minutes || 30} min`,
      actions
    );
  }, [teacherId, profile, handleDeleteLesson]);

  const handleAssignLesson = useCallback((lesson: TeacherLesson) => {
    router.push({
      pathname: '/screens/assign-lesson',
      params: { lessonId: lesson.id },
    });
  }, []);

  const handleCreateLesson = useCallback(() => {
    router.push('/screens/ai-lesson-generator');
  }, []);

  const renderFilterTabs = () => (
    <View style={styles.filterContainer}>
      {[
        { key: 'all', label: `All (${stats.total})` },
        { key: 'active', label: `Active (${stats.active})` },
        { key: 'draft', label: `Drafts (${stats.draft})` },
        { key: 'mine', label: `My Lessons (${myLessons.length})` },
      ].map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          style={[
            styles.filterTab,
            filterStatus === key && styles.filterTabActive,
          ]}
          onPress={() => setFilterStatus(key as FilterStatus)}
        >
          <Text
            style={[
              styles.filterTabText,
              filterStatus === key && styles.filterTabTextActive,
            ]}
          >
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'published':
        return '#10B981';
      case 'draft':
        return '#F59E0B';
      case 'archived':
        return '#6B7280';
      default:
        return theme.textSecondary;
    }
  };

  const renderLessonItem = ({ item }: { item: TeacherLesson }) => {
    const isOwner = item.teacher_id === teacherId;

    return (
      <TouchableOpacity
        style={styles.lessonCard}
        onPress={() => handleLessonPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.lessonHeader}>
          <View style={styles.lessonTitleRow}>
            <Text style={styles.lessonTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {item.is_ai_generated && (
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={12} color="#00f5ff" />
              </View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.lessonMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="book-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.metaText}>{item.subject || 'General'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.metaText}>{item.duration_minutes || 30} min</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.metaText}>{item.age_group || '3-6 yrs'}</Text>
          </View>
        </View>

        {item.description && (
          <Text style={styles.lessonDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.lessonFooter}>
          <View style={styles.ownerInfo}>
            <Ionicons 
              name={isOwner ? 'person' : 'school-outline'} 
              size={12} 
              color={theme.textSecondary} 
            />
            <Text style={styles.ownerText}>
              {isOwner ? 'Created by you' : 'Organization lesson'}
            </Text>
          </View>
          <Text style={styles.dateText}>
            {format(new Date(item.created_at), 'MMM d, yyyy')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.assignButton}
          onPress={() => handleAssignLesson(item)}
        >
          <Ionicons name="send" size={16} color="#fff" />
          <Text style={styles.assignButtonText}>Assign</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="book-outline" size={64} color={theme.textSecondary} />
      <Text style={styles.emptyTitle}>
        {error ? 'Error Loading Lessons' : 'No Lessons Found'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {error 
          ? error 
          : searchQuery 
            ? 'Try adjusting your search' 
            : 'Create your first lesson with AI'
        }
      </Text>
      {!error && (
        <TouchableOpacity style={styles.createButton} onPress={handleCreateLesson}>
          <Ionicons name="sparkles" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Generate with AI</Text>
        </TouchableOpacity>
      )}
      {error && (
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Ionicons name="refresh" size={20} color={theme.primary} />
          <Text style={[styles.createButtonText, { color: theme.primary }]}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader 
        title="Lessons"
        showBackButton
        rightAction={
          <TouchableOpacity onPress={handleCreateLesson} style={{ padding: 8 }}>
            <Ionicons name="add" size={24} color={theme.text} />
          </TouchableOpacity>
        }
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search lessons..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      {renderFilterTabs()}

      {/* Lessons List */}
      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading lessons...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLessons}
          renderItem={renderLessonItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            filteredLessons.length === 0 && styles.listContentEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
    paddingVertical: 0,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: theme.surface,
  },
  filterTabActive: {
    backgroundColor: theme.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  filterTabTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
  },
  listContentEmpty: {
    flex: 1,
  },
  separator: {
    height: 12,
  },
  lessonCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  lessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  lessonTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  aiBadge: {
    backgroundColor: 'rgba(0, 245, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  lessonMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  lessonDescription: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  lessonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ownerText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  dateText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  assignButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
});
