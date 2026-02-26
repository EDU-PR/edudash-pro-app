/**
 * ExerciseProgressView
 *
 * Detailed progress dashboard for a child's daily exercises.
 * Shows streak, weekly dots, subject breakdown, recent results.
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useDailyExerciseProgress } from '@/hooks/daily-exercises';
import type {
  DailyExerciseProgress,
  DayProgress,
  SubjectAverage,
  DailyExerciseSet,
} from '@/lib/daily-exercises/types';

interface ExerciseProgressViewProps {
  studentId: string | undefined;
  studentName: string | undefined;
}

export function ExerciseProgressView({ studentId, studentName }: ExerciseProgressViewProps) {
  const { t } = useTranslation();
  const { data: progress, isLoading } = useDailyExerciseProgress(studentId);

  if (isLoading || !progress) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {isLoading
            ? 'Loading progress...'
            : 'No progress data yet. Complete some daily exercises to see your stats!'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <StreakCard streak={progress.streak} />
      <WeekView days={progress.weekProgress} />
      <SubjectBreakdown averages={progress.subjectAverages} />
      <RecentExercises exercises={progress.recentExercises} />
      {progress.insight && <InsightCard insight={progress.insight} />}
    </ScrollView>
  );
}

/* ─── Streak Card ─────────────────────────────────────────────────── */

function StreakCard({ streak }: { streak: DailyExerciseProgress['streak'] }) {
  return (
    <LinearGradient
      colors={['rgba(255,150,0,0.14)', 'rgba(255,80,0,0.08)']}
      style={styles.streakCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Text style={styles.streakEmoji}>🔥</Text>
      <View style={styles.streakStats}>
        <StatBlock value={streak.current} label="Current" />
        <StatBlock value={streak.best} label="Best" />
        <StatBlock value={streak.totalDays} label="Total Days" />
      </View>
    </LinearGradient>
  );
}

function StatBlock({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* ─── Week View ───────────────────────────────────────────────────── */

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function WeekView({ days }: { days: DayProgress[] }) {
  const dayMap = useMemo(() => {
    const paddedDays = [...days];
    while (paddedDays.length < 7) {
      paddedDays.push({ date: '', status: 'pending' });
    }
    return paddedDays.slice(0, 7);
  }, [days]);

  return (
    <View style={styles.weekCard}>
      <Text style={styles.sectionTitle}>This Week</Text>
      <View style={styles.weekRow}>
        {dayMap.map((day, idx) => {
          const color =
            day.status === 'completed'
              ? '#4ADE80'
              : day.status === 'partial'
                ? '#FBBF24'
                : day.status === 'missed'
                  ? '#F87171'
                  : 'rgba(255,255,255,0.12)';
          return (
            <View key={idx} style={styles.weekDayCol}>
              <View style={[styles.weekDot, { backgroundColor: color }]} />
              <Text style={styles.weekDayLabel}>{DAY_LABELS[idx]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ─── Subject Breakdown ───────────────────────────────────────────── */

function SubjectBreakdown({ averages }: { averages: SubjectAverage[] }) {
  if (averages.length === 0) return null;

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Subject Breakdown</Text>
      {averages.map((avg) => (
        <View key={avg.subjectCode} style={styles.barRow}>
          <Text style={styles.barLabel}>{avg.subjectLabel}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.min(avg.averageScore, 100)}%`,
                  backgroundColor:
                    avg.averageScore >= 70 ? '#4ADE80' : avg.averageScore >= 50 ? '#FBBF24' : '#F87171',
                },
              ]}
            />
          </View>
          <Text style={styles.barValue}>{avg.averageScore}%</Text>
        </View>
      ))}
    </View>
  );
}

/* ─── Recent Exercises ────────────────────────────────────────────── */

function RecentExercises({ exercises }: { exercises: DailyExerciseSet[] }) {
  if (exercises.length === 0) return null;

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Recent Exercises</Text>
      {exercises.slice(0, 7).map((ex) => (
        <View key={`${ex.date}-${ex.id}`} style={styles.recentRow}>
          <Text style={styles.recentDate}>{formatShortDate(ex.date)}</Text>
          <View style={styles.recentSubjects}>
            {ex.subjects.map((s) => (
              <Text
                key={s.subjectCode}
                style={[
                  styles.recentBadge,
                  {
                    backgroundColor:
                      s.status === 'completed'
                        ? 'rgba(74,222,128,0.15)'
                        : 'rgba(255,255,255,0.06)',
                  },
                ]}
              >
                {s.subjectLabel.split(' ')[0]}{' '}
                {s.status === 'completed' ? `${s.score ?? 0}%` : '—'}
              </Text>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

/* ─── Insight Card ────────────────────────────────────────────────── */

function InsightCard({ insight }: { insight: string }) {
  return (
    <LinearGradient
      colors={['rgba(0,180,180,0.12)', 'rgba(30,100,200,0.08)']}
      style={styles.insightCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.insightHeader}>
        <Ionicons name="bulb-outline" size={18} color="#00F5FF" />
        <Text style={styles.insightTitle}>Dash Insights</Text>
      </View>
      <Text style={styles.insightText}>{insight}</Text>
    </LinearGradient>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 60 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  streakCard: {
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,150,0,0.20)',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakEmoji: { fontSize: 40, marginBottom: 12 },
  streakStats: { flexDirection: 'row', gap: 32 },
  statBlock: { alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  weekCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 14 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around' },
  weekDayCol: { alignItems: 'center', gap: 6 },
  weekDot: { width: 14, height: 14, borderRadius: 7 },
  weekDayLabel: { fontSize: 11, color: '#6B7280' },
  sectionCard: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  barLabel: { fontSize: 13, color: '#B0BEC5', width: 90 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { fontSize: 13, fontWeight: '700', color: '#E2E8F0', width: 40, textAlign: 'right' },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 10,
  },
  recentDate: { fontSize: 12, color: '#6B7280', width: 80 },
  recentSubjects: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  recentBadge: {
    fontSize: 11,
    color: '#B0BEC5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  insightCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.15)',
    marginBottom: 16,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  insightTitle: { fontSize: 14, fontWeight: '700', color: '#00F5FF' },
  insightText: { fontSize: 14, color: '#B0BEC5', lineHeight: 20 },
});
