/**
 * SessionSummaryCard — #NEXT-GEN Cosmic Session Results
 *
 * End-of-session card rendered in the DashAssistant chat after the
 * D→T→P→C pipeline completes. Uses the ZA cosmic palette with
 * glassmorphism, gradient borders, and animated mastery visualization.
 *
 * Shows:
 * - Mastery ring with gradient border + percentage
 * - Phase-by-phase breakdown with gradient indicators
 * - Achievement badges with glow
 * - Stats grid with colored backgrounds
 * - Continue / new topic action buttons
 *
 * ≤400 lines (excl. StyleSheet) per WARP.md
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { PipelineSessionSummary } from '@/hooks/dash-assistant/useTutorPipeline';

// ─── ZA Cosmic Palette ───────────────────────────────────────────────────────

const ZA = {
  gold: '#FFD700',
  goldSoft: '#FFC83D',
  emerald: '#00C853',
  teal: '#00BCD4',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionSummaryCardProps {
  summary: PipelineSessionSummary;
  onNewTopic?: () => void;
  onReviewAgain?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMasteryLabel(pct: number): { label: string; icon: string; gradient: [string, string]; color: string } {
  if (pct >= 90) return { label: 'Mastery!', icon: 'star', gradient: [ZA.gold, ZA.goldSoft], color: ZA.gold };
  if (pct >= 80) return { label: 'Proficient', icon: 'medal', gradient: ['#3b82f6', '#60a5fa'], color: '#3b82f6' };
  if (pct >= 60) return { label: 'Developing', icon: 'trending-up', gradient: ['#f59e0b', '#fbbf24'], color: '#f59e0b' };
  if (pct >= 40) return { label: 'Emerging', icon: 'leaf', gradient: ['#f97316', '#fb923c'], color: '#f97316' };
  return { label: 'Needs Practice', icon: 'refresh', gradient: ['#ef4444', '#f87171'], color: '#ef4444' };
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

const PHASE_ICONS: Record<string, string> = {
  DIAGNOSE: 'search',
  TEACH: 'book',
  PRACTICE: 'pencil',
  CHECK: 'checkmark-circle',
};

// ─── Component ───────────────────────────────────────────────────────────────

export const SessionSummaryCard: React.FC<SessionSummaryCardProps> = ({
  summary,
  onNewTopic,
  onReviewAgain,
}) => {
  const { isDark } = useTheme();

  const correctAnswers = summary.criteria.practiceCorrect;
  const totalQuestions = summary.criteria.practiceAnswered;
  const masteryPercent = totalQuestions > 0
    ? Math.round((correctAnswers / totalQuestions) * 100)
    : 0;
  const mastery = useMemo(() => getMasteryLabel(masteryPercent), [masteryPercent]);

  const totalTimeMs = summary.startedAt && summary.completedAt
    ? new Date(summary.completedAt).getTime() - new Date(summary.startedAt).getTime()
    : 0;

  const achievements = useMemo(() => {
    const list: { label: string; icon: string }[] = [];
    if (masteryPercent >= 90) list.push({ label: 'Perfect Score', icon: 'star' });
    if (summary.criteria.checkPassed) list.push({ label: 'Check Passed', icon: 'checkmark-done' });
    if (correctAnswers >= 5) list.push({ label: 'Practice Pro', icon: 'flash' });
    if (totalTimeMs > 0 && totalTimeMs < 5 * 60 * 1000) list.push({ label: 'Speed Learner', icon: 'rocket' });
    return list;
  }, [masteryPercent, summary.criteria, correctAnswers, totalTimeMs]);

  const completedPhases = summary.phases.filter(
    (p) => p !== 'IDLE' && p !== 'COMPLETE'
  );

  // Cosmic palette
  const cardBg: [string, string] = isDark
    ? ['#0F172A', '#131B2E']
    : ['#F8FAFC', '#F0F4FF'];
  const borderColor = isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.1)';
  const textColor = isDark ? '#E2E8F0' : '#1E293B';
  const mutedColor = isDark ? '#94A3B8' : '#64748B';
  const surfaceBg = isDark ? '#1E293B' : '#F1F5F9';

  return (
    <View style={[styles.cardWrap, { borderColor }]}>
      <LinearGradient
        colors={cardBg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ─── Header ─── */}
      <View style={styles.titleRow}>
        <LinearGradient
          colors={mastery.gradient}
          style={styles.titleIconWrap}
        >
          <Ionicons name="analytics" size={14} color="#fff" />
        </LinearGradient>
        <Text style={[styles.title, { color: textColor }]}>Session Complete</Text>
        <Ionicons name="sparkles" size={14} color={ZA.gold} />
      </View>

      {/* ─── Mastery Ring ─── */}
      <View style={styles.masterySection}>
        <View style={[
          styles.masteryRingOuter,
          { shadowColor: mastery.color },
          Platform.OS === 'ios' && { shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
        ]}>
          <LinearGradient
            colors={mastery.gradient}
            style={styles.masteryRingGradient}
          >
            <View style={[styles.masteryRingInner, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
              <Text style={[styles.masteryPct, { color: mastery.color }]}>
                {masteryPercent}%
              </Text>
            </View>
          </LinearGradient>
        </View>
        <Text style={[styles.masteryLabel, { color: mastery.color }]}>{mastery.label}</Text>
        <Text style={[styles.topicText, { color: mutedColor }]}>
          {summary.config.subject}
          {summary.config.topic ? ` — ${summary.config.topic}` : ''}
        </Text>
      </View>

      {/* ─── Stats Grid ─── */}
      <View style={styles.statsGrid}>
        <StatBox
          icon="trophy"
          label="Score"
          value={`${correctAnswers}/${totalQuestions}`}
          gradient={['rgba(59,130,246,0.15)', 'rgba(99,102,241,0.08)']}
          color="#3b82f6"
          isDark={isDark}
        />
        <StatBox
          icon="time"
          label="Time"
          value={formatDuration(totalTimeMs)}
          gradient={['rgba(139,92,246,0.15)', 'rgba(168,85,247,0.08)']}
          color="#8b5cf6"
          isDark={isDark}
        />
        <StatBox
          icon="layers"
          label="Phases"
          value={completedPhases.length.toString()}
          gradient={['rgba(245,158,11,0.15)', 'rgba(251,191,36,0.08)']}
          color="#f59e0b"
          isDark={isDark}
        />
      </View>

      {/* ─── Phase Breakdown ─── */}
      <View style={styles.phaseBreakdown}>
        <Text style={[styles.sectionLabel, { color: mutedColor }]}>Phase Progress</Text>
        {completedPhases.map((p) => (
          <View key={p} style={[styles.phaseRow, { backgroundColor: surfaceBg }]}>
            <Ionicons
              name={(PHASE_ICONS[p] || 'ellipse') as any}
              size={13}
              color={ZA.emerald}
            />
            <Text style={[styles.phaseText, { color: textColor }]}>{p}</Text>
            <Ionicons name="checkmark" size={14} color={ZA.emerald} style={{ marginLeft: 'auto' }} />
          </View>
        ))}
      </View>

      {/* ─── Achievements ─── */}
      {achievements.length > 0 && (
        <View style={styles.achievements}>
          <Text style={[styles.sectionLabel, { color: mutedColor }]}>Achievements</Text>
          <View style={styles.badgeRow}>
            {achievements.map((a, i) => (
              <LinearGradient
                key={i}
                colors={['rgba(255,215,0,0.15)', 'rgba(255,200,61,0.08)']}
                style={styles.badge}
              >
                <Ionicons name={a.icon as any} size={12} color={ZA.gold} />
                <Text style={[styles.badgeText, { color: isDark ? ZA.gold : '#B45309' }]}>{a.label}</Text>
              </LinearGradient>
            ))}
          </View>
        </View>
      )}

      {/* ─── Actions ─── */}
      <View style={styles.actions}>
        {masteryPercent < 80 && onReviewAgain && (
          <TouchableOpacity style={styles.actionBtnWrap} onPress={onReviewAgain}>
            <LinearGradient
              colors={['#f59e0b', '#f97316']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtn}
            >
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.actionText}>Review Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        {onNewTopic && (
          <TouchableOpacity style={styles.actionBtnWrap} onPress={onNewTopic}>
            <LinearGradient
              colors={['#3b82f6', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionBtn}
            >
              <Ionicons name="book" size={16} color="#fff" />
              <Text style={styles.actionText}>New Topic</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const StatBox: React.FC<{
  icon: string;
  label: string;
  value: string;
  gradient: [string, string];
  color: string;
  isDark: boolean;
}> = ({ icon, label, value, gradient, color, isDark }) => (
  <LinearGradient colors={gradient} style={styles.statBox}>
    <Ionicons name={icon as any} size={14} color={color} style={{ marginBottom: 2 }} />
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={[styles.statLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>{label}</Text>
  </LinearGradient>
);

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardWrap: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 4,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  titleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    letterSpacing: 0.3,
  },
  masterySection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  masteryRingOuter: {
    marginBottom: 10,
    elevation: 8,
  },
  masteryRingGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    padding: 4,
  },
  masteryRingInner: {
    flex: 1,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  masteryPct: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  masteryLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  topicText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  phaseBreakdown: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  phaseText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtnWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
});

export default SessionSummaryCard;
