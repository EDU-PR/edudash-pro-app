/**
 * Principal Dashboard - Recent Activity Section
 * 
 * Activity feed, alerts, and pending actions.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { CollapsibleSection } from '../shared/CollapsibleSection';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;

interface ActivityItem {
  id: string;
  type: 'registration' | 'payment' | 'announcement' | 'alert' | 'teacher' | 'class';
  title: string;
  description: string;
  time: string;
  icon: string;
  color: string;
  actionRoute?: string;
}

interface PrincipalRecentActivityProps {
  activities?: ActivityItem[];
  stats?: {
    pendingRegistrations?: { total: number };
    pendingPayments?: { total: number };
  };
  collapsedSections: Set<string>;
  onToggleSection: (sectionId: string) => void;
}

export const PrincipalRecentActivity: React.FC<PrincipalRecentActivityProps> = ({
  activities,
  stats,
  collapsedSections,
  onToggleSection,
}) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const styles = createStyles(theme, isDark);

  // Default activities based on stats if none provided
  const defaultActivities: ActivityItem[] = [
    ...(stats?.pendingRegistrations?.total ? [{
      id: 'pending-reg',
      type: 'registration' as const,
      title: t('dashboard.pending_registrations', { defaultValue: 'Pending Registrations' }),
      description: t('dashboard.registrations_awaiting', { 
        count: stats.pendingRegistrations.total,
        defaultValue: `${stats.pendingRegistrations.total} registrations awaiting review` 
      }),
      time: t('common.now', { defaultValue: 'Now' }),
      icon: 'person-add',
      color: '#6366F1',
      actionRoute: '/screens/principal-registrations',
    }] : []),
    ...(stats?.pendingPayments?.total ? [{
      id: 'pending-pay',
      type: 'payment' as const,
      title: t('dashboard.pending_payments', { defaultValue: 'Pending Payments' }),
      description: t('dashboard.payments_awaiting', { 
        count: stats.pendingPayments.total,
        defaultValue: `${stats.pendingPayments.total} payments need attention` 
      }),
      time: t('common.now', { defaultValue: 'Now' }),
      icon: 'card',
      color: '#F59E0B',
      actionRoute: '/screens/financial-dashboard',
    }] : []),
  ];

  const displayActivities = activities?.length ? activities : defaultActivities;

  const handleActivityPress = (activity: ActivityItem) => {
    if (activity.actionRoute) {
      router.push(activity.actionRoute as any);
    }
  };

  if (!displayActivities.length) {
    return (
      <CollapsibleSection 
        title={t('dashboard.recent_activity', { defaultValue: 'Recent Activity' })} 
        sectionId="recent-activity" 
        icon="🔔"
        defaultCollapsed={collapsedSections.has('recent-activity')}
        onToggle={onToggleSection}
      >
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={48} color="#10B981" />
          <Text style={styles.emptyTitle}>
            {t('dashboard.all_caught_up', { defaultValue: 'All Caught Up!' })}
          </Text>
          <Text style={styles.emptyDescription}>
            {t('dashboard.no_pending_items', { defaultValue: 'No pending items require your attention.' })}
          </Text>
        </View>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection 
      title={t('dashboard.recent_activity', { defaultValue: 'Recent Activity' })} 
      sectionId="recent-activity" 
      icon="🔔"
      defaultCollapsed={collapsedSections.has('recent-activity')}
      onToggle={onToggleSection}
    >
      <View style={styles.activityList}>
        {displayActivities.map((activity, index) => (
          <TouchableOpacity
            key={activity.id}
            style={[
              styles.activityItem,
              index === displayActivities.length - 1 && styles.activityItemLast,
            ]}
            onPress={() => handleActivityPress(activity)}
            activeOpacity={activity.actionRoute ? 0.7 : 1}
          >
            <View style={[styles.activityIcon, { backgroundColor: `${activity.color}20` }]}>
              <Ionicons name={activity.icon as any} size={20} color={activity.color} />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle} numberOfLines={1}>
                {activity.title}
              </Text>
              <Text style={styles.activityDescription} numberOfLines={2}>
                {activity.description}
              </Text>
            </View>
            <View style={styles.activityMeta}>
              <Text style={styles.activityTime}>{activity.time}</Text>
              {activity.actionRoute && (
                <Ionicons 
                  name="chevron-forward" 
                  size={16} 
                  color={theme.textSecondary} 
                  style={styles.activityChevron}
                />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* View All Link */}
      <TouchableOpacity 
        style={styles.viewAllButton}
        onPress={() => router.push('/screens/activity-log')}
      >
        <Text style={styles.viewAllText}>
          {t('dashboard.view_all_activity', { defaultValue: 'View All Activity' })}
        </Text>
        <Ionicons name="arrow-forward" size={16} color="#6366F1" />
      </TouchableOpacity>
    </CollapsibleSection>
  );
};

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  activityList: {
    backgroundColor: theme.cardBackground || theme.card || theme.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isSmallScreen ? 12 : 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border || 'rgba(0,0,0,0.08)',
  },
  activityItemLast: {
    borderBottomWidth: 0,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
    marginRight: 8,
  },
  activityTitle: {
    fontSize: isSmallScreen ? 14 : 15,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 2,
  },
  activityDescription: {
    fontSize: isSmallScreen ? 12 : 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  activityMeta: {
    alignItems: 'flex-end',
  },
  activityTime: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  activityChevron: {
    opacity: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: theme.cardBackground || theme.card || theme.surface,
    borderRadius: 12,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
    marginRight: 4,
  },
});

export default PrincipalRecentActivity;
