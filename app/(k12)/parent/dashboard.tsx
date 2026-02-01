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
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, usePermissions } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { track } from '@/lib/analytics';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { hasCapability, getRequiredTier, type Tier } from '@/lib/ai/capabilities';
import { getDashAIRoleCopy } from '@/lib/ai/dashRoleCopy';
import { useNotificationBadgeCount } from '@/hooks/useNotificationCount';
import { calculateAge } from '@/lib/date-utils';
import { styles } from '@/domains/k12/components/K12ParentDashboard.styles';
import { ChildCard } from '@/domains/k12/components/K12ParentChildCard';
import { useK12ParentData } from '@/domains/k12/hooks/useK12ParentData';
import DashOrb from '@/components/dash-orb';
import { MobileNavDrawer } from '@/components/navigation/MobileNavDrawer';
import { TierBadge } from '@/components/ui/TierBadge';
import InlineUpgradeBanner from '@/components/ui/InlineUpgradeBanner';
import AdBannerWithUpgrade from '@/components/ui/AdBannerWithUpgrade';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';

export default function K12ParentDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user, loading: authLoading, profileLoading } = useAuth();
  const permissions = usePermissions();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { tier } = useSubscription();
  const { showAlert, alertProps } = useAlertModal();
  const dashCopy = useMemo(() => getDashAIRoleCopy(profile?.role), [profile?.role]);
  const flags = getFeatureFlagsSync();
  const params = useLocalSearchParams<{ schoolType?: string; mode?: string }>();
  const notificationCount = useNotificationBadgeCount();
  
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Get school and user info from profile
  const communitySchoolName = t('dashboard.parent.community_school', { defaultValue: 'EduDash Pro Community School' });
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

  const hasExamEligibleChild = useMemo(() => {
    if (!children || children.length === 0) return false;
    return children.some((child) => {
      const gradeNum = getGradeNumber(child.grade);
      if (gradeNum < 4) return false;
      const ageYears = calculateAge(child.dateOfBirth);
      return ageYears === null || ageYears >= 6;
    });
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

  // Load data on mount - use profile.id for data fetching
  useEffect(() => {
    if (profile?.id && !authLoading && !profileLoading) {
      fetchChildrenData();
    }
  }, [profile?.id, authLoading, profileLoading, fetchChildrenData]);

  // Redirect if unauthorized
  const hasRedirectedRef = React.useRef(false);
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (!authLoading && !profileLoading) {
      if (!user?.id) {
        hasRedirectedRef.current = true;
        router.replace('/(auth)/sign-in');
        return;
      }
    }
  }, [authLoading, profileLoading, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    track('k12.parent.dashboard_refresh', { user_id: user?.id });
    await fetchChildrenData();
    setRefreshing(false);
  }, [user?.id, fetchChildrenData]);

  const handleQuickAction = (route: string, actionId: string) => {
    track('k12.parent.quick_action_tap', { action: actionId, user_id: user?.id });
    if (actionId === 'payments') {
      router.push('/screens/parent-payments' as any);
      return;
    }
    router.push(route as any);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.good_morning', { defaultValue: 'Good morning' });
    if (hour < 17) return t('dashboard.good_afternoon', { defaultValue: 'Good afternoon' });
    return t('dashboard.good_evening', { defaultValue: 'Good evening' });
  };

  const tierLower = String(tier || 'free').toLowerCase();
  const isStarterTier = tierLower === 'parent_starter' || tierLower === 'starter';
  const showGreetingUpgrade = tierLower === 'free' || isStarterTier;
  const isDashOrbUnlocked = [
    'parent_plus',
    'premium',
    'pro',
    'enterprise',
    'school_premium',
    'school_pro',
    'school_enterprise',
  ].includes(tierLower);

  const normalizeTierForCapabilities = (value?: string | null): Tier => {
    const raw = String(value || 'free').toLowerCase().replace(/-/g, '_');
    if (raw === 'trial') return 'starter';
    if (raw === 'parent_starter' || raw === 'teacher_starter' || raw === 'school_starter' || raw === 'starter' || raw === 'basic') {
      return 'starter';
    }
    if (raw === 'parent_plus' || raw === 'teacher_pro' || raw === 'school_premium' || raw === 'school_pro' || raw === 'premium' || raw === 'pro') {
      return 'premium';
    }
    if (raw === 'school_enterprise' || raw === 'enterprise') {
      return 'enterprise';
    }
    return 'free';
  };

  const tierForCaps = normalizeTierForCapabilities(tier);
  const canShowExamPrep = hasExamEligibleChild;
  const canUseExamPrep = flags.exam_prep_enabled && hasCapability(tierForCaps, 'exam.practice') && canShowExamPrep;
  const requiredExamTier = getRequiredTier('exam.practice');
  const quickActions = useMemo(() => ([
    { id: 'children', icon: 'people', label: t('dashboard.parent.nav.my_children', { defaultValue: 'My Children' }), route: '/screens/parent-children', color: '#4F46E5' },
    { id: 'progress', icon: 'ribbon', label: t('dashboard.progress', { defaultValue: 'Progress' }), route: '/screens/parent-progress', color: '#10B981' },
    { id: 'attendance', icon: 'calendar-outline', label: t('dashboard.parent.nav.attendance', { defaultValue: 'Attendance' }), route: '/screens/parent-attendance', color: '#F59E0B' },
    { id: 'messages', icon: 'chatbubbles', label: t('navigation.messages', { defaultValue: 'Messages' }), route: '/screens/parent-messages', color: '#3B82F6' },
    { id: 'payments', icon: 'card', label: t('dashboard.parent.nav.payments', { defaultValue: 'Payments' }), route: '/screens/parent-payments', color: '#8B5CF6' },
    { id: 'announcements', icon: 'megaphone', label: t('dashboard.parent.nav.announcements', { defaultValue: 'Announcements' }), route: '/screens/parent-announcements', color: '#EF4444' },
  ]), [t]);

  const aiQuickActions = useMemo(() => ([
    { id: 'dash-ai', icon: 'sparkles', label: t('dashboard.parent.nav.dash_ai', { defaultValue: dashCopy.navLabel }), route: '/screens/dash-assistant', color: '#7C3AED' },
    ...(canShowExamPrep ? [
      { id: 'exam-prep', icon: 'school', label: t('dashboard.parent.quick_actions.exam_prep', { defaultValue: 'Exam Prep' }), route: '/screens/exam-prep', color: '#EC4899' },
    ] : []),
    { id: 'homework', icon: 'document-text', label: t('dashboard.parent.nav.homework', { defaultValue: 'Homework' }), route: '/screens/homework', color: '#06B6D4' },
    { id: 'weekly-report', icon: 'stats-chart', label: t('dashboard.parent.k12.weekly_reports', { defaultValue: 'Weekly Reports' }), route: '/screens/parent-weekly-report', color: '#F97316' },
  ]), [t, canShowExamPrep, dashCopy.navLabel]);

  const schoolTypeLabel = useMemo(() => {
    switch (schoolType) {
      case 'combined':
        return t('dashboard.parent.k12.school_type.combined', { defaultValue: 'K-12 School' });
      case 'primary':
        return t('dashboard.parent.k12.school_type.primary', { defaultValue: 'Primary School' });
      case 'secondary':
        return t('dashboard.parent.k12.school_type.secondary', { defaultValue: 'Secondary School' });
      case 'community_school':
        return t('dashboard.parent.k12.school_type.community_school', { defaultValue: 'Community School' });
      default:
        return t('dashboard.parent.k12.school_type.k12', { defaultValue: 'K-12 School' });
    }
  }, [schoolType, t]);

  const navItems = useMemo(() => ([
    { id: 'home', label: t('dashboard.parent.nav.dashboard', { defaultValue: 'Dashboard' }), icon: 'home', route: '/(k12)/parent/dashboard' },
    { id: 'children', label: t('dashboard.parent.nav.my_children', { defaultValue: 'My Children' }), icon: 'people', route: '/screens/parent-children' },
    { id: 'progress', label: t('dashboard.progress', { defaultValue: 'Progress' }), icon: 'ribbon', route: '/screens/parent-progress' },
    { id: 'attendance', label: t('dashboard.parent.nav.attendance', { defaultValue: 'Attendance' }), icon: 'calendar-outline', route: '/screens/parent-attendance' },
    { id: 'messages', label: t('navigation.messages', { defaultValue: 'Messages' }), icon: 'chatbubbles', route: '/screens/parent-messages' },
    { id: 'payments', label: t('dashboard.parent.nav.payments', { defaultValue: 'Payments' }), icon: 'card', route: '/screens/parent-payments' },
    { id: 'announcements', label: t('dashboard.parent.nav.announcements', { defaultValue: 'Announcements' }), icon: 'megaphone', route: '/screens/parent-announcements' },
    { id: 'reports', label: t('dashboard.parent.k12.weekly_reports', { defaultValue: 'Weekly Reports' }), icon: 'stats-chart', route: '/screens/parent-weekly-report' },
    { id: 'account', label: t('navigation.account', { defaultValue: 'Account' }), icon: 'person-circle', route: '/screens/account' },
    { id: 'settings', label: t('navigation.settings', { defaultValue: 'Settings' }), icon: 'settings', route: '/screens/settings' },
  ]), [t]);

  // Loading state
  if (authLoading || profileLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t('dashboard.loading', { defaultValue: 'Loading dashboard...' })}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {/* FIXED HEADER - Does not scroll */}
      <View style={[styles.fixedHeader, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeftSection}>
          <TouchableOpacity
            style={styles.hamburgerButton}
            onPress={() => setIsDrawerOpen(true)}
            accessibilityLabel={t('dashboard.parent.nav.menu', { defaultValue: 'Menu' })}
          >
            <Ionicons name="menu" size={28} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrapper}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              {t('dashboard.parentDashboard', { defaultValue: 'Parent Dashboard' })}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => {
              track('k12.parent.notifications_tap', { user_id: user?.id });
              router.push('/screens/notifications' as any);
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
              router.push('/screens/settings' as any);
            }}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.profileGradient}
            >
              <Text style={styles.profileInitial}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* SCROLLABLE CONTENT */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting Card */}
        <View style={[styles.greetingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.greetingRow}>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>
              {getGreeting()},
            </Text>
            <View style={styles.greetingActions}>
              <TierBadge
                tier={tier || 'free'}
                size="sm"
                containerStyle={isStarterTier ? { opacity: 0.6 } : undefined}
              />
              {showGreetingUpgrade && (
                <TouchableOpacity
                  style={[styles.greetingUpgradeButton, { borderColor: theme.primary }]}
                  onPress={() => router.push('/pricing')}
                >
                  <Text style={[styles.greetingUpgradeText, { color: theme.primary }]}>
                    {t('common.upgrade', { defaultValue: 'Upgrade' })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text style={[styles.userName, { color: theme.text }]}>{userName}</Text>
          <Text style={[styles.schoolName, { color: theme.textSecondary }]}>{schoolName}</Text>
        </View>

        {/* School Type Badge */}
        <View style={styles.schoolTypeBadge}>
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.schoolTypeBadgeGradient}
          >
            <Ionicons name="school" size={14} color="#FFFFFF" />
            <Text style={styles.schoolTypeBadgeText}>
              {schoolTypeLabel}
            </Text>
          </LinearGradient>
        </View>

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
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('dashboard.parent.section.my_children', { defaultValue: 'My Children' })}
          </Text>
          {dataLoading ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
          ) : children.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                {t('dashboard.noChildren', { defaultValue: 'No linked children yet' })}
              </Text>
            </View>
          ) : (
            children.map((child) => (
              <ChildCard key={child.id} child={child} colors={theme} />
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('dashboard.quick_actions', { defaultValue: 'Quick Actions' })}
          </Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.quickActionCard, { backgroundColor: theme.surface }]}
                onPress={() => handleQuickAction(action.route, action.id)}
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

        {/* AI & Learning Tools - PWA Feature Migration */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t('dashboard.parent.k12.ai_tools.title', { defaultValue: 'AI & Learning Tools' })}
          </Text>
          <View style={styles.quickActionsGrid}>
            {aiQuickActions.map((action) => {
              const isExamPrep = action.id === 'exam-prep';
              const isDisabled = isExamPrep && !canUseExamPrep;
              return (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.quickActionCard, 
                  { backgroundColor: theme.surface },
                  isDisabled && styles.quickActionDisabled
                ]}
                onPress={() => {
                  if (isDisabled) {
                    if (!flags.exam_prep_enabled) {
                      showAlert({
                        title: t('dashboard.parent.k12.exam_prep.unavailable_title', { defaultValue: 'Exam Prep Unavailable' }),
                        message: t('dashboard.parent.k12.exam_prep.unavailable_message', { defaultValue: 'Exam Prep is currently disabled in this build. Please try again later.' }),
                        type: 'warning',
                        buttons: [
                          { text: t('common.ok', { defaultValue: 'OK' }), style: 'cancel' },
                        ],
                      });
                      return;
                    }

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
                        { text: t('common.upgrade', { defaultValue: 'Upgrade' }), onPress: () => router.push('/screens/subscription-setup' as any) },
                      ],
                    });
                    return;
                  }
                  handleQuickAction(action.route, action.id);
                }}
                activeOpacity={0.7}
                disabled={isDisabled}
              >
                {isDisabled && (
                  <View style={[styles.quickActionLockBadge, { backgroundColor: theme.surfaceVariant }]}>
                    <Ionicons name="lock-closed" size={12} color={theme.textSecondary} />
                  </View>
                )}
                <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
                  <Ionicons name={action.icon as any} size={24} color={action.color} />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.text }]}>{action.label}</Text>
              </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Dash AI Card - Homework Helper */}
        <TouchableOpacity 
          style={styles.dashAICard} 
          activeOpacity={0.8}
          onPress={() => {
            track('k12.parent.dash_ai_tap', { user_id: user?.id });
            router.push('/screens/dash-assistant' as any);
          }}
        >
          <LinearGradient
            colors={['#7C3AED', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.dashAIGradient}
          >
            <View style={styles.dashAIContent}>
              <View style={styles.dashAIIcon}>
                <Ionicons name="sparkles" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.dashAIText}>
                <Text style={styles.dashAITitle}>
                  {t('parent.ask_dash', { defaultValue: `Ask ${dashCopy.navLabel}` })}
                </Text>
                <Text style={styles.dashAISubtitle}>
                  {t('dashboard.parent.k12.dash_ai.subtitle', { defaultValue: 'Get instant homework help & study tips' })}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Recent Updates */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t('dashboard.recent_activity', { defaultValue: 'Recent Activity' })}
            </Text>
            <TouchableOpacity onPress={() => {
              track('k12.parent.see_all_updates_tap', { user_id: user?.id });
            }}>
              <Text style={[styles.seeAllText, { color: theme.primary }]}>
                {t('common.see_all', { defaultValue: 'See All' })}
              </Text>
            </TouchableOpacity>
          </View>
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
                style={[styles.updateCard, { backgroundColor: theme.surface }]}
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
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t('dashboard.upcoming_events', { defaultValue: 'Upcoming Events' })}
            </Text>
            <TouchableOpacity onPress={() => {
              track('k12.parent.see_all_events_tap', { user_id: user?.id });
              router.push('/screens/parent-events' as any);
            }}>
              <Text style={[styles.seeAllText, { color: theme.primary }]}>
                {t('common.see_all', { defaultValue: 'See All' })}
              </Text>
            </TouchableOpacity>
          </View>
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
                style={[styles.eventCard, { backgroundColor: theme.surface }]}
                activeOpacity={0.7}
                onPress={() => {
                  track('k12.parent.event_tap', { eventId: event.id, user_id: user?.id });
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
            // TODO: Navigate to school communication
          }}
        >
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
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

      {/* Floating Dash AI Orb - Role-aware, works for all users */}
      <DashOrb 
        position="bottom-right"
        size={56}
        locked={!isDashOrbUnlocked}
        lockedTitle={t('dash_ai.orb_locked_title', { defaultValue: 'Dash Orb Locked' })}
        lockedMessage={t('dash_ai.orb_locked_message', { defaultValue: 'Upgrade to Parent Plus to unlock the Dash Orb.' })}
        lockedCtaLabel={t('common.upgrade', { defaultValue: 'Upgrade' })}
        onUpgradePress={() => router.push('/screens/subscription-setup' as any)}
        onCommandExecuted={(cmd) => track('dash_orb_command', { command: cmd, screen: 'k12_parent_dashboard' })}
      />
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
