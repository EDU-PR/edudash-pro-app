/**
 * K-12 Parent Dashboard Screen
 * 
 * Main dashboard for K-12 school parents.
 * Shows children's progress, grades, attendance, and school updates.
 * 
 * Routes here when: profile.organization_membership.school_type is one of:
 * - k12, k12_school, combined, primary, secondary, community_school
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Platform, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, usePermissions } from '@/contexts/AuthContext';
import {
  K12ThemeOverrideProvider,
  useNextGenTheme,
} from '@/contexts/K12NextGenThemeContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { track } from '@/lib/analytics';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { trackK12ParentQuickwinsRendered } from '@/lib/ai/trackingEvents';
import { hasCapability, getRequiredTier, type Tier } from '@/lib/ai/capabilities';
import { getCapabilityTier, normalizeTierName } from '@/lib/tiers';
import { useNotificationBadgeCount } from '@/hooks/useNotificationCount';
import { calculateAge } from '@/lib/date-utils';
import { nextGenK12Parent } from '@/contexts/theme/nextGenK12Parent';
import { styles } from '@/domains/k12/components/K12ParentDashboard.styles';
import { ChildCard } from '@/domains/k12/components/K12ParentChildCard';
import { useK12ParentData } from '@/domains/k12/hooks/useK12ParentData';
import { MobileNavDrawer } from '@/components/navigation/MobileNavDrawer';
import InlineUpgradeBanner from '@/components/ui/InlineUpgradeBanner';
import AdBannerWithUpgrade from '@/components/ui/AdBannerWithUpgrade';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { useSpotlightTarget } from '@/hooks/useSpotlightTarget';
import { GlassCard } from '@/components/nextgen/GlassCard';
import { GradientActionCard } from '@/components/nextgen/GradientActionCard';
import { Pill } from '@/components/nextgen/Pill';
import DashOrb from '@/components/nextgen/DashOrb';
import SubNavTabs from '@/components/nextgen/SubNavTabs';
import FocusBanner from '@/components/nextgen/FocusBanner';
import InlineTutorPreview from '@/components/nextgen/InlineTutorPreview';
import {
  K12_PARENT_ACTIONS,
  buildK12ParentActionTarget,
  type K12ParentActionId,
} from '@/lib/navigation/k12ParentActionMap';

import EduDashSpinner from '@/components/ui/EduDashSpinner';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ROBOT_MASCOT = require('@/assets/images/robot-mascot.png');

type StarfieldPoint = {
  top: `${number}%`;
  left: `${number}%`;
  size: number;
  opacity: number;
};

const STARFIELD_POINTS: StarfieldPoint[] = [
  { top: '6%', left: '12%', size: 2, opacity: 0.55 },
  { top: '9%', left: '68%', size: 1.5, opacity: 0.5 },
  { top: '14%', left: '33%', size: 1.8, opacity: 0.45 },
  { top: '18%', left: '84%', size: 2.2, opacity: 0.58 },
  { top: '23%', left: '20%', size: 1.6, opacity: 0.4 },
  { top: '29%', left: '74%', size: 1.9, opacity: 0.54 },
  { top: '36%', left: '9%', size: 1.3, opacity: 0.44 },
  { top: '42%', left: '56%', size: 2.1, opacity: 0.52 },
  { top: '49%', left: '89%', size: 1.4, opacity: 0.38 },
  { top: '58%', left: '26%', size: 1.9, opacity: 0.5 },
  { top: '64%', left: '63%', size: 1.6, opacity: 0.42 },
  { top: '72%', left: '14%', size: 2, opacity: 0.57 },
  { top: '79%', left: '48%', size: 1.7, opacity: 0.43 },
  { top: '86%', left: '77%', size: 1.5, opacity: 0.4 },
  { top: '92%', left: '30%', size: 2.1, opacity: 0.55 },
];

function K12ParentDashboardContent({ quickWinsEnabled }: { quickWinsEnabled: boolean }) {
  const insets = useSafeAreaInsets();
  const { profile, user, loading: authLoading, profileLoading } = useAuth();
  const permissions = usePermissions();
  const { theme } = useNextGenTheme();
  const { t } = useTranslation();
  const { tier } = useSubscription();
  const { showAlert, alertProps } = useAlertModal();
  const menuTourRef = useSpotlightTarget('parent-menu-tile');
  const docsTourRef = useSpotlightTarget('parent-documents-tile');
  const announcementsTourRef = useSpotlightTarget('parent-announcements-tile');
  const params = useLocalSearchParams<{ schoolType?: string; mode?: string }>();
  const notificationCount = useNotificationBadgeCount();
  
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeSubTab] = useState('dashboard');
  const dashboardBottomPadding = quickWinsEnabled ? 100 : 80;

  const SUB_NAV_TABS = useMemo(() => [
    { id: 'dashboard', label: t('navigation.dashboard', { defaultValue: 'Dashboard' }) },
    { id: 'messages', label: t('navigation.messages', { defaultValue: 'Messages' }) },
    { id: 'grades', label: t('dashboard.parent.k12.grades', { defaultValue: 'Grades' }) },
    { id: 'account', label: t('navigation.account', { defaultValue: 'Account' }) },
  ], [t]);

  // Get school and user info from profile
  const communitySchoolName = t('dashboard.parent.community_school', { defaultValue: 'My School' });
  const schoolName = (profile as any)?.organization_membership?.organization_name ||
                     (profile as any)?.organization_name ||
                     communitySchoolName;
  const userName = profile?.full_name || profile?.email?.split('@')[0] || t('roles.parent', { defaultValue: 'Parent' });
  const schoolType = params.schoolType || (profile as any)?.organization_membership?.school_type || 'k12';
  const organizationId = (profile as any)?.organization_id || (profile as any)?.preschool_id;

    // RBAC checks
  const canView = permissions?.hasRole ? permissions.hasRole('parent') : true;
  const hasAccess = permissions?.can ? permissions.can('access_mobile_app') : true;

  // Use the K12 parent data hook for data fetching
  // NOTE: Pass profile?.id (internal profile ID), NOT user?.id (auth user ID)
  const {
    children,
    recentUpdates,
    upcomingEvents,
    dataLoading,
    fetchChildrenData,
  } = useK12ParentData(profile?.id, organizationId);

  const getGradeNumber = (value?: string | null): number => {
    if (!value) return 0;
    const normalized = value.toLowerCase();
    if (normalized.includes('grade r') || normalized.trim() === 'r') return 0;
    const match = normalized.match(/\d{1,2}/);
    return match ? Number(match[0]) : 0;
  };

  const normalizeGradeLabel = (value?: string | null): string | null => {
    if (!value) return null;
    return value.replace(/^\s*grade\s+grade\s+/i, 'Grade ').replace(/\s+/g, ' ').trim();
  };

  const hasExamEligibleChild = useMemo(() => {
    if (!children || children.length === 0) return false;
    return children.some((child) => {
      const gradeNum = getGradeNumber(child.grade);
      if (gradeNum < 4) return false;
      const ageYears = calculateAge(child.dateOfBirth);
      return ageYears === null || ageYears >= 6;
    });
  }, [children]);

  const dashboardSummary = useMemo(() => {
    const totalChildren = children.length;
    const pendingTasks = children.reduce((sum, child) => sum + Number(child.pendingAssignments || 0), 0);
    const attendanceRate = totalChildren > 0
      ? Math.round(children.reduce((sum, child) => sum + Number(child.attendance || 0), 0) / totalChildren)
      : 0;
    const leadChild = children[0];

    return {
      totalChildren,
      pendingTasks,
      attendanceRate,
      leadChildName: leadChild?.name || null,
      leadChildGrade: normalizeGradeLabel(leadChild?.grade),
      leadChildClassName: leadChild?.className || null,
      leadChildAttendance: Number(leadChild?.attendance || 0),
      leadChildPendingTasks: Number(leadChild?.pendingAssignments || 0),
      leadChildAvgGrade: leadChild?.avgGrade || null,
    };
  }, [children]);

  // Track dashboard view
  useEffect(() => {
    if (canView && hasAccess && user?.id) {
      track('k12.parent.dashboard_view', {
        user_id: user.id,
        school_type: schoolType,
        tier,
        platform: Platform.OS,
      });
    }
  }, [canView, hasAccess, user?.id, schoolType, tier]);

  useEffect(() => {
    if (quickWinsEnabled) {
      trackK12ParentQuickwinsRendered({
        route: '/(k12)/parent/dashboard',
        userId: user?.id || null,
      });
    }
  }, [quickWinsEnabled, user?.id]);

  // Load data on mount - use profile.id for data fetching
  useEffect(() => {
    if (profile?.id && !authLoading && !profileLoading) {
      fetchChildrenData();
    }
  }, [profile?.id, authLoading, profileLoading, fetchChildrenData]);

  // Redirect if unauthorized or wrong role
  const hasRedirectedRef = React.useRef(false);
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (!authLoading && !profileLoading) {
      if (!user?.id) {
        hasRedirectedRef.current = true;
        router.replace('/(auth)/sign-in');
        return;
      }
      if (!canView || !hasAccess) {
        hasRedirectedRef.current = true;
        router.replace('/profiles-gate' as any);
        return;
      }
    }
  }, [authLoading, profileLoading, user?.id, canView, hasAccess]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    track('k12.parent.dashboard_refresh', { user_id: user?.id });
    await fetchChildrenData();
    setRefreshing(false);
  }, [user?.id, fetchChildrenData]);

  const pushAction = useCallback(
    (actionId: K12ParentActionId, params?: Record<string, string | number | boolean | undefined>) => {
      router.push(buildK12ParentActionTarget(actionId, params) as any);
    },
    []
  );

  const handleQuickAction = useCallback((actionId: K12ParentActionId) => {
    track('k12.parent.quick_action_tap', { action: actionId, user_id: user?.id });
    pushAction(actionId);
  }, [pushAction, user?.id]);

  const tierForCaps: Tier = getCapabilityTier(normalizeTierName(tier || 'free'));
  const canShowExamPrep = hasExamEligibleChild;
  const canUseExamPrep = hasCapability(tierForCaps, 'exam.practice') && canShowExamPrep;
  const requiredExamTier = getRequiredTier('exam.practice');
  const quickActions = useMemo(() => ([
    { id: 'children', actionId: 'children' as const, icon: 'people', label: t('dashboard.parent.nav.my_children', { defaultValue: 'My Children' }), color: '#4F46E5' },
    { id: 'progress', actionId: 'progress' as const, icon: 'ribbon', label: t('dashboard.progress', { defaultValue: 'Progress' }), color: '#10B981' },
    { id: 'attendance', actionId: 'attendance' as const, icon: 'calendar-outline', label: t('dashboard.parent.nav.attendance', { defaultValue: 'Attendance' }), color: '#F59E0B' },
    { id: 'messages', actionId: 'messages' as const, icon: 'chatbubbles', label: t('navigation.messages', { defaultValue: 'Messages' }), color: '#3B82F6' },
    { id: 'payments', actionId: 'payments' as const, icon: 'card', label: t('dashboard.parent.nav.payments', { defaultValue: 'Payments' }), color: '#8B5CF6' },
    { id: 'announcements', actionId: 'announcements' as const, icon: 'megaphone', label: t('dashboard.parent.nav.announcements', { defaultValue: 'Announcements' }), color: '#EF4444' },
    { id: 'menu', actionId: 'weekly_menu' as const, icon: 'restaurant-outline', label: t('dashboard.parent.nav.weekly_menu', { defaultValue: 'Weekly Menu' }), color: '#F97316' },
    { id: 'documents', actionId: 'documents' as const, icon: 'document-attach', label: t('dashboard.parent.nav.documents', { defaultValue: 'Documents' }), color: '#14B8A6' },
  ]), [t]);

  const aiQuickActions = useMemo(() => ([
    { id: 'homework', actionId: 'homework' as const, icon: 'document-text', label: t('dashboard.parent.nav.homework', { defaultValue: 'Homework' }), color: '#06B6D4' },
    { id: 'weekly-report', actionId: 'weekly_report' as const, icon: 'stats-chart', label: t('dashboard.parent.k12.weekly_reports', { defaultValue: 'Weekly Reports' }), color: '#F97316' },
  ]), [t]);

  const openTutorSession = useCallback(() => {
    track('k12.parent.tutor_session_open', { user_id: user?.id });
    pushAction('tutor_session');
  }, [pushAction, user?.id]);

  const handleExamBuilderPress = useCallback(() => {
    if (!canShowExamPrep) {
      showAlert({
        title: t('dashboard.parent.k12.exam_prep.not_ready_title', { defaultValue: 'Exam Builder Not Available Yet' }),
        message: t('dashboard.parent.k12.exam_prep.not_ready_message', {
          defaultValue: 'Exam Builder is available from Grade 4 and up. Tutor Mode remains available for interactive learning.',
        }),
        type: 'warning',
        buttons: [{ text: t('common.ok', { defaultValue: 'OK' }), style: 'cancel' }],
      });
      return;
    }

    if (!canUseExamPrep) {
      const tierLabel = requiredExamTier
        ? t(`subscription.${requiredExamTier}`, {
            defaultValue: requiredExamTier.charAt(0).toUpperCase() + requiredExamTier.slice(1),
          })
        : t('subscription.starter', { defaultValue: 'Starter' });
      showAlert({
        title: t('dashboard.parent.k12.exam_prep.locked_title', { defaultValue: 'Exam Prep Locked' }),
        message: t('dashboard.parent.k12.exam_prep.locked_message', {
          defaultValue: 'Exam Prep requires {{tier}} plan or higher.\\n\\nUpgrade your subscription to unlock this feature.',
          tier: tierLabel,
        }),
        type: 'warning',
        buttons: [
          { text: t('common.not_now', { defaultValue: 'Not now' }), style: 'cancel' },
          { text: t('common.upgrade', { defaultValue: 'Upgrade' }), onPress: () => pushAction('subscription_setup') },
        ],
      });
      return;
    }

    track('k12.parent.exam_builder_open', { user_id: user?.id });
    // Pass child's grade so exam-prep can skip the grade-selection step
    const leadChild = children[0];
    const gradeNum = leadChild ? getGradeNumber(leadChild.grade) : 0;
    const gradeParam = gradeNum >= 4 ? `grade_${gradeNum}` : '';
    pushAction(
      'exam_builder',
      gradeParam ? { grade: gradeParam, childName: leadChild?.name || '' } : undefined
    );
  }, [canShowExamPrep, canUseExamPrep, requiredExamTier, showAlert, t, user?.id, children, pushAction]);

  const navItems = useMemo(() => ([
    { id: 'home', label: t('dashboard.parent.nav.dashboard', { defaultValue: 'Dashboard' }), icon: 'home', route: K12_PARENT_ACTIONS.dashboard_home.route },
    { id: 'children', label: t('dashboard.parent.nav.my_children', { defaultValue: 'My Children' }), icon: 'people', route: K12_PARENT_ACTIONS.children.route },
    { id: 'progress', label: t('dashboard.progress', { defaultValue: 'Progress' }), icon: 'ribbon', route: K12_PARENT_ACTIONS.progress.route },
    { id: 'attendance', label: t('dashboard.parent.nav.attendance', { defaultValue: 'Attendance' }), icon: 'calendar-outline', route: K12_PARENT_ACTIONS.attendance.route },
    { id: 'messages', label: t('navigation.messages', { defaultValue: 'Messages' }), icon: 'chatbubbles', route: K12_PARENT_ACTIONS.messages.route },
    { id: 'payments', label: t('dashboard.parent.nav.payments', { defaultValue: 'Payments' }), icon: 'card', route: K12_PARENT_ACTIONS.payments.route },
    { id: 'announcements', label: t('dashboard.parent.nav.announcements', { defaultValue: 'Announcements' }), icon: 'megaphone', route: K12_PARENT_ACTIONS.announcements.route },
    { id: 'menu', label: t('dashboard.parent.nav.weekly_menu', { defaultValue: 'Weekly Menu' }), icon: 'restaurant-outline', route: K12_PARENT_ACTIONS.weekly_menu.route },
    { id: 'reports', label: t('dashboard.parent.k12.weekly_reports', { defaultValue: 'Weekly Reports' }), icon: 'stats-chart', route: K12_PARENT_ACTIONS.weekly_report.route },
    { id: 'documents', label: t('dashboard.parent.nav.documents', { defaultValue: 'Documents' }), icon: 'document-attach', route: K12_PARENT_ACTIONS.documents.route },
    { id: 'account', label: t('navigation.account', { defaultValue: 'Account' }), icon: 'person-circle', route: K12_PARENT_ACTIONS.account.route },
    { id: 'settings', label: t('navigation.settings', { defaultValue: 'Settings' }), icon: 'settings', route: K12_PARENT_ACTIONS.settings.route },
  ]), [t]);

  const SectionHeaderCard = ({
    title,
    hint,
    actionLabel,
    onActionPress,
  }: {
    title: string;
    hint: string;
    actionLabel?: string;
    onActionPress?: () => void;
  }) => (
    <GlassCard style={styles.sectionHeaderCard} padding={14}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionHeaderTitle, { color: theme.text }]}>{title}</Text>
        {actionLabel && onActionPress && (
          <TouchableOpacity onPress={onActionPress} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={[styles.sectionHeaderAction, { color: theme.primary }]}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.sectionHeaderHint, { color: theme.textSecondary }]}>{hint}</Text>
    </GlassCard>
  );

  // Loading state
  if (authLoading || profileLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t('dashboard.loading', { defaultValue: 'Loading dashboard...' })}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View pointerEvents="none" style={styles.cosmicBackdrop}>
        <LinearGradient
          colors={['#070B16', '#0F121E', '#131A2E']}
          style={styles.cosmicBackdropFill}
        />
        <View style={[styles.nebulaGlow, styles.nebulaTop]} />
        <View style={[styles.nebulaGlow, styles.nebulaMid]} />
        <View style={[styles.nebulaGlow, styles.nebulaBottom]} />
        {STARFIELD_POINTS.map((star, index) => (
          <View
            key={`star-${index}`}
            style={[
              styles.starDot,
              {
                top: star.top,
                left: star.left,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
              },
            ]}
          />
        ))}
      </View>

      {/* FIXED HEADER - Does not scroll */}
      <View
        style={[
          styles.fixedHeader,
          {
            backgroundColor: quickWinsEnabled ? 'rgba(15,18,30,0.82)' : theme.background,
            borderBottomColor: quickWinsEnabled ? 'rgba(255,255,255,0.08)' : theme.border,
          },
        ]}
      >
        <View style={styles.headerLeftSection}>
          <TouchableOpacity
            style={styles.hamburgerButton}
            onPress={() => setIsDrawerOpen(true)}
            accessibilityLabel={t('dashboard.parent.nav.menu', { defaultValue: 'Menu' })}
          >
            <DashOrb size={30} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrapper}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              EduDashPro
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => {
              track('k12.parent.search_tap', { user_id: user?.id });
              pushAction('search');
            }}
          >
            <Ionicons name="search-outline" size={22} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => {
              track('k12.parent.notifications_tap', { user_id: user?.id });
              pushAction('notifications');
            }}
          >
            <Ionicons name="notifications-outline" size={24} color={theme.text} />
            {notificationCount > 0 && (
              <View style={[styles.notificationBadge, { backgroundColor: theme.error }]}>
                <Text style={styles.notificationBadgeText}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => {
              track('k12.parent.profile_tap', { user_id: user?.id });
              pushAction('profile');
            }}
          >
            <LinearGradient
              colors={quickWinsEnabled ? ['#1B314D', '#305E88'] : ['#F59E0B', '#D97706']}
              style={styles.profileGradient}
            >
              <Text style={styles.profileInitial}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* SUB-NAVIGATION TABS */}
      {quickWinsEnabled && (
        <SubNavTabs
          tabs={SUB_NAV_TABS}
          activeTab={activeSubTab}
          onTabPress={(tabId) => {
            // Don't setActiveSubTab — dashboard tab stays active;
            // other tabs navigate to separate screens.
            if (tabId === 'messages') pushAction('messages');
            else if (tabId === 'grades') pushAction('grades');
            else if (tabId === 'account') pushAction('account');
          }}
        />
      )}

      {/* SCROLLABLE CONTENT */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: dashboardBottomPadding }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
          style={styles.heroSummaryCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroSummaryTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroSummaryTitle, { color: theme.text }]}>
                {dashboardSummary.leadChildName
                  ? `${dashboardSummary.leadChildName}'s Dashboard`
                  : t('dashboard.parentDashboard', { defaultValue: 'Parent Dashboard' })}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                {/* Grade badge with child avatar */}
                <LinearGradient
                  colors={['#3C8E62', '#2E7D59']}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 6 }}
                >
                  <Ionicons name="school" size={12} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                    {dashboardSummary.leadChildGrade || 'Grade'}
                  </Text>
                </LinearGradient>
                {children[0]?.avatarUrl ? (
                  <Image
                    source={{ uri: children[0].avatarUrl }}
                    style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }}
                  />
                ) : null}
              </View>
            </View>
            <Pill
              tone="success"
              compact
              label={t('dashboard.parent.k12.tutor_badge', { defaultValue: 'Tutor Mode' })}
            />
          </View>
          <View style={styles.heroSummaryStatsRow}>
            <View style={styles.heroSummaryStat}>
              <Text style={[styles.heroSummaryValue, { color: theme.text }]}>
                {dashboardSummary.totalChildren}
              </Text>
              <Text style={[styles.heroSummaryLabel, { color: theme.textSecondary }]}>
                {t('dashboard.parent.nav.my_children', { defaultValue: 'My Children' })}
              </Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroSummaryStat}>
              <Text style={[styles.heroSummaryValue, { color: '#3C8E62' }]}>
                {dashboardSummary.attendanceRate}%
              </Text>
              <Text style={[styles.heroSummaryLabel, { color: theme.textSecondary }]}>
                {t('dashboard.parent.nav.attendance', { defaultValue: 'Attendance' })}
              </Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroSummaryStat}>
              <Text style={[styles.heroSummaryValue, { color: theme.text }]}>
                {dashboardSummary.pendingTasks}
              </Text>
              <Text style={[styles.heroSummaryLabel, { color: theme.textSecondary }]}>
                {t('teacher.pending', { defaultValue: 'Pending' })}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <GlassCard style={styles.currentClassCard} padding={0}>
          <LinearGradient
            colors={['rgba(90,64,157,0.22)', 'rgba(60,142,98,0.16)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.currentClassGradient}
          >
            <View style={styles.currentClassTopRow}>
              <View style={styles.currentClassTitleWrap}>
                <Text style={[styles.currentClassEyebrow, { color: theme.textSecondary }]}>
                  {t('dashboard.parent.k12.current_class', { defaultValue: 'Current Class' })}
                </Text>
                <Text style={[styles.currentClassTitle, { color: theme.text }]}>
                  {dashboardSummary.leadChildGrade || t('dashboard.parent.k12.class_overview', { defaultValue: 'Class Overview' })}
                </Text>
                <Text style={[styles.currentClassSubtitle, { color: theme.textSecondary }]}>
                  {dashboardSummary.leadChildClassName || schoolName}
                </Text>
              </View>
              <View style={styles.currentClassAverageChip}>
                <Text style={[styles.currentClassAverageLabel, { color: theme.textSecondary }]}>
                  {t('dashboard.parent.k12.avg_grade', { defaultValue: 'Avg Grade' })}
                </Text>
                <Text style={[styles.currentClassAverageValue, { color: theme.text }]}>
                  {dashboardSummary.leadChildAvgGrade || '--'}
                </Text>
              </View>
            </View>

            <View style={styles.currentClassStatsRow}>
              <View style={styles.currentClassStatPill}>
                <Text style={[styles.currentClassStatValue, { color: theme.text }]}>
                  {dashboardSummary.leadChildPendingTasks}
                </Text>
                <Text style={[styles.currentClassStatLabel, { color: theme.textSecondary }]}>
                  {t('teacher.pending', { defaultValue: 'Pending' })}
                </Text>
              </View>

              <View style={styles.currentClassStatPill}>
                <Text style={[styles.currentClassStatValue, { color: '#3C8E62' }]}>
                  {dashboardSummary.leadChildAttendance}%
                </Text>
                <Text style={[styles.currentClassStatLabel, { color: theme.textSecondary }]}>
                  {t('dashboard.parent.nav.attendance', { defaultValue: 'Attendance' })}
                </Text>
              </View>

              <View style={styles.currentClassStatPill}>
                <Text style={[styles.currentClassStatValue, { color: theme.text }]}>
                  {dashboardSummary.totalChildren}
                </Text>
                <Text style={[styles.currentClassStatLabel, { color: theme.textSecondary }]}>
                  {t('dashboard.parent.nav.my_children', { defaultValue: 'My Children' })}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </GlassCard>

        {/* Focus Banner */}
        {dashboardSummary.leadChildName && quickWinsEnabled && (
          <FocusBanner childName={dashboardSummary.leadChildName} />
        )}

        <TouchableOpacity style={styles.inlineTutorCard} activeOpacity={0.88} onPress={openTutorSession}>
          <LinearGradient
            colors={['#22433F', '#3C8E62', '#5A409D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.inlineTutorGradient}
          >
            <View style={styles.inlineTutorHeader}>
              <View style={styles.inlineTutorIcon}>
                <Image source={ROBOT_MASCOT} style={styles.inlineTutorMascot} />
              </View>
              <View style={styles.inlineTutorTextWrap}>
                <Text style={styles.inlineTutorTitle}>
                  {t('dashboard.parent.k12.current_tutor_session', { defaultValue: 'Current Tutor Session' })}
                </Text>
                <Text style={styles.inlineTutorSubtitle}>
                  {t('dashboard.parent.k12.current_tutor_hint', {
                    defaultValue: 'Dash Tutor is ready for {{name}} with guided one-step coaching and revision prompts.',
                    name: dashboardSummary.leadChildName || t('roles.student', { defaultValue: 'your learner' }),
                  })}
                </Text>
              </View>
            </View>

            <View style={styles.inlineTutorCta}>
              <Text style={styles.inlineTutorCtaText}>
                {t('dashboard.parent.k12.tutor_cta', { defaultValue: 'Start Tutor Session' })}
              </Text>
              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Inline Tutor Session Preview */}
        {quickWinsEnabled && (
          <InlineTutorPreview
            childName={dashboardSummary.leadChildName || 'Learner'}
            onOpenFullSession={openTutorSession}
          />
        )}

        {/* Upgrade Banner (Free tier parents) */}
        <InlineUpgradeBanner
          screen="k12_parent_dashboard"
          feature="dashboard_upgrade"
          title={t('dashboard.parent.k12.upgrade.title', { defaultValue: 'Upgrade for more AI help' })}
          description={t('dashboard.parent.k12.upgrade.description', { defaultValue: 'Unlock more Dash AI help, practice tools, and remove limits.' })}
        />

        {/* Ad Banner + Upgrade CTA (free tier only) */}
        <AdBannerWithUpgrade screen="k12_parent_dashboard" showUpgradeCTA margin={10} />

        {/* Children Cards */}
        <View style={styles.section}>
          <SectionHeaderCard
            title={t('dashboard.parent.section.my_children', { defaultValue: 'My Children' })}
            hint={t('dashboard.parent.section.my_children_hint', { defaultValue: 'Profiles, attendance, and progress for each child.' })}
          />
          {dataLoading ? (
            <EduDashSpinner size="small" color={theme.primary} style={{ marginVertical: 20 }} />
          ) : children.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                {t('dashboard.noChildren', { defaultValue: 'No linked children yet' })}
              </Text>
            </View>
          ) : (
            children.map((child) => (
              <ChildCard key={child.id} child={child} colors={theme} onPressChild={(childId) => {
                pushAction('child_detail', { childId });
              }} />
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <SectionHeaderCard
            title={t('dashboard.quick_actions', { defaultValue: 'Quick Actions' })}
            hint={t('dashboard.quick_actions_hint', { defaultValue: 'Shortcuts to messages, attendance, payments, and announcements.' })}
          />
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => {
              const tourRef = action.id === 'menu' ? menuTourRef
                : action.id === 'documents' ? docsTourRef
                : action.id === 'announcements' ? announcementsTourRef
                : undefined;
              return (
                <TouchableOpacity
                  key={action.id}
                  ref={tourRef}
                  style={[
                    styles.quickActionCard,
                    {
                      backgroundColor: quickWinsEnabled ? 'rgba(255,255,255,0.06)' : theme.surfaceVariant,
                      borderColor: quickWinsEnabled ? 'rgba(255,255,255,0.08)' : theme.border,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => handleQuickAction(action.actionId)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
                    <Ionicons name={action.icon as any} size={24} color={action.color} />
                  </View>
                  <Text style={[styles.quickActionLabel, { color: theme.text }]}>{action.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* AI & Learning Tools - PWA Feature Migration */}
        <View style={styles.section}>
          <SectionHeaderCard
            title={t('dashboard.parent.k12.ai_tools.title', { defaultValue: 'AI & Learning Tools' })}
            hint={t('dashboard.parent.k12.ai_tools.hint', { defaultValue: 'Dash AI, exam prep, homework, and weekly reports.' })}
          />
          <View style={styles.learningHubGrid}>
            <GradientActionCard
              tone="purple"
              gradientColors={quickWinsEnabled ? ['#23214D', '#5A409D'] : undefined}
              ctaBackgroundColor={quickWinsEnabled ? '#5A409D' : undefined}
              icon="document-text-outline"
              badgeLabel={t('dashboard.parent.k12.exam_badge', { defaultValue: 'Exam Builder' })}
              title={t('dashboard.parent.k12.exam_title', { defaultValue: 'Build Full Exam (Printable)' })}
              description={t('dashboard.parent.k12.exam_description', { defaultValue: 'Generate a CAPS-aligned formal test paper for review or print.' })}
              cta={t('dashboard.parent.k12.exam_cta', { defaultValue: 'Generate Formal Test Paper' })}
              onPress={handleExamBuilderPress}
              disabled={!canShowExamPrep}
            />
          </View>

          <View style={styles.secondaryToolsGrid}>
            {aiQuickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.quickActionCard,
                  {
                    backgroundColor: quickWinsEnabled ? 'rgba(255,255,255,0.06)' : theme.surfaceVariant,
                    borderColor: quickWinsEnabled ? 'rgba(255,255,255,0.08)' : theme.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={() => handleQuickAction(action.actionId)}
                activeOpacity={0.7}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
                  <Ionicons name={action.icon as any} size={24} color={action.color} />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.text }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Updates */}
        <View style={styles.section}>
          <SectionHeaderCard
            title={t('dashboard.recent_activity', { defaultValue: 'Recent Activity' })}
            hint={t('dashboard.recent_activity_hint', { defaultValue: 'Latest updates from teachers and classwork.' })}
            actionLabel={t('common.see_all', { defaultValue: 'See All' })}
            onActionPress={() => {
              track('k12.parent.see_all_updates_tap', { user_id: user?.id });
              pushAction('see_all_activity');
            }}
          />
          {recentUpdates.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <Ionicons name="newspaper-outline" size={32} color={theme.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                {t('dashboard.noActivity', { defaultValue: 'No recent activity' })}
              </Text>
            </View>
          ) : (
            recentUpdates.map((update) => (
              <View 
                key={update.id} 
                style={[
                  styles.updateCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: quickWinsEnabled ? 'rgba(255,255,255,0.1)' : theme.border,
                    borderWidth: quickWinsEnabled ? 1 : 0,
                  },
                ]}
              >
                <View style={[styles.updateIcon, { backgroundColor: update.color + '20' }]}>
                  <Ionicons name={update.icon as any} size={18} color={update.color} />
                </View>
                <View style={styles.updateInfo}>
                  <Text style={[styles.updateChild, { color: theme.textSecondary }]}>{update.child}</Text>
                  <Text style={[styles.updateMessage, { color: theme.text }]}>{update.message}</Text>
                </View>
                <Text style={[styles.updateTime, { color: theme.textSecondary }]}>{update.time}</Text>
              </View>
            ))
          )}
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <SectionHeaderCard
            title={t('dashboard.upcoming_events', { defaultValue: 'Upcoming Events' })}
            hint={t('dashboard.upcoming_events_hint', { defaultValue: 'Calendar reminders and important school dates.' })}
            actionLabel={t('common.see_all', { defaultValue: 'See All' })}
            onActionPress={() => {
              track('k12.parent.see_all_events_tap', { user_id: user?.id });
              pushAction('see_all_events');
            }}
          />
          {upcomingEvents.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <Ionicons name="calendar-outline" size={32} color={theme.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                {t('dashboard.upcoming_events_empty', { defaultValue: 'No upcoming events' })}
              </Text>
            </View>
          ) : (
            upcomingEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={[
                  styles.eventCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: quickWinsEnabled ? 'rgba(255,255,255,0.1)' : theme.border,
                    borderWidth: quickWinsEnabled ? 1 : 0,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => {
                  track('k12.parent.event_tap', { eventId: event.id, user_id: user?.id });
                  pushAction('event_detail', { date: event.date });
                }}
              >
                <View style={[styles.eventDate, { backgroundColor: theme.primary + '20' }]}>
                  <Text style={[styles.eventDateText, { color: theme.primary }]}>
                    {event.date.split(' ')[1]}
                  </Text>
                  <Text style={[styles.eventMonthText, { color: theme.primary }]}>
                    {event.date.split(' ')[0]}
                  </Text>
                </View>
                <View style={styles.eventInfo}>
                  <Text style={[styles.eventTitle, { color: theme.text }]}>{event.title}</Text>
                  <Text style={[styles.eventTime, { color: theme.textSecondary }]}>{event.time}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* School Communication Card */}
        <TouchableOpacity 
          style={styles.communicationCard} 
          activeOpacity={0.8}
          onPress={() => {
            track('k12.parent.school_communication_tap', { user_id: user?.id });
            pushAction('school_communication');
          }}
        >
          <LinearGradient
            colors={quickWinsEnabled ? ['#1C1F2F', '#2A2F4A'] : ['#F59E0B', '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.communicationGradient}
          >
            <View style={styles.communicationContent}>
              <View style={styles.communicationIcon}>
                <Ionicons name="school" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.communicationText}>
                <Text style={styles.communicationTitle}>
                  {t('dashboard.parent.k12.communication.title', { defaultValue: 'School Communication' })}
                </Text>
                <Text style={styles.communicationSubtitle}>
                  {t('dashboard.parent.k12.communication.subtitle', { defaultValue: 'Stay connected with teachers and school updates' })}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      <AlertModal {...alertProps} />

      {/* Mobile Navigation Drawer */}
      <MobileNavDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        navItems={navItems}
      />
    </SafeAreaView>
  );
}

export default function K12ParentDashboardScreen() {
  const flags = getFeatureFlagsSync();
  const quickWinsEnabled = flags.k12_parent_quickwins_v1;

  if (!quickWinsEnabled) {
    return <K12ParentDashboardContent quickWinsEnabled={false} />;
  }

  return (
    <K12ThemeOverrideProvider override={nextGenK12Parent}>
      <K12ParentDashboardContent quickWinsEnabled />
    </K12ThemeOverrideProvider>
  );
}
