/**
 * useNewEnhancedTeacherState - State management hook for New Enhanced Teacher Dashboard
 * 
 * Extracts all state logic, handlers, and business logic from the dashboard component.
 */

import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import Feedback from '@/lib/feedback';
import { track } from '@/lib/analytics';
import { 
  TEACHER_ROUTES, 
  TEACHER_QUICK_ACTIONS, 
  getTeacherRoute,
  resolveRouteColor 
} from '@/lib/constants/teacherRoutes';

export const useNewEnhancedTeacherState = () => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { tier } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);

  // Get personalized greeting based on time of day
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    const teacherName = profile?.first_name || user?.user_metadata?.first_name || 'Teacher';
    
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
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Check if user is from a preschool (no longer needed for routing - all preschool teachers use same route)
  const isPreschool = Boolean(profile?.preschool_id);

  /**
   * Navigate to a teacher route using centralized route config
   * Single source of truth for all navigation
   */
  const handleQuickAction = (action: string) => {
    track('teacher.dashboard.quick_action', { action, layout: 'enhanced', isPreschool });
    
    const routeConfig = TEACHER_ROUTES[action as keyof typeof TEACHER_ROUTES];
    
    if (!routeConfig) {
      Alert.alert(t('common.coming_soon'), t('dashboard.feature_coming_soon'));
      return;
    }
    
    // Check premium requirement
    if (routeConfig.requiresPremium && tier === 'free') {
      Alert.alert(
        t('subscription.premium_required', { defaultValue: 'Premium Required' }),
        t('subscription.upgrade_for_feature', { defaultValue: 'Upgrade your plan to access this feature.' }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('subscription.upgrade'), onPress: () => router.push('/pricing') }
        ]
      );
      return;
    }
    
    // Navigate to the route from single source of truth
    router.push(routeConfig.path);
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
    return TEACHER_QUICK_ACTIONS.map(actionKey => {
      const route = TEACHER_ROUTES[actionKey];
      if (!route) return null;
      
      return {
        title: t(route.titleKey, { defaultValue: route.title }),
        icon: route.icon,
        color: resolveRouteColor(route.color, theme),
        onPress: () => handleQuickAction(actionKey),
        disabled: route.requiresPremium && tier === 'free',
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
