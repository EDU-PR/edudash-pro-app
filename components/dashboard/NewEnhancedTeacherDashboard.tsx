/**
 * New Enhanced Teacher Dashboard - Modern UI/UX Implementation
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

import React, { useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTeacherDashboard } from '@/hooks/useDashboardData';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDashboardPreferences } from '@/contexts/DashboardPreferencesContext';
import { track } from '@/lib/analytics';
import { PendingParentLinkRequests } from './PendingParentLinkRequests';
import { TeacherMetricsCard } from './teacher/TeacherMetricsCard';
import { TeacherQuickActionCard } from './teacher/TeacherQuickActionCard';
import { useNewEnhancedTeacherState } from '@/hooks/useNewEnhancedTeacherState';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;
const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;
const containerWidth = width - (cardPadding * 2);
const cardWidth = isTablet ? (containerWidth - (cardGap * 3)) / 4 : (containerWidth - cardGap) / 2;

// Helper to get tier badge color
const getTierColor = (tier: string, theme: any): string => {
  switch (tier) {
    case 'enterprise': return '#8B5CF6'; // Purple
    case 'premium':
    case 'group_10': return '#F59E0B'; // Amber/Gold
    case 'starter':
    case 'group_5': return '#3B82F6'; // Blue
    case 'solo':
    case 'free':
    default: return theme.textSecondary; // Gray
  }
};

// Helper to format tier label for display
const getTierLabel = (tier: string): string => {
  switch (tier) {
    case 'enterprise': return 'Enterprise';
    case 'premium': return 'Premium';
    case 'group_10': return 'Group 10';
    case 'starter': return 'Starter';
    case 'group_5': return 'Group 5';
    case 'solo': return 'Solo';
    case 'free': 
    default: return 'Free';
  }
};

interface NewEnhancedTeacherDashboardProps {
  refreshTrigger?: number;
  preferences?: any;
}

export const NewEnhancedTeacherDashboard: React.FC<NewEnhancedTeacherDashboardProps> = ({ 
  refreshTrigger: _refreshTrigger, 
  preferences: _preferences 
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { preferences: dashPrefs } = useDashboardPreferences();
  const insets = useSafeAreaInsets();
  
  const styles = useMemo(() => createStyles(theme, insets.top, insets.bottom), [theme, insets.top, insets.bottom]);
  
  // Clear any stuck dashboardSwitching flag on mount to prevent loading issues after hot reload
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).dashboardSwitching) {
      console.log('[TeacherDashboard] Clearing stuck dashboardSwitching flag');
      delete (window as any).dashboardSwitching;
    }
  }, []);
  
  // State management hook
  const state = useNewEnhancedTeacherState();
  
  const {
    data: dashboardData,
    loading,
    error,
    refresh,
    isLoadingFromCache,
  } = useTeacherDashboard();

  // Build metrics and actions from state
  const metrics = state.buildMetrics(dashboardData);
  const quickActions = state.buildQuickActions();


  if (loading && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
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
            refreshing={state.refreshing}
            onRefresh={() => state.handleRefresh(refresh)}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerGradient}>
            <View style={styles.headerContent}>
              <View style={styles.greetingRow}>
                <Text style={styles.greetingEmoji}>👋</Text>
                <View style={styles.greetingTextContainer}>
                  <Text style={styles.greeting}>{state.getGreeting()}</Text>
                  <Text style={styles.subtitle}>{t('teacher.dashboard_subtitle')}</Text>
                </View>
              </View>
              
              {/* School info with tier badge */}
              {dashboardData?.schoolName && (
                <View style={styles.schoolCard}>
                  <View style={styles.schoolIconContainer}>
                    <Text style={styles.schoolIcon}>🏫</Text>
                  </View>
                  <View style={styles.schoolTextContainer}>
                    <Text style={styles.schoolLabel}>{t('teacher.your_school', { defaultValue: 'Your School' })}</Text>
                    <Text style={styles.schoolName}>{dashboardData.schoolName}</Text>
                  </View>
                  {dashboardData?.schoolTier && (
                    <View style={[styles.tierBadge, { backgroundColor: getTierColor(dashboardData.schoolTier, theme) }]}>
                      <Text style={styles.tierBadgeText}>
                        {getTierLabel(dashboardData.schoolTier)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Metrics Grid */}
        <View style={styles.section}>
          <View style={[styles.sectionTitleChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
            <Text style={styles.sectionTitle}>{t('dashboard.overview')}</Text>
          </View>
          <View style={styles.metricsGrid}>
            {metrics.map((metric, index) => (
              <TeacherMetricsCard
                key={index}
                title={metric.title}
                value={metric.value}
                icon={metric.icon}
                color={metric.color}
                trend={metric.trend}
                onPress={() => {
                  track('teacher.dashboard.metric_clicked', { metric: metric.title });
                }}
              />
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={[styles.sectionTitleChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
            <Text style={styles.sectionTitle}>{t('dashboard.quick_actions')}</Text>
          </View>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <TeacherQuickActionCard
                key={index}
                title={action.title}
                icon={action.icon}
                color={action.color}
                onPress={action.onPress}
                disabled={action.disabled}
                subtitle={action.disabled ? t('dashboard.upgrade_required') : undefined}
              />
            ))}
          </View>
        </View>

        {/* Parent Link Requests Widget */}
        <View style={styles.section}>
          <PendingParentLinkRequests />
        </View>

      </ScrollView>
    </View>
  );
};

const createStyles = (theme: any, _topInset: number, bottomInset: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20, // Fixed padding - DesktopLayout handles safe area for header
    paddingHorizontal: cardPadding,
    paddingBottom: 20, // Just scroll breathing room - BottomTabBar handles its own safe area
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
  headerCard: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  headerGradient: {
    padding: isTablet ? 24 : 18,
    backgroundColor: theme.primary + '10',
  },
  headerContent: {
    gap: 16,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  greetingEmoji: {
    fontSize: isTablet ? 40 : 32,
    marginTop: 2,
  },
  greetingTextContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: isTablet ? 28 : isSmallScreen ? 22 : 24,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: isTablet ? 16 : isSmallScreen ? 13 : 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  schoolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  schoolIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: theme.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  schoolIcon: {
    fontSize: 20,
  },
  schoolTextContainer: {
    flex: 1,
  },
  schoolLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  schoolName: {
    fontSize: isTablet ? 16 : 14,
    color: theme.text,
    fontWeight: '600',
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: isTablet ? 22 : isSmallScreen ? 18 : 20,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  sectionTitleChip: {
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
    marginBottom: 10,
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
});