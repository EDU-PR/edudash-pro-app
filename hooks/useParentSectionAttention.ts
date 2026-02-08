/**
 * useParentSectionAttention — Smart attention signal computation
 * 
 * Computes urgency state for each CollapsibleSection on the parent
 * dashboard using live dashboard data signals (messages, homework,
 * calls, fees, attendance). Memoized — only recalculates when the
 * underlying data changes.
 * 
 * Priority tiers:
 *   critical — Immediate action needed (overdue fees, low attendance, many missed calls)
 *   action   — Should review soon (pending homework, unread messages)
 *   info     — FYI, no urgency (new activities, upcoming birthdays)
 *   none     — No attention needed
 */

import { useMemo } from 'react';
import type { AttentionPriority } from '@/components/dashboard/shared/SectionAttentionDot';

export interface SectionAttentionState {
  priority: AttentionPriority;
  count: number;
  label?: string;
}

export type SectionAttentionMap = Record<string, SectionAttentionState>;

/** Default state — no attention for any section */
const NONE: SectionAttentionState = { priority: 'none', count: 0 };

interface AttentionInput {
  /** Data from useParentDashboard() */
  dashboardData: any | null;
  /** From useNotificationsWithFocus() */
  unreadMessageCount: number;
  missedCallsCount: number;
  /** From dashboardData.feesDueSoon */
  feesDueSoon: { amount?: number; daysUntil: number } | null;
  /** Whether a live class is currently active */
  hasActiveClass?: boolean;
  /** Number of upcoming birthdays this week */
  upcomingBirthdaysCount?: number;
  /** Whether there are new teacher notes (unread) */
  hasNewTeacherNotes?: boolean;
  /** Whether there are new daily activities today */
  hasNewActivities?: boolean;
}

export function useParentSectionAttention(input: AttentionInput): SectionAttentionMap {
  const {
    dashboardData,
    unreadMessageCount,
    missedCallsCount,
    feesDueSoon,
    hasActiveClass = false,
    upcomingBirthdaysCount = 0,
    hasNewTeacherNotes = false,
    hasNewActivities = false,
  } = input;

  return useMemo(() => {
    const pendingHomework =
      dashboardData?.recentHomework?.filter(
        (hw: any) => hw.status === 'not_submitted',
      ).length ?? 0;
    const attendanceRate = dashboardData?.attendanceRate ?? 100;
    const feesOverdue = feesDueSoon
      ? feesDueSoon.daysUntil <= 0
      : false;
    const feesSoon = feesDueSoon
      ? feesDueSoon.daysUntil > 0 && feesDueSoon.daysUntil <= 3
      : false;

    // ─── Overview section ────────────────────────────────────
    let overview: SectionAttentionState = { ...NONE };
    if (missedCallsCount > 2 || attendanceRate < 75) {
      overview = { priority: 'critical', count: missedCallsCount, label: 'Needs attention' };
    } else if (unreadMessageCount > 5 || missedCallsCount > 0) {
      const total = unreadMessageCount + missedCallsCount;
      overview = { priority: 'action', count: total, label: `${total} pending` };
    } else if (unreadMessageCount > 0) {
      overview = { priority: 'info', count: unreadMessageCount };
    }

    // ─── Mission Control (formerly Quick Actions) ────────────
    let missionControl: SectionAttentionState = { ...NONE };
    if (feesOverdue) {
      missionControl = { priority: 'critical', count: 1, label: 'Payment overdue' };
    } else if (pendingHomework > 0 || feesSoon) {
      const count = pendingHomework + (feesSoon ? 1 : 0);
      missionControl = { priority: 'action', count, label: `${count} items` };
    }

    // ─── Live Classes ────────────────────────────────────────
    const liveClasses: SectionAttentionState = hasActiveClass
      ? { priority: 'action', count: 1, label: 'Live now' }
      : { ...NONE };

    // ─── Teacher Notes ───────────────────────────────────────
    const teacherNotes: SectionAttentionState = hasNewTeacherNotes
      ? { priority: 'info', count: 1, label: 'New note' }
      : { ...NONE };

    // ─── Progress & Achievements ─────────────────────────────
    // Could be enhanced with new badge detection
    const progress: SectionAttentionState = { ...NONE };

    // ─── Upcoming Birthdays ──────────────────────────────────
    const birthdays: SectionAttentionState = upcomingBirthdaysCount > 0
      ? { priority: 'info', count: upcomingBirthdaysCount }
      : { ...NONE };

    // ─── Daily Activities ────────────────────────────────────
    const dailyActivities: SectionAttentionState = hasNewActivities
      ? { priority: 'info', count: 1, label: 'New today' }
      : { ...NONE };

    // ─── Uniform Sizes (no attention signals) ────────────────
    const uniformSizes: SectionAttentionState = { ...NONE };

    return {
      'overview': overview,
      'mission-control': missionControl,
      'live-classes': liveClasses,
      'teacher-notes': teacherNotes,
      'progress': progress,
      'birthdays': birthdays,
      'daily-activities': dailyActivities,
      'uniform-sizes': uniformSizes,
    };
  }, [
    dashboardData,
    unreadMessageCount,
    missedCallsCount,
    feesDueSoon,
    hasActiveClass,
    upcomingBirthdaysCount,
    hasNewTeacherNotes,
    hasNewActivities,
  ]);
}

export default useParentSectionAttention;
