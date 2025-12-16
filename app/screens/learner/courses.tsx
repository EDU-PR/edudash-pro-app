import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export default function LearnerCoursesScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // TODO: Implement course fetching
  const courses: any[] = [];

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: t('learner.online_courses', { defaultValue: 'Online Courses' }),
          headerBackTitle: t('common.back', { defaultValue: 'Back' }),
        }} 
      />
      <ScrollView contentContainerStyle={styles.content}>
        {courses.length === 0 && (
          <EmptyState
            icon="book-outline"
            title={t('learner.no_courses', { defaultValue: 'No Courses Available' })}
            description={t('learner.courses_prompt', { defaultValue: 'Online courses and learning materials will appear here' })}
          />
        )}

        {courses.map((course) => (
          <Card key={course.id} padding={16} margin={0} elevation="small" style={styles.courseCard}>
            <Text style={styles.courseTitle}>{course.title}</Text>
            <Text style={styles.courseDescription}>{course.description}</Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme?.background || '#0b1220' },
  content: { padding: 16, paddingBottom: 32 },
  courseCard: { marginBottom: 12 },
  courseTitle: { color: theme?.text || '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  courseDescription: { color: theme?.textSecondary || '#9CA3AF', fontSize: 14 },
});


