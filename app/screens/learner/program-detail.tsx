import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { assertSupabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export default function LearnerProgramDetailScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const { data: course, isLoading, error } = useQuery({
    queryKey: ['learner-course', id],
    queryFn: async () => {
      if (!id) throw new Error('Course ID required');
      const { data, error } = await assertSupabase()
        .from('courses')
        .select('*, organizations(id, name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: enrollment } = useQuery({
    queryKey: ['learner-enrollment', profile?.id, id],
    queryFn: async () => {
      if (!profile?.id || !id) return null;
      const { data } = await assertSupabase()
        .from('enrollments')
        .select('*')
        .eq('student_id', profile.id)
        .eq('course_id', id)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id && !!id,
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen 
        options={{ 
          title: course?.title || t('learner.program_details', { defaultValue: 'Program Details' }),
          headerBackTitle: t('common.back', { defaultValue: 'Back' }),
        }} 
      />
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading && (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}

        {error && (
          <Card padding={20} margin={0}>
            <Text style={styles.errorText}>
              {t('common.error_loading', { defaultValue: 'Error loading program' })}
            </Text>
          </Card>
        )}

        {course && (
          <>
            {/* Program Header */}
            <Card padding={20} margin={0} elevation="medium" style={styles.headerCard}>
              <Text style={styles.title}>{course.title}</Text>
              {course.course_code && (
                <Text style={styles.code}>Code: {course.course_code}</Text>
              )}
              {course.description && (
                <Text style={styles.description}>{course.description}</Text>
              )}
              {enrollment && (
                <View style={styles.enrollmentBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.success || '#10B981'} />
                  <Text style={styles.enrollmentText}>
                    {t('learner.enrolled', { defaultValue: 'Enrolled' })}: {new Date(enrollment.enrolled_at).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </Card>

            {/* Program Modules/Content */}
            <Card padding={20} margin={0} elevation="small" style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                {t('learner.program_content', { defaultValue: 'Program Content' })}
              </Text>
              <Text style={styles.comingSoon}>
                {t('common.coming_soon', { defaultValue: 'Coming Soon' })}
              </Text>
            </Card>

            {/* Actions */}
            {enrollment && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: theme.primary }]}
                  onPress={() => router.push(`/screens/learner/submissions?course_id=${course.id}`)}
                >
                  <Ionicons name="document-text" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>
                    {t('learner.view_assignments', { defaultValue: 'View Assignments' })}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme?.background || '#0b1220' },
  content: { padding: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  headerCard: { marginBottom: 16 },
  title: { color: theme?.text || '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  code: { color: theme?.textSecondary || '#9CA3AF', fontSize: 14, marginBottom: 12 },
  description: { color: theme?.text || '#fff', fontSize: 16, lineHeight: 24, marginBottom: 16 },
  enrollmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: theme?.surface || '#1f2937',
    borderRadius: 8,
  },
  enrollmentText: { color: theme?.text || '#fff', fontSize: 14, fontWeight: '600' },
  sectionCard: { marginBottom: 16 },
  sectionTitle: { color: theme?.text || '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  comingSoon: { color: theme?.textSecondary || '#9CA3AF', fontSize: 14, fontStyle: 'italic' },
  actions: { marginTop: 8 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { color: theme?.error || '#EF4444', textAlign: 'center' },
});

