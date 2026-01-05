/**
 * Organization Dashboard - Regional Manager View
 * Regional command center for provincial/regional management
 * 
 * Now uses real data from useRegionalDashboard hook:
 * - Members filtered to user's region only
 * - Regional standings showing all regions for healthy competition
 * - Real pending tasks and activities from database
 */
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { MobileNavDrawer } from '@/components/navigation/MobileNavDrawer';
import { useNotificationBadgeCount } from '@/hooks/useNotificationCount';
import { DashboardWallpaperBackground } from '@/components/membership/dashboard';
import { useRegionalDashboard } from '@/hooks/useRegionalDashboard';

// Modular components
import {
  RegionalHero,
  ActionCardsGrid,
  TaskItemList,
  LegacyActivityList,
  QuickStatsRow,
  RegionalLeaderboard,
  REGIONAL_ACTIONS,
  type QuickStat,
  type TaskItem,
  type LegacyActivityItem,
} from '@/components/membership/regional-dashboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Regional Manager Quick Actions
const REGIONAL_QUICK_ACTIONS = [
  { id: '1', label: 'Members', icon: 'people', color: '#3B82F6', route: '/screens/membership/members-list' },
  { id: '2', label: 'Invite Members', icon: 'person-add', color: '#10B981', route: '/screens/membership/regional-invite-code' },
  { id: '3', label: 'Approvals', icon: 'checkmark-circle', color: '#F59E0B', route: '/screens/membership/pending-approvals' },
  { id: '4', label: 'Events', icon: 'calendar', color: '#06B6D4', route: '/screens/membership/events' },
  { id: '5', label: 'Reports', icon: 'bar-chart', color: '#8B5CF6', route: '/screens/membership/reports' },
  { id: '6', label: 'Documents', icon: 'document-text', color: '#EF4444', route: '/screens/membership/documents' },
];

export default function OrganizationDashboard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const notificationCount = useNotificationBadgeCount();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Use the new hook for real data
  const {
    regionId,
    regionName,
    regionCode,
    regionColor,
    members,
    stats,
    allRegionCounts,
    pendingTasks,
    recentActivities,
    loading,
    error,
    refresh,
  } = useRegionalDashboard();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Convert pending tasks to TaskItem format
  const tasksForDisplay: TaskItem[] = pendingTasks.map(task => ({
    task: task.title,
    icon: task.icon,
    color: task.color,
    urgent: task.urgent,
  }));

  // Convert activities to legacy format
  const activitiesForDisplay: LegacyActivityItem[] = recentActivities.map(activity => ({
    icon: activity.icon,
    color: activity.color,
    title: activity.title,
    subtitle: activity.subtitle,
    time: activity.time,
  }));

  // Quick stats from real data
  const quickStats: QuickStat[] = [
    { 
      id: 'members', 
      icon: 'people', 
      value: String(stats.regionMembers), 
      label: 'Total Members', 
      color: regionColor 
    },
    { 
      id: 'active', 
      icon: 'checkmark-circle', 
      value: String(stats.activeMembers), 
      label: 'Active', 
      color: '#10B981',
      valueColor: '#10B981' 
    },
    { 
      id: 'new', 
      icon: 'trending-up', 
      value: `+${stats.newMembersThisMonth}`, 
      label: 'This Month', 
      color: '#3B82F6' 
    },
  ];

  // Regional stats for hero card
  const heroStats = {
    regionMembers: stats.regionMembers,
    activeBranches: 0, // Not tracking branches yet
    newMembersThisMonth: stats.newMembersThisMonth,
    pendingApplications: stats.pendingApplications,
    regionRevenue: stats.regionRevenue,
    regionGrowth: 0, // Calculate from historical data later
    idCardsIssued: stats.idCardsIssued,
    upcomingEvents: 0,
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading your region...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={[styles.errorTitle, { color: theme.text }]}>Unable to Load Dashboard</Text>
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={refresh}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <DashboardWallpaperBackground>
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]} edges={['top']}>
        {/* Mobile Navigation Drawer */}
        <MobileNavDrawer 
          isOpen={isDrawerOpen} 
          onClose={() => setIsDrawerOpen(false)} 
        />

        {/* Custom Header */}
        <View style={[styles.customHeader, { backgroundColor: theme.card + 'E6' }]}>
          <View style={styles.headerLeftSection}>
            <TouchableOpacity 
              style={styles.hamburgerButton}
              onPress={() => setIsDrawerOpen(true)}
            >
              <Ionicons name="menu" size={26} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.headerLeft}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Regional Manager</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{regionName || 'Your Region'}</Text>
            </View>
          </View>
          <View style={styles.headerButtons}>
            <View style={[styles.regionBadgeHeader, { backgroundColor: regionColor || '#3B82F6' }]}>
              <Text style={styles.regionBadgeText}>RM - {regionCode || 'REG'}</Text>
            </View>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => router.push('/screens/notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={theme.primary} />
              {notificationCount > 0 && (
                <View style={[styles.notificationBadge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.notificationCount}>
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
          {/* Region Header Card */}
          <RegionalHero
            regionName={regionName}
            regionCode={regionCode}
            regionColor={regionColor}
            stats={heroStats}
          />

          {/* Quick Actions Grid */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {REGIONAL_QUICK_ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[styles.actionCard, { backgroundColor: theme.card }]}
                  onPress={() => router.push(action.route as any)}
                >
                  <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                    <Ionicons name={action.icon as any} size={24} color={action.color} />
                  </View>
                  <Text style={[styles.actionLabel, { color: theme.text }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Regional Leaderboard - Healthy Competition */}
          <View style={styles.section}>
            <RegionalLeaderboard
              regions={allRegionCounts}
              currentRegionId={regionId}
              theme={theme}
              maxVisible={5}
            />
          </View>

          {/* Pending Tasks */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Pending Tasks</Text>
            <TaskItemList tasks={tasksForDisplay} theme={theme} />
          </View>

          {/* Quick Stats Row */}
          <View style={styles.section}>
            <QuickStatsRow stats={quickStats} theme={theme} />
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
              <TouchableOpacity onPress={() => router.push('/screens/membership/members-list')}>
                <Text style={[styles.seeAll, { color: theme.primary }]}>View All Members</Text>
              </TouchableOpacity>
            </View>
            {activitiesForDisplay.length > 0 ? (
              <LegacyActivityList activities={activitiesForDisplay} theme={theme} />
            ) : (
              <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
                <Ionicons name="time-outline" size={32} color={theme.textSecondary} />
                <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                  No recent activity in your region
                </Text>
              </View>
            )}
          </View>

          {/* Members Summary */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Your Region Members ({members.length})
              </Text>
              <TouchableOpacity onPress={() => router.push('/screens/membership/members-list')}>
                <Text style={[styles.seeAll, { color: theme.primary }]}>Manage</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.membersSummary, { backgroundColor: theme.card }]}>
              <View style={styles.memberStat}>
                <Text style={[styles.memberStatValue, { color: theme.text }]}>{stats.activeMembers}</Text>
                <Text style={[styles.memberStatLabel, { color: theme.textSecondary }]}>Active</Text>
              </View>
              <View style={[styles.memberStatDivider, { backgroundColor: theme.border }]} />
              <View style={styles.memberStat}>
                <Text style={[styles.memberStatValue, { color: '#F59E0B' }]}>{stats.pendingApplications}</Text>
                <Text style={[styles.memberStatLabel, { color: theme.textSecondary }]}>Pending</Text>
              </View>
              <View style={[styles.memberStatDivider, { backgroundColor: theme.border }]} />
              <View style={styles.memberStat}>
                <Text style={[styles.memberStatValue, { color: '#10B981' }]}>+{stats.newMembersThisMonth}</Text>
                <Text style={[styles.memberStatLabel, { color: theme.textSecondary }]}>This Month</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </DashboardWallpaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Custom Header styles
  customHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hamburgerButton: {
    padding: 4,
  },
  headerLeft: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  regionBadgeHeader: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  regionBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationCount: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Quick Actions Grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (SCREEN_WIDTH - 56) / 3,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
  },
  membersSummary: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
  },
  memberStat: {
    flex: 1,
    alignItems: 'center',
  },
  memberStatValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  memberStatLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  memberStatDivider: {
    width: 1,
    marginHorizontal: 8,
  },
});
