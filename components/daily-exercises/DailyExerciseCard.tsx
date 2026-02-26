/**
 * DailyExerciseCard
 *
 * Dashboard card for the Daily Exercise Routine feature.
 * Renders four visual states: unconfigured, pending, partial, and completed.
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

import {
  useDailyExerciseConfig,
  useDailyExercises,
  useDailyExerciseProgress,
} from '@/hooks/daily-exercises';
import type { SubjectExercise } from '@/lib/daily-exercises/types';

interface DailyExerciseCardProps {
  studentId: string | undefined;
  studentName: string | undefined;
  grade: string | undefined;
  onStartExercise: () => void;
  onViewProgress: () => void;
  onConfigure: () => void;
}

export function DailyExerciseCard({
  studentId,
  studentName,
  grade,
  onStartExercise,
  onViewProgress,
  onConfigure,
}: DailyExerciseCardProps) {
  const { t } = useTranslation();
  const { data: config, isLoading: configLoading } = useDailyExerciseConfig(studentId);
  const { data: todaySet } = useDailyExercises(studentId);
  const { data: progress } = useDailyExerciseProgress(studentId);

  const streak = progress?.streak?.current ?? 0;

  const { completedCount, totalCount, allDone, overallProgress } = useMemo(() => {
    if (!todaySet) return { completedCount: 0, totalCount: 0, allDone: false, overallProgress: 0 };
    const done = todaySet.subjects.filter((s) => s.status === 'completed').length;
    const total = todaySet.subjects.length;
    return {
      completedCount: done,
      totalCount: total,
      allDone: done === total && total > 0,
      overallProgress: total > 0 ? done / total : 0,
    };
  }, [todaySet]);

  const averageScore = useMemo(() => {
    if (!todaySet) return 0;
    const completed = todaySet.subjects.filter((s) => s.status === 'completed' && s.score != null);
    if (completed.length === 0) return 0;
    return Math.round(completed.reduce((sum, s) => sum + (s.score ?? 0), 0) / completed.length);
  }, [todaySet]);

  const totalTimeMin = useMemo(() => {
    if (!todaySet) return 0;
    const seconds = todaySet.subjects.reduce((sum, s) => sum + (s.timeSpentSeconds ?? 0), 0);
    return Math.round(seconds / 60);
  }, [todaySet]);

  if (configLoading) return null;

  const isConfigured = !!config;

  return (
    <LinearGradient
      colors={['rgba(0,180,180,0.12)', 'rgba(30,100,200,0.08)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEmoji}>📚</Text>
          <Text style={styles.headerTitle}>
            {t('dailyExercise.title', { defaultValue: 'Daily Practice' })}
          </Text>
        </View>
        {isConfigured && streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {streak}-day streak</Text>
          </View>
        )}
      </View>

      {!isConfigured && <UnconfiguredBody onConfigure={onConfigure} />}
      {isConfigured && !todaySet && <PendingBodyEmpty onStart={onStartExercise} />}
      {isConfigured && todaySet && !allDone && (
        <PartialBody
          subjects={todaySet.subjects}
          overallProgress={overallProgress}
          onContinue={onStartExercise}
        />
      )}
      {isConfigured && todaySet && allDone && (
        <CompletedBody
          subjects={todaySet.subjects}
          averageScore={averageScore}
          totalTimeMin={totalTimeMin}
          onViewProgress={onViewProgress}
          onConfigure={onConfigure}
        />
      )}
    </LinearGradient>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function UnconfiguredBody({ onConfigure }: { onConfigure: () => void }) {
  return (
    <>
      <Text style={styles.bodyText}>
        Set up a daily exercise routine for your child. 5 questions per subject in Maths and
        English, every day.
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={onConfigure} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>🚀 Set Up Daily Practice</Text>
      </TouchableOpacity>
    </>
  );
}

function PendingBodyEmpty({ onStart }: { onStart: () => void }) {
  return (
    <>
      <Text style={styles.sectionLabel}>Today&apos;s exercises:</Text>
      <Text style={styles.bodyText}>Exercises not yet generated for today.</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={onStart} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>▶ Start Today&apos;s Practice</Text>
      </TouchableOpacity>
    </>
  );
}

function PartialBody({
  subjects,
  overallProgress,
  onContinue,
}: {
  subjects: SubjectExercise[];
  overallProgress: number;
  onContinue: () => void;
}) {
  const pct = Math.round(overallProgress * 100);
  return (
    <>
      <Text style={styles.sectionLabel}>Today&apos;s progress:</Text>
      {subjects.map((s) => (
        <SubjectRow key={s.subjectCode} subject={s} />
      ))}
      <TouchableOpacity style={styles.primaryButton} onPress={onContinue} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>▶ Continue Practice</Text>
      </TouchableOpacity>
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.progressText}>Progress: {pct}%</Text>
      </View>
    </>
  );
}

function CompletedBody({
  subjects,
  averageScore,
  totalTimeMin,
  onViewProgress,
  onConfigure,
}: {
  subjects: SubjectExercise[];
  averageScore: number;
  totalTimeMin: number;
  onViewProgress: () => void;
  onConfigure: () => void;
}) {
  return (
    <>
      <Text style={styles.celebrationText}>🎉 All done for today!</Text>
      {subjects.map((s) => (
        <SubjectRow key={s.subjectCode} subject={s} />
      ))}
      <Text style={styles.summaryText}>
        Average: {averageScore}% | Time: {totalTimeMin}min
      </Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={onViewProgress} activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>📊 View Progress</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onConfigure} activeOpacity={0.8}>
          <Text style={styles.secondaryButtonText}>⚙️ Settings</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

function SubjectRow({ subject }: { subject: SubjectExercise }) {
  const isCompleted = subject.status === 'completed';
  const icon = isCompleted ? '✅' : '○';
  const suffix = isCompleted
    ? ` — ${subject.score ?? 0}% (${subject.correctCount ?? 0}/${subject.totalQuestions})`
    : ` (${subject.totalQuestions} questions)`;

  return (
    <View style={styles.subjectRow}>
      <Text style={styles.subjectIcon}>{icon}</Text>
      <Text style={[styles.subjectLabel, isCompleted && styles.subjectCompleted]}>
        {subject.subjectLabel}
        <Text style={styles.subjectSuffix}>{suffix}</Text>
      </Text>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerEmoji: { fontSize: 20 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  streakBadge: {
    backgroundColor: 'rgba(255,150,0,0.18)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  streakText: { fontSize: 12, fontWeight: '700', color: '#FFB347' },
  bodyText: { fontSize: 14, color: '#B0BEC5', lineHeight: 20, marginBottom: 14 },
  sectionLabel: { fontSize: 13, color: '#9CA3AF', marginBottom: 8, fontWeight: '600' },
  celebrationText: { fontSize: 15, fontWeight: '700', color: '#4ADE80', marginBottom: 10 },
  summaryText: { fontSize: 13, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
  subjectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  subjectIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  subjectLabel: { fontSize: 14, color: '#E2E8F0', flex: 1 },
  subjectCompleted: { color: '#86EFAC' },
  subjectSuffix: { color: '#9CA3AF' },
  primaryButton: {
    backgroundColor: 'rgba(0,245,255,0.18)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.3)',
  },
  primaryButtonText: { fontSize: 15, fontWeight: '700', color: '#00F5FF' },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'center' },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  secondaryButtonText: { fontSize: 13, fontWeight: '600', color: '#B0BEC5' },
  progressBarContainer: { marginTop: 10, alignItems: 'center' },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#00F5FF' },
  progressText: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
});
