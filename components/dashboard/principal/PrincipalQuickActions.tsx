/**
 * Principal Dashboard - Quick Actions Section
 * 
 * Action buttons for common principal tasks.
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/components/ui/StyledAlert';
import { QuickActionCard } from '../shared/QuickActionCard';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { getFeatureFlagsSync } from '@/lib/featureFlags';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;
const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;

interface PrincipalQuickActionsProps {
  stats?: {
    pendingRegistrations?: { total: number };
    pendingPayments?: { total: number };
    pendingPOPUploads?: { total: number };
  };
  pendingRegistrationsCount?: number;
  pendingPaymentsCount?: number;
  pendingPOPUploadsCount?: number;
  collapsedSections: Set<string>;
  onToggleSection: (sectionId: string) => void;
  onAction?: (actionId: string) => void;
}

export const PrincipalQuickActions: React.FC<PrincipalQuickActionsProps> = ({
  stats,
  pendingRegistrationsCount = 0,
  pendingPaymentsCount = 0,
  pendingPOPUploadsCount = 0,
  collapsedSections,
  onToggleSection,
  onAction,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const alert = useAlert();
  const styles = createStyles(theme);
  const flags = getFeatureFlagsSync();
  const canLiveLessons = flags.live_lessons_enabled || flags.group_calls_enabled;

  // Quick Actions matching PWA Principal Dashboard
  const quickActions = [
    {
      id: 'registrations',
      title: t('dashboard.review_registrations', { defaultValue: 'Review Registrations' }),
      icon: 'person-add',
      color: '#6366F1',
      badge: stats?.pendingRegistrations?.total ?? pendingRegistrationsCount,
    },
    {
      id: 'aftercare',
      title: t('dashboard.aftercare_registrations', { defaultValue: 'Aftercare Registrations' }),
      icon: 'school',
      color: '#8B5CF6',
    },
    {
      id: 'payments',
      title: t('dashboard.review_payments', { defaultValue: 'Review Payments' }),
      icon: 'receipt',
      color: '#10B981',
      badge: stats?.pendingPOPUploads?.total ?? pendingPOPUploadsCount,
    },
    {
      id: 'teacher-approval',
      title: t('dashboard.approve_teachers', { defaultValue: 'Approve Teachers' }),
      icon: 'checkmark-circle',
      color: '#06B6D4',
    },
    {
      id: 'activities',
      title: t('dashboard.learning_activities', { defaultValue: 'Learning Activities' }),
      icon: 'game-controller',
      color: '#EC4899',
    },
    {
      id: 'browse-lessons',
      title: t('dashboard.browse_lessons', { defaultValue: 'Browse Lessons' }),
      icon: 'book',
      color: '#F59E0B',
    },
    {
      id: 'create-lesson',
      title: t('dashboard.create_lesson', { defaultValue: 'Create Lesson' }),
      icon: 'add-circle',
      color: '#10B981',
    },
    {
      id: 'assign-lessons',
      title: t('dashboard.assign_lessons', { defaultValue: 'Assign Lessons' }),
      icon: 'paper-plane',
      color: '#8B5CF6',
    },
    {
      id: 'reports',
      title: t('dashboard.view_reports', { defaultValue: 'View Reports' }),
      icon: 'bar-chart',
      color: '#8B5CF6',
    },
    {
      id: 'announcements',
      title: t('dashboard.send_announcement', { defaultValue: 'Send Announcement' }),
      icon: 'megaphone',
      color: '#F59E0B',
    },
    {
      id: 'calendar',
      title: t('dashboard.manage_calendar', { defaultValue: 'Manage Calendar' }),
      icon: 'calendar',
      color: '#EC4899',
    },
    ...(canLiveLessons ? [{
      id: 'live-lessons',
      title: t('dashboard.live_lessons', { defaultValue: 'Live Lessons' }),
      icon: 'videocam',
      color: '#EC4899',
    }] : []),
    {
      id: 'teachers',
      title: t('dashboard.manage_teachers', { defaultValue: 'Manage Teachers' }),
      icon: 'people',
      color: '#06B6D4',
    },
    {
      id: 'groups',
      title: t('dashboard.manage_groups', { defaultValue: 'Manage Groups' }),
      icon: 'people-circle',
      color: '#14B8A6',
    },
    {
      id: 'classes',
      title: t('dashboard.manage_classes', { defaultValue: 'Manage Classes' }),
      icon: 'library',
      color: '#14B8A6',
    },
    {
      id: 'seat-management',
      title: t('dashboard.seat_management', { defaultValue: 'Seat Management' }),
      icon: 'people-circle',
      color: '#8B5CF6',
    },
    {
      id: 'settings',
      title: t('dashboard.school_settings', { defaultValue: 'School Settings' }),
      icon: 'settings',
      color: '#64748B',
    },
    // ECD Planning Features
    {
      id: 'year-planner',
      title: t('dashboard.year_planner', { defaultValue: 'Year Planner' }),
      icon: 'calendar',
      color: '#3B82F6',
    },
    {
      id: 'ai-year-planner',
      title: t('dashboard.ai_year_planner', { defaultValue: '✨ AI Year Planner' }),
      icon: 'sparkles',
      color: '#8B5CF6',
    },
    {
      id: 'excursions',
      title: t('dashboard.excursions', { defaultValue: 'Excursions' }),
      icon: 'bus',
      color: '#10B981',
    },
    {
      id: 'meetings',
      title: t('dashboard.meetings', { defaultValue: 'Meetings' }),
      icon: 'people',
      color: '#F59E0B',
    },
    {
      id: 'activity-library',
      title: t('dashboard.activity_library', { defaultValue: 'Activity Library' }),
      icon: 'game-controller',
      color: '#EC4899',
    },
    {
      id: 'curriculum-themes',
      title: t('dashboard.curriculum_themes', { defaultValue: 'Curriculum Themes' }),
      icon: 'book',
      color: '#6366F1',
    },
    {
      id: 'lesson-templates',
      title: t('dashboard.lesson_templates', { defaultValue: 'Lesson Templates' }),
      icon: 'document-text',
      color: '#14B8A6',
    },
    {
      id: 'weekly-plans',
      title: t('dashboard.weekly_plans', { defaultValue: 'Weekly Plans' }),
      icon: 'list',
      color: '#64748B',
    },
    // Birthday Management
    {
      id: 'birthday-chart',
      title: t('dashboard.birthday_chart', { defaultValue: 'Birthday Chart' }),
      icon: 'gift',
      color: '#F472B6',
    },
    // Financial Management
    {
      id: 'fee-management',
      title: t('dashboard.fee_management', { defaultValue: 'Fee Management' }),
      icon: 'wallet',
      color: '#10B981',
    },
    {
      id: 'dash-studio',
      title: t('dashboard.dash_studio', { defaultValue: 'Dash Studio' }),
      icon: 'sparkles',
      color: '#6366F1',
    },
  ];

  const handleActionPress = (actionId: string) => {
    // Allow custom handler first
    if (onAction) {
      onAction(actionId);
    }

    // Default navigation
    switch (actionId) {
      case 'registrations':
        router.push('/screens/principal-registrations');
        break;
      case 'aftercare':
        router.push('/screens/aftercare-admin');
        break;
      case 'payments':
        try {
          router.push('/screens/pop-review' as any);
        } catch (error) {
          console.error('[PrincipalQuickActions] Failed to navigate to pop-review:', error);
          alert.show(
            'Navigation Error',
            'Could not open payment reviews. Please try again.',
            [{ text: 'Close', style: 'cancel' }],
            { type: 'error' }
          );
        }
        break;
      case 'teacher-approval':
        router.push('/screens/teacher-approval');
        break;
      case 'activities':
        router.push('/screens/aftercare-activities');
        break;
      case 'browse-lessons':
        router.push('/screens/teacher-lessons');
        break;
      case 'create-lesson':
        router.push('/screens/ai-lesson-generator');
        break;
      case 'assign-lessons':
        router.push('/screens/assign-lesson');
        break;
      case 'reports':
        router.push('/screens/principal-reports');
        break;
      case 'announcements':
        router.push('/screens/principal-announcement');
        break;
      case 'calendar':
        router.push('/screens/calendar-management');
        break;
      case 'live-lessons':
        router.push('/screens/start-live-lesson');
        break;
      case 'teachers':
        router.push('/screens/teacher-management');
        break;
      case 'groups':
        router.push('/screens/group-management');
        break;
      case 'classes':
        router.push('/screens/class-teacher-management');
        break;
      case 'seat-management':
        router.push('/screens/principal-seat-management');
        break;
      case 'settings':
        router.push('/screens/school-settings');
        break;
      case 'year-planner':
        router.push('/screens/principal-year-planner');
        break;
      case 'ai-year-planner':
        router.push('/screens/principal-ai-year-planner');
        break;
      case 'excursions':
        router.push('/screens/principal-excursions');
        break;
      case 'meetings':
        router.push('/screens/principal-meetings');
        break;
      case 'activity-library':
        router.push('/screens/principal-activities');
        break;
      case 'curriculum-themes':
        // TODO: Create screen - for now show coming soon
        alert.show(
          t('common.coming_soon', { defaultValue: 'Coming Soon' }),
          t('ecd.curriculum_themes_coming_soon', { defaultValue: 'Curriculum Themes management is coming in the next update.' }),
          [{ text: t('common.close', { defaultValue: 'Close' }), style: 'cancel' }],
          { type: 'info' }
        );
        break;
      case 'lesson-templates':
        // TODO: Create screen - for now show coming soon
        alert.show(
          t('common.coming_soon', { defaultValue: 'Coming Soon' }),
          t('ecd.lesson_templates_coming_soon', { defaultValue: 'Lesson Templates are coming in the next update.' }),
          [{ text: t('common.close', { defaultValue: 'Close' }), style: 'cancel' }],
          { type: 'info' }
        );
        break;
      case 'weekly-plans':
        // TODO: Create screen - for now show coming soon
        alert.show(
          t('common.coming_soon', { defaultValue: 'Coming Soon' }),
          t('ecd.weekly_plans_coming_soon', { defaultValue: 'Weekly Plans management is coming in the next update.' }),
          [{ text: t('common.close', { defaultValue: 'Close' }), style: 'cancel' }],
          { type: 'info' }
        );
        break;
      case 'birthday-chart':
        router.push('/screens/birthday-chart');
        break;
      case 'fee-management':
        router.push('/screens/principal-fee-overview');
        break;
      case 'dash-studio':
        router.push('/screens/dash-studio');
        break;
      default:
        alert.show(
          t('common.coming_soon', { defaultValue: 'Coming Soon' }),
          t('common.feature_in_development', { defaultValue: 'This feature is coming soon.' }),
          [{ text: t('common.close', { defaultValue: 'Close' }), style: 'cancel' }],
          { type: 'info' }
        );
    }
  };

  return (
    <CollapsibleSection 
      title={t('dashboard.quick_actions', { defaultValue: 'Quick Actions' })} 
      sectionId="quick-actions" 
      icon="⚡"
      hint={t('dashboard.hints.principal_quick_actions', { defaultValue: 'Approve, message, and jump to key workflows.' })}
      defaultCollapsed={collapsedSections.has('quick-actions')}
      onToggle={onToggleSection}
    >
      <View style={styles.actionsGrid}>
        {quickActions.map((action) => (
          <QuickActionCard
            key={action.id}
            title={action.title}
            icon={action.icon}
            color={action.color}
            badgeCount={action.badge}
            onPress={() => handleActionPress(action.id)}
          />
        ))}
      </View>
    </CollapsibleSection>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -cardGap / 2,
  },
});

export default PrincipalQuickActions;
