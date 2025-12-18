import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLearnerCourses } from '@/hooks/useLearnerCourses';

export default function LearnerCoursesScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const { data: courses, isLoading, error, refetch } = useLearnerCourses();

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: t('learner.online_courses', { defaultValue: 'Online Courses' }),
          headerBackTitle: t('common.back', { defaultValue: 'Back' }),
        }} 
      />
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}

        {!!error && (
          <Card padding={20} margin={0} elevation="small" style={{ marginBottom: 16 }}>
            <Text style={styles.errorText}>
              {t('common.error_loading', { defaultValue: 'Error loading courses' })}
            </Text>
            <TouchableOpacity onPress={() => refetch()} style={{ marginTop: 12 }}>
              <Text style={[styles.retryText, { color: theme.primary }]}>
                {t('common.retry', { defaultValue: 'Retry' })}
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {!isLoading && (!courses || courses.length === 0) && (
          <EmptyState
            icon="book-outline"
            title={t('learner.no_courses', { defaultValue: 'No Courses Available' })}
            description={t('learner.courses_prompt', { defaultValue: 'Online courses and learning materials will appear here' })}
          />
        )}

        {courses?.map((course) => (
          <TouchableOpacity
            key={course.id}
            activeOpacity={0.75}
            onPress={() => router.push(`/screens/learner/course-player?courseId=${course.id}`)}
          >
            <Card padding={16} margin={0} elevation="small" style={styles.courseCard}>
              <Text style={styles.courseTitle}>{course.title}</Text>
              {!!course.description && <Text style={styles.courseDescription}>{course.description}</Text>}
              {!!course.course_code && <Text style={styles.courseCode}>{course.course_code}</Text>}
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme?.background || '#0b1220' },
  content: { padding: 16, paddingBottom: 32 },
  loading: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  courseCard: { marginBottom: 12 },
  courseTitle: { color: theme?.text || '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  courseDescription: { color: theme?.textSecondary || '#9CA3AF', fontSize: 14 },
  courseCode: { color: theme?.textSecondary || '#9CA3AF', fontSize: 12, marginTop: 8, fontWeight: '600' },
  errorText: { color: theme?.error || '#EF4444', textAlign: 'center', fontWeight: '600' },
  retryText: { textAlign: 'center', fontWeight: '700' },
});


