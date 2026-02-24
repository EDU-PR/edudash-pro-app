/**
 * Parent Assigned Lessons Screen
 *
 * Shows all lesson-related assignments for a parent's children, grouped by
 * delivery context so parents understand what to do with each:
 *
 *   class_activity  — informational: teacher is delivering this in class
 *   playground      — actionable: child can practice this on Dash
 *   take_home       — actionable: parent-guided home reinforcement
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { fetchParentChildren } from '@/lib/parent-children';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

type DeliveryMode = 'class_activity' | 'playground' | 'take_home';

interface AssignedLesson {
  id: string;
  lesson_id: string | null;
  student_id: string;
  due_date: string | null;
  status: 'assigned' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  delivery_mode: DeliveryMode;
  lesson?: {
    id: string;
    title: string;
    description: string | null;
    subject: string;
    duration_minutes: number;
    age_group: string;
  };
  interactive_activity?: {
    id: string;
    title: string;
  };
  student?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

const DELIVERY_CONFIG: Record<DeliveryMode, { label: string; icon: string; color: string; description: string }> = {
  class_activity: {
    label: 'Class Activity',
    icon: 'school',
    color: '#5A409D',
    description: "Your child's class will work on this together",
  },
  playground: {
    label: 'Dash Activity',
    icon: 'game-controller',
    color: '#10B981',
    description: 'Your child can practice this on Dash',
  },
  take_home: {
    label: 'Take-Home',
    icon: 'home',
    color: '#F59E0B',
    description: 'A reinforcement activity to try at home',
  },
};

export default function ParentAssignedLessonsScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { data: children = [] } = useQuery({
    queryKey: ['parent-children', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const result = await fetchParentChildren(profile.id, {
        includeInactive: false,
        schoolId: profile.preschool_id || profile.organization_id || undefined,
      });
      return result || [];
    },
    enabled: !!profile?.id,
  });

  const {
    data: assignments = [],
    isLoading,
    refetch,
  } = useQuery<AssignedLesson[]>({
    queryKey: ['parent-assigned-lessons', children.map((c) => c.id)],
    queryFn: async () => {
      if (children.length === 0) return [];
      const studentIds = children.map((c) => c.id);
      const { data, error } = await assertSupabase()
        .from('lesson_assignments')
        .select(`
          id,
          lesson_id,
          student_id,
          due_date,
          status,
          priority,
          delivery_mode,
          lesson:lessons(id, title, description, subject, duration_minutes, age_group),
          interactive_activity:interactive_activities(id, title)
        `)
        .in('student_id', studentIds)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return ((data || []) as any[]).map((a) => ({
        ...a,
        delivery_mode: (a.delivery_mode as DeliveryMode) || 'class_activity',
        lesson: Array.isArray(a.lesson) ? a.lesson[0] : a.lesson,
        interactive_activity: Array.isArray(a.interactive_activity) ? a.interactive_activity[0] : a.interactive_activity,
        student: children.find((c) => c.id === a.student_id),
      }));
    },
    enabled: children.length > 0,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAction = useCallback((assignment: AssignedLesson) => {
    if (assignment.delivery_mode === 'playground' && assignment.interactive_activity?.id) {
      router.push({
        pathname: '/screens/dash-playground',
        params: { activityId: assignment.interactive_activity.id },
      });
    } else if (assignment.lesson_id) {
      router.push({
        pathname: '/screens/lesson-viewer',
        params: { lessonId: assignment.lesson_id },
      });
    }
  }, []);

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

  // Group by delivery_mode for contextual display
  const classActivities = assignments.filter((a) => a.delivery_mode === 'class_activity' && a.status !== 'completed');
  const playgroundActivities = assignments.filter((a) => a.delivery_mode === 'playground' && a.status !== 'completed');
  const takeHomeActivities = assignments.filter((a) => a.delivery_mode === 'take_home' && a.status !== 'completed');
  const completedAssignments = assignments.filter((a) => a.status === 'completed');

  const pendingCount = classActivities.length + playgroundActivities.length + takeHomeActivities.length;

  const renderAssignmentCard = (assignment: AssignedLesson) => {
    const config = DELIVERY_CONFIG[assignment.delivery_mode] ?? DELIVERY_CONFIG.class_activity;
    const title =
      assignment.delivery_mode === 'playground' && assignment.interactive_activity?.title
        ? assignment.interactive_activity.title
        : assignment.lesson?.title || 'Untitled';
    const isActionable = assignment.delivery_mode !== 'class_activity' || !!assignment.lesson_id;
    const borderColor =
      assignment.priority === 'urgent' ? '#ef4444' :
      assignment.priority === 'high' ? '#f59e0b' :
      theme.border;

    return (
      <TouchableOpacity
        key={assignment.id}
        style={[styles.card, { backgroundColor: theme.card, borderColor }]}
        onPress={() => handleAction(assignment)}
        activeOpacity={isActionable ? 0.7 : 1}
      >
        {/* Delivery mode badge */}
        <View style={[styles.modeBadge, { backgroundColor: config.color + '18' }]}>
          <Ionicons name={config.icon as any} size={13} color={config.color} />
          <Text style={[styles.modeBadgeText, { color: config.color }]}>{config.label}</Text>
        </View>

        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBlock}>
            <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
              {title}
            </Text>
            {assignment.student && (
              <Text style={[styles.cardStudent, { color: theme.textSecondary }]}>
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

        {/* Context description */}
        <Text style={[styles.modeDescription, { color: theme.textSecondary }]}>
          {config.description}
        </Text>

        {/* Meta row */}
        <View style={styles.metaRow}>
          {assignment.lesson?.subject ? (
            <View style={[styles.metaChip, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="book" size={12} color={theme.primary} />
              <Text style={[styles.metaText, { color: theme.primary }]}>{assignment.lesson.subject}</Text>
            </View>
          ) : null}
          {assignment.lesson?.duration_minutes ? (
            <View style={[styles.metaChip, { backgroundColor: '#F59E0B15' }]}>
              <Ionicons name="time" size={12} color="#F59E0B" />
              <Text style={[styles.metaText, { color: '#F59E0B' }]}>{assignment.lesson.duration_minutes} min</Text>
            </View>
          ) : null}
          {assignment.due_date ? (
            <View style={[styles.metaChip, { backgroundColor: new Date(assignment.due_date) < new Date() ? '#ef444420' : '#6b728015' }]}>
              <Ionicons name="calendar" size={12} color={new Date(assignment.due_date) < new Date() ? '#ef4444' : '#6b7280'} />
              <Text style={[styles.metaText, { color: new Date(assignment.due_date) < new Date() ? '#ef4444' : '#6b7280' }]}>
                Due {new Date(assignment.due_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          ) : null}
        </View>

        {isActionable && assignment.delivery_mode !== 'class_activity' && (
          <View style={[styles.actionRow, { borderTopColor: theme.border }]}>
            <Text style={[styles.actionText, { color: config.color }]}>
              {assignment.delivery_mode === 'playground' ? 'Open in Dash' : 'View Activity'}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={config.color} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSection = (
    title: string,
    items: AssignedLesson[],
    icon: string,
    iconColor: string,
  ) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.section} key={title}>
        <View style={styles.sectionHeader}>
          <Ionicons name={icon as any} size={18} color={iconColor} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
          <View style={[styles.sectionCount, { backgroundColor: iconColor + '20' }]}>
            <Text style={[styles.sectionCountText, { color: iconColor }]}>{items.length}</Text>
          </View>
        </View>
        {items.map(renderAssignmentCard)}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#10B981', '#059669']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle}>Learning Activities</Text>
            <Text style={styles.headerSubtitle}>
              {pendingCount} active · {completedAssignments.length} completed
            </Text>
          </View>
        </View>
      </LinearGradient>

      {isLoading ? (
        <View style={styles.center}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading activities...</Text>
        </View>
      ) : assignments.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="book-outline" size={64} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No Activities Yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            When teachers schedule lessons or assign activities, they will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
          {renderSection('Today\'s Class Activities', classActivities, 'school', '#5A409D')}
          {renderSection('Dash Playground Activities', playgroundActivities, 'game-controller', '#10B981')}
          {renderSection('Take-Home Activities', takeHomeActivities, 'home', '#F59E0B')}
          {renderSection('Completed', completedAssignments, 'checkmark-circle', '#6b7280')}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 16, paddingBottom: 20 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    backButton: { padding: 8, marginRight: 12 },
    headerTitleBlock: { flex: 1 },
    headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    loadingText: { marginTop: 12, fontSize: 14 },
    emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: 16, marginBottom: 8 },
    emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    scroll: { flex: 1 },
    scrollContent: { padding: 16 },
    section: { marginBottom: 28 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
    sectionCount: {
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    sectionCountText: { fontSize: 12, fontWeight: '700' },
    card: {
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
    },
    modeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
      marginBottom: 10,
    },
    modeBadgeText: { fontSize: 11, fontWeight: '700' },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    cardTitleBlock: { flex: 1, marginRight: 12 },
    cardTitle: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
    cardStudent: { fontSize: 12, marginTop: 2 },
    statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
    statusText: { fontSize: 11, fontWeight: '600' },
    modeDescription: { fontSize: 12, marginBottom: 10, lineHeight: 16 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    metaText: { fontSize: 11, fontWeight: '500' },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    actionText: { fontSize: 13, fontWeight: '600' },
  });
