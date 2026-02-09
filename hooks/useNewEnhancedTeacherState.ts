/**
 * useNewEnhancedTeacherState - State management hook for New Enhanced Teacher Dashboard
 * 
 * Extracts all state logic, handlers, and business logic from the dashboard component.
 */

import { useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/components/ui/StyledAlert';
import Feedback from '@/lib/feedback';
import { track } from '@/lib/analytics';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { normalizePersonName } from '@/lib/utils/nameUtils';
import { resolveSchoolTypeFromProfile } from '@/lib/schoolTypeResolver';
import { isDashboardActionAllowed } from '@/lib/dashboard/dashboardPolicy';
import { 
  TEACHER_ROUTES, 
  TEACHER_QUICK_ACTIONS, 
  getTeacherRoute,
  getTeacherRouteForSchoolType,
  resolveRouteColor 
} from '@/lib/constants/teacherRoutes';

export const useNewEnhancedTeacherState = () => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const alert = useAlert();
  const { tier } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);

  // Get personalized greeting based on time of day
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    const normalizedName = normalizePersonName({
      first: profile?.first_name || user?.user_metadata?.first_name,
      last: profile?.last_name || user?.user_metadata?.last_name,
      full: profile?.full_name || user?.user_metadata?.full_name,
    });
    const teacherName = normalizedName.shortName || 'Teacher';
    
    if (hour < 12) return t('dashboard.good_morning') + ', ' + teacherName;
    if (hour < 18) return t('dashboard.good_afternoon') + ', ' + teacherName;
    return t('dashboard.good_evening') + ', ' + teacherName;
  };

  // Handle dashboard refresh with haptic feedback
  const handleRefresh = async (refresh: () => Promise<void>) => {
    setRefreshing(true);
    try {
      await refresh();
      await Feedback.vibrate(10);
    } catch (error) {
      if (__DEV__) console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Check if user is from a preschool (used to tailor quick lesson actions)
  const resolvedSchoolType = resolveSchoolTypeFromProfile(profile);
  const isPreschool = resolvedSchoolType === 'preschool';

  /**
   * Navigate to a teacher route using centralized route config
   * Single source of truth for all navigation
   */
  const handleQuickAction = (action: string) => {
    track('teacher.dashboard.quick_action', { action, layout: 'enhanced', isPreschool, resolvedSchoolType });
    
    const routeConfig = TEACHER_ROUTES[action as keyof typeof TEACHER_ROUTES];
    
    if (!routeConfig) {
      alert.show(
        t('common.coming_soon', { defaultValue: 'Coming Soon' }),
        t('dashboard.feature_coming_soon', { defaultValue: 'This feature is coming soon.' }),
        [{ text: t('common.close', { defaultValue: 'Close' }), style: 'cancel' }],
        { type: 'info' }
      );
      return;
    }
    
    // Check premium requirement
    if (routeConfig.requiresPremium && tier === 'free') {
      alert.show(
        t('subscription.premium_required', { defaultValue: 'Premium Required' }),
        t('subscription.upgrade_for_feature', { defaultValue: 'Upgrade your plan to access this feature.' }),
        [
          { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          { text: t('subscription.upgrade', { defaultValue: 'Upgrade' }), onPress: () => router.push('/pricing') },
        ],
        { type: 'warning' }
      );
      return;
    }
    
    const routePath = getTeacherRouteForSchoolType(
      action as keyof typeof TEACHER_ROUTES,
      resolvedSchoolType
    );
    router.push(routePath);
  };

  // Build metrics data for display
  const buildMetrics = (dashboardData: any) => [
    {
      title: t('teacher.students_total'),
      value: String(dashboardData?.totalStudents ?? 0),
      icon: 'people',
      color: theme.primary,
      trend: 'stable'
    },
    {
      title: t('teacher.classes_active'),
      value: String(dashboardData?.totalClasses ?? 0),
      icon: 'school',
      color: theme.secondary,
      trend: 'good'
    },
    {
      title: t('teacher.assignments_pending'),
      value: String(dashboardData?.pendingGrading ?? 0),
      icon: 'document-text',
      color: theme.warning,
      trend: 'attention'
    },
    {
      title: t('teacher.upcoming_lessons'),
      value: String(dashboardData?.upcomingLessons ?? 0),
      icon: 'calendar',
      color: theme.success,
      trend: 'up'
    }
  ];

  /**
   * Build quick actions from centralized route config
   * Uses TEACHER_QUICK_ACTIONS array for ordering
   */
  const buildQuickActions = () => {
    const flags = getFeatureFlagsSync();
    const canLiveLessons = flags.live_lessons_enabled || flags.group_calls_enabled;
    const applyNextGenPolicy = flags.NEXT_GEN_DASH_POLICY_V1;
    const actionKeys = TEACHER_QUICK_ACTIONS.filter(actionKey => {
      if (actionKey === 'start_live_lesson' && !canLiveLessons) return false;
      if (actionKey === 'call_parent' && !(flags.voice_calls_enabled || flags.video_calls_enabled)) return false;
      if (actionKey === 'quick_lesson' && !isPreschool) return false;
      if (
        applyNextGenPolicy &&
        !isDashboardActionAllowed('teacher', resolvedSchoolType, actionKey)
      ) {
        return false;
      }
      return true;
    });

    return actionKeys.map(actionKey => {
      const route = TEACHER_ROUTES[actionKey];
      if (!route) return null;
      const resolvedPath = getTeacherRouteForSchoolType(actionKey, resolvedSchoolType);
      
      return {
        title: t(route.titleKey, { defaultValue: route.title }),
        icon: route.icon,
        color: resolveRouteColor(route.color, theme),
        path: resolvedPath,
        onPress: () => handleQuickAction(actionKey),
        disabled: route.requiresPremium && tier === 'free',
        category: route.category,
        id: actionKey,
      };
    }).filter(Boolean);
  };

  return {
    user,
    profile,
    theme,
    tier,
    refreshing,
    isPreschool,
    resolvedSchoolType,
    getGreeting,
    handleRefresh,
    handleQuickAction,
    buildMetrics,
    buildQuickActions,
    // Export route config for external use
    routes: TEACHER_ROUTES,
    getRoute: getTeacherRoute,
  };
};
