/**
 * SessionSummaryCard
 *
 * End-of-session card rendered in the DashAssistant chat after the
 * D→T→P→C pipeline completes. Shows:
 * - Score breakdown & mastery percentage
 * - Phase-by-phase results
 * - Achievement badges (if any)
 * - Spaced repetition next review date
 * - Continue / new topic actions
 *
 * ≤400 lines (excl. StyleSheet) per WARP.md
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { PipelineSessionSummary } from '@/hooks/dash-assistant/useTutorPipeline';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionSummaryCardProps {
  summary: PipelineSessionSummary;
  onNewTopic?: () => void;
  onReviewAgain?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMasteryLabel(pct: number): { label: string; emoji: string; color: string } {
  if (pct >= 90) return { label: 'Mastery!', emoji: '🌟', color: '#22c55e' };
  if (pct >= 80) return { label: 'Proficient', emoji: '💪', color: '#3b82f6' };
  if (pct >= 60) return { label: 'Developing', emoji: '📈', color: '#f59e0b' };
  if (pct >= 40) return { label: 'Emerging', emoji: '🌱', color: '#f97316' };
  return { label: 'Needs Practice', emoji: '🔄', color: '#ef4444' };
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const SessionSummaryCard: React.FC<SessionSummaryCardProps> = ({
  summary,
  onNewTopic,
  onReviewAgain,
}) => {
  const { isDark } = useTheme();

  // Derive display values from the actual PipelineSessionSummary shape
  const correctAnswers = summary.criteria.practiceCorrect;
  const totalQuestions = summary.criteria.practiceAnswered;
  const masteryPercent = totalQuestions > 0
    ? Math.round((correctAnswers / totalQuestions) * 100)
    : 0;
  const mastery = useMemo(() => getMasteryLabel(masteryPercent), [masteryPercent]);

  const totalTimeMs = summary.startedAt && summary.completedAt
    ? new Date(summary.completedAt).getTime() - new Date(summary.startedAt).getTime()
    : 0;

  // Derive achievements from criteria
  const achievements = useMemo(() => {
    const list: string[] = [];
    if (masteryPercent >= 90) list.push('Perfect Score');
    if (summary.criteria.checkPassed) list.push('Check Passed');
    if (correctAnswers >= 5) list.push('Practice Pro');
    if (totalTimeMs > 0 && totalTimeMs < 5 * 60 * 1000) list.push('Speed Learner');
    return list;
  }, [masteryPercent, summary.criteria, correctAnswers, totalTimeMs]);

  const completedPhases = summary.phases.filter(
    (p) => p !== 'IDLE' && p !== 'COMPLETE'
  );

  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const border = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const muted = isDark ? '#94a3b8' : '#64748b';

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
      {/* Title */}
      <View style={styles.titleRow}>
        <Text style={styles.titleEmoji}>📊</Text>
        <Text style={[styles.title, { color: textColor }]}>Session Summary</Text>
      </View>

      {/* Mastery Ring (simplified) */}
      <View style={styles.masterySection}>
        <View style={[styles.masteryRing, { borderColor: mastery.color }]}>
          <Text style={[styles.masteryPct, { color: mastery.color }]}>
            {masteryPercent}%
          </Text>
          <Text style={styles.masteryEmoji}>{mastery.emoji}</Text>
        </View>
        <Text style={[styles.masteryLabel, { color: mastery.color }]}>{mastery.label}</Text>
        <Text style={[styles.topicText, { color: muted }]}>
          {summary.config.subject}
          {summary.config.topic ? ` — ${summary.config.topic}` : ''}
        </Text>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatBox label="Score" value={`${correctAnswers}/${totalQuestions}`} color="#3b82f6" isDark={isDark} />
        <StatBox label="Time" value={formatDuration(totalTimeMs)} color="#8b5cf6" isDark={isDark} />
        <StatBox label="Phases" value={completedPhases.length.toString()} color="#f59e0b" isDark={isDark} />
      </View>

      {/* Phase breakdown */}
      <View style={styles.phaseBreakdown}>
        <Text style={[styles.sectionLabel, { color: muted }]}>Phase Progress</Text>
        {completedPhases.map((p) => (
          <View key={p} style={styles.phaseRow}>
            <Text style={[styles.phaseCheck, { color: '#22c55e' }]}>✓</Text>
            <Text style={[styles.phaseText, { color: textColor }]}>{p}</Text>
          </View>
        ))}
      </View>

      {/* Achievements */}
      {achievements.length > 0 && (
        <View style={styles.achievements}>
          <Text style={[styles.sectionLabel, { color: muted }]}>Achievements</Text>
          <View style={styles.badgeRow}>
            {achievements.map((a, i) => (
              <View key={i} style={[styles.badge, { backgroundColor: '#f59e0b20' }]}>
                <Text style={styles.badgeText}>🏅 {a}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {masteryPercent < 80 && onReviewAgain && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#f59e0b' }]}
            onPress={onReviewAgain}
          >
            <Text style={styles.actionText}>🔄 Review Again</Text>
          </TouchableOpacity>
        )}
        {onNewTopic && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]}
            onPress={onNewTopic}
          >
            <Text style={styles.actionText}>📚 New Topic</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatBox: React.FC<{
  label: string;
  value: string;
  color: string;
  isDark: boolean;
}> = ({ label, value, color, isDark }) => (
  <View style={[styles.statBox, { backgroundColor: color + '15' }]}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>{label}</Text>
  </View>
);

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  titleEmoji: {
    fontSize: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  masterySection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  masteryRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  masteryPct: {
    fontSize: 22,
    fontWeight: '800',
  },
  masteryEmoji: {
    fontSize: 14,
  },
  masteryLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  topicText: {
    fontSize: 13,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  phaseBreakdown: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  phaseCheck: {
    fontSize: 14,
    fontWeight: '700',
  },
  phaseText: {
    fontSize: 14,
  },
  achievements: {
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default SessionSummaryCard;
