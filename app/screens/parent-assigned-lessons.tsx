/**
 * Parent Assigned Lessons Screen
 * 
 * Shows lessons assigned to parent's children with detailed view.
 * Parents can view lesson content and track completion.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { fetchParentChildren } from '@/lib/parent-children';

interface AssignedLesson {
  id: string;
  lesson_id: string | null;
  student_id: string;
  due_date: string | null;
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  lesson?: {
    id: string;
    title: string;
    description: string | null;
    subject: string;
    duration_minutes: number;
    age_group: string;
  };
  student?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

export default function ParentAssignedLessonsScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch children
  const { data: children = [] } = useQuery({
    queryKey: ['parent-children', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const children = await fetchParentChildren(profile.id, {
        includeInactive: false,
        schoolId: profile.preschool_id || profile.organization_id || undefined,
      });
      return children || [];
    },
    enabled: !!profile?.id,
  });

  // Fetch assigned lessons for all children
  const {
    data: assignments = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['parent-assigned-lessons', children.map(c => c.id)],
    queryFn: async () => {
      if (children.length === 0) return [];
      
      const studentIds = children.map(c => c.id);
      const { data, error } = await assertSupabase()
        .from('lesson_assignments')
        .select(`
          id,
          lesson_id,
          student_id,
          due_date,
          status,
          priority,
          lesson:lessons(id, title, description, subject, duration_minutes, age_group)
        `)
        .in('student_id', studentIds)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('assigned_at', { ascending: false });
      
      if (error) throw error;
      
      // Attach student info
      return (data || []).map((assignment: any) => ({
        ...assignment,
        student: children.find(c => c.id === assignment.student_id),
      }));
    },
    enabled: children.length > 0,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleViewLesson = (assignment: AssignedLesson) => {
    if (assignment.lesson_id) {
      router.push({
        pathname: '/screens/lesson-viewer',
        params: { lessonId: assignment.lesson_id },
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#3b82f6';
      case 'overdue': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: string, dueDate: string | null) => {
    if (status === 'completed') return 'Completed';
    if (dueDate && new Date(dueDate) < new Date()) return 'Overdue';
    if (status === 'in_progress') return 'In Progress';
    return 'Assigned';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f59e0b';
      default: return 'transparent';
    }
  };

  const pendingAssignments = assignments.filter(a => a.status !== 'completed');
  const completedAssignments = assignments.filter(a => a.status === 'completed');

  const styles = createStyles(theme);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <LinearGradient
        colors={['#10B981', '#059669']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Assigned Lessons</Text>
            <Text style={styles.headerSubtitle}>
              {pendingAssignments.length} pending • {completedAssignments.length} completed
            </Text>
          </View>
        </View>
      </LinearGradient>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading lessons...
          </Text>
        </View>
      ) : assignments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No Assigned Lessons
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            When teachers assign lessons to your child, they will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
          {/* Pending Lessons */}
          {pendingAssignments.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                📚 Pending Lessons
              </Text>
              {pendingAssignments.map((assignment) => (
                <TouchableOpacity
                  key={assignment.id}
                  style={[
                    styles.lessonCard,
                    { 
                      backgroundColor: theme.card,
                      borderLeftColor: getPriorityColor(assignment.priority) || theme.border,
                      borderLeftWidth: assignment.priority === 'urgent' || assignment.priority === 'high' ? 4 : 1,
                    },
                  ]}
                  onPress={() => handleViewLesson(assignment)}
                  activeOpacity={0.7}
                >
                  <View style={styles.lessonHeader}>
                    <View style={styles.lessonInfo}>
                      <Text style={[styles.lessonTitle, { color: theme.text }]} numberOfLines={2}>
                        {assignment.lesson?.title || 'Untitled Lesson'}
                      </Text>
                      {assignment.student && (
                        <Text style={[styles.studentName, { color: theme.textSecondary }]}>
                          For {assignment.student.first_name}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(assignment.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(assignment.status) }]}>
                        {getStatusLabel(assignment.status, assignment.due_date)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.lessonMeta}>
                    {assignment.lesson?.subject && (
                      <View style={[styles.metaChip, { backgroundColor: theme.primary + '15' }]}>
                        <Ionicons name="book" size={12} color={theme.primary} />
                        <Text style={[styles.metaText, { color: theme.primary }]}>
                          {assignment.lesson.subject}
                        </Text>
                      </View>
                    )}
                    {assignment.lesson?.duration_minutes && (
                      <View style={[styles.metaChip, { backgroundColor: theme.warning + '15' }]}>
                        <Ionicons name="time" size={12} color={theme.warning} />
                        <Text style={[styles.metaText, { color: theme.warning }]}>
                          {assignment.lesson.duration_minutes} min
                        </Text>
                      </View>
                    )}
                    {assignment.due_date && (
                      <View style={[
                        styles.metaChip, 
                        { backgroundColor: new Date(assignment.due_date) < new Date() ? '#ef444420' : '#6b728020' }
                      ]}>
                        <Ionicons name="calendar" size={12} color={new Date(assignment.due_date) < new Date() ? '#ef4444' : '#6b7280'} />
                        <Text style={[
                          styles.metaText, 
                          { color: new Date(assignment.due_date) < new Date() ? '#ef4444' : '#6b7280' }
                        ]}>
                          Due {new Date(assignment.due_date).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>

                  {assignment.lesson?.description && (
                    <Text style={[styles.lessonDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                      {assignment.lesson.description}
                    </Text>
                  )}

                  <View style={styles.viewButton}>
                    <Text style={[styles.viewButtonText, { color: theme.primary }]}>View Lesson</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Completed Lessons */}
          {completedAssignments.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                ✅ Completed Lessons
              </Text>
              {completedAssignments.map((assignment) => (
                <TouchableOpacity
                  key={assignment.id}
                  style={[styles.lessonCard, { backgroundColor: theme.card, opacity: 0.8 }]}
                  onPress={() => handleViewLesson(assignment)}
                  activeOpacity={0.7}
                >
                  <View style={styles.lessonHeader}>
                    <View style={styles.lessonInfo}>
                      <Text style={[styles.lessonTitle, { color: theme.text }]} numberOfLines={2}>
                        {assignment.lesson?.title || 'Untitled Lesson'}
                      </Text>
                      {assignment.student && (
                        <Text style={[styles.studentName, { color: theme.textSecondary }]}>
                          {assignment.student.first_name}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  lessonCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  lessonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  lessonInfo: {
    flex: 1,
    marginRight: 12,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  studentName: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  lessonMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  lessonDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
