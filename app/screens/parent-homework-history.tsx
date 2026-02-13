/**
 * Parent Homework History Screen
 * 
 * Shows all past homework submissions and grades for the parent's children.
 * Matches web parity from /dashboard/parent/homework-history.
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SubPageHeader } from '@/components/SubPageHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

interface HomeworkSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  status: 'submitted' | 'graded' | 'late';
  assignment: {
    title: string;
    due_date: string;
    total_points?: number;
  };
  student: {
    first_name: string;
    last_name: string;
  };
}

type FilterStatus = 'all' | 'graded' | 'pending' | 'late';

export default function ParentHomeworkHistoryScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selectedChild, setSelectedChild] = useState<string>('all');

  // Resolve the correct parent ID (profile.id may differ from auth user.id)
  const parentId = (profile as any)?.id || user?.id;

  const { data: childrenData = [], isLoading: childrenLoading } = useQuery({
    queryKey: ['parent-children', parentId],
    queryFn: async () => {
      if (!parentId) return [];
      const supabase = assertSupabase();
      
      // Check both parent_id and guardian_id columns
      const parentFilters = [`parent_id.eq.${parentId}`, `guardian_id.eq.${parentId}`];
      if (user?.id && user.id !== parentId) {
        parentFilters.push(`parent_id.eq.${user.id}`, `guardian_id.eq.${user.id}`);
      }
      
      const { data } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .or(parentFilters.join(','));
      return data || [];
    },
    enabled: !!parentId,
  });

  const childIds = useMemo(() => childrenData.map((c: any) => c.id), [childrenData]);

  const { data: submissions = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['homework-history', childIds],
    queryFn: async () => {
      if (childIds.length === 0) return [];
      const supabase = assertSupabase();

      const { data, error } = await supabase
        .from('homework_submissions')
        .select(`
          id, assignment_id, student_id, submitted_at, grade, feedback,
          assignment:homework_assignments(title, due_date, total_points, is_published),
          student:students(first_name, last_name)
        `)
        .in('student_id', childIds)
        .order('submitted_at', { ascending: false });

      if (error || !data) return [];

      return data
        .filter((sub: any) => sub.assignment?.is_published !== false)
        .map((sub: any) => ({
          ...sub,
          status: sub.grade !== null ? 'graded'
            : new Date(sub.submitted_at) > new Date(sub.assignment.due_date) ? 'late'
            : 'submitted',
        })) as HomeworkSubmission[];
    },
    enabled: childIds.length > 0,
  });

  const filtered = useMemo(() => {
    return submissions.filter((sub) => {
      if (selectedChild !== 'all' && sub.student_id !== selectedChild) return false;
      if (filter === 'all') return true;
      if (filter === 'graded') return sub.grade !== null;
      if (filter === 'pending') return sub.grade === null && sub.status !== 'late';
      if (filter === 'late') return sub.status === 'late';
      return true;
    });
  }, [submissions, filter, selectedChild]);

  // Stats
  const gradedCount = submissions.filter((s) => s.grade !== null).length;
  const pendingCount = submissions.filter((s) => s.grade === null && s.status !== 'late').length;
  const lateCount = submissions.filter((s) => s.status === 'late').length;
  const avgGrade = gradedCount > 0
    ? Math.round(submissions.filter((s) => s.grade !== null).reduce((sum, s) => sum + (s.grade || 0), 0) / gradedCount)
    : 0;

  const getGradeColor = (grade: number) => {
    if (grade >= 75) return '#10b981';
    if (grade >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const styles = createStyles(theme, insets.bottom);

  const filters: { key: FilterStatus; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: submissions.length, color: theme.primary },
    { key: 'graded', label: 'Graded', count: gradedCount, color: '#10b981' },
    { key: 'pending', label: 'Pending', count: pendingCount, color: '#3b82f6' },
    { key: 'late', label: 'Late', count: lateCount, color: '#f59e0b' },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubPageHeader title={t('parent.homework_history', { defaultValue: 'Homework History' })} />

      {isLoading || childrenLoading ? (
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading submissions...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => refetch()} />}
        >
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{submissions.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#10b981' }]}>{avgGrade}%</Text>
              <Text style={styles.statLabel}>Average</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#3b82f6' }]}>{pendingCount}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>

          {/* Child filter */}
          {childrenData.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childFilterRow}>
              <TouchableOpacity
                style={[styles.childChip, selectedChild === 'all' && styles.childChipActive]}
                onPress={() => setSelectedChild('all')}
              >
                <Text style={[styles.childChipText, selectedChild === 'all' && styles.childChipTextActive]}>All</Text>
              </TouchableOpacity>
              {childrenData.map((child: any) => (
                <TouchableOpacity
                  key={child.id}
                  style={[styles.childChip, selectedChild === child.id && styles.childChipActive]}
                  onPress={() => setSelectedChild(child.id)}
                >
                  <Text style={[styles.childChipText, selectedChild === child.id && styles.childChipTextActive]}>
                    {child.first_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {filters.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, filter === f.key && { backgroundColor: f.color }]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterText, filter === f.key && { color: '#fff' }]}>
                  {f.label} ({f.count})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Submissions */}
          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={theme.textSecondary} />
              <Text style={styles.emptyText}>
                {filter === 'all' ? 'No homework submissions yet.' : `No ${filter} submissions.`}
              </Text>
            </View>
          ) : (
            filtered.map((sub) => (
              <View key={sub.id} style={[styles.card, { borderLeftColor: sub.grade !== null ? getGradeColor(sub.grade) : sub.status === 'late' ? '#f59e0b' : '#3b82f6' }]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{sub.assignment.title}</Text>
                    <Text style={styles.cardStudent}>{sub.student.first_name} {sub.student.last_name}</Text>
                  </View>
                  {sub.grade !== null ? (
                    <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(sub.grade) }]}>
                      <Text style={styles.gradeBadgeText}>{sub.grade}%</Text>
                    </View>
                  ) : sub.status === 'late' ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#f59e0b' }]}>
                      <Text style={styles.statusBadgeText}>Late</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: '#3b82f6' }]}>
                      <Text style={styles.statusBadgeText}>Pending</Text>
                    </View>
                  )}
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
                    <Text style={styles.metaText}>Due: {new Date(sub.assignment.due_date).toLocaleDateString('en-ZA')}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                    <Text style={styles.metaText}>Submitted: {new Date(sub.submitted_at).toLocaleDateString('en-ZA')}</Text>
                  </View>
                </View>

                {sub.feedback && (
                  <View style={styles.feedbackBox}>
                    <Text style={styles.feedbackLabel}>Teacher Feedback:</Text>
                    <Text style={styles.feedbackText}>{sub.feedback}</Text>
                  </View>
                )}

                {sub.grade !== null && (
                  <View style={styles.gradeDisplay}>
                    <Text style={[styles.gradeText, { color: getGradeColor(sub.grade) }]}>{sub.grade}%</Text>
                    {sub.assignment.total_points && (
                      <Text style={styles.gradeSubtext}>out of {sub.assignment.total_points} points</Text>
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (theme: any, bottomInset: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: theme.textSecondary, fontSize: 14 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: bottomInset + 40, gap: 12 },
    statsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    statCard: {
      flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 14,
      alignItems: 'center', borderWidth: 1, borderColor: theme.border,
    },
    statValue: { fontSize: 22, fontWeight: '700' },
    statLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 4, fontWeight: '600' },
    childFilterRow: { marginTop: 12 },
    childChip: {
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
      backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, marginRight: 8,
    },
    childChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    childChipText: { fontSize: 13, fontWeight: '600', color: theme.text },
    childChipTextActive: { color: '#fff' },
    filterRow: { marginTop: 12 },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
      backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, marginRight: 8,
    },
    filterText: { fontSize: 13, fontWeight: '600', color: theme.text },
    emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 14, color: theme.textSecondary },
    card: {
      backgroundColor: theme.surface, borderRadius: 14, padding: 16,
      borderWidth: 1, borderColor: theme.border, borderLeftWidth: 4,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 4 },
    cardStudent: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
    gradeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    gradeBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    statusBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    metaRow: { flexDirection: 'row', gap: 16, marginTop: 12, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: theme.textSecondary },
    feedbackBox: {
      marginTop: 12, padding: 12, borderRadius: 10,
      backgroundColor: theme.elevated,
    },
    feedbackLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 4 },
    feedbackText: { fontSize: 13, color: theme.text, lineHeight: 20 },
    gradeDisplay: { marginTop: 12, alignItems: 'center' },
    gradeText: { fontSize: 28, fontWeight: '700' },
    gradeSubtext: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  });
