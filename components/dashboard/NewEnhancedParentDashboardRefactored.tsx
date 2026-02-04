/**
 * New Enhanced Parent Dashboard - Refactored
 * 
 * A modular, clean implementation following WARP.md file size standards.
 * Uses extracted components for better maintainability.
 * 
 * Features:
 * - Clean grid-based layout with improved visual hierarchy
 * - Mobile-first responsive design with <2s load time
 * - Child switching with multi-child support
 * - Collapsible sections for progressive disclosure
 * - Enhanced loading states and error handling
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import Feedback from '@/lib/feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { track } from '@/lib/analytics';
import { useNotificationsWithFocus } from '@/hooks/useNotifications';
import { useParentDashboard } from '@/hooks/useDashboardData';
import { calculateAge } from '@/lib/date-utils';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';

// Import shared components
import { MetricCard, CollapsibleSection, SearchBar, type SearchBarSuggestion } from './shared';
import { ChildSwitcher, DailyActivityFeed, TeacherQuickNotes, ChildProgressBadges, UniformSizesSection } from './parent';
import { JoinLiveLesson } from '@/components/calls/JoinLiveLesson';
import AdBannerWithUpgrade from '@/components/ui/AdBannerWithUpgrade';
import { OnboardingHint, useOnboardingHint } from '@/components/ui/OnboardingHint';
import { EmptyState } from '@/components/ui/EmptyState';
import { UpcomingBirthdaysCard } from './UpcomingBirthdaysCard';
import { useBirthdayPlanner } from '@/hooks/useBirthdayPlanner';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;
const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;
const DEFAULT_COLLAPSED_SECTIONS = [
  'overview',
  'quick-actions',
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
  const [uniformEnabled, setUniformEnabled] = useState(false);
  const [uniformSchoolIds, setUniformSchoolIds] = useState<string[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(DEFAULT_COLLAPSED_SECTIONS)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const insets = useSafeAreaInsets();
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
  
  const styles = useMemo(() => createStyles(theme, insets.top, insets.bottom), [theme, insets.top, insets.bottom]);

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

  useEffect(() => {
    let cancelled = false;
    const loadUniformEnabled = async () => {
      const preschoolIds = Array.from(new Set(
        children
          .map((child) => child.preschoolId || child.preschool_id)
          .filter(Boolean)
      )) as string[];

      if (!preschoolIds.length) {
        if (!cancelled) {
          setUniformEnabled(false);
          setUniformSchoolIds([]);
        }
        return;
      }

      try {
        const supabase = assertSupabase();
        const { data: preschoolSettings, error: preschoolError } = await supabase
          .from('preschools')
          .select('id, settings')
          .in('id', preschoolIds);
        if (preschoolError) throw preschoolError;

        const { data: organizationSettings, error: organizationError } = await supabase
          .from('organizations')
          .select('id, settings')
          .in('id', preschoolIds);
        if (organizationError) throw organizationError;

        const enabledIds = new Set<string>();
        (preschoolSettings || []).forEach((row: any) => {
          const enabled = row?.settings?.features?.uniforms?.enabled;
          if (enabled) enabledIds.add(row.id);
        });
        (organizationSettings || []).forEach((row: any) => {
          const enabled = row?.settings?.features?.uniforms?.enabled;
          if (enabled) enabledIds.add(row.id);
        });

        if (!cancelled) {
          setUniformSchoolIds(Array.from(enabledIds));
          setUniformEnabled(enabledIds.size > 0);
        }
      } catch (error) {
        if (!cancelled) {
          setUniformEnabled(false);
          setUniformSchoolIds([]);
        }
      }
    };

    loadUniformEnabled();
    return () => {
      cancelled = true;
    };
  }, [children]);

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    const parentName = profile?.first_name || user?.user_metadata?.first_name || t('roles.parent', { defaultValue: 'Parent' });
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

  const handlePaymentsPress = useCallback(() => {
    track('parent.dashboard.quick_action', { action: 'payments', layout: 'enhanced' });
    router.push('/screens/parent-payments');
  }, []);

  const handleQuickAction = (action: string) => {
    track('parent.dashboard.quick_action', { action, layout: 'enhanced' });
    
    switch (action) {
      case 'view_homework':
        router.push('/screens/homework');
        break;
      case 'assigned_lessons':
        router.push('/screens/parent-assigned-lessons');
        break;
      case 'check_attendance':
        // Parents go to read-only attendance view, not teacher attendance management
        router.push('/screens/parent-attendance');
        break;
      case 'view_grades':
        router.push('/screens/grades');
        break;
      case 'messages':
        router.push('/screens/parent-messages');
        break;
      case 'events':
        router.push('/screens/calendar');
        break;
      case 'ai_homework_help':
        router.push('/screens/ai-homework-helper');
        break;
      case 'ask_dash':
      case 'dash_tutor':
        router.push('/screens/dash-assistant');
        break;
      case 'dash_explain':
        router.push({ pathname: '/screens/dash-assistant', params: { initialMessage: t('parent.dash_explain_prompt', { defaultValue: 'Explain a concept to me in simple terms.' }) } });
        break;
      case 'dash_quiz':
        router.push({ pathname: '/screens/dash-assistant', params: { initialMessage: t('parent.dash_quiz_prompt', { defaultValue: 'Create a short practice quiz for my child.' }) } });
        break;
      case 'dash_study_plan':
        router.push({ pathname: '/screens/dash-assistant', params: { initialMessage: t('parent.dash_study_plan_prompt', { defaultValue: 'Create a simple study plan for this week.' }) } });
        break;
      case 'children':
        // Show children list or scroll to child switcher
        // For now, could navigate to profile or show modal
        router.push('/screens/account');
        break;
      case 'calls':
        router.push('/screens/calls');
        break;
      case 'payments':
        handlePaymentsPress();
        break;
      case 'learning_hub':
        router.push('/screens/learning-hub');
        break;
      default:
        showAlert({
          title: t('common.coming_soon', { defaultValue: 'Coming Soon' }),
          message: t('dashboard.feature_coming_soon', { defaultValue: 'This feature is coming soon!' }),
          type: 'info',
        });
    }
  };

  // Search suggestions for PWA-style search
  const searchSuggestions: SearchBarSuggestion[] = useMemo(() => {
    const base: SearchBarSuggestion[] = [
      { id: 'view_homework', label: t('parent.view_homework', { defaultValue: 'View Homework' }), icon: 'book' },
      { id: 'messages', label: t('parent.messages', { defaultValue: 'Messages' }), icon: 'chatbubbles' },
      { id: 'check_attendance', label: t('parent.check_attendance', { defaultValue: 'Check Attendance' }), icon: 'calendar' },
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

  // Metrics from dashboard data - now with onPress navigation, glow, and badges
  const metrics = useMemo(() => {
    if (!dashboardData) {
      return [
        { title: t('parent.unread_messages', { defaultValue: 'Unread Messages' }), value: '...', icon: 'mail-unread', color: theme.primary, trend: 'stable' as const, action: 'messages', glow: false, badge: 0 },
        { title: t('parent.missed_calls', { defaultValue: 'Missed Calls' }), value: '...', icon: 'call', color: '#10B981', trend: 'stable' as const, action: 'calls', glow: false, badge: 0 },
        { title: t('parent.homework_pending', { defaultValue: 'Homework Pending' }), value: '...', icon: 'document-text', color: theme.warning, trend: 'stable' as const, action: 'view_homework', glow: false, badge: 0 },
        { title: t('parent.attendance_rate', { defaultValue: 'Attendance Rate' }), value: '...', icon: 'calendar', color: theme.success, trend: 'stable' as const, action: 'check_attendance', glow: false, badge: 0 },
      ];
    }

    const pendingHomework = dashboardData.recentHomework?.filter((hw: any) => hw.status === 'not_submitted').length ?? 0;
    const attendancePercentage = `${dashboardData.attendanceRate ?? 0}%`;
    const unreadCount = dashboardData.unreadMessages || unreadMessageCount || 0;
    const attendanceRate = dashboardData.attendanceRate ?? 0;
    
    return [
      {
        title: t('parent.unread_messages', { defaultValue: 'Unread Messages' }),
        value: String(unreadCount),
        icon: 'mail-unread',
        color: theme.primary,
        trend: (unreadCount > 5 ? 'attention' : 'stable') as 'stable' | 'attention' | 'up' | 'down' | 'good' | 'excellent' | 'warning' | 'needs_attention' | 'low' | 'high',
        action: 'messages',
        glow: unreadCount > 0,
        badge: unreadCount,
        priority: unreadCount > 5 ? 'important' : unreadCount > 0 ? 'informational' : undefined,
      },
      {
        title: t('parent.missed_calls', { defaultValue: 'Missed Calls' }),
        value: String(missedCallsCount),
        icon: 'call',
        color: '#10B981',
        trend: (missedCallsCount > 0 ? 'attention' : 'stable') as 'stable' | 'attention' | 'up' | 'down' | 'good' | 'excellent' | 'warning' | 'needs_attention' | 'low' | 'high',
        action: 'calls',
        glow: missedCallsCount > 0,
        badge: missedCallsCount,
        priority: missedCallsCount > 2 ? 'urgent' : missedCallsCount > 0 ? 'important' : undefined,
      },
      {
        title: t('parent.homework_pending', { defaultValue: 'Homework Pending' }),
        value: pendingHomework.toString(),
        icon: 'document-text',
        color: theme.warning,
        trend: (pendingHomework > 3 ? 'attention' : pendingHomework === 0 ? 'up' : 'stable') as 'stable' | 'attention' | 'up' | 'down' | 'good' | 'excellent' | 'warning' | 'needs_attention' | 'low' | 'high',
        action: 'view_homework',
        glow: pendingHomework > 0,
        badge: pendingHomework,
        priority: pendingHomework > 3 ? 'urgent' : pendingHomework > 0 ? 'important' : undefined,
      },
      {
        title: t('parent.attendance_rate', { defaultValue: 'Attendance Rate' }),
        value: attendancePercentage,
        icon: 'calendar',
        color: theme.success,
        trend: (attendanceRate >= 90 ? 'up' : attendanceRate >= 75 ? 'stable' : 'attention') as 'stable' | 'attention' | 'up' | 'down' | 'good' | 'excellent' | 'warning' | 'needs_attention' | 'low' | 'high',
        action: 'check_attendance',
        glow: false,
        badge: 0,
        priority: attendanceRate < 75 ? 'urgent' : attendanceRate < 90 ? 'important' : 'informational',
      },
    ];
  }, [dashboardData, unreadMessageCount, missedCallsCount, theme, t]);

  // Quick actions - enhanced with parent-friendly labels
  type ParentQuickAction = {
    id: string;
    title: string;
    icon: string;
    color: string;
    disabled?: boolean;
    subtitle?: string;
    glow?: boolean;
  };

  const baseQuickActions = useMemo<ParentQuickAction[]>(() => {
    const dashTutorSubtitle = isDashOrbUnlocked
      ? t('parent.dash_tutor_subtitle', { defaultValue: 'Homework help, practice, and explanations.' })
      : t('parent.dash_tutor_locked', { defaultValue: 'Upgrade to unlock Dash Tutor.' });
    const actions: ParentQuickAction[] = [
      { id: 'view_homework', title: t('parent.view_homework', { defaultValue: "My Child's Homework" }), icon: 'book', color: theme.primary },
      { id: 'assigned_lessons', title: t('parent.assigned_lessons', { defaultValue: "Assigned Lessons" }), icon: 'library', color: '#10B981' },
      { id: 'check_attendance', title: t('parent.check_attendance', { defaultValue: "Today's Attendance" }), icon: 'calendar', color: theme.success },
      { id: 'view_grades', title: t('parent.view_grades', { defaultValue: 'View Progress' }), icon: 'school', color: theme.secondary },
      { id: 'messages', title: t('parent.messages', { defaultValue: 'Message Teacher' }), icon: 'chatbubbles', color: theme.info },
      { id: 'events', title: t('parent.events', { defaultValue: 'School Events' }), icon: 'calendar-outline', color: theme.warning },
      { id: 'calls', title: t('parent.calls', { defaultValue: 'Call Teacher' }), icon: 'call', color: '#10B981' },
      { id: 'payments', title: t('parent.payments', { defaultValue: 'Fees & Payments' }), icon: 'card', color: isFeesDueSoon ? theme.warning : '#059669', subtitle: feesDueSubtitle, glow: isFeesDueSoon },
    ];

    if (!isDashOrbUnlocked) {
      actions.push({
        id: 'dash_tutor',
        title: t('parent.dash_tutor', { defaultValue: 'Dash Tutor' }),
        icon: 'sparkles',
        color: '#8B5CF6',
        subtitle: dashTutorSubtitle,
        disabled: !isDashOrbUnlocked,
      });
    }

    const shouldShowLearningHub = !isK12School || isEarlyLearner;
    if (shouldShowLearningHub) {
      actions.splice(3, 0, {
        id: 'learning_hub',
        title: t('parent.learning_hub', { defaultValue: 'Learning Hub' }),
        icon: 'rocket',
        color: '#0EA5E9',
      });
    }

    return isEarlyLearner ? actions.filter((action) => action.id !== 'view_grades') : actions;
  }, [t, theme, isK12School, isEarlyLearner, isFeesDueSoon, feesDueSubtitle, isDashOrbUnlocked]);

  const quickActions = useMemo<ParentQuickAction[]>(() => baseQuickActions, [baseQuickActions]);

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
        {/* Compact Header with Greeting + Tier/Role Badge */}
        <View style={styles.compactHeader}>
          <View style={styles.greetingRow}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <View style={styles.badgeRow}>
              {/* Role Badge */}
              <View style={[styles.roleBadge, { backgroundColor: theme.primary + '20' }]}>
                <Text style={[styles.roleBadgeText, { color: theme.primary }]}>
                  {t('roles.parent', { defaultValue: 'Parent' })}
                </Text>
              </View>
              {/* Tier Badge */}
              <View style={[
                styles.tierBadge, 
                { backgroundColor: (!tier || tier === 'free') ? theme.textSecondary + '20' : theme.success + '20' }
              ]}>
                <Text style={[
                  styles.tierBadgeText, 
                  { color: (!tier || tier === 'free') ? theme.textSecondary : theme.success }
                ]}>
                  {(!tier || tier === 'free') ? t('subscription.free', { defaultValue: 'Free' }) :
                   (tier === 'parent_starter' || tier === 'starter') ? t('subscription.starter', { defaultValue: 'Starter' }) :
                   (tier === 'parent_plus' || tier === 'pro' || tier === 'premium') ? t('subscription.plus', { defaultValue: 'Plus' }) :
                   tier === 'enterprise' ? t('subscription.enterprise', { defaultValue: 'Enterprise' }) :
                   t('subscription.premium', { defaultValue: 'Premium' })}
                </Text>
              </View>
            </View>
          </View>
        </View>

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

        {/* Upgrade CTA for Free Tier */}
        {(() => {
          // Check if user is on free tier (handle various possible tier values)
          const tierLower = (tier || '').toLowerCase();
          const isFreeTier = !tier || tierLower === 'free' || tierLower === '';
          // Show banner if free tier, even if subscriptionReady is false (tier can still be detected)
          const shouldShowBanner = isFreeTier;
          
          // Debug logging
          if (__DEV__) {
            logger.debug('[ParentDashboard] Upgrade banner check', {
              tier,
              tierLower,
              isFreeTier,
              subscriptionReady,
              shouldShowBanner,
            });
          }
          
          return shouldShowBanner ? (
            <View style={styles.upgradeBanner}>
              <View style={styles.upgradeBannerContent}>
                <View style={styles.upgradeBannerIconContainer}>
                  <Ionicons name="sparkles" size={16} color="#FFD700" />
                </View>
                <View style={styles.upgradeBannerText}>
                  <Text style={styles.upgradeBannerTitle}>
                    {upgradeBannerTitle}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.upgradeBannerButton}
                  onPress={() => {
                    track('parent.dashboard.upgrade_cta_clicked', { source: 'free_tier_banner', tier });
                    router.push('/pricing');
                  }}
                >
                  <Text style={styles.upgradeBannerButtonText}>
                    {t('common.upgrade', { defaultValue: 'Upgrade' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null;
        })()}

        {/* Ad Banner for Free Tier Users (Android only) */}
        <AdBannerWithUpgrade 
          screen="parent_dashboard" 
          showUpgradeCTA={true} 
          margin={12} 
        />

        {/* Metrics Grid */}
        <CollapsibleSection 
          title={t('dashboard.todays_overview', { defaultValue: "Today's Overview" })}
          sectionId="overview"
          icon="📊"
          hint={t('dashboard.hints.overview', { defaultValue: 'Attendance, fees, messages, and highlights at a glance.' })}
          defaultCollapsed={collapsedSections.has('overview')}
          onToggle={toggleSection}
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

        {/* Quick Actions */}
        <CollapsibleSection 
          title={t('dashboard.quick_actions', { defaultValue: 'Quick Actions' })}
          sectionId="quick-actions"
          icon="⚡"
          hint={t('dashboard.hints.quick_actions', { defaultValue: 'Shortcuts to homework, messages, fees, and AI help.' })}
          defaultCollapsed={collapsedSections.has('quick-actions')}
          onToggle={toggleSection}
        >
          {/* Onboarding hint for Quick Actions */}
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
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <View key={action.id} style={action.disabled ? { opacity: 0.5 } : undefined}>
                <MetricCard
                  title={action.disabled ? `${action.title} 🔒` : action.title}
                  subtitle={action.subtitle}
                  value=""
                  icon={action.icon}
                  color={action.disabled ? theme.textSecondary : action.color}
                  size="small"
                  glow={Boolean(action.glow)}
                  onPress={() => {
                    if (action.disabled) {
                      // Show upgrade modal for locked features
                      router.push('/screens/subscription-setup' as any);
                    } else {
                      if (action.id === 'payments') {
                        handlePaymentsPress();
                      } else {
                        handleQuickAction(action.id);
                      }
                    }
                  }}
                />
              </View>
            ))}
          </View>
        </CollapsibleSection>

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

const createStyles = (theme: any, topInset: number, bottomInset: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: isSmallScreen ? 8 : 12,
    paddingHorizontal: cardPadding,
    paddingBottom: Math.max(bottomInset, 34) + 120, // Ensure space for bottom nav/FAB on all devices
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 16,
  },
  compactHeader: {
    marginBottom: 12,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  greeting: {
    fontSize: isTablet ? 24 : isSmallScreen ? 18 : 20,
    fontWeight: '600',
    color: theme.text,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchSection: {
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -cardGap / 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -cardGap / 2,
  },
  upgradeBanner: {
    backgroundColor: theme.cardBackground,
    borderRadius: isSmallScreen ? 10 : 12,
    paddingVertical: isSmallScreen ? 10 : 12,
    paddingHorizontal: isSmallScreen ? 12 : 14,
    marginBottom: cardGap,
    borderWidth: 1,
    borderColor: theme.primary + '20',
  },
  upgradeBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradeBannerIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  upgradeBannerText: {
    flex: 1,
  },
  upgradeBannerTitle: {
    fontSize: isSmallScreen ? 13 : 14,
    fontWeight: '600',
    color: theme.text,
  },
  upgradeBannerSubtitle: {
    fontSize: isSmallScreen ? 11 : 12,
    color: theme.textSecondary,
    lineHeight: 16,
  },
  upgradeBannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    paddingVertical: isSmallScreen ? 6 : 8,
    paddingHorizontal: isSmallScreen ? 12 : 14,
    borderRadius: isSmallScreen ? 6 : 8,
  },
  upgradeBannerButtonText: {
    fontSize: isSmallScreen ? 12 : 13,
    fontWeight: '600',
    color: theme.onPrimary,
  },
});

export default NewEnhancedParentDashboard;
