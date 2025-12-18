import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { CourseVideoPlayer } from '@/components/learner/CourseVideoPlayer';
import { assertSupabase } from '@/lib/supabase';
import { useMutation, useQuery } from '@tanstack/react-query';

export default function CoursePlayerScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { courseId, lessonId } = useLocalSearchParams<{ courseId?: string; lessonId?: string }>();
  const styles = createStyles(theme);

  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [progress, setProgress] = useState(0);

  // Fetch course details
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: async () => {
      if (!courseId) return null;
      const { data, error } = await assertSupabase()
        .from('courses')
        .select('*, lessons(*)')
        .eq('id', courseId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  // Fetch or initialize lesson
  useEffect(() => {
    if (course?.lessons && course.lessons.length > 0) {
      if (lessonId) {
        const lesson = course.lessons.find((l: any) => l.id === lessonId);
        if (lesson) setSelectedLesson(lesson);
      } else {
        setSelectedLesson(course.lessons[0]);
      }
    }
  }, [course, lessonId]);

  // Save progress mutation
  const saveProgress = useMutation({
    mutationFn: async ({ lessonId, progress, completed }: { lessonId: string; progress: number; completed: boolean }) => {
      if (!profile?.id || !courseId) return;
      
      const { error } = await assertSupabase()
        .from('course_progress')
        .upsert({
          learner_id: profile.id,
          course_id: courseId,
          lesson_id: lessonId,
          progress_percentage: progress,
          is_completed: completed,
          last_position: progress,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'learner_id,lesson_id',
        });

      if (error) throw error;
    },
  });

  const handleProgress = (progressValue: number) => {
    setProgress(progressValue);
    if (selectedLesson && progressValue > 0) {
      // Auto-save progress every 10%
      if (progressValue % 10 < 1) {
        saveProgress.mutate({
          lessonId: selectedLesson.id,
          progress: progressValue,
          completed: progressValue >= 95,
        });
      }
    }
  };

  const handleComplete = () => {
    if (selectedLesson) {
      saveProgress.mutate({
        lessonId: selectedLesson.id,
        progress: 100,
        completed: true,
      });
    }
  };

  if (courseLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('course.loading', { defaultValue: 'Loading...' }) }} />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  if (!course) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: t('course.not_found', { defaultValue: 'Course Not Found' }) }} />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('course.course_not_found', { defaultValue: 'Course not found' })}</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>{t('common.go_back', { defaultValue: 'Go Back' })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: course.title || t('course.player', { defaultValue: 'Course Player' }),
          headerBackTitle: t('common.back', { defaultValue: 'Back' }),
        }} 
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Video Player */}
        {selectedLesson?.video_url && (
          <CourseVideoPlayer
            videoUrl={selectedLesson.video_url}
            courseId={courseId}
            lessonId={selectedLesson.id}
            onProgress={handleProgress}
            onComplete={handleComplete}
            startTime={selectedLesson.last_position || 0}
          />
        )}

        {/* Course Info */}
        <Card padding={20} margin={0} elevation="small" style={styles.section}>
          <Text style={styles.courseTitle}>{course.title}</Text>
          {course.description && (
            <Text style={styles.courseDescription}>{course.description}</Text>
          )}
        </Card>

        {/* Lessons List */}
        {course.lessons && course.lessons.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('course.lessons', { defaultValue: 'Lessons' })} ({course.lessons.length})
            </Text>
            {course.lessons.map((lesson: any, index: number) => {
              const isSelected = selectedLesson?.id === lesson.id;
              return (
                <TouchableOpacity
                  key={lesson.id}
                  style={[
                    styles.lessonCard,
                    isSelected && { backgroundColor: theme.primary + '20', borderColor: theme.primary },
                  ]}
                  onPress={() => {
                    setSelectedLesson(lesson);
                    setProgress(0);
                  }}
                >
                  <View style={styles.lessonHeader}>
                    <View style={[styles.lessonNumber, { backgroundColor: isSelected ? theme.primary : theme.surface }]}>
                      <Text style={[styles.lessonNumberText, { color: isSelected ? '#fff' : theme.text }]}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.lessonInfo}>
                      <Text style={[styles.lessonTitle, { color: theme.text }]}>{lesson.title}</Text>
                      {lesson.duration && (
                        <Text style={[styles.lessonDuration, { color: theme.textSecondary }]}>
                          {lesson.duration} {t('course.minutes', { defaultValue: 'min' })}
                        </Text>
                      )}
                    </View>
                    {isSelected && (
                      <Ionicons name="play-circle" size={24} color={theme.primary} />
                    )}
                    {lesson.progress_percentage > 0 && (
                      <View style={styles.progressBadge}>
                        <Text style={styles.progressBadgeText}>
                          {Math.round(lesson.progress_percentage)}%
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { paddingBottom: 32 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: theme.text, fontSize: 16, marginBottom: 16 },
  button: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  section: { marginBottom: 16, marginHorizontal: 16 },
  courseTitle: { color: theme.text, fontSize: 24, fontWeight: '700', marginBottom: 8 },
  courseDescription: { color: theme.textSecondary, fontSize: 14, lineHeight: 20 },
  sectionTitle: { color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 12, marginHorizontal: 16 },
  lessonCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  lessonHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lessonNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonNumberText: { fontSize: 16, fontWeight: '700' },
  lessonInfo: { flex: 1 },
  lessonTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  lessonDuration: { fontSize: 12 },
  progressBadge: {
    backgroundColor: theme.success || '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});





