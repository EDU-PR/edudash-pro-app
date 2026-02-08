/**
 * useParentMetrics — Metrics + today highlights computation
 * 
 * Extracts the reactive metrics grid and today highlights
 * from the parent dashboard for WARP compliance.
 * 
 * ≤180 lines — WARP-compliant hook.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency } from '@/lib/dashboard/parentDashboardHelpers';
import type { TodayHighlight } from '@/components/dashboard/parent/TodayHighlights';

interface Metric {
  title: string;
  value: string;
  icon: string;
  color: string;
  trend: 'stable' | 'attention' | 'up' | 'down' | 'good' | 'excellent' | 'warning' | 'needs_attention' | 'low' | 'high';
  action: string;
  glow: boolean;
  badge: number;
  priority?: 'urgent' | 'important' | 'informational';
}

interface UseParentMetricsOptions {
  dashboardData: any;
  unreadMessageCount: number;
  missedCallsCount: number;
  childrenCount: number;
  isFeesDueSoon: boolean;
  feesDueSoon: any;
}

export function useParentMetrics(options: UseParentMetricsOptions) {
  const { dashboardData, unreadMessageCount, missedCallsCount, childrenCount, isFeesDueSoon, feesDueSoon } = options;
  const { t } = useTranslation();
  const { theme } = useTheme();

  const metrics = useMemo<Metric[]>(() => {
    if (!dashboardData) {
      return [
        { title: t('parent.unread_messages', { defaultValue: 'Unread Messages' }), value: '...', icon: 'mail-unread', color: theme.primary, trend: 'stable', action: 'messages', glow: false, badge: 0 },
        { title: t('parent.missed_calls', { defaultValue: 'Missed Calls' }), value: '...', icon: 'call', color: '#10B981', trend: 'stable', action: 'calls', glow: false, badge: 0 },
        { title: t('parent.homework_pending', { defaultValue: 'Homework Pending' }), value: '...', icon: 'document-text', color: theme.warning, trend: 'stable', action: 'view_homework', glow: false, badge: 0 },
        { title: t('parent.attendance_rate', { defaultValue: 'Attendance Rate' }), value: '...', icon: 'calendar', color: theme.success, trend: 'stable', action: 'check_attendance', glow: false, badge: 0 },
      ];
    }

    const pendingHomework = dashboardData.recentHomework?.filter((hw: any) => hw.status === 'not_submitted').length ?? 0;
    const unreadCount = dashboardData.unreadMessages || unreadMessageCount || 0;
    const attendanceRate = dashboardData.attendanceRate ?? 0;

    const baseMetrics: (Metric & { _index: number; _rank: number })[] = [
      {
        title: t('parent.unread_messages', { defaultValue: 'Unread Messages' }),
        value: String(unreadCount), icon: 'mail-unread', color: theme.primary,
        trend: unreadCount > 5 ? 'attention' : 'stable',
        action: 'messages', glow: unreadCount > 0, badge: unreadCount,
        priority: unreadCount > 5 ? 'important' : unreadCount > 0 ? 'informational' : undefined,
        _index: 0, _rank: 0,
      },
      {
        title: t('parent.missed_calls', { defaultValue: 'Missed Calls' }),
        value: String(missedCallsCount), icon: 'call', color: '#10B981',
        trend: missedCallsCount > 0 ? 'attention' : 'stable',
        action: 'calls', glow: missedCallsCount > 0, badge: missedCallsCount,
        priority: missedCallsCount > 2 ? 'urgent' : missedCallsCount > 0 ? 'important' : undefined,
        _index: 1, _rank: 0,
      },
      {
        title: t('parent.homework_pending', { defaultValue: 'Homework Pending' }),
        value: String(pendingHomework), icon: 'document-text', color: theme.warning,
        trend: pendingHomework > 3 ? 'attention' : pendingHomework === 0 ? 'up' : 'stable',
        action: 'view_homework', glow: pendingHomework > 0, badge: pendingHomework,
        priority: pendingHomework > 3 ? 'urgent' : pendingHomework > 0 ? 'important' : undefined,
        _index: 2, _rank: 0,
      },
      {
        title: t('parent.attendance_rate', { defaultValue: 'Attendance Rate' }),
        value: `${attendanceRate}%`, icon: 'calendar', color: theme.success,
        trend: attendanceRate >= 90 ? 'up' : attendanceRate >= 75 ? 'stable' : 'attention',
        action: 'check_attendance', glow: false, badge: 0,
        priority: attendanceRate < 75 ? 'urgent' : attendanceRate < 90 ? 'important' : 'informational',
        _index: 3, _rank: 0,
      },
    ];

    const priorityRank: Record<string, number> = { urgent: 0, important: 1, informational: 2 };
    return baseMetrics
      .map((m) => ({ ...m, _rank: priorityRank[m.priority ?? 'informational'] ?? 3 }))
      .sort((a, b) => (a._rank - b._rank) || (a._index - b._index))
      .map(({ _index, _rank, ...rest }) => rest);
  }, [dashboardData, unreadMessageCount, missedCallsCount, theme, t]);

  const todayHighlights = useMemo<TodayHighlight[]>(() => {
    const totalChildrenCount = dashboardData?.totalChildren ?? childrenCount;
    const presentToday = dashboardData?.presentToday ?? 0;
    const attendanceRate = dashboardData?.attendanceRate ?? 0;
    const pendingHomework = dashboardData?.recentHomework?.filter((hw: any) => hw.status === 'not_submitted').length ?? 0;
    const upcomingEvent = dashboardData?.upcomingEvents?.[0];

    const highlights: TodayHighlight[] = [
      {
        id: 'attendance', label: t('parent.attendance_today', { defaultValue: 'Attendance' }),
        value: `${attendanceRate}%`,
        sub: totalChildrenCount > 0
          ? `${presentToday}/${totalChildrenCount} ${t('parent.present', { defaultValue: 'present' })}`
          : t('parent.no_children', { defaultValue: 'No children linked' }),
        icon: 'checkmark-circle-outline', color: theme.success,
      },
      {
        id: 'homework', label: t('parent.homework_due', { defaultValue: 'Homework' }),
        value: pendingHomework > 0 ? String(pendingHomework) : t('parent.all_done', { defaultValue: '0' }),
        sub: pendingHomework > 0 ? t('parent.needs_attention', { defaultValue: 'Needs attention' }) : t('parent.caught_up', { defaultValue: 'All caught up' }),
        icon: 'document-text-outline', color: pendingHomework > 0 ? theme.warning : theme.primary,
      },
      {
        id: 'next_event', label: t('parent.next_event', { defaultValue: 'Next Event' }),
        value: upcomingEvent?.title || t('parent.no_events', { defaultValue: 'No upcoming events' }),
        sub: upcomingEvent?.time || t('parent.check_back', { defaultValue: 'Check back soon' }),
        icon: 'calendar-outline', color: theme.info,
      },
    ];

    if (isFeesDueSoon && feesDueSoon) {
      highlights.push({
        id: 'fees_due', label: t('parent.fees_due', { defaultValue: 'Fees Due' }),
        value: formatCurrency(feesDueSoon.amount || 0),
        sub: t('parent.fees_due_in_days', { defaultValue: 'Due in {{count}} days', count: feesDueSoon.daysUntil }),
        icon: 'card-outline', color: feesDueSoon.daysUntil <= 1 ? theme.error : theme.warning,
      });
    }

    return highlights;
  }, [dashboardData, childrenCount, t, theme, isFeesDueSoon, feesDueSoon]);

  return { metrics, todayHighlights };
}

export default useParentMetrics;
