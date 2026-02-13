/**
 * TutorSessionBanner
 *
 * Sticky banner displayed at the top of the DashAssistant chat when a
 * tutor pipeline session is active. Shows:
 * - Current D→T→P→C phase with visual step indicators
 * - Subject / topic label
 * - Live session timer
 * - Compact score (practice phase onward)
 *
 * ≤400 lines (excl. StyleSheet) per WARP.md
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import type { TutorPhase, PhaseCriteria } from '@/hooks/dash-assistant/useTutorPipeline';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TutorSessionBannerProps {
  phase: TutorPhase;
  subject?: string;
  topic?: string;
  grade?: string;
  criteria: PhaseCriteria;
  onClose?: () => void;
}

// ─── Phase metadata ──────────────────────────────────────────────────────────

const PHASE_META: Record<
  Exclude<TutorPhase, 'IDLE'>,
  { label: string; emoji: string; color: string }
> = {
  DIAGNOSE: { label: 'Diagnose', emoji: '🔍', color: '#8b5cf6' },
  TEACH: { label: 'Teach', emoji: '📖', color: '#3b82f6' },
  PRACTICE: { label: 'Practice', emoji: '✏️', color: '#f59e0b' },
  CHECK: { label: 'Check', emoji: '✅', color: '#22c55e' },
  COMPLETE: { label: 'Done', emoji: '🎉', color: '#10b981' },
};

const PHASES_ORDERED: Exclude<TutorPhase, 'IDLE'>[] = [
  'DIAGNOSE',
  'TEACH',
  'PRACTICE',
  'CHECK',
  'COMPLETE',
];

// ─── Component ───────────────────────────────────────────────────────────────

export const TutorSessionBanner: React.FC<TutorSessionBannerProps> = ({
  phase,
  subject,
  topic,
  grade,
  criteria,
  onClose,
}) => {
  const { isDark } = useTheme();
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // Live timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = useCallback((secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  if (phase === 'IDLE') return null;

  const meta = PHASE_META[phase] || PHASE_META.DIAGNOSE;
  const activeIdx = PHASES_ORDERED.indexOf(phase);
  const bg = isDark ? '#0f172a' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e2e8f0';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';

  const scoreDisplay =
    criteria.practiceCorrect > 0 || criteria.practiceAnswered > 0
      ? `${criteria.practiceCorrect}/${criteria.practiceAnswered}`
      : null;

  return (
    <View style={[styles.banner, { backgroundColor: bg, borderBottomColor: border }]}>
      {/* Phase stepper */}
      <View style={styles.stepper}>
        {PHASES_ORDERED.slice(0, 4).map((p, idx) => {
          const pMeta = PHASE_META[p];
          const completed = idx < activeIdx;
          const active = idx === activeIdx;
          return (
            <View key={p} style={styles.stepItem}>
              <View
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: completed
                      ? pMeta.color
                      : active
                        ? pMeta.color + '30'
                        : isDark
                          ? '#334155'
                          : '#e2e8f0',
                    borderColor: active ? pMeta.color : 'transparent',
                    borderWidth: active ? 2 : 0,
                  },
                ]}
              >
                <Text style={styles.stepEmoji}>
                  {completed ? '✓' : pMeta.emoji}
                </Text>
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color: active ? pMeta.color : muted,
                    fontWeight: active ? '700' : '400',
                  },
                ]}
              >
                {pMeta.label}
              </Text>
              {idx < 3 && (
                <View
                  style={[
                    styles.stepLine,
                    {
                      backgroundColor: completed ? pMeta.color : isDark ? '#334155' : '#e2e8f0',
                    },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Info row */}
      <View style={styles.infoRow}>
        <View style={styles.infoLeft}>
          {subject && (
            <Text style={[styles.subjectText, { color: textColor }]} numberOfLines={1}>
              {subject}
              {topic ? ` · ${topic}` : ''}
              {grade ? ` (${grade})` : ''}
            </Text>
          )}
        </View>

        <View style={styles.infoRight}>
          {scoreDisplay && (
            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>{scoreDisplay}</Text>
            </View>
          )}
          <Text style={[styles.timer, { color: muted }]}>⏱ {formatTime(elapsed)}</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.closeBtn, { color: muted }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 4,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepEmoji: {
    fontSize: 12,
  },
  stepLabel: {
    fontSize: 10,
    marginLeft: 2,
  },
  stepLine: {
    width: 20,
    height: 2,
    borderRadius: 1,
    marginHorizontal: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLeft: {
    flex: 1,
    marginRight: 8,
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scorePill: {
    backgroundColor: '#22c55e20',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22c55e',
  },
  timer: {
    fontSize: 12,
    fontWeight: '500',
  },
  closeBtn: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TutorSessionBanner;
