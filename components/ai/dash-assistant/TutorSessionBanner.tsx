/**
 * TutorSessionBanner — #NEXT-GEN Cosmic Pipeline Stepper
 *
 * Sticky banner displayed at the top of the DashAssistant chat when a
 * tutor pipeline session is active. Uses the ZA-inspired cosmic palette
 * (gold/emerald/deep-blue) with glassmorphism and gradient effects.
 *
 * Shows:
 * - Current D→T→P→C phase with glowing step indicators
 * - Subject / topic label with gradient text accent
 * - Live session timer
 * - Compact score pill (practice phase onward)
 *
 * ≤400 lines (excl. StyleSheet) per WARP.md
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import type { TutorPhase, PhaseCriteria } from '@/hooks/dash-assistant/useTutorPipeline';

// ─── ZA Cosmic Palette (aligned with DashOrb) ───────────────────────────────

const ZA = {
  gold: '#FFD700',
  goldSoft: '#FFC83D',
  emerald: '#00C853',
  deepBlue: '#002395',
  teal: '#00BCD4',
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface TutorSessionBannerProps {
  /** Current pipeline phase. Accepts both 'phase' and 'currentPhase' */
  phase?: TutorPhase;
  currentPhase?: TutorPhase;
  subject?: string;
  topic?: string;
  grade?: string;
  criteria: PhaseCriteria;
  onClose?: () => void;
}

// ─── Phase metadata ──────────────────────────────────────────────────────────

const PHASE_META: Record<
  Exclude<TutorPhase, 'IDLE'>,
  { label: string; icon: string; gradient: [string, string] }
> = {
  DIAGNOSE: { label: 'Diagnose', icon: 'search', gradient: ['#8b5cf6', '#a78bfa'] },
  TEACH:    { label: 'Teach',    icon: 'book', gradient: ['#3b82f6', '#60a5fa'] },
  PRACTICE: { label: 'Practice', icon: 'pencil', gradient: [ZA.gold, ZA.goldSoft] },
  CHECK:    { label: 'Check',    icon: 'checkmark-circle', gradient: [ZA.emerald, '#4ade80'] },
  COMPLETE: { label: 'Done',     icon: 'trophy', gradient: ['#10b981', '#34d399'] },
};

const PHASES_ORDERED: Exclude<TutorPhase, 'IDLE'>[] = [
  'DIAGNOSE', 'TEACH', 'PRACTICE', 'CHECK',
];

// ─── Component ───────────────────────────────────────────────────────────────

export const TutorSessionBanner: React.FC<TutorSessionBannerProps> = ({
  phase: phaseProp,
  currentPhase,
  subject,
  topic,
  grade,
  criteria,
  onClose,
}) => {
  const { isDark } = useTheme();
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // Support both prop names for flexibility
  const phase = phaseProp || currentPhase || 'IDLE';

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

  const meta = PHASE_META[phase as Exclude<TutorPhase, 'IDLE'>] || PHASE_META.DIAGNOSE;
  const activeIdx = PHASES_ORDERED.indexOf(phase as Exclude<TutorPhase, 'IDLE'>);

  const scoreDisplay =
    criteria.practiceCorrect > 0 || criteria.practiceAnswered > 0
      ? `${criteria.practiceCorrect}/${criteria.practiceAnswered}`
      : null;

  // Cosmic colors
  const bgGradient: [string, string, string] = isDark
    ? ['#0B1020', '#0F172A', '#131B2E']
    : ['#F0F4FF', '#E8EEFF', '#F5F7FF'];
  const borderColor = isDark ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.12)';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const textColor = isDark ? '#E2E8F0' : '#1E293B';

  return (
    <View style={[styles.bannerWrap, { borderBottomColor: borderColor }]}>
      <LinearGradient
        colors={bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient glow behind active phase */}
      <View style={[styles.ambientGlow, { backgroundColor: meta.gradient[0] + '12' }]} />

      {/* ─── Phase Stepper ─── */}
      <View style={styles.stepper}>
        {PHASES_ORDERED.map((p, idx) => {
          const pMeta = PHASE_META[p];
          const completed = idx < activeIdx;
          const active = idx === activeIdx;
          const future = idx > activeIdx;
          return (
            <React.Fragment key={p}>
              {/* Connector line (before each step except first) */}
              {idx > 0 && (
                <View style={styles.connectorWrap}>
                  <LinearGradient
                    colors={completed
                      ? (PHASE_META[PHASES_ORDERED[idx - 1]].gradient as [string, string])
                      : [isDark ? '#1E293B' : '#CBD5E1', isDark ? '#1E293B' : '#CBD5E1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.connector}
                  />
                </View>
              )}
              {/* Phase dot */}
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepDotOuter,
                  active && { shadowColor: pMeta.gradient[0], shadowOpacity: 0.6, shadowRadius: 10, elevation: 8 },
                ]}>
                  <LinearGradient
                    colors={completed || active
                      ? pMeta.gradient
                      : [isDark ? '#1E293B' : '#E2E8F0', isDark ? '#334155' : '#CBD5E1']}
                    style={[
                      styles.stepDot,
                      active && styles.stepDotActive,
                    ]}
                  >
                    <Ionicons
                      name={(completed ? 'checkmark' : pMeta.icon) as any}
                      size={completed ? 12 : 13}
                      color={completed || active ? '#fff' : (isDark ? '#64748B' : '#94A3B8')}
                    />
                  </LinearGradient>
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    {
                      color: active ? pMeta.gradient[0] : (future ? mutedColor : textColor),
                      fontWeight: active ? '700' : '500',
                    },
                  ]}
                >
                  {pMeta.label}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      {/* ─── Info Row ─── */}
      <View style={styles.infoRow}>
        <View style={styles.infoLeft}>
          {subject && (
            <View style={styles.subjectWrap}>
              <Ionicons name="sparkles" size={12} color={ZA.gold} style={{ marginRight: 4 }} />
              <Text style={[styles.subjectText, { color: textColor }]} numberOfLines={1}>
                {subject}
                {topic && topic !== subject ? ` · ${topic}` : ''}
                {grade ? ` (${grade})` : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.infoRight}>
          {scoreDisplay && (
            <LinearGradient
              colors={['rgba(34,197,94,0.15)', 'rgba(16,185,129,0.1)']}
              style={styles.scorePill}
            >
              <Ionicons name="stats-chart" size={10} color="#22c55e" />
              <Text style={styles.scoreText}>{scoreDisplay}</Text>
            </LinearGradient>
          )}
          <View style={[styles.timerPill, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
            <Ionicons name="time-outline" size={11} color={mutedColor} />
            <Text style={[styles.timerText, { color: mutedColor }]}>{formatTime(elapsed)}</Text>
          </View>
          {onClose && (
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}
            >
              <Ionicons name="close" size={14} color={mutedColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bannerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  ambientGlow: {
    position: 'absolute',
    top: -30,
    left: '20%',
    width: '60%',
    height: 80,
    borderRadius: 40,
    opacity: 0.6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 10,
  },
  connectorWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 2,
    marginHorizontal: 2,
  },
  connector: {
    width: 24,
    height: 2.5,
    borderRadius: 2,
    marginTop: -12,
  },
  stepItem: {
    alignItems: 'center',
    width: 52,
  },
  stepDotOuter: {
    marginBottom: 4,
    ...(Platform.OS === 'ios' ? {
      shadowOffset: { width: 0, height: 4 },
    } : {}),
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  stepLabel: {
    fontSize: 10,
    letterSpacing: 0.3,
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
  subjectWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22c55e',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TutorSessionBanner;
