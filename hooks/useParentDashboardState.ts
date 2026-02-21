/**
 * useParentDashboardState — derived state, effects, and handlers
 *
 * Extracted from NewEnhancedParentDashboardRefactored.tsx to bring it under 400 lines.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import Feedback from '@/lib/feedback';
import { calculateAge } from '@/lib/date-utils';
import { normalizePersonName } from '@/lib/utils/nameUtils';
import { resolveAvatarUrl } from '@/lib/utils/avatar';
import { useParentDashboard } from '@/hooks/useDashboardData';
import { useNotificationsWithFocus } from '@/hooks/useNotifications';
import { useBirthdayPlanner } from '@/hooks/useBirthdayPlanner';
import { useParentInsights } from '@/hooks/useParentInsights';
import {
  getTempLessonSuggestions,
  isTierEligibleForTempLessons,
  type TempLessonSuggestion,
} from '@/lib/services/parentTempLessonService';
import type { SearchBarSuggestion } from '@/components/dashboard/shared';
import { resolveOrganizationId, resolveSchoolTypeFromProfile } from '@/lib/schoolTypeResolver';
const DEFAULT_COLLAPSED_SECTIONS = [
  'overview', 'mission-control', 'uniform-sizes', 'live-classes',
  'upcoming-reminders', 'teacher-notes', 'progress', 'insights', 'birthdays', 'daily-activities',
];
const getGradeNumber = (value?: string | null): number => {
  if (!value) return 0;
  const n = value.toLowerCase();
  if (n.includes('grade r') || n.trim() === 'r') return 0;
  const m = n.match(/\d{1,2}/);
  return m ? Number(m[0]) : 0;
};
export function useParentDashboardState(focusSection?: string) {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const { tier, ready: subscriptionReady, refresh: refreshSubscription } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [collapsedSections, setCollapsedSections] = useState(() => new Set(DEFAULT_COLLAPSED_SECTIONS));
  const [searchQuery, setSearchQuery] = useState('');
  const [tempLessonSuggestions, setTempLessonSuggestions] = useState<TempLessonSuggestion[]>([]);
  const [tempLessonSuggestionsLoading, setTempLessonSuggestionsLoading] = useState(false);
  const [tempLessonSuggestionsError, setTempLessonSuggestionsError] = useState<string | null>(null);
  // Data hooks
  const { data: dashboardData, loading, refresh } = useParentDashboard();
  const { messages: unreadMessageCount, calls: missedCallsCount } = useNotificationsWithFocus();
  const { birthdays: upcomingBirthdays, loading: birthdaysLoading, refresh: refreshBirthdays } = useBirthdayPlanner();
  const { insights: parentInsights, alerts: parentAlerts, loading: insightsLoading, error: insightsError, refresh: refreshInsights, hasUrgent: hasUrgentInsights } = useParentInsights({ studentId: activeChildId });
  // Derived state
  const resolvedOrganizationId = resolveOrganizationId(profile);
  const hasOrganization = Boolean(resolvedOrganizationId);
  const resolvedSchoolType = resolveSchoolTypeFromProfile(profile);
  const isK12School = resolvedSchoolType === 'k12_school';
  const activeChild = useMemo(() => children.find(c => c.id === activeChildId) || children[0], [children, activeChildId]);
  const activeChildAgeYears = useMemo(() => {
    const age = calculateAge(activeChild?.dateOfBirth || activeChild?.date_of_birth || null);
    return typeof age === 'number' && !Number.isNaN(age) ? age : null;
  }, [activeChild]);
  const activeChildGradeNumber = useMemo(() => getGradeNumber(activeChild?.grade || activeChild?.grade_level || null), [activeChild]);
  const isEarlyLearner = useMemo(() => {
    if (!activeChild) return false;
    if (typeof activeChildAgeYears === 'number' && activeChildAgeYears <= 5) return true;
    return activeChildGradeNumber < 1;
  }, [activeChild, activeChildAgeYears, activeChildGradeNumber]);
  const tierLower = String(tier || 'free').toLowerCase();
  const canUseTempLessons = isTierEligibleForTempLessons(tierLower);
  const isDashOrbUnlocked = ['parent_plus', 'premium', 'pro', 'enterprise', 'school_premium', 'school_pro', 'school_enterprise'].includes(tierLower);
  const feesDueSoon = dashboardData?.feesDueSoon ?? null;
  const isFeesDueSoon = Boolean(feesDueSoon && feesDueSoon.daysUntil <= 3);
  const upcomingBirthdaysCount = useMemo(() =>
    (upcomingBirthdays?.today.length ?? 0) + (upcomingBirthdays?.thisWeek.length ?? 0) +
    (upcomingBirthdays?.thisMonth.length ?? 0) + (upcomingBirthdays?.nextMonth.length ?? 0),
  [upcomingBirthdays]);
  const feesDueSubtitle = isFeesDueSoon && feesDueSoon
    ? t('parent.fees_due_in_days', { defaultValue: 'Due in {{count}} day', count: feesDueSoon.daysUntil })
    : undefined;
  const upgradeBannerTitle = isK12School && !isEarlyLearner
    ? t('dashboard.upgrade_value', { defaultValue: 'Save time with AI homework help' })
    : t('dashboard.upgrade_value_preschool', { defaultValue: 'Save time with Dash AI support' });
  // Active child display
  const activeChildDisplay = useMemo(() => {
    if (!activeChild) return null;
    const firstName = (activeChild.firstName || '').trim();
    const lastName = (activeChild.lastName || '').trim();
    const fullName = `${firstName} ${lastName}`.trim() || t('parent.child', { defaultValue: 'Child' });
    const initials = [firstName, lastName].filter(Boolean).map(p => p.charAt(0).toUpperCase()).join('').slice(0, 2) || '?';
    return {
      fullName, initials,
      avatarUrl: resolveAvatarUrl(activeChild.avatarUrl, activeChild.avatar_url),
      className: activeChild.className || t('parent.no_class', { defaultValue: 'No class assigned' }),
      teacherName: activeChild.teacher || t('parent.no_teacher', { defaultValue: 'No teacher assigned' }),
      grade: activeChild.grade,
    };
  }, [activeChild, t]);
  // Greeting
  const getGreeting = useCallback((): string => {
    const hour = new Date().getHours();
    const norm = normalizePersonName({
      first: profile?.first_name || user?.user_metadata?.first_name,
      last: profile?.last_name || user?.user_metadata?.last_name,
      full: profile?.full_name || user?.user_metadata?.full_name,
    });
    const name = norm.shortName || t('roles.parent', { defaultValue: 'Parent' });
    if (hour < 12) return t('dashboard.good_morning', { defaultValue: 'Good morning' }) + ', ' + name;
    if (hour < 18) return t('dashboard.good_afternoon', { defaultValue: 'Good afternoon' }) + ', ' + name;
    return t('dashboard.good_evening', { defaultValue: 'Good evening' }) + ', ' + name;
  }, [profile, user, t]);
  // Search suggestions
  const searchSuggestions: SearchBarSuggestion[] = useMemo(() => {
    const base: SearchBarSuggestion[] = [
      { id: 'view_homework', label: t('parent.view_homework', { defaultValue: 'View Homework' }), icon: 'book' },
      { id: 'daily_program', label: t('parent.daily_program', { defaultValue: 'Daily Program' }), icon: 'time-outline' },
      { id: 'weekly_menu', label: t('parent.weekly_menu', { defaultValue: 'Weekly Menu' }), icon: 'restaurant-outline' },
      { id: 'messages', label: t('parent.messages', { defaultValue: 'Messages' }), icon: 'chatbubbles' },
      { id: 'check_attendance', label: t('parent.check_attendance', { defaultValue: 'Check Attendance' }), icon: 'calendar' },
      { id: 'activity_feed', label: t('parent.activity_feed', { defaultValue: 'Activity Feed' }), icon: 'newspaper' },
      { id: 'generate_image', label: t('parent.generate_image', { defaultValue: 'Generate Image' }), icon: 'image-outline' },
    ];
    base.push(isK12School && !isEarlyLearner
      ? { id: 'view_grades', label: t('parent.view_grades', { defaultValue: 'View Grades' }), icon: 'school' }
      : { id: 'learning_hub', label: t('parent.learning_hub', { defaultValue: 'Learning Hub' }), icon: 'rocket' });
    return base;
  }, [t, isK12School, isEarlyLearner]);
  // Effects
  useEffect(() => {
    if (!focusSection) return;
    setCollapsedSections(prev => {
      if (!prev.has(focusSection)) return prev;
      const next = new Set(prev);
      next.delete(focusSection);
      return next;
    });
  }, [focusSection]);
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).dashboardSwitching) {
      logger.debug('[ParentDashboard] Clearing stuck dashboardSwitching flag');
      delete (window as any).dashboardSwitching;
    }
    logger.debug('[ParentDashboard] Mount - triggering subscription refresh', { tier, subscriptionReady });
    refreshSubscription();
  }, []);
  useEffect(() => { logger.debug('[ParentDashboard] Tier updated', { tier, subscriptionReady }); }, [tier, subscriptionReady]);
  useEffect(() => {
    if (dashboardData?.children) {
      setChildren(dashboardData.children);
      if (!activeChildId && dashboardData.children.length > 0) setActiveChildId(dashboardData.children[0].id);
    }
  }, [dashboardData?.children, activeChildId]);

  const loadTempLessons = useCallback(async () => {
    if (!canUseTempLessons || !activeChildId || !resolvedOrganizationId) {
      setTempLessonSuggestions([]);
      setTempLessonSuggestionsError(null);
      return;
    }

    setTempLessonSuggestionsLoading(true);
    setTempLessonSuggestionsError(null);
    try {
      const suggestions = await getTempLessonSuggestions({
        childId: activeChildId,
        preschoolId: resolvedOrganizationId,
        limit: 3,
      });
      setTempLessonSuggestions(suggestions);
    } catch (error) {
      logger.error('[ParentDashboard] Failed to load temp lesson suggestions:', error);
      setTempLessonSuggestions([]);
      setTempLessonSuggestionsError('Failed to load temporary lesson suggestions');
    } finally {
      setTempLessonSuggestionsLoading(false);
    }
  }, [activeChildId, canUseTempLessons, resolvedOrganizationId]);

  useEffect(() => {
    void loadTempLessons();
  }, [loadTempLessons]);
  // Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      refreshSubscription();
      await Promise.all([refresh(), refreshBirthdays(), refreshInsights(), loadTempLessons()]);
      try { await Feedback.vibrate(10); } catch { /* ignore */ }
    } catch (e) { logger.error('Dashboard refresh failed:', e); }
    finally { setRefreshing(false); }
  }, [refresh, refreshBirthdays, refreshInsights, refreshSubscription, loadTempLessons]);
  const toggleSection = useCallback((sectionId: string, isCollapsed?: boolean) => {
    setCollapsedSections(prev => {
      if (isCollapsed === false) return new Set(DEFAULT_COLLAPSED_SECTIONS.filter(id => id !== sectionId));
      if (isCollapsed === true) return new Set(DEFAULT_COLLAPSED_SECTIONS);
      if (!prev.has(sectionId)) return new Set(DEFAULT_COLLAPSED_SECTIONS.filter(id => id !== sectionId));
      return new Set(DEFAULT_COLLAPSED_SECTIONS);
    });
  }, []);
  return {
    // State
    refreshing, activeChildId, setActiveChildId, children, collapsedSections,
    searchQuery, setSearchQuery,
    // Data
    dashboardData, loading, tier,
    unreadMessageCount, missedCallsCount,
    upcomingBirthdays, birthdaysLoading,
    parentInsights, parentAlerts, insightsLoading, insightsError, hasUrgentInsights,
    tempLessonSuggestions, tempLessonSuggestionsLoading, tempLessonSuggestionsError, canUseTempLessons,
    // Derived
    hasOrganization, resolvedOrganizationId, resolvedSchoolType, isK12School, isEarlyLearner, isDashOrbUnlocked,
    activeChild, activeChildDisplay,
    feesDueSoon, isFeesDueSoon, feesDueSubtitle,
    upcomingBirthdaysCount, upgradeBannerTitle,
    // Computed
    getGreeting, searchSuggestions,
    // Handlers
    handleRefresh, toggleSection,
  };
}
