/**
 * Organization Dashboard - Regional Manager View
 * Regional command center for provincial/regional management
 * 
 * Now uses real data from useRegionalDashboard hook:
 * - Members filtered to user's region only
 * - Regional standings showing all regions for healthy competition
 * - Real pending tasks and activities from database
 */
import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
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

export default function OrganizationDashboard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Regional Dashboard',
          headerLargeTitle: true,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <View style={[styles.regionBadgeHeader, { backgroundColor: regionColor }]}>
                <Text style={styles.regionBadgeText}>RM - {regionCode}</Text>
              </View>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="notifications-outline" size={24} color={theme.primary} />
                {stats.pendingApplications > 0 && (
                  <View style={[styles.notificationBadge, { backgroundColor: '#EF4444' }]}>
                    <Text style={styles.notificationCount}>{stats.pendingApplications}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="search-outline" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <DashboardWallpaperBackground>
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

          {/* Regional Leaderboard - Healthy Competition */}
          <View style={styles.section}>
            <RegionalLeaderboard
              regions={allRegionCounts}
              currentRegionId={regionId}
              theme={theme}
              maxVisible={5}
            />
          </View>

          {/* Urgent Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Action Required</Text>
            <ActionCardsGrid actions={REGIONAL_ACTIONS} theme={theme} />
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
      </DashboardWallpaperBackground>
    </SafeAreaView>
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
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginRight: 16,
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
