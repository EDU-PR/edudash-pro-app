/**
 * Daily Exercise Progress Screen
 *
 * Shows detailed progress analytics for a child's daily exercise routine.
 */

import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { ExerciseProgressView } from '@/components/daily-exercises/ExerciseProgressView';

export default function DailyExerciseProgressScreen() {
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ studentId?: string; studentName?: string }>();
  const studentId = params.studentId ?? profile?.id;
  const studentName = params.studentName;

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(k12)/parent/dashboard' as never);
    }
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LinearGradient colors={['#070B16', '#0F121E']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exercise Progress</Text>
        <View style={styles.backBtn} />
      </View>

      <ExerciseProgressView studentId={studentId} studentName={studentName} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070B16' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
});
