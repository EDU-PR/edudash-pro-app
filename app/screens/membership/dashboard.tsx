/**
 * Organization Dashboard - National Admin View
 * Central command center for organization management
 */
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Mock data - replace with actual API calls
const MOCK_STATS = {
  totalMembers: 2847,
  activeMembers: 2654,
  newThisMonth: 127,
  regions: 9,
  pendingApprovals: 23,
  totalRevenue: 847500,
  outstandingPayments: 45200,
  upcomingEvents: 8,
};

const MOCK_REGIONS = [
  { id: '1', name: 'Gauteng', code: 'GP', members: 892, growth: 12.5, color: '#3B82F6' },
  { id: '2', name: 'Western Cape', code: 'WC', members: 567, growth: 8.3, color: '#10B981' },
  { id: '3', name: 'KwaZulu-Natal', code: 'KZN', members: 445, growth: 15.2, color: '#F59E0B' },
  { id: '4', name: 'Eastern Cape', code: 'EC', members: 312, growth: 6.7, color: '#EF4444' },
  { id: '5', name: 'Mpumalanga', code: 'MP', members: 234, growth: 9.1, color: '#8B5CF6' },
  { id: '6', name: 'Limpopo', code: 'LP', members: 189, growth: 11.4, color: '#EC4899' },
  { id: '7', name: 'Free State', code: 'FS', members: 156, growth: 4.2, color: '#06B6D4' },
  { id: '8', name: 'North West', code: 'NW', members: 98, growth: 7.8, color: '#84CC16' },
  { id: '9', name: 'Northern Cape', code: 'NC', members: 54, growth: 3.1, color: '#F97316' },
];

const QUICK_ACTIONS = [
  { id: 'members', icon: 'people', label: 'Members', route: '/screens/membership/members', color: '#3B82F6' },
  { id: 'regions', icon: 'map', label: 'Regions', route: '/screens/membership/regions', color: '#10B981' },
  { id: 'finance', icon: 'wallet', label: 'Finance', route: '/screens/membership/finance', color: '#F59E0B' },
  { id: 'resources', icon: 'folder', label: 'Resources', route: '/screens/membership/resources', color: '#8B5CF6' },
  { id: 'events', icon: 'calendar', label: 'Events', route: '/screens/membership/events', color: '#EC4899' },
  { id: 'reports', icon: 'bar-chart', label: 'Reports', route: '/screens/membership/reports', color: '#06B6D4' },
];

export default function OrganizationDashboard() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    // Fetch latest data
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return `R ${amount.toLocaleString('en-ZA')}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Organization Dashboard',
          headerLargeTitle: true,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="notifications-outline" size={24} color={theme.primary} />
                <View style={[styles.notificationBadge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.notificationCount}>{MOCK_STATS.pendingApprovals}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="settings-outline" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Hero Stats Card */}
        <LinearGradient
          colors={['#1E40AF', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroHeader}>
            <Text style={styles.heroTitle}>SOIL OF AFRICA</Text>
            <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#10B981" />
              <Text style={styles.heroBadgeText}>Active</Text>
            </View>
          </View>
          
          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{MOCK_STATS.totalMembers.toLocaleString()}</Text>
              <Text style={styles.heroStatLabel}>Total Members</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{MOCK_STATS.regions}</Text>
              <Text style={styles.heroStatLabel}>Regions</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>+{MOCK_STATS.newThisMonth}</Text>
              <Text style={styles.heroStatLabel}>This Month</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action) => (
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

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Key Metrics</Text>
          <View style={styles.metricsRow}>
            <Card padding={16} margin={0} style={{ ...styles.metricCard, flex: 1 }}>
              <View style={[styles.metricIcon, { backgroundColor: '#10B98115' }]}>
                <Ionicons name="cash-outline" size={20} color="#10B981" />
              </View>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {formatCurrency(MOCK_STATS.totalRevenue)}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                Total Revenue
              </Text>
              <View style={styles.metricTrend}>
                <Ionicons name="trending-up" size={14} color="#10B981" />
                <Text style={[styles.metricTrendText, { color: '#10B981' }]}>+12.5%</Text>
              </View>
            </Card>

            <Card padding={16} margin={0} style={{ ...styles.metricCard, flex: 1 }}>
              <View style={[styles.metricIcon, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="time-outline" size={20} color="#F59E0B" />
              </View>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {formatCurrency(MOCK_STATS.outstandingPayments)}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                Outstanding
              </Text>
              <View style={styles.metricTrend}>
                <Ionicons name="trending-down" size={14} color="#EF4444" />
                <Text style={[styles.metricTrendText, { color: '#EF4444' }]}>-8.2%</Text>
              </View>
            </Card>
          </View>
        </View>

        {/* Regions Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Regional Performance</Text>
            <TouchableOpacity>
              <Text style={[styles.seeAll, { color: theme.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {MOCK_REGIONS.slice(0, 5).map((region, index) => (
            <TouchableOpacity 
              key={region.id}
              style={[styles.regionCard, { backgroundColor: theme.card }]}
            >
              <View style={styles.regionLeft}>
                <View style={[styles.regionBadge, { backgroundColor: region.color + '20' }]}>
                  <Text style={[styles.regionCode, { color: region.color }]}>{region.code}</Text>
                </View>
                <View style={styles.regionInfo}>
                  <Text style={[styles.regionName, { color: theme.text }]}>{region.name}</Text>
                  <Text style={[styles.regionMembers, { color: theme.textSecondary }]}>
                    {region.members.toLocaleString()} members
                  </Text>
                </View>
              </View>
              <View style={styles.regionRight}>
                <View style={styles.growthBadge}>
                  <Ionicons 
                    name={region.growth > 0 ? 'trending-up' : 'trending-down'} 
                    size={14} 
                    color={region.growth > 0 ? '#10B981' : '#EF4444'} 
                  />
                  <Text style={[
                    styles.growthText, 
                    { color: region.growth > 0 ? '#10B981' : '#EF4444' }
                  ]}>
                    {region.growth > 0 ? '+' : ''}{region.growth}%
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pending Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Pending Actions</Text>
          
          <Card padding={16} margin={0} style={styles.pendingCard}>
            <TouchableOpacity style={styles.pendingItem}>
              <View style={[styles.pendingIcon, { backgroundColor: '#EF444415' }]}>
                <Ionicons name="person-add-outline" size={20} color="#EF4444" />
              </View>
              <View style={styles.pendingInfo}>
                <Text style={[styles.pendingTitle, { color: theme.text }]}>
                  Membership Approvals
                </Text>
                <Text style={[styles.pendingSubtitle, { color: theme.textSecondary }]}>
                  {MOCK_STATS.pendingApprovals} pending applications
                </Text>
              </View>
              <View style={[styles.pendingBadge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.pendingBadgeText}>{MOCK_STATS.pendingApprovals}</Text>
              </View>
            </TouchableOpacity>
            
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            
            <TouchableOpacity style={styles.pendingItem}>
              <View style={[styles.pendingIcon, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="card-outline" size={20} color="#F59E0B" />
              </View>
              <View style={styles.pendingInfo}>
                <Text style={[styles.pendingTitle, { color: theme.text }]}>
                  ID Card Requests
                </Text>
                <Text style={[styles.pendingSubtitle, { color: theme.textSecondary }]}>
                  12 cards ready for printing
                </Text>
              </View>
              <View style={[styles.pendingBadge, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.pendingBadgeText}>12</Text>
              </View>
            </TouchableOpacity>
            
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            
            <TouchableOpacity style={styles.pendingItem}>
              <View style={[styles.pendingIcon, { backgroundColor: '#3B82F615' }]}>
                <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
              </View>
              <View style={styles.pendingInfo}>
                <Text style={[styles.pendingTitle, { color: theme.text }]}>
                  Upcoming Events
                </Text>
                <Text style={[styles.pendingSubtitle, { color: theme.textSecondary }]}>
                  {MOCK_STATS.upcomingEvents} events this week
                </Text>
              </View>
              <View style={[styles.pendingBadge, { backgroundColor: '#3B82F6' }]}>
                <Text style={styles.pendingBadgeText}>{MOCK_STATS.upcomingEvents}</Text>
              </View>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={[styles.seeAll, { color: theme.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <Card padding={0} margin={0}>
            {[
              { icon: 'person-add', color: '#10B981', title: 'New member joined', subtitle: 'Thabo Mokoena • Gauteng', time: '5 min ago' },
              { icon: 'card', color: '#3B82F6', title: 'ID Card printed', subtitle: 'Sarah Johnson • Western Cape', time: '15 min ago' },
              { icon: 'cash', color: '#F59E0B', title: 'Payment received', subtitle: 'R 450.00 • Membership fee', time: '1 hour ago' },
              { icon: 'calendar', color: '#8B5CF6', title: 'Event created', subtitle: 'Regional Workshop • KZN', time: '2 hours ago' },
            ].map((activity, index) => (
              <View key={index}>
                <View style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: activity.color + '15' }]}>
                    <Ionicons name={activity.icon as any} size={18} color={activity.color} />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={[styles.activityTitle, { color: theme.text }]}>{activity.title}</Text>
                    <Text style={[styles.activitySubtitle, { color: theme.textSecondary }]}>{activity.subtitle}</Text>
                  </View>
                  <Text style={[styles.activityTime, { color: theme.textSecondary }]}>{activity.time}</Text>
                </View>
                {index < 3 && <View style={[styles.activityDivider, { backgroundColor: theme.border }]} />}
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginRight: 16,
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
  
  // Hero Card
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  heroStatItem: {
    alignItems: 'center',
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // Section
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

  // Quick Actions
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (SCREEN_WIDTH - 44) / 3,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    borderRadius: 16,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  metricTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  metricTrendText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Regions
  regionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  regionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  regionBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionCode: {
    fontSize: 14,
    fontWeight: '700',
  },
  regionInfo: {},
  regionName: {
    fontSize: 15,
    fontWeight: '600',
  },
  regionMembers: {
    fontSize: 12,
    marginTop: 2,
  },
  regionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  growthText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Pending
  pendingCard: {
    borderRadius: 16,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  pendingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingInfo: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  pendingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  pendingBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pendingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
  },

  // Activity
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  activitySubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 11,
  },
  activityDivider: {
    height: 1,
    marginLeft: 62,
  },
});
