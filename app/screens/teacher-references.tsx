import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, type ThemeColors } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { TeacherReputationService } from '@/lib/services/TeacherReputationService';
import type { TeacherReference, TeacherRatingSummary } from '@/types/teacher-reputation';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
export default function TeacherReferencesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { teacherUserId, candidateProfileId } = useLocalSearchParams<{ teacherUserId?: string; candidateProfileId?: string }>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<TeacherRatingSummary | null>(null);
  const [references, setReferences] = useState<TeacherReference[]>([]);

  const resolvedTeacherUserId = candidateProfileId ? undefined : teacherUserId || user?.id || undefined;
  const isTeacherView = Boolean(resolvedTeacherUserId && user?.id && resolvedTeacherUserId === user.id);

  const loadReferences = useCallback(async () => {
    try {
      setLoading(true);
      const summaryResult = candidateProfileId
        ? await TeacherReputationService.getRatingSummaryByCandidateProfileId(candidateProfileId)
        : resolvedTeacherUserId
          ? await TeacherReputationService.getRatingSummaryByTeacherUserId(resolvedTeacherUserId)
          : null;

      const referenceList = candidateProfileId
        ? await TeacherReputationService.getReferencesByCandidateProfileId(candidateProfileId)
        : resolvedTeacherUserId
          ? await TeacherReputationService.getReferencesByTeacherUserId(resolvedTeacherUserId)
          : [];

      setSummary(summaryResult);
      setReferences(referenceList);
    } catch (_e) {
      setSummary(null);
      setReferences([]);
    } finally {
      setLoading(false);
    }
  }, [candidateProfileId, resolvedTeacherUserId]);

  useEffect(() => {
    loadReferences();
  }, [loadReferences]);

  const renderStars = (rating?: number | null, size = 16) => {
    if (!rating) return null;
    const rounded = Math.round(rating);
    return (
      <View style={styles.starsRow}>
        {Array.from({ length: 5 }).map((_, idx) => (
          <Ionicons
            key={idx}
            name={idx + 1 <= rounded ? 'star' : 'star-outline'}
            size={size}
            color={idx + 1 <= rounded ? '#F59E0B' : '#D1D5DB'}
          />
        ))}
      </View>
    );
  };

  const getInsights = () => {
    if (!summary || summary.rating_count < 2) {
      return 'Collect more references to unlock detailed insights.';
    }

    const categories = [
      { key: 'Communication', value: summary.avg_communication },
      { key: 'Classroom Management', value: summary.avg_classroom },
      { key: 'Planning', value: summary.avg_planning },
      { key: 'Professionalism', value: summary.avg_professionalism },
      { key: 'Parent Engagement', value: summary.avg_parent_engagement },
      { key: 'Reliability', value: summary.avg_reliability },
    ].filter((c) => typeof c.value === 'number');

    if (categories.length === 0) return 'Add more detailed ratings to see improvement tips.';

    const lowest = categories.reduce((acc, curr) => (curr.value! < acc.value! ? curr : acc));

    const tips: Record<string, string> = {
      Communication: 'Share weekly updates and set clear expectations with families.',
      'Classroom Management': 'Adopt consistent routines and reinforce positive behavior.',
      Planning: 'Prepare lesson outlines one week ahead and align objectives.',
      Professionalism: 'Document parent interactions and follow up promptly.',
      'Parent Engagement': 'Offer quick check-ins and invite parent participation.',
      Reliability: 'Communicate early about changes and keep schedules consistent.',
    };

    return `Focus area: ${lowest.key}. Tip: ${tips[lowest.key] || 'Keep improving with structured feedback.'}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Teacher References</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading references...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Overall Rating</Text>
            {summary?.avg_rating ? (
              <View style={styles.summaryRow}>
                {renderStars(summary.avg_rating, 20)}
                <Text style={styles.summaryScore}>{summary.avg_rating.toFixed(1)}</Text>
                <Text style={styles.summaryCount}>({summary.rating_count})</Text>
              </View>
            ) : (
              <Text style={styles.summaryEmpty}>No ratings yet</Text>
            )}
            {isTeacherView && (
              <View style={styles.insightBox}>
                <Ionicons name="bulb-outline" size={18} color={theme.primary} />
                <Text style={styles.insightText}>{getInsights()}</Text>
              </View>
            )}
            {isTeacherView && (
              <TouchableOpacity
                style={styles.manageProfileButton}
                onPress={() => router.push('/screens/teacher-hiring-profile')}
              >
                <Ionicons name="location-outline" size={16} color={theme.primary} />
                <Text style={styles.manageProfileText}>Manage Hiring Profile</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sectionTitle}>References</Text>

          {references.length === 0 ? (
            <Text style={styles.emptyText}>No references yet.</Text>
          ) : (
            references.map((reference) => (
              <View key={reference.id} style={styles.referenceCard}>
                <View style={styles.referenceHeader}>
                  <View>
                    <Text style={styles.referenceSchool}>{reference.school_name || 'School'}</Text>
                    {reference.principal_name ? (
                      <Text style={styles.referenceAuthor}>{reference.principal_name}</Text>
                    ) : null}
                  </View>
                  {renderStars(reference.rating_overall, 16)}
                </View>
                {reference.title ? <Text style={styles.referenceTitle}>{reference.title}</Text> : null}
                {reference.comment ? <Text style={styles.referenceComment}>{reference.comment}</Text> : null}
                <Text style={styles.referenceDate}>
                  {new Date(reference.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backButton: {
      padding: 8,
      borderRadius: 999,
      backgroundColor: theme.surface,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
    },
    loadingText: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    scrollView: { flex: 1 },
    content: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    summaryCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
    },
    summaryTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 8,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    summaryScore: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
    },
    summaryCount: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    summaryEmpty: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    starsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    insightBox: {
      marginTop: 12,
      flexDirection: 'row',
      gap: 8,
      backgroundColor: theme.primary + '12',
      padding: 10,
      borderRadius: 12,
      alignItems: 'flex-start',
    },
    insightText: {
      flex: 1,
      fontSize: 12,
      color: theme.text,
    },
    manageProfileButton: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      backgroundColor: theme.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    manageProfileText: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 12,
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    referenceCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },
    referenceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    referenceSchool: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    referenceAuthor: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    referenceTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    referenceComment: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 8,
    },
    referenceDate: {
      fontSize: 11,
      color: theme.textSecondary,
      textAlign: 'right',
    },
  });
