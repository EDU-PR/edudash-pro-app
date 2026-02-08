/**
 * New Enhanced Parent Dashboard — Mission Control Edition
 * 
 * Modular, WARP-compliant parent dashboard with next-gen attention system.
 * Uses extracted components, hooks, and styles for ≤500 line screen limit.
 * 
 * Features:
 * - Priority elevation + glow on sections needing attention
 * - "Mission Control 🚀" replaces Quick Actions
 * - Extracted: ChildFocusCard, TodayHighlights, MissionControlSection
 * - Extracted: useParentQuickActions, useParentSectionAttention
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import Feedback from '@/lib/feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { track } from '@/lib/analytics';
import { useNotificationsWithFocus } from '@/hooks/useNotifications';
import { useParentDashboard } from '@/hooks/useDashboardData';
import { calculateAge } from '@/lib/date-utils';
import { normalizePersonName } from '@/lib/utils/nameUtils';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';

// Shared dashboard components
import { MetricCard, CollapsibleSection, SearchBar, GlowContainer, type SearchBarSuggestion } from './shared';
import { ChildSwitcher, DailyActivityFeed, TeacherQuickNotes, ChildProgressBadges, UniformSizesSection } from './parent';
import { JoinLiveLesson } from '@/components/calls/JoinLiveLesson';
import AdBannerWithUpgrade from '@/components/ui/AdBannerWithUpgrade';
import { OnboardingHint, useOnboardingHint } from '@/components/ui/OnboardingHint';
import { EmptyState } from '@/components/ui/EmptyState';
import { UpcomingBirthdaysCard } from './UpcomingBirthdaysCard';
import { useBirthdayPlanner } from '@/hooks/useBirthdayPlanner';

// Extracted parent dashboard modules
import { ChildFocusCard } from './parent/ChildFocusCard';
import { TodayHighlights } from './parent/TodayHighlights';
import { MissionControlSection } from './parent/MissionControlSection';
import { ParentDashboardHeader } from './parent/ParentDashboardHeader';
import { UpgradeBanner } from './parent/UpgradeBanner';
import { useParentQuickActions } from '@/hooks/useParentQuickActions';
import { useParentSectionAttention } from '@/hooks/useParentSectionAttention';
import { useParentDashboardNavigation } from '@/hooks/useParentDashboardNavigation';
import { useParentMetrics } from '@/hooks/useParentMetrics';
import { useUniformEnabled } from '@/hooks/useUniformEnabled';
import { createParentDashboardStyles, getLayoutMetrics } from './parent/ParentDashboard.styles';

const DEFAULT_COLLAPSED_SECTIONS = [
  'overview',
  'mission-control',
  'uniform-sizes',
  'live-classes',
  'teacher-notes',
  'progress',
  'birthdays',
  'daily-activities',
];

const getGradeNumber = (value?: string | null): number => {
  if (!value) return 0;
  const normalized = value.toLowerCase();
  if (normalized.includes('grade r') || normalized.trim() === 'r') return 0;
  const match = normalized.match(/\d{1,2}/);
  return match ? Number(match[0]) : 0;
};

interface NewEnhancedParentDashboardProps {
  refreshTrigger?: number;
  focusSection?: string;
}

export const NewEnhancedParentDashboard: React.FC<NewEnhancedParentDashboardProps> = ({ 
  refreshTrigger,
  focusSection,
}) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { tier, ready: subscriptionReady, refresh: refreshSubscription } = useSubscription();
  const { showAlert, alertProps } = useAlertModal();
  const [refreshing, setRefreshing] = useState(false);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [children, setChildren] = useState<any[]>([]);
  const { uniformEnabled, uniformSchoolIds } = useUniformEnabled(children);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(DEFAULT_COLLAPSED_SECTIONS)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const layout = useMemo(() => getLayoutMetrics(width), [width]);
  const hasOrganization = !!profile?.preschool_id || !!profile?.organization_id;
  const schoolTypeRaw =
    (profile as any)?.organization_membership?.school_type ||
    (profile as any)?.school_type ||
    (profile as any)?.organization_type ||
    'preschool';
  const schoolTypeNormalized = String(schoolTypeRaw || 'preschool').toLowerCase();
  const k12Types = new Set(['k12', 'k12_school', 'combined', 'primary', 'secondary', 'community_school']);
  const isK12School = k12Types.has(schoolTypeNormalized);
  const activeChild = useMemo(
    () => children.find((child) => child.id === activeChildId) || children[0],
    [children, activeChildId]
  );
  const activeChildAgeYears = useMemo(() => {
    const dob = activeChild?.dateOfBirth || activeChild?.date_of_birth || null;
    const age = calculateAge(dob);
    return typeof age === 'number' && !Number.isNaN(age) ? age : null;
  }, [activeChild]);
  const activeChildGradeNumber = useMemo(
    () => getGradeNumber(activeChild?.grade || activeChild?.grade_level || null),
    [activeChild]
  );
  const isEarlyLearner = useMemo(() => {
    if (!activeChild) return false;
    if (typeof activeChildAgeYears === 'number' && activeChildAgeYears <= 5) return true;
    return activeChildGradeNumber < 1;
  }, [activeChild, activeChildAgeYears, activeChildGradeNumber]);
  const upgradeBannerTitle = isK12School && !isEarlyLearner
    ? t('dashboard.upgrade_value', { defaultValue: 'Save time with AI homework help' })
    : t('dashboard.upgrade_value_preschool', { defaultValue: 'Save time with Dash AI support' });
  const tierLower = String(tier || 'free').toLowerCase();
  const isDashOrbUnlocked = [
    'parent_plus',
    'premium',
    'pro',
    'enterprise',
    'school_premium',
    'school_pro',
    'school_enterprise',
  ].includes(tierLower);
  
  // Onboarding hints state
  const [showQuickActionsHint, dismissQuickActionsHint] = useOnboardingHint('parent_quick_actions');
  const [showLiveClassesHint, dismissLiveClassesHint] = useOnboardingHint('parent_live_classes');
  
  const styles = useMemo(() => createParentDashboardStyles(theme, insets.top, insets.bottom, layout), [theme, insets.top, insets.bottom, layout]);

  useEffect(() => {
    if (!focusSection) return;
    setCollapsedSections(prev => {
      if (!prev.has(focusSection)) return prev;
      const next = new Set(prev);
      next.delete(focusSection);
      return next;
    });
  }, [focusSection]);
  
  // Main parent dashboard data hook
  const {
    data: dashboardData,
    loading,
    refresh,
  } = useParentDashboard();
  
  // Unified notification hook - auto-refreshes on screen focus
  const { messages: unreadMessageCount, calls: missedCallsCount } = useNotificationsWithFocus();

  // Birthday planner hook - show upcoming birthdays in child's class
  const { birthdays: upcomingBirthdays, loading: birthdaysLoading, refresh: refreshBirthdays } = useBirthdayPlanner();
  const feesDueSoon = dashboardData?.feesDueSoon ?? null;
  const isFeesDueSoon = Boolean(feesDueSoon && feesDueSoon.daysUntil <= 3);
  const upcomingBirthdaysCount = useMemo(
    () =>
      (upcomingBirthdays?.today.length ?? 0) +
      (upcomingBirthdays?.thisWeek.length ?? 0) +
      (upcomingBirthdays?.thisMonth.length ?? 0) +
      (upcomingBirthdays?.nextMonth.length ?? 0),
    [upcomingBirthdays]
  );
  const feesDueSubtitle = isFeesDueSoon && feesDueSoon
    ? t('parent.fees_due_in_days', {
      defaultValue: 'Due in {{count}} day',
      count: feesDueSoon.daysUntil,
    })
    : undefined;

  // Clear any stuck dashboardSwitching flag on mount to prevent loading issues after hot reload
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).dashboardSwitching) {
      logger.debug('[ParentDashboard] Clearing stuck dashboardSwitching flag');
      delete (window as any).dashboardSwitching;
    }
    // Refresh subscription data on dashboard mount to ensure tier is up-to-date
    // This handles cases where payment was completed but tier wasn't refreshed
    logger.debug('[ParentDashboard] Mount - triggering subscription refresh', { tier, subscriptionReady });
    refreshSubscription();
  }, []);  // Only run on mount, not when tier changes to avoid loops

  // Log tier changes for debugging
  useEffect(() => {
    logger.debug('[ParentDashboard] Tier updated', { tier, subscriptionReady });
  }, [tier, subscriptionReady]);

  // Update children state when dashboard data changes
  useEffect(() => {
    if (dashboardData?.children) {
      setChildren(dashboardData.children);
      if (!activeChildId && dashboardData.children.length > 0) {
        setActiveChildId(dashboardData.children[0].id);
      }
    }
  }, [dashboardData?.children, activeChildId]);

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    const normalizedName = normalizePersonName({
      first: profile?.first_name || user?.user_metadata?.first_name,
      last: profile?.last_name || user?.user_metadata?.last_name,
      full: profile?.full_name || user?.user_metadata?.full_name,
    });
    const parentName = normalizedName.shortName || t('roles.parent', { defaultValue: 'Parent' });
    if (hour < 12) return t('dashboard.good_morning', { defaultValue: 'Good morning' }) + ', ' + parentName;
    if (hour < 18) return t('dashboard.good_afternoon', { defaultValue: 'Good afternoon' }) + ', ' + parentName;
    return t('dashboard.good_evening', { defaultValue: 'Good evening' }) + ', ' + parentName;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh subscription tier first (in case payment was processed)
      refreshSubscription();
      await Promise.all([
        refresh(),
        refreshBirthdays(),
      ]);
      try { await Feedback.vibrate(10); } catch { /* ignore */ }
    } catch (_error) {
      logger.error('Dashboard refresh failed:', _error);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleSection = useCallback((sectionId: string, isCollapsed?: boolean) => {
    setCollapsedSections(prev => {
      if (isCollapsed === false) {
        return new Set(DEFAULT_COLLAPSED_SECTIONS.filter(id => id !== sectionId));
      }
      if (isCollapsed === true) {
        return new Set(DEFAULT_COLLAPSED_SECTIONS);
      }
      if (!prev.has(sectionId)) {
        return new Set(DEFAULT_COLLAPSED_SECTIONS.filter(id => id !== sectionId));
      }
      return new Set(DEFAULT_COLLAPSED_SECTIONS);
    });
  }, []);

  // ─── Navigation routing (extracted hook) ─────────────
  const { handleQuickAction, handlePaymentsPress } = useParentDashboardNavigation({
    activeChild,
    children,
    showAlert,
  });

  // Search suggestions for PWA-style search
  const searchSuggestions: SearchBarSuggestion[] = useMemo(() => {
    const base: SearchBarSuggestion[] = [
      { id: 'view_homework', label: t('parent.view_homework', { defaultValue: 'View Homework' }), icon: 'book' },
      { id: 'messages', label: t('parent.messages', { defaultValue: 'Messages' }), icon: 'chatbubbles' },
      { id: 'check_attendance', label: t('parent.check_attendance', { defaultValue: 'Check Attendance' }), icon: 'calendar' },
      { id: 'activity_feed', label: t('parent.activity_feed', { defaultValue: 'Activity Feed' }), icon: 'newspaper' },
    ];
    if (isK12School && !isEarlyLearner) {
      base.push({ id: 'view_grades', label: t('parent.view_grades', { defaultValue: 'View Grades' }), icon: 'school' });
    } else {
      base.push({ id: 'learning_hub', label: t('parent.learning_hub', { defaultValue: 'Learning Hub' }), icon: 'rocket' });
    }
    return base;
  }, [t, isK12School, isEarlyLearner]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Filter and navigate based on query
    const match = searchSuggestions.find(s => 
      s.label.toLowerCase().includes(query.toLowerCase())
    );
    if (match) {
      handleQuickAction(match.id);
    }
  };

  // ─── Metrics + highlights (extracted hook) ────────────
  const { metrics, todayHighlights } = useParentMetrics({
    dashboardData,
    unreadMessageCount,
    missedCallsCount,
    childrenCount: children.length,
    isFeesDueSoon,
    feesDueSoon,
  });

  // ─── Quick Actions (extracted hook) ───────────────────
  const { quickActions, hasLockedActions, missionControlSections, groupedQuickActions } = useParentQuickActions({
    isK12School,
    isEarlyLearner,
    isFeesDueSoon,
    feesDueSubtitle,
    isDashOrbUnlocked,
    isDev: __DEV__,
  });

  // ─── Attention system ────────────────────────────────
  const sectionAttention = useParentSectionAttention({
    dashboardData,
    unreadMessageCount,
    missedCallsCount,
    feesDueSoon,
    upcomingBirthdaysCount,
  });

  const activeChildDisplay = useMemo(() => {
    if (!activeChild) return null;
    const firstName = (activeChild.firstName || '').trim();
    const lastName = (activeChild.lastName || '').trim();
    const fullName = `${firstName} ${lastName}`.trim() || t('parent.child', { defaultValue: 'Child' });
    const initials = [firstName, lastName]
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || '?';
    const className = activeChild.className || t('parent.no_class', { defaultValue: 'No class assigned' });
    const teacherName = activeChild.teacher || t('parent.no_teacher', { defaultValue: 'No teacher assigned' });
    return {
      fullName,
      initials,
      className,
      teacherName,
      grade: activeChild.grade,
    };
  }, [activeChild, t]);

  if (loading && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('common.loading', { defaultValue: 'Loading...' })}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Compact Header */}
        <ParentDashboardHeader greeting={getGreeting()} tier={tier} />

        {/* PWA-Style Search Bar */}
        <View style={styles.searchSection}>
          <SearchBar
            placeholder={t('common.search', { defaultValue: 'Search...' })}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={handleSearch}
            suggestions={searchSuggestions}
            onSuggestionPress={(suggestion) => handleQuickAction(suggestion.id)}
          />
        </View>

        {/* Child Switcher */}
        <ChildSwitcher
          children={children}
          activeChildId={activeChildId}
          onChildChange={setActiveChildId}
        />

        {/* Child Focus Card */}
        {activeChildDisplay && (
          <ChildFocusCard
            child={activeChildDisplay}
            onMessageTeacher={() => handleQuickAction('messages')}
            onViewHomework={() => handleQuickAction('view_homework')}
          />
        )}

        {/* Today Highlights */}
        <TodayHighlights highlights={todayHighlights} />

        {/* Upgrade CTA for Free Tier */}
        <UpgradeBanner title={upgradeBannerTitle} tier={tier} visible={hasLockedActions} />

        {/* Ad Banner for Free Tier Users (Android only) */}
        <AdBannerWithUpgrade 
          screen="parent_dashboard" 
          showUpgradeCTA={true} 
          margin={12} 
        />

        {/* Metrics Grid */}
        <GlowContainer urgency={sectionAttention['overview']?.priority ?? 'none'} elevated={sectionAttention['overview']?.priority === 'critical'}>
        <CollapsibleSection 
          title={t('dashboard.todays_overview', { defaultValue: "Today's Overview" })}
          sectionId="overview"
          icon="📊"
          hint={t('dashboard.hints.overview', { defaultValue: 'Attendance, fees, messages, and highlights at a glance.' })}
          defaultCollapsed={collapsedSections.has('overview')}
          onToggle={toggleSection}
          attention={sectionAttention['overview']}
        >
          <View style={styles.metricsGrid}>
            {metrics.map((metric, index) => (
              <MetricCard
                key={index}
                title={metric.title}
                value={metric.value}
                icon={metric.icon}
                color={metric.color}
                trend={metric.trend}
                glow={metric.glow}
                badge={metric.badge}
                priority={metric.priority as 'urgent' | 'important' | 'informational' | undefined}
                onPress={() => {
                  track('parent.dashboard.metric_clicked', { metric: metric.title });
                  if (metric.action) {
                    handleQuickAction(metric.action);
                  }
                }}
              />
            ))}
          </View>
        </CollapsibleSection>
        </GlowContainer>

        {/* Mission Control 🚀 */}
        <GlowContainer urgency={sectionAttention['mission-control']?.priority ?? 'none'} elevated={sectionAttention['mission-control']?.priority === 'critical'}>
        <CollapsibleSection 
          title={t('dashboard.mission_control', { defaultValue: 'Mission Control' })}
          sectionId="mission-control"
          icon="🚀"
          hint={t('dashboard.hints.mission_control', { defaultValue: 'Shortcuts to homework, messages, fees, and Dash Intelligence.' })}
          defaultCollapsed={collapsedSections.has('mission-control')}
          onToggle={toggleSection}
          attention={sectionAttention['mission-control']}
        >
          {/* Onboarding hint for Mission Control */}
          {showQuickActionsHint && (
            <OnboardingHint
              hintId="parent_quick_actions"
              message={t('hints.quick_actions_message', { defaultValue: "Tap a card below to jump to homework, messages, fees, or Dash Tutor." })}
              icon="sparkles"
              position="bottom"
              screen="parent_dashboard"
              onDismiss={dismissQuickActionsHint}
            />
          )}
          <MissionControlSection
            sections={missionControlSections}
            groupedActions={groupedQuickActions}
            onAction={handleQuickAction}
            onUpgrade={() => router.push('/screens/subscription-setup' as any)}
          />
        </CollapsibleSection>
        </GlowContainer>

        {/* Uniform Sizes (enabled by school) */}
        {hasOrganization && children.length > 0 && uniformEnabled && (
          <CollapsibleSection
            title={t('dashboard.uniform_sizes', { defaultValue: 'Uniform Sizes' })}
            sectionId="uniform-sizes"
            icon="shirt-outline"
            hint={t('dashboard.hints.uniform_sizes', { defaultValue: 'View sizes and uniform notes per child.' })}
            defaultCollapsed={collapsedSections.has('uniform-sizes')}
            onToggle={toggleSection}
          >
            <UniformSizesSection
              children={children.filter((child) =>
                (child.preschoolId || child.preschool_id)
                  ? uniformSchoolIds.includes(child.preschoolId || child.preschool_id)
                  : false
              )}
            />
          </CollapsibleSection>
        )}

        {/* Live Classes - Show if user has preschool_id */}
        <CollapsibleSection 
          title={t('calls.live_classes', { defaultValue: 'Live Classes' })}
          sectionId="live-classes"
          icon="videocam"
          hint={t('dashboard.hints.live_classes', { defaultValue: 'Join live lessons and events when they start.' })}
          defaultCollapsed={collapsedSections.has('live-classes')}
          onToggle={toggleSection}
          attention={sectionAttention['live-classes']}
        >
          {showLiveClassesHint && !showQuickActionsHint && (
            <OnboardingHint
              hintId="parent_live_classes"
              message={t('hints.live_classes_message', { defaultValue: "When your child's teacher starts a live class, you'll see it here. Tap to join and watch together!" })}
              icon="videocam"
              position="bottom"
              screen="parent_dashboard"
              onDismiss={dismissLiveClassesHint}
            />
          )}
          {profile?.preschool_id ? (
            <JoinLiveLesson 
              preschoolId={profile.preschool_id}
            />
          ) : (
            <EmptyState
              icon="videocam-outline"
              title={t('dashboard.parent.empty.live_classes.title', { defaultValue: 'Live classes preview' })}
              description={t('dashboard.parent.empty.live_classes.description', {
                defaultValue: 'Live class links appear here once a child is linked to a school.',
              })}
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onActionPress={() => router.push('/screens/register-child' as any)}
              size="small"
              secondary
            />
          )}
        </CollapsibleSection>

        {/* Teacher Quick Notes - Show notes from teacher to parent */}
        <CollapsibleSection
          title={t('dashboard.parent.section.teacher_notes', { defaultValue: 'Teacher Notes' })}
          sectionId="teacher-notes"
          icon="chatbubbles"
          hint={t('dashboard.hints.teacher_notes', { defaultValue: 'Latest feedback and notes from educators.' })}
          defaultCollapsed={collapsedSections.has('teacher-notes')}
          onToggle={toggleSection}
          attention={sectionAttention['teacher-notes']}
        >
          {activeChildId ? (
            <TeacherQuickNotes
              studentId={activeChildId}
              maxItems={3}
              showHeader={false}
            />
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title={t('dashboard.parent.empty.teacher_notes.title', { defaultValue: 'Teacher notes preview' })}
              description={t('dashboard.parent.empty.teacher_notes.description', {
                defaultValue: 'Notes from educators will appear here after a child is linked.',
              })}
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onActionPress={() => router.push('/screens/register-child' as any)}
              size="small"
              secondary
            />
          )}
        </CollapsibleSection>

        {/* Child Progress & Achievements */}
        <CollapsibleSection
          title={t('dashboard.parent.section.progress', { defaultValue: 'Progress & Achievements' })}
          sectionId="progress"
          icon="ribbon"
          hint={t('dashboard.hints.progress', { defaultValue: 'Badges, milestones, and growth snapshots.' })}
          defaultCollapsed={collapsedSections.has('progress')}
          onToggle={toggleSection}
        >
          {activeChildId ? (
            <ChildProgressBadges
              studentId={activeChildId}
              compact={false}
              showHeader={false}
            />
          ) : (
            <EmptyState
              icon="ribbon-outline"
              title={t('dashboard.parent.empty.progress.title', { defaultValue: 'Progress badges preview' })}
              description={t('dashboard.parent.empty.progress.description', {
                defaultValue: 'Track milestones and achievements once a child is linked.',
              })}
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onActionPress={() => router.push('/screens/register-child' as any)}
              size="small"
              secondary
            />
          )}
        </CollapsibleSection>

        {/* Upcoming Birthdays in Class */}
        <CollapsibleSection 
          title={t('dashboard.upcoming_birthdays', { defaultValue: 'Upcoming Birthdays 🎂' })}
          sectionId="birthdays"
          icon="🎈"
          hint={t('dashboard.hints.birthdays', { defaultValue: 'Upcoming class birthdays and reminders.' })}
          defaultCollapsed={collapsedSections.has('birthdays')}
          onToggle={toggleSection}
          attention={sectionAttention['birthdays']}
          actionLabel={t('dashboard.view_chart', { defaultValue: 'View Chart' })}
          onActionPress={() => router.push('/screens/birthday-chart' as any)}
        >
          {profile?.preschool_id ? (
            <UpcomingBirthdaysCard
              birthdays={upcomingBirthdays}
              loading={birthdaysLoading}
              showHeader={false}
              maxItems={4}
              compact={true}
              studentTapBehavior="none"
              onViewAll={() => router.push('/screens/birthday-chart' as any)}
            />
          ) : (
            <EmptyState
              icon="balloon-outline"
              title={t('dashboard.parent.empty.birthdays.title', { defaultValue: 'Upcoming birthdays preview' })}
              description={t('dashboard.parent.empty.birthdays.description', {
                defaultValue: 'Birthdays for your child\'s group will appear here after linking.',
              })}
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onActionPress={() => router.push('/screens/register-child' as any)}
              size="small"
              secondary
            />
          )}
        </CollapsibleSection>

        {/* Today's Activities - Show daily activities for child's class */}
        <CollapsibleSection 
          title={t('dashboard.todays_activities', { defaultValue: "Today's Activities" })}
          sectionId="daily-activities"
          icon="☀️"
          hint={t('dashboard.hints.daily_activities', { defaultValue: 'Daily class activities, photos, and updates.' })}
          defaultCollapsed={collapsedSections.has('daily-activities')}
          onToggle={toggleSection}
          attention={sectionAttention['daily-activities']}
        >
          {dashboardData?.children?.find((c: any) => c.id === activeChildId)?.classId ? (
            <DailyActivityFeed
              classId={dashboardData?.children?.find((c: any) => c.id === activeChildId)?.classId}
              studentId={activeChildId || undefined}
              showHeader={false}
            />
          ) : (
            <EmptyState
              icon="sunny-outline"
              title={t('dashboard.parent.empty.daily_activity.title', { defaultValue: 'Daily activity preview' })}
              description={t('dashboard.parent.empty.daily_activity.description', {
                defaultValue: 'Daily activities will appear here once a child is linked.',
              })}
              actionLabel={t('dashboard.parent.empty.add_child.cta', { defaultValue: 'Add Child' })}
              onActionPress={() => router.push('/screens/register-child' as any)}
              size="small"
              secondary
            />
          )}
        </CollapsibleSection>

        {/* Bottom Ad Banner for Free Tier Users (Android only) */}
        <AdBannerWithUpgrade 
          screen="parent_dashboard_bottom" 
          showUpgradeCTA={false} 
          margin={16} 
        />
      </ScrollView>
      <AlertModal {...alertProps} />
    </View>
  );
};

export default NewEnhancedParentDashboard;
