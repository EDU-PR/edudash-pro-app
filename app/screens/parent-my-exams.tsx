/**
 * Parent My Exams Screen
 * 
 * Lists all AI-generated practice exams with scores and retake options.
 * Navigates to exam detail/interactive view for taking/retaking exams.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
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
import { formatDistanceToNow } from 'date-fns';

interface SavedExam {
  id: string;
  display_title: string;
  grade: string;
  subject: string;
  generated_content: string;
  created_at: string;
  exam_type: string;
  progress?: {
    percentage: number;
    score_obtained: number;
    score_total: number;
    completed_at: string;
  }[];
}

export default function ParentMyExamsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets.bottom);

  const { data: exams = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['my-exams', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('exam_generations')
        .select(`
          *,
          progress:exam_user_progress(
            percentage,
            score_obtained,
            score_total,
            completed_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data || []) as SavedExam[];
    },
    enabled: !!user?.id,
  });

  const stats = useMemo(() => {
    const completed = exams.filter((e) => e.progress && e.progress.length > 0);
    const scores = completed.map((e) => e.progress![0].percentage);
    return {
      total: completed.length,
      avg: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      best: scores.length > 0 ? Math.round(Math.max(...scores)) : 0,
    };
  }, [exams]);

  const getScoreColor = (pct: number) => {
    if (pct >= 70) return '#10b981';
    if (pct >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const handleOpenExam = (exam: SavedExam) => {
    // Navigate to exam prep with the exam ID
    router.push({
      pathname: '/screens/dash-assistant',
      params: {
        initialMessage: `Show me my practice exam "${exam.display_title}" for ${exam.subject} ${exam.grade.replace('grade_', 'Grade ')}`,
      },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubPageHeader title={t('parent.my_exams', { defaultValue: 'My Practice Exams' })} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading your exams...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => refetch()} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats */}
          {stats.total > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={{ fontSize: 28, marginBottom: 4 }}>📝</Text>
                <Text style={[styles.statValue, { color: theme.primary }]}>{stats.total}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={{ fontSize: 28, marginBottom: 4 }}>📊</Text>
                <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.avg}%</Text>
                <Text style={styles.statLabel}>Average</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={{ fontSize: 28, marginBottom: 4 }}>🏆</Text>
                <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.best}%</Text>
                <Text style={styles.statLabel}>Best Score</Text>
              </View>
            </View>
          )}

          {/* Exams List */}
          {exams.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 56 }}>📝</Text>
              <Text style={styles.emptyTitle}>No Practice Exams Yet</Text>
              <Text style={styles.emptyText}>Generate your first practice exam using Dash AI</Text>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => router.push('/screens/dash-assistant')}
              >
                <Ionicons name="home" size={18} color="#fff" />
                <Text style={styles.ctaButtonText}>Go to Dashboard</Text>
              </TouchableOpacity>
            </View>
          ) : (
            exams.map((exam) => {
              const hasProgress = exam.progress && exam.progress.length > 0;
              const latest = hasProgress ? exam.progress![0] : null;

              return (
                <View key={exam.id} style={styles.examCard}>
                  <View style={styles.examHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.examTitle}>{exam.display_title}</Text>
                      <Text style={styles.examMeta}>
                        {exam.grade.replace('grade_', 'Grade ')} · {exam.subject}
                      </Text>
                    </View>
                    <View style={styles.timeBadge}>
                      <Ionicons name="time-outline" size={12} color={theme.primary} />
                      <Text style={styles.timeText}>
                        {formatDistanceToNow(new Date(exam.created_at), { addSuffix: true })}
                      </Text>
                    </View>
                  </View>

                  {latest && (
                    <View style={[styles.scoreBox, { borderColor: getScoreColor(latest.percentage) }]}>
                      <Text style={[styles.scorePct, { color: getScoreColor(latest.percentage) }]}>
                        {latest.percentage.toFixed(1)}%
                      </Text>
                      <Text style={styles.scoreMeta}>
                        📊 Score: {latest.score_obtained}/{latest.score_total} marks
                        {' · '}
                        🕐 {formatDistanceToNow(new Date(latest.completed_at), { addSuffix: true })}
                      </Text>
                    </View>
                  )}

                  <View style={styles.examActions}>
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={() => handleOpenExam(exam)}
                    >
                      <Ionicons name={hasProgress ? 'bar-chart' : 'create'} size={16} color="#fff" />
                      <Text style={styles.primaryButtonText}>
                        {hasProgress ? 'Review Exam' : 'Take Exam'}
                      </Text>
                    </TouchableOpacity>

                    {hasProgress && (
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => handleOpenExam(exam)}
                      >
                        <Ionicons name="refresh" size={16} color={theme.primary} />
                        <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>Retake</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
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
    scrollContent: { paddingHorizontal: 16, paddingBottom: bottomInset + 40, gap: 14 },
    statsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    statCard: {
      flex: 1, backgroundColor: theme.surface, borderRadius: 14, padding: 14,
      alignItems: 'center', borderWidth: 1, borderColor: theme.border,
    },
    statValue: { fontSize: 22, fontWeight: '700' },
    statLabel: { fontSize: 11, color: theme.textSecondary, marginTop: 2, fontWeight: '600' },
    emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
    emptyText: { fontSize: 14, color: theme.textSecondary },
    ctaButton: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
      marginTop: 8,
    },
    ctaButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    examCard: {
      backgroundColor: theme.surface, borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: theme.border,
    },
    examHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
    examTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 4 },
    examMeta: { fontSize: 13, color: theme.textSecondary },
    timeBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: `${theme.primary}15`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    },
    timeText: { fontSize: 11, color: theme.primary, fontWeight: '600' },
    scoreBox: {
      marginTop: 12, padding: 14, borderRadius: 12,
      backgroundColor: theme.elevated, borderWidth: 1,
    },
    scorePct: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
    scoreMeta: { fontSize: 12, color: theme.textSecondary },
    examActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    primaryButton: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 12,
    },
    primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    secondaryButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
      borderWidth: 1, borderColor: theme.border,
    },
    secondaryButtonText: { fontWeight: '700', fontSize: 14 },
  });
