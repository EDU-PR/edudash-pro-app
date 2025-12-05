/**
 * New Enhanced Principal Dashboard - Modern UI/UX Implementation
 * 
 * Features:
 * - Clean grid-based layout with improved visual hierarchy
 * - Mobile-first responsive design with <2s load time
 * - Modern card design with subtle shadows and rounded corners
 * - Streamlined quick actions with contextual grouping
 * - Better information architecture with progressive disclosure
 * - Enhanced loading states and error handling
 * - Optimized for touch interfaces and accessibility
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { usePrincipalHub, getPendingReportCount } from '@/hooks/usePrincipalHub';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { usePettyCashMetricCards } from '@/hooks/usePettyCashDashboard';
import Feedback from '@/lib/feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import TierBadge from '@/components/ui/TierBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PendingParentLinkRequests } from './PendingParentLinkRequests';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;
const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;
const containerWidth = width - (cardPadding * 2);
const cardWidth = isTablet ? (containerWidth - (cardGap * 3)) / 4 : (containerWidth - cardGap) / 2;

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: string;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
  valueColor?: string; // Optional: color for the value text
}

interface QuickActionProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
  subtitle?: string;
  badgeCount?: number;
}

interface NewEnhancedPrincipalDashboardProps {
  refreshTrigger?: number;
}

export const NewEnhancedPrincipalDashboard: React.FC<NewEnhancedPrincipalDashboardProps> = ({ refreshTrigger }) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { tier, ready: subscriptionReady } = useSubscription();
  const { metricCards: pettyCashCards } = usePettyCashMetricCards();
  const { preferences, setLayout } = useDashboardPreferences();
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const insets = useSafeAreaInsets();
  const userRole = (profile as any)?.role || 'principal';
  // Prefer explicit tenant slug when available
  const tenantSlug = (profile as any)?.organization_membership?.tenant_slug 
    || (profile as any)?.organization_membership?.organization_slug 
    || (profile as any)?.organization_membership?.slug 
    || '';
  
  const styles = useMemo(() => createStyles(theme, insets.top, insets.bottom), [theme, insets.top, insets.bottom]);
  
  const {
    data,
    loading,
    error,
    refresh,
    getMetrics,
    getTeachersWithStatus,
    formatCurrency,
    isEmpty
  } = usePrincipalHub();

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.good_morning');
    if (hour < 18) return t('dashboard.good_afternoon');
    return t('dashboard.good_evening');
  };

  const toggleSection = useCallback((sectionId: string) => {
    console.log('🔄 Toggling section:', sectionId);
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        console.log('✅ Expanding:', sectionId);
        newSet.delete(sectionId);
      } else {
        console.log('❌ Collapsing:', sectionId);
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  const SectionHeader: React.FC<{ title: string; sectionId: string; icon?: string }> = useCallback(({ title, sectionId, icon }) => {
    const isCollapsed = collapsedSections.has(sectionId);
    console.log(`📋 Rendering SectionHeader: ${title} (${sectionId}) - collapsed: ${isCollapsed}`);
    return (
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => {
          console.log('👆 SectionHeader tapped:', sectionId);
          toggleSection(sectionId);
          try { Feedback.vibrate(5); } catch { /* non-fatal */ }
        }}
        activeOpacity={0.7}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${isCollapsed ? 'Expand' : 'Collapse'} ${title}`}
      >
        {icon && <Text style={styles.sectionHeaderIcon}>{icon}</Text>}
        <View style={[styles.sectionHeaderChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
          <Text style={styles.sectionHeaderTitleText}>{title}</Text>
        </View>
        <Ionicons
          name={isCollapsed ? 'chevron-down' : 'chevron-up'}
          size={20}
          color={theme.textSecondary}
        />
      </TouchableOpacity>
    );
  }, [collapsedSections, styles, theme, toggleSection]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      await Feedback.vibrate(10);
    } catch (_error) {
      console.error('Refresh error:', _error);
    } finally {
      setRefreshing(false);
    }
  };

  const MetricCard: React.FC<MetricCardProps> = ({ 
    title, 
    value, 
    icon, 
    color, 
    trend, 
    onPress,
    size = 'medium',
    valueColor
  }) => (
    <TouchableOpacity
      style={[
        styles.metricCard,
        size === 'large' && styles.metricCardLarge,
        size === 'small' && styles.metricCardSmall,
        { marginHorizontal: cardGap / 2, marginBottom: cardGap }
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={styles.metricContent}>
        <View style={styles.metricHeader}>
          <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
            <Ionicons 
              name={icon as any} 
              size={isSmallScreen ? (size === 'large' ? 24 : 20) : (size === 'large' ? 28 : 24)} 
              color={color} 
            />
          </View>
          {trend && (
            <View style={styles.trendContainer}>
              <Text style={[styles.trendText, getTrendColor(trend)]}>
                {getTrendIcon(trend)} {getTrendText(trend)}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.metricValue, valueColor && { color: valueColor }]}>{value}</Text>
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  const QuickAction: React.FC<QuickActionProps> = ({ title, icon, color, onPress, subtitle, badgeCount }) => (
    <TouchableOpacity
      style={styles.actionCard}
      onPress={async () => {
        try {
          await Feedback.vibrate(10);
          onPress();
        } catch { /* TODO: Implement */ }
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={isSmallScreen ? 20 : 24} color={color} />
        {badgeCount !== undefined && badgeCount > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.error }]}>
            <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
          </View>
        )}
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      {subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  );

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': case 'good': case 'excellent': case 'stable': return { color: theme.success };
      case 'warning': case 'attention': case 'high': return { color: theme.warning };
      case 'down': case 'low': case 'needs_attention': return { color: theme.error };
      default: return { color: theme.textSecondary };
    }
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'up': case 'good': case 'excellent': return '↗️';
      case 'down': case 'low': return '↘️';
      case 'warning': case 'attention': case 'needs_attention': return '⚠️';
      default: return '➡️';
    }
  };

  const getTrendText = (trend: string): string => {
    switch (trend) {
      case 'up': return t('trends.up', { defaultValue: 'Up' });
      case 'down': return t('trends.down', { defaultValue: 'Down' });
      case 'good': return t('trends.good', { defaultValue: 'Good' });
      case 'excellent': return t('trends.excellent', { defaultValue: 'Excellent' });
      case 'warning': return t('trends.warning', { defaultValue: 'Warning' });
      case 'attention': return t('trends.attention', { defaultValue: 'Attention' });
      case 'needs_attention': return t('trends.needs_attention', { defaultValue: 'Needs attention' });
      case 'low': return t('trends.low', { defaultValue: 'Low' });
      case 'stable': return t('trends.stable', { defaultValue: 'Stable' });
      case 'high': return t('trends.high', { defaultValue: 'High' });
      default: return trend;
    }
  };

  if (loading && isEmpty) {
    return <LoadingScreen message="Loading your dashboard..." />;
  }

  if (error && isEmpty) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={64} color={theme.error} />
        <Text style={styles.errorTitle}>{t('dashboard.load_error')}</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const metrics = getMetrics();
  const teachersWithStatus = getTeachersWithStatus();
  
  // School Overview metrics matching PWA design - now includes registrations
  const schoolOverviewMetrics = [
    {
      id: 'students',
      title: t('dashboard.total_students', { defaultValue: 'Total Students' }),
      value: data.stats?.students?.total ?? data.studentsCount ?? 0,
      icon: 'people',
      color: '#6366F1',
      trend: 'stable'
    },
    {
      id: 'enrollments',
      title: t('dashboard.active_enrollments', { defaultValue: 'Active Enrollments' }),
      value: data.stats?.pendingRegistrations?.total ?? 0,
      icon: 'person-add',
      color: '#10B981',
      trend: data.stats?.pendingRegistrations?.total > 5 ? 'attention' : 'stable'
    },
    {
      id: 'classes',
      title: t('dashboard.active_classes', { defaultValue: 'Active Classes' }),
      value: data.stats?.classes?.total ?? data.classesCount ?? 0,
      icon: 'book',
      color: '#8B5CF6',
      trend: 'stable'
    },
    {
      id: 'pending_payments',
      title: t('dashboard.pending_payments', { defaultValue: 'Pending Payments' }),
      value: data.stats?.pendingPayments?.total ?? 0,
      icon: 'time',
      color: '#F59E0B',
      trend: data.stats?.pendingPayments?.total > 3 ? 'attention' : 'stable'
    }
  ];

  // Financial Summary metrics matching PWA design  
  const financialMetrics = [
    {
      id: 'fees_collected',
      title: t('dashboard.registration_fees', { defaultValue: 'Registration Fees Collected' }),
      value: `R${(data.stats?.registrationFees?.total ?? 0).toLocaleString()}`,
      icon: 'cash',
      color: '#10B981',
      valueColor: '#10B981', // Green for fees
      trend: (data.stats?.registrationFees?.total ?? 0) > 0 ? 'up' : 'stable'
    },
    {
      id: 'pending_payments',
      title: t('dashboard.pending_payments', { defaultValue: 'Pending Payments' }),
      value: data.stats?.pendingPayments?.total ?? 0,
      icon: 'time',
      color: '#F59E0B',
      valueColor: '#F59E0B', // Yellow/orange for pending
      trend: (data.stats?.pendingPayments?.total ?? 0) > 3 ? 'attention' : 'stable'
    },
    {
      id: 'enrollments',
      title: t('dashboard.active_enrollments', { defaultValue: 'Active Enrollments' }),
      value: data.stats?.students?.total ?? data.studentsCount ?? 0,
      icon: 'person-add',
      color: '#6366F1',
      trend: 'stable'
    },
    {
      id: 'events',
      title: t('dashboard.upcoming_events', { defaultValue: 'Upcoming Events' }),
      value: 0,
      icon: 'calendar',
      color: '#EC4899',
      trend: 'stable'
    }
  ];
  
  // Add pending reports metric BEFORE other metrics (high priority)
  const reportsMetric = {
    id: 'pending_reports',
    title: 'Reports to Review',
    value: getPendingReportCount(data),
    icon: 'document-text-outline',
    color: '#F59E0B',
    trend: getPendingReportCount(data) > 0 ? 'attention' : 'stable'
  };
  
  // Place reports card first, then base metrics, then petty cash (limit to 6 total)
  // But show first 4 in main grid (including reports card as #1)
  const allMetrics = [reportsMetric, ...metrics, ...pettyCashCards].slice(0, 8);

  // Quick actions with modern grouping
  const primaryActions = [
    {
      title: t('quick_actions.dash_chat', { defaultValue: 'Chat with Dash' }),
      icon: 'chatbubbles',
      color: '#6366F1',
      onPress: () => router.push('/screens/dash-assistant'),
      subtitle: t('quick_actions.ai_assistant', { defaultValue: 'Your AI teaching assistant' })
    },
    {
      title: t('quick_actions.registrations', { defaultValue: 'Registrations' }),
      icon: 'person-add',
      color: '#F59E0B',
      onPress: () => router.push('/screens/principal-registrations'),
      subtitle: t('quick_actions.review_registrations', { defaultValue: 'Review registration requests' })
    },
    {
      title: t('quick_actions.enroll_student'),
      icon: 'school',
      color: theme.primary,
      onPress: () => router.push('/screens/student-enrollment'),
    },
    {
      title: t('quick_actions.manage_teachers'),
      icon: 'people',
      color: theme.success,
      onPress: () => router.push('/screens/teacher-management'),
    },
    {
      title: t('quick_actions.campaigns', { defaultValue: 'Campaigns' }),
      icon: 'megaphone',
      color: '#EC4899',
      onPress: () => router.push('/screens/campaigns'),
      subtitle: t('quick_actions.marketing_campaigns', { defaultValue: 'Manage marketing campaigns' })
    },
    {
      title: 'Review Progress Reports',
      icon: 'document-text',
      color: '#8B5CF6',
      onPress: () => router.push('/screens/principal-report-review'),
      subtitle: 'Approve and review reports',
      badgeCount: getPendingReportCount(data)
    },
    {
      title: 'Student Management',
      icon: 'people-outline',
      color: '#3B82F6',
      onPress: () => router.push('/screens/student-management'),
      subtitle: 'View and manage students'
    },
    {
      title: t('quick_actions.view_finances'),
      icon: 'analytics',
      color: '#059669',
      onPress: () => router.push('/screens/financial-dashboard'),
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header is now provided by DesktopLayout with hamburger menu */}

      {/* Scrollable content */}
      <ScrollView
        style={[styles.scrollContainer, Platform.OS === 'web' && styles.scrollContainerWeb]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >

        {/* Welcome Card - Separate from header */}
        <View style={[styles.section, styles.firstSection, Platform.OS === 'web' && styles.firstSectionWeb]}>
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeContent}>
              <View style={styles.titleRow}>
                <View style={styles.titleLeft}>
                  <Text style={styles.headerIcon}>🏫</Text>
                  <Text style={styles.welcomeTitle}>{t('dashboard.school_overview')}</Text>
                </View>
                <View style={styles.titleRight}>
                  {/* Dashboard Layout Toggle - Web Only */}
                  {Platform.OS === 'web' && (
                    <TouchableOpacity
                      style={styles.webLayoutToggle}
                      onPress={() => {
                        const newLayout = preferences.layout === 'enhanced' ? 'classic' : 'enhanced';
                        setLayout(newLayout);
                        try { Feedback.vibrate(15); } catch { /* Intentional: non-fatal */ }
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons 
                        name={preferences.layout === 'classic' ? 'grid' : 'apps'} 
                        size={18} 
                        color={theme.primary} 
                      />
                      <Text style={styles.webLayoutToggleText}>
                        {preferences.layout === 'enhanced' ? 'Classic' : 'Enhanced'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {/* Tier Badge - unified component */}
                  {subscriptionReady && (
                    <TierBadge size="md" showManageButton />
                  )}
                </View>
              </View>
            <Text style={styles.welcomeGreeting}>
              {getGreeting()}, {user?.user_metadata?.first_name || t('roles.principal')}!
            </Text>
            <Text style={styles.welcomeSubtitle}>
              Welcome to your principal dashboard
            </Text>
            
            {/* Upgrade prompt for free tier */}
            {tier === 'free' && subscriptionReady && (
              <View style={styles.upgradePrompt}>
                <View style={styles.upgradePromptContent}>
                  <Ionicons name="diamond" size={16} color="#FFD700" />
                  <Text style={styles.upgradePromptText}>{t('dashboard.unlock_features')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.upgradePromptButton}
                  onPress={() => router.push('/screens/subscription-upgrade-post')}
                >
                  <Text style={styles.upgradePromptButtonText}>{t('common.upgrade')}</Text>
                  <Ionicons name="arrow-forward" size={12} color={theme.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        </View>

        {/* School Overview Metrics - Collapsible */}
        <View style={styles.section}>
        <SectionHeader title={t('dashboard.school_overview')} sectionId="school-metrics" icon="📊" />
        {!collapsedSections.has('school-metrics') && (
        <View style={styles.metricsGrid}>
          {/* School Overview - 4 metrics like PWA (with registrations/payments) */}
          {schoolOverviewMetrics.map((metric, index) => (
            <MetricCard
              key={index}
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              color={metric.color}
              trend={metric.trend}
              onPress={() => {
                switch (metric.id) {
                  case 'students':
                    router.push('/screens/student-management');
                    break;
                  case 'enrollments':
                    router.push('/screens/principal-registrations');
                    break;
                  case 'classes':
                    router.push('/screens/class-details');
                    break;
                  case 'pending_payments':
                    router.push('/screens/financial-dashboard');
                    break;
                  default:
                    break;
                }
              }}
            />
          ))}
        </View>
        )}
      </View>

      {/* Financial Summary - Collapsible - Like PWA */}
      <View style={styles.section}>
        <SectionHeader title={t('dashboard.financial_summary', { defaultValue: 'Financial Summary' })} sectionId="financial-summary" icon="💰" />
        {!collapsedSections.has('financial-summary') && (
        <View style={styles.metricsGrid}>
          {/* Financial metrics like PWA with colored values */}
          {financialMetrics.map((metric, index) => (
            <MetricCard
              key={index}
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              color={metric.color}
              valueColor={metric.valueColor}
              trend={metric.trend}
              onPress={() => {
                switch (metric.id) {
                  case 'fees_collected':
                  case 'pending_payments':
                    router.push('/screens/financial-dashboard');
                    break;
                  case 'enrollments':
                    router.push('/screens/principal-registrations');
                    break;
                  case 'events':
                    router.push('/screens/calendar');
                    break;
                  default:
                    break;
                }
              }}
            />
          ))}
        </View>
        )}
      </View>

      {/* Quick Actions & Statistics - Collapsible */}
      <View style={styles.section}>
        <SectionHeader title={t('dashboard.quick_actions_stats')} sectionId="quick-actions" icon="⚡" />
        {!collapsedSections.has('quick-actions') && (
        <View style={styles.twoColumnLayout}>
          <View style={styles.leftColumn}>
            <View style={styles.quickActionsCard}>
              <Text style={styles.cardTitle}>{t('dashboard.quick_actions')}</Text>
              <View style={styles.quickActionsList}>
                {primaryActions.map((action, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickActionItem}
                    onPress={async () => {
                      try {
                        await Feedback.vibrate(5);
                        action.onPress();
                      } catch { /* TODO: Implement */ }
                    }}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel={action.title}
                    accessibilityHint="Double tap to execute this action"
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
                      <Ionicons name={action.icon as any} size={18} color={action.color} />
                    </View>
                    <Text style={styles.quickActionText}>{action.title}</Text>
                    <Ionicons name="chevron-forward-outline" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          
          {/* Performance Chart Column */}
          <View style={styles.rightColumn}>
            <View style={styles.performanceCard}>
              <Text style={styles.cardTitle}>{t('dashboard.statistics')}</Text>
              <View style={styles.chartPlaceholder}>
                <Text style={styles.chartIcon}>📈</Text>
                <Text style={styles.chartLabel}>{t('settings.language.comingSoon')}</Text>
                <Text style={styles.chartSubtext}>{t('dashboard.live_activity_feed')}</Text>
              </View>
            </View>
          </View>
        </View>
        )}
      </View>

      {/* Parent Link Requests Widget - Collapsible */}
      <View style={styles.section}>
        <SectionHeader title={t('dashboard.parent_requests')} sectionId="parent-requests" icon="👨‍👩‍👧" />
        {!collapsedSections.has('parent-requests') && (
          <PendingParentLinkRequests />
        )}
      </View>

      {/* Recent Activity - Collapsible - With Alerts like PWA */}
      <View style={styles.section}>
        <SectionHeader title={t('activity.recent_activity')} sectionId="recent-activity" icon="🔔" />
        {!collapsedSections.has('recent-activity') && (
        <View style={styles.recentActivityCard}>
          <Text style={styles.cardTitle}>{t('activity.recent_activity')}</Text>
          
          {/* Pending Payments Alert - Like PWA */}
          {(data.stats?.pendingPayments?.total ?? 0) > 0 && (
            <TouchableOpacity 
              style={[styles.alertCard, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}
              onPress={() => router.push('/screens/financial-dashboard')}
              activeOpacity={0.8}
            >
              <View style={styles.alertIconContainer}>
                <Ionicons name="warning" size={20} color="#F59E0B" />
              </View>
              <View style={styles.alertContent}>
                <Text style={[styles.alertTitle, { color: '#92400E' }]}>
                  {t('dashboard.pending_payments', { defaultValue: 'Pending Payments' })}
                </Text>
                <Text style={[styles.alertSubtitle, { color: '#B45309' }]}>
                  {data.stats?.pendingPayments?.total} {t('dashboard.payments_awaiting', { defaultValue: 'payments awaiting review' })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#F59E0B" />
            </TouchableOpacity>
          )}
          
          {/* Recent Activities List */}
          {data.recentActivities && data.recentActivities.length > 0 ? (
            <View style={styles.activityList}>
              {data.recentActivities.slice(0, 4).map((activity: any, index: number) => (
                <View key={index} style={styles.activityItem}>
                  <Text style={styles.activityBullet}>•</Text>
                  <Text style={styles.activityText}>{activity.title}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.activityEmpty}>
              <Ionicons name="time-outline" size={28} color={theme.textSecondary} />
              <Text style={styles.activityText}>{t('activity.no_recent_activity')}</Text>
              <Text style={[styles.activityText, { color: theme.textSecondary }]}>{t('activity.empty_description')}</Text>
            </View>
          )}
          
          {/* Show Teachers Link */}
          {teachersWithStatus.length > 2 && (
            <TouchableOpacity
              style={styles.viewAllActivity}
              onPress={() => router.push('/screens/teacher-management')}
            >
              <Text style={styles.viewAllActivityText}>{t('dashboard.teaching_staff')} ({teachersWithStatus.length})</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.primary} />
            </TouchableOpacity>
          )}
        </View>
        )}
      </View>

      {/* Financial Overview - Collapsible - Matching PWA style */}
      <View style={styles.section}>
        <SectionHeader title={t('dashboard.financial_overview')} sectionId="financials" icon="💰" />
        {!collapsedSections.has('financials') && (
        <View style={styles.financialGrid}>
          <View style={styles.financialCard}>
            <Text style={styles.financialLabel}>{t('dashboard.monthly_revenue')}</Text>
            <Text style={[styles.financialValue, { color: '#10B981' }]}>
              R{(data.stats?.registrationFees?.total ?? data.financialSummary?.monthlyRevenue ?? 0).toLocaleString()}
            </Text>
          </View>
          <View style={styles.financialCard}>
            <Text style={styles.financialLabel}>{t('dashboard.net_profit')}</Text>
            <Text style={[styles.financialValue, { 
              color: ((data.stats?.registrationFees?.total ?? data.financialSummary?.netProfit ?? 0) - (data.financialSummary?.estimatedExpenses ?? 0)) >= 0 ? '#10B981' : '#EF4444' 
            }]}>
              R{((data.stats?.registrationFees?.total ?? data.financialSummary?.monthlyRevenue ?? 0) - (data.financialSummary?.estimatedExpenses ?? 0)).toLocaleString()}
            </Text>
          </View>
        </View>
        )}
      </View>
      </ScrollView>

      {/* Dash AI Floating Button removed - global FAB is used from _layout.tsx */}
    </View>
  );
};

// Teacher Card Component
const TeacherCard: React.FC<{ teacher: any }> = ({ teacher }) => {
  const { theme } = useTheme();
  const cardStyles = useMemo(() => createStyles(theme), [theme]);
  
  return (
    <TouchableOpacity style={[cardStyles.teacherCard, { backgroundColor: theme.cardBackground }]}>
      <View style={cardStyles.teacherHeader}>
        <View style={[cardStyles.teacherAvatar, { backgroundColor: theme.primary }]}>
          <Text style={[cardStyles.teacherInitials, { color: theme.onPrimary }]}>
            {teacher.first_name?.[0]}{teacher.last_name?.[0]}
          </Text>
        </View>
        <View style={cardStyles.teacherInfo}>
          <Text style={[cardStyles.teacherName, { color: theme.text }]}>{teacher.full_name}</Text>
          <Text style={[cardStyles.teacherSpecialty, { color: theme.textSecondary }]}>
            {teacher.subject_specialization || 'General'}
          </Text>
        </View>
      </View>
      <Text style={[cardStyles.teacherStats, { color: theme.textSecondary }]}>
        {teacher.classes_assigned} classes • {teacher.students_count} students
      </Text>
    </TouchableOpacity>
  );
};

// Loading Skeleton Component
const LoadingSkeleton: React.FC = () => {
  const { theme } = useTheme();
  const skeletonStyles = useMemo(() => createStyles(theme), [theme]);
  
  return (
    <View style={skeletonStyles.skeleton}>
      <View style={[skeletonStyles.skeletonHeader, { backgroundColor: theme.surfaceVariant }]} />
      <View style={skeletonStyles.skeletonMetrics}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={[skeletonStyles.skeletonCard, { backgroundColor: theme.surfaceVariant }]} />
        ))}
      </View>
      <View style={[skeletonStyles.skeletonSection, { backgroundColor: theme.surfaceVariant }]} />
    </View>
  );
};

const createStyles = (theme: any, insetTop = 0, insetBottom = 0) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    appHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      backgroundColor: theme.surface,
      paddingHorizontal: cardPadding,
      paddingTop: insetTop + (isSmallScreen ? 8 : 10),
      paddingBottom: isSmallScreen ? 8 : 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    scrollContainer: {
      flex: 1,
      // Reduced spacing - header height calculation:
      // insetTop + top padding (10) + avatar height (36) + bottom padding (10) + border (1) = ~57 + insetTop
      marginTop: (isSmallScreen ? 165 : 170) + insetTop,
    },
    scrollContainerWeb: {
      marginTop: 0, // DesktopLayout header handles it - no extra margin needed
    },
    scrollContent: {
      paddingBottom: insetBottom + (isSmallScreen ? 56 : 72),
    },
    appHeaderContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isSmallScreen ? 10 : 12,
    },
    tenantName: {
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 2,
      flexShrink: 1,
      minWidth: 0,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      width: '100%',
    },
    titleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    titleRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    webLayoutToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.primaryLight,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    webLayoutToggleText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.primary,
    },
    sectionHeaderSurface: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: isSmallScreen ? 12 : 14,
      paddingHorizontal: cardPadding,
      backgroundColor: theme.surface,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionHeaderIcon: {
      fontSize: 18,
      marginRight: 8,
    },
    sectionHeaderTitle: {
      flex: 1,
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '700',
      color: theme.text,
    },
    sectionHeaderChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      alignSelf: 'flex-start',
      marginRight: 8,
    },
    sectionHeaderTitleText: {
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '700',
      color: theme.text,
    },
    headerIcon: {
      fontSize: 24,
      marginRight: 8,
    },
    headerTitle: {
      fontSize: isSmallScreen ? 18 : isTablet ? 24 : 20,
      fontWeight: '700',
      color: theme.text,
    },
    headerSubtitle: {
      fontSize: isSmallScreen ? 14 : 16,
      color: theme.text,
      fontWeight: '600',
      marginBottom: 4,
    },
    userAvatar: {
      width: isSmallScreen ? 32 : 36,
      height: isSmallScreen ? 32 : 36,
      borderRadius: isSmallScreen ? 16 : 18,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    userAvatarText: {
      color: theme.onPrimary,
      fontSize: isSmallScreen ? 14 : 16,
      fontWeight: '600',
    },
    settingsButton: {
      width: isSmallScreen ? 32 : 36,
      height: isSmallScreen ? 32 : 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: isSmallScreen ? 16 : 18,
      backgroundColor: theme.surface,
    },
    dashboardToggle: {
      width: isSmallScreen ? 32 : 36,
      height: isSmallScreen ? 32 : 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: isSmallScreen ? 16 : 18,
      backgroundColor: theme.primaryLight,
      borderWidth: 1,
      borderColor: theme.border,
    },
    welcomeCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: isSmallScreen ? 12 : 16,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    welcomeContent: {
      padding: isSmallScreen ? 12 : 16,
    },
    welcomeTitle: {
      fontSize: isSmallScreen ? 18 : 20,
      fontWeight: '700',
      color: theme.text,
    },
    welcomeGreeting: {
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '600',
      color: theme.text,
      marginTop: 8,
      marginBottom: 4,
    },
    welcomeSubtitle: {
      fontSize: isSmallScreen ? 14 : 16,
      color: theme.textSecondary,
    },
    upgradePrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.surface,
    },
    upgradePromptContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 8,
    },
    upgradePromptText: {
      fontSize: isSmallScreen ? 12 : 14,
      color: theme.textSecondary,
      flex: 1,
    },
    upgradePromptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.surface,
      gap: 4,
    },
    upgradePromptButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.primary,
    },
    greeting: {
      fontSize: isSmallScreen ? 20 : isTablet ? 28 : 24,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
      lineHeight: isSmallScreen ? 24 : isTablet ? 32 : 28,
    },
    schoolName: {
      fontSize: isSmallScreen ? 14 : 16,
      color: theme.textSecondary,
      fontWeight: '500',
      lineHeight: isSmallScreen ? 18 : 20,
    },
    section: {
      paddingHorizontal: cardPadding,
      paddingVertical: isSmallScreen ? 10 : 12,
    },
    firstSection: {
      paddingTop: isSmallScreen ? 2 : 4,
    },
    firstSectionWeb: {
      paddingTop: 4, // Reduced spacing for web with DesktopLayout
    },
    sectionTitle: {
      fontSize: isSmallScreen ? 18 : isTablet ? 22 : 20,
      fontWeight: '700',
      color: theme.text,
      marginBottom: isSmallScreen ? 12 : 16,
      lineHeight: isSmallScreen ? 22 : isTablet ? 26 : 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    viewAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    viewAllText: {
      fontSize: 16,
      color: theme.primary,
      fontWeight: '600',
      marginRight: 4,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -cardGap / 2,
    },
    metricCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: isSmallScreen ? 12 : 16,
      padding: isSmallScreen ? 14 : 18,
      width: cardWidth,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
      minHeight: isSmallScreen ? 110 : 130,
    },
    metricCardLarge: {
      width: isTablet ? (width - 60) / 2 : width - (cardPadding * 2),
    },
    metricCardSmall: {
      width: isTablet ? (width - 80) / 5 : (width - (cardPadding * 2) - (cardGap * 2)) / 3,
      padding: isSmallScreen ? 8 : 12,
      minHeight: isSmallScreen ? 80 : 100,
    },
    metricContent: {
      alignItems: 'flex-start',
      flex: 1,
    },
    metricHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      width: '100%',
      marginBottom: isSmallScreen ? 10 : 14,
    },
    iconContainer: {
      width: isSmallScreen ? 44 : 52,
      height: isSmallScreen ? 44 : 52,
      borderRadius: isSmallScreen ? 12 : 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trendContainer: {
      backgroundColor: theme.surface,
      paddingHorizontal: isSmallScreen ? 6 : 8,
      paddingVertical: isSmallScreen ? 3 : 4,
      borderRadius: 6,
      maxWidth: '100%',
    },
    trendText: {
      fontSize: isSmallScreen ? 10 : 11,
      fontWeight: '600',
      lineHeight: isSmallScreen ? 12 : 14,
    },
    metricValue: {
      fontSize: isSmallScreen ? 24 : isTablet ? 36 : 32,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 6,
      lineHeight: isSmallScreen ? 28 : isTablet ? 40 : 36,
    },
    metricTitle: {
      fontSize: isSmallScreen ? 13 : isTablet ? 16 : 15,
      color: theme.textSecondary,
      fontWeight: '500',
      lineHeight: isSmallScreen ? 18 : isTablet ? 22 : 20,
      textAlign: 'left',
    },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: cardGap,
    },
    actionCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: isSmallScreen ? 12 : 16,
      padding: isSmallScreen ? 12 : 16,
      alignItems: 'center',
      width: cardWidth,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
      minHeight: isSmallScreen ? 90 : 110,
    },
    actionIcon: {
      width: isSmallScreen ? 48 : 56,
      height: isSmallScreen ? 48 : 56,
      borderRadius: isSmallScreen ? 12 : 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: isSmallScreen ? 8 : 12,
      position: 'relative',
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.cardBackground,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 13,
    },
    actionTitle: {
      fontSize: isSmallScreen ? 12 : 14,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      lineHeight: isSmallScreen ? 16 : 18,
    },
    actionSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 4,
    },
    teachersRow: {
      flexDirection: 'row',
      paddingRight: cardPadding,
      gap: cardGap,
    },
    teacherCard: {
      borderRadius: isSmallScreen ? 10 : 12,
      padding: isSmallScreen ? 10 : 12,
      width: isSmallScreen ? 160 : 180,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    teacherHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    teacherAvatar: {
      width: isSmallScreen ? 32 : 36,
      height: isSmallScreen ? 32 : 36,
      borderRadius: isSmallScreen ? 16 : 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isSmallScreen ? 8 : 10,
    },
    teacherInitials: {
      fontSize: isSmallScreen ? 12 : 14,
      fontWeight: '600',
    },
    teacherInfo: {
      flex: 1,
    },
    teacherName: {
      fontSize: isSmallScreen ? 12 : 14,
      fontWeight: '600',
      marginBottom: 2,
    },
    teacherSpecialty: {
      fontSize: isSmallScreen ? 10 : 12,
    },
    teacherStats: {
      fontSize: isSmallScreen ? 10 : 12,
    },
    financialGrid: {
      flexDirection: 'row',
      gap: cardGap,
    },
    financialCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: isSmallScreen ? 12 : 16,
      padding: isSmallScreen ? 12 : 16,
      flex: 1,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    financialLabel: {
      fontSize: isSmallScreen ? 12 : 14,
      color: theme.textSecondary,
      marginBottom: isSmallScreen ? 6 : 8,
      fontWeight: '500',
    },
    financialValue: {
      fontSize: isSmallScreen ? 20 : isTablet ? 28 : 24,
      fontWeight: '700',
      lineHeight: isSmallScreen ? 24 : isTablet ? 32 : 28,
    },
    skeleton: {
      padding: 20,
    },
    skeletonHeader: {
      height: 80,
      borderRadius: 12,
      marginBottom: 20,
    },
    skeletonMetrics: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 20,
    },
    skeletonCard: {
      width: cardWidth,
      height: 120,
      borderRadius: 16,
    },
    skeletonSection: {
      height: 200,
      borderRadius: 16,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      backgroundColor: theme.background,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text,
      marginTop: 16,
      marginBottom: 8,
      textAlign: 'center',
    },
    errorText: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 22,
    },
    retryButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    retryButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    twoColumnLayout: {
      flexDirection: isSmallScreen ? 'column' : 'row',
      gap: cardGap,
    },
    leftColumn: {
      flex: isSmallScreen ? undefined : 1,
      marginRight: isSmallScreen ? 0 : cardGap / 2,
    },
    rightColumn: {
      flex: isSmallScreen ? undefined : 1,
      marginLeft: isSmallScreen ? 0 : cardGap / 2,
      marginTop: isSmallScreen ? cardGap : 0,
    },
    quickActionsCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: isSmallScreen ? 12 : 16,
      padding: isSmallScreen ? 18 : 22,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: theme.name === 'dark' ? 0.3 : 0.08,
      shadowRadius: 10,
      elevation: theme.name === 'dark' ? 5 : 3,
      borderWidth: theme.name === 'dark' ? 1 : 0,
      borderColor: theme.name === 'dark' ? theme.border : 'transparent',
    },
    performanceCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: isSmallScreen ? 12 : 16,
      padding: isSmallScreen ? 16 : 20,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    recentActivityCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: isSmallScreen ? 12 : 16,
      padding: isSmallScreen ? 16 : 20,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    cardTitle: {
      fontSize: isSmallScreen ? 16 : 18,
      fontWeight: '700',
      color: theme.text,
      marginBottom: isSmallScreen ? 12 : 16,
    },
    quickActionsList: {
      gap: isSmallScreen ? 4 : 6,
    },
    quickActionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: isSmallScreen ? 12 : 14,
      paddingHorizontal: isSmallScreen ? 12 : 16,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme.name === 'dark' ? 0.25 : 0.1,
      shadowRadius: 4,
      elevation: theme.name === 'dark' ? 4 : 2,
      minHeight: isSmallScreen ? 48 : 52,
      marginBottom: isSmallScreen ? 8 : 10,
      ...(theme.name === 'dark' && {
        backgroundColor: theme.surface + 'CC',
        borderColor: theme.primary + '40',
        shadowColor: '#000000',
      }),
    },
    quickActionText: {
      fontSize: isSmallScreen ? 14 : 15,
      fontWeight: '600',
      color: theme.text,
      marginLeft: 12,
      flex: 1,
    },
    quickActionPressed: {
      backgroundColor: theme.primary + '15',
      borderColor: theme.primary + '30',
      transform: [{ scale: 0.98 }],
    },
    quickActionIcon: {
      width: isSmallScreen ? 36 : 40,
      height: isSmallScreen ? 36 : 40,
      borderRadius: isSmallScreen ? 10 : 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 1,
    },
    chartPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      height: isSmallScreen ? 120 : 140,
      backgroundColor: theme.surface,
      borderRadius: 12,
    },
    chartIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    chartLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 4,
    },
    chartSubtext: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    // Alert card styles for pending payments etc
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      marginBottom: 12,
    },
    alertIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    alertContent: {
      flex: 1,
    },
    alertTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 2,
    },
    alertSubtitle: {
      fontSize: 12,
    },
    activityList: {
      gap: isSmallScreen ? 8 : 12,
    },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 4,
    },
    activityBullet: {
      fontSize: 16,
      color: theme.primary,
      marginRight: 8,
      marginTop: 2,
    },
    activityText: {
      fontSize: isSmallScreen ? 13 : 14,
      color: theme.text,
      lineHeight: isSmallScreen ? 18 : 20,
      flex: 1,
    },
    activityEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: isSmallScreen ? 8 : 10,
    },
    viewAllActivity: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: isSmallScreen ? 12 : 16,
      marginTop: isSmallScreen ? 12 : 16,
      borderTopWidth: 1,
      borderTopColor: theme.surface,
    },
    viewAllActivityText: {
      fontSize: 14,
      color: theme.primary,
      fontWeight: '600',
    },
  });
};

export default NewEnhancedPrincipalDashboard;