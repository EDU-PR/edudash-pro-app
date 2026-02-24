import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

type CompletionRow = {
  id: string;
  studentName: string;
  activityTitle: string;
  score: number | null;
  stars: number | null;
  timeSpentMinutes: number | null;
  completedAt: string | null;
};

const parseStars = (feedback: unknown): number | null => {
  if (!feedback || typeof feedback !== 'object') return null;
  const raw = (feedback as Record<string, unknown>).stars;
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(3, parsed)) : null;
};

export default function TeacherClassInsightsScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const preschoolId = (profile as any)?.organization_membership?.organization_id || (profile as any)?.organization_id || (profile as any)?.preschool_id;

  const { data = [], isLoading } = useQuery<CompletionRow[]>({
    queryKey: ['teacher-class-insights', preschoolId],
    enabled: !!preschoolId,
    queryFn: async () => {
      const supabase = assertSupabase();
      const { data: rows, error } = await supabase
        .from('lesson_completions')
        .select(`
          id,
          completed_at,
          score,
          time_spent_minutes,
          feedback,
          student:students(first_name,last_name),
          lesson:lessons(title)
        `)
        .eq('preschool_id', preschoolId)
        .order('completed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (rows || []).map((row: any) => {
        const student = Array.isArray(row.student) ? row.student[0] : row.student;
        const lesson = Array.isArray(row.lesson) ? row.lesson[0] : row.lesson;
        const feedback = row.feedback && typeof row.feedback === 'object' ? row.feedback : {};
        const activityMeta = (feedback as Record<string, unknown>).activity_meta as Record<string, unknown> | undefined;
        const activityTitle = String(
          activityMeta?.lesson_title ||
            activityMeta?.activity_id ||
            lesson?.title ||
            'Activity',
        );

        return {
          id: row.id,
          studentName: `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'Learner',
          activityTitle,
          score: row.score ?? null,
          stars: parseStars(row.feedback),
          timeSpentMinutes: row.time_spent_minutes ?? null,
          completedAt: row.completed_at ?? null,
        };
      });
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Class Insights" showBackButton />
      {isLoading ? (
        <View style={styles.centered}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading class performance...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colStudent, styles.headerCell]}>Student</Text>
            <Text style={[styles.colActivity, styles.headerCell]}>Activity</Text>
            <Text style={[styles.colMetric, styles.headerCell]}>Score</Text>
            <Text style={[styles.colMetric, styles.headerCell]}>Stars</Text>
            <Text style={[styles.colMetric, styles.headerCell]}>Time</Text>
          </View>
          {data.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No completion data yet.</Text>
            </View>
          ) : (
            data.map((row) => (
              <View key={row.id} style={styles.tableRow}>
                <View style={styles.colStudent}>
                  <Text style={styles.cellText} numberOfLines={1}>{row.studentName}</Text>
                  <Text style={styles.cellSubtext}>
                    {row.completedAt ? new Date(row.completedAt).toLocaleDateString() : 'Pending'}
                  </Text>
                </View>
                <Text style={[styles.colActivity, styles.cellText]} numberOfLines={2}>{row.activityTitle}</Text>
                <Text style={[styles.colMetric, styles.cellText]}>{row.score !== null ? `${row.score}%` : '-'}</Text>
                <Text style={[styles.colMetric, styles.cellText]}>{row.stars !== null ? `${row.stars}/3` : '-'}</Text>
                <Text style={[styles.colMetric, styles.cellText]}>{row.timeSpentMinutes !== null ? `${row.timeSpentMinutes}m` : '-'}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 12,
      color: theme.textSecondary,
    },
    content: {
      padding: 16,
      gap: 8,
    },
    tableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingBottom: 8,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerCell: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
    },
    colStudent: {
      flex: 1.6,
      paddingRight: 6,
    },
    colActivity: {
      flex: 2.2,
      paddingRight: 6,
      color: theme.text,
    },
    colMetric: {
      flex: 0.9,
      textAlign: 'right',
      color: theme.text,
    },
    cellText: {
      fontSize: 13,
      color: theme.text,
    },
    cellSubtext: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 2,
    },
    emptyState: {
      paddingVertical: 30,
      alignItems: 'center',
    },
    emptyText: {
      color: theme.textSecondary,
    },
  });
