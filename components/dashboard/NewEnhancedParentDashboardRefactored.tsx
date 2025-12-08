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
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import Feedback from '@/lib/feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { track } from '@/lib/analytics';
import { useNotificationsWithFocus } from '@/hooks/useNotifications';
import { useParentDashboard } from '@/hooks/useDashboardData';

// Import shared components
import { MetricCard, CollapsibleSection, SearchBar, type SearchBarSuggestion } from './shared';
import { ChildSwitcher } from './parent';
import { JoinLiveLesson } from '@/components/calls/JoinLiveLesson';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;
const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;

interface NewEnhancedParentDashboardProps {
  refreshTrigger?: number;
}

export const NewEnhancedParentDashboard: React.FC<NewEnhancedParentDashboardProps> = ({ 
  refreshTrigger
}) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { tier } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const insets = useSafeAreaInsets();
  
  const styles = useMemo(() => createStyles(theme, insets.top, insets.bottom), [theme, insets.top, insets.bottom]);
  
  // Main parent dashboard data hook
  const {
    data: dashboardData,
    loading,
    refresh,
  } = useParentDashboard();
  
  // Unified notification hook - auto-refreshes on screen focus
  const { messages: unreadMessageCount, calls: missedCallsCount } = useNotificationsWithFocus();

  // Clear any stuck dashboardSwitching flag on mount to prevent loading issues after hot reload
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).dashboardSwitching) {
      console.log('[ParentDashboard] Clearing stuck dashboardSwitching flag');
      delete (window as any).dashboardSwitching;
    }
  }, []);

  // Update children state when dashboard data changes
  useEffect(() => {
    if (dashboardData?.children) {
      setChildren(dashboardData.children);
      if (!activeChildId && dashboardData.children.length > 0) {
        setActiveChildId(dashboardData.children[0].id);
      }
    }
  }, [dashboardData?.children, activeChildId]);

  const getGreeting = (): string => {
    const hour = new Date().getHours();
    const parentName = profile?.first_name || user?.user_metadata?.first_name || 'Parent';
    if (hour < 12) return t('dashboard.good_morning', { defaultValue: 'Good morning' }) + ', ' + parentName;
    if (hour < 18) return t('dashboard.good_afternoon', { defaultValue: 'Good afternoon' }) + ', ' + parentName;
    return t('dashboard.good_evening', { defaultValue: 'Good evening' }) + ', ' + parentName;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      try { await Feedback.vibrate(10); } catch { /* ignore */ }
    } catch (_error) {
      logger.error('Dashboard refresh failed:', _error);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  const handleQuickAction = (action: string) => {
    track('parent.dashboard.quick_action', { action, layout: 'enhanced' });
    
    switch (action) {
      case 'view_homework':
        router.push('/screens/homework');
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
        router.push('/screens/dash-assistant');
        break;
      case 'children':
        // Show children list or scroll to child switcher
        // For now, could navigate to profile or show modal
        router.push('/screens/account');
        break;
      case 'calls':
        router.push('/screens/calls');
        break;
      default:
        Alert.alert(
          t('common.coming_soon', { defaultValue: 'Coming Soon' }), 
          t('dashboard.feature_coming_soon', { defaultValue: 'This feature is coming soon!' })
        );
    }
  };

  // Search suggestions for PWA-style search
  const searchSuggestions: SearchBarSuggestion[] = useMemo(() => [
    { id: 'homework', label: t('parent.view_homework', { defaultValue: 'View Homework' }), icon: 'book' },
    { id: 'messages', label: t('parent.messages', { defaultValue: 'Messages' }), icon: 'chatbubbles' },
    { id: 'attendance', label: t('parent.check_attendance', { defaultValue: 'Check Attendance' }), icon: 'calendar' },
    { id: 'grades', label: t('parent.view_grades', { defaultValue: 'View Grades' }), icon: 'school' },
  ], [t]);

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
      },
    ];
  }, [dashboardData, unreadMessageCount, missedCallsCount, theme, t]);

  // Quick actions - enhanced with more AI features
  const quickActions = useMemo(() => [
    { id: 'view_homework', title: t('parent.view_homework', { defaultValue: 'View Homework' }), icon: 'book', color: theme.primary },
    { id: 'check_attendance', title: t('parent.check_attendance', { defaultValue: 'Check Attendance' }), icon: 'calendar', color: theme.success },
    { id: 'view_grades', title: t('parent.view_grades', { defaultValue: 'View Grades' }), icon: 'school', color: theme.secondary },
    { id: 'messages', title: t('parent.messages', { defaultValue: 'Messages' }), icon: 'chatbubbles', color: theme.info },
    { id: 'events', title: t('parent.events', { defaultValue: 'Events' }), icon: 'calendar-outline', color: theme.warning },
    { id: 'calls', title: t('parent.calls', { defaultValue: 'Calls' }), icon: 'call', color: '#10B981' },
    { id: 'ask_dash', title: t('parent.ask_dash', { defaultValue: 'Ask Dash AI' }), icon: 'sparkles', color: '#8B5CF6' },
    { id: 'ai_homework_help', title: t('parent.ai_homework_help', { defaultValue: 'AI Homework Help' }), icon: 'bulb', color: '#F59E0B', disabled: tier === 'free' },
  ], [t, theme, tier]);

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
                { backgroundColor: tier === 'free' ? theme.textSecondary + '20' : theme.success + '20' }
              ]}>
                <Text style={[
                  styles.tierBadgeText, 
                  { color: tier === 'free' ? theme.textSecondary : theme.success }
                ]}>
                  {tier === 'free' ? t('subscription.free', { defaultValue: 'Free' }) :
                   tier === 'parent-starter' || tier === 'parent_starter' ? t('subscription.starter', { defaultValue: 'Starter' }) :
                   tier === 'parent-plus' || tier === 'parent_plus' ? t('subscription.plus', { defaultValue: 'Plus' }) :
                   tier === 'trial' ? t('subscription.trial', { defaultValue: 'Trial' }) :
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

        {/* Metrics Grid */}
        <CollapsibleSection 
          title={t('dashboard.overview', { defaultValue: 'Overview' })}
          sectionId="overview"
          icon="📊"
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
          defaultCollapsed={collapsedSections.has('quick-actions')}
          onToggle={toggleSection}
        >
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <MetricCard
                key={action.id}
                title={action.title}
                value=""
                icon={action.icon}
                color={action.color}
                size="small"
                onPress={() => !action.disabled && handleQuickAction(action.id)}
              />
            ))}
          </View>
        </CollapsibleSection>

        {/* Live Classes - Show if user has preschool_id */}
        {profile?.preschool_id && (
          <CollapsibleSection 
            title={t('calls.live_classes', { defaultValue: 'Live Classes' })}
            sectionId="live-classes"
            icon="videocam"
            defaultCollapsed={collapsedSections.has('live-classes')}
            onToggle={toggleSection}
          >
            <JoinLiveLesson 
              preschoolId={profile.preschool_id}
            />
          </CollapsibleSection>
        )}
      </ScrollView>
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
});

export default NewEnhancedParentDashboard;
