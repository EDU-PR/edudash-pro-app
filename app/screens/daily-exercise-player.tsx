/**
 * Daily Exercise Player Screen
 *
 * Full-screen exercise experience (hides bottom nav).
 * Loads the current day's exercises and renders the ExercisePlayer component.
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '@/contexts/AuthContext';
import { useDailyExercises, useCompleteSubjectExercise } from '@/hooks/daily-exercises';
import { ExercisePlayer } from '@/components/daily-exercises/ExercisePlayer';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import type { SubjectCode } from '@/lib/daily-exercises/types';

export default function DailyExercisePlayerScreen() {
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ studentId?: string }>();
  const studentId = params.studentId ?? profile?.id;

  const { data: exerciseSet, isLoading } = useDailyExercises(studentId);
  const completeSubject = useCompleteSubjectExercise();

  const handleComplete = useCallback(
    (subjectCode: SubjectCode, score: number, timeSeconds: number) => {
      if (!studentId || !exerciseSet) return;
      completeSubject.mutate({
        studentId,
        exerciseSetId: exerciseSet.id,
        subjectCode,
        score,
        timeSpentSeconds: timeSeconds,
      });
    },
    [studentId, exerciseSet, completeSubject],
  );

  const handleExit = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(k12)/parent/dashboard' as never);
    }
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#070B16', '#0F121E']} style={StyleSheet.absoluteFillObject} />
        <EduDashSpinner size="large" color="#00F5FF" />
        <Text style={styles.loadingText}>Loading exercises...</Text>
      </View>
    );
  }

  return (
    <ExercisePlayer
      exerciseSet={exerciseSet ?? null}
      onExit={handleExit}
      onComplete={handleComplete}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#070B16',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 15,
  },
});
