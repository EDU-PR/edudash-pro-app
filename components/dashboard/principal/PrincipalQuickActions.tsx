/**
 * Principal Dashboard - Quick Actions Section
 * 
 * Action buttons for common principal tasks.
 */

import React from 'react';
import { View, StyleSheet, Dimensions, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { QuickActionCard } from '../shared/QuickActionCard';
import { CollapsibleSection } from '../shared/CollapsibleSection';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;
const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;

interface PrincipalQuickActionsProps {
  stats?: {
    pendingRegistrations?: { total: number };
    pendingPayments?: { total: number };
  };
  pendingRegistrationsCount?: number;
  pendingPaymentsCount?: number;
  collapsedSections: Set<string>;
  onToggleSection: (sectionId: string) => void;
  onAction?: (actionId: string) => void;
}

export const PrincipalQuickActions: React.FC<PrincipalQuickActionsProps> = ({
  stats,
  pendingRegistrationsCount = 0,
  pendingPaymentsCount = 0,
  collapsedSections,
  onToggleSection,
  onAction,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = createStyles(theme);

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
      id: 'payments',
      title: t('dashboard.view_payments', { defaultValue: 'View Payments' }),
      icon: 'card',
      color: '#10B981',
      badge: stats?.pendingPayments?.total ?? pendingPaymentsCount,
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
    {
      id: 'teachers',
      title: t('dashboard.manage_teachers', { defaultValue: 'Manage Teachers' }),
      icon: 'people',
      color: '#06B6D4',
    },
    {
      id: 'classes',
      title: t('dashboard.manage_classes', { defaultValue: 'Manage Classes' }),
      icon: 'library',
      color: '#14B8A6',
    },
    {
      id: 'settings',
      title: t('dashboard.school_settings', { defaultValue: 'School Settings' }),
      icon: 'settings',
      color: '#64748B',
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
      case 'payments':
        router.push('/screens/financial-dashboard');
        break;
      case 'reports':
        router.push('/screens/reports');
        break;
      case 'announcements':
        router.push('/screens/announcements');
        break;
      case 'calendar':
        router.push('/screens/calendar');
        break;
      case 'teachers':
        router.push('/screens/teacher-management');
        break;
      case 'classes':
        router.push('/screens/class-details');
        break;
      case 'settings':
        router.push('/screens/school-settings');
        break;
      default:
        Alert.alert(
          t('common.coming_soon', { defaultValue: 'Coming Soon' }),
          t('common.feature_in_development', { defaultValue: 'This feature is currently in development.' })
        );
    }
  };

  return (
    <CollapsibleSection 
      title={t('dashboard.quick_actions', { defaultValue: 'Quick Actions' })} 
      sectionId="quick-actions" 
      icon="⚡"
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
