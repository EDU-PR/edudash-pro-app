/**
 * Veterans League Dashboard - Veterans Wing Executive Overview
 * Manage veterans league members, events, programs and initiatives
 * Adapted from Youth President dashboard design
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/Card';
import { MobileNavDrawer } from '@/components/navigation/MobileNavDrawer';
import { useNotificationBadgeCount } from '@/hooks/useNotificationCount';
import { assertSupabase } from '@/lib/supabase';
import {
  DashboardBackground,
  DashboardWallpaperBackground,
  type DashboardSettings,
} from '@/components/membership/dashboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Veterans League specific stats interface
interface VeteransStats {
  totalMembers: number;
  newThisMonth: number;
  activeEvents: number;
  upcomingPrograms: number;
  pendingApprovals: number;
  totalRegions: number;
}

// Veterans League Executive Actions
const VETERANS_EXECUTIVE_ACTIONS = [
  { id: '1', label: 'Members', icon: 'people', color: '#854D0E', route: '/screens/membership/members-list' },
  { id: '2', label: 'Invite Members', icon: 'person-add', color: '#10B981', route: '/screens/membership/veterans-invite-code' },
  { id: '3', label: 'Leadership', icon: 'people-circle', color: '#8B5CF6', route: '/screens/membership/veterans-executive-invite' },
  { id: '4', label: 'Events', icon: 'calendar', color: '#06B6D4', route: '/screens/membership/events' },
  { id: '5', label: 'Programs', icon: 'school', color: '#F59E0B', route: '/screens/membership/programs' },
  { id: '6', label: 'Budget', icon: 'wallet', color: '#EF4444', route: '/screens/membership/budget-requests' },
];

// Member type filter for Veterans League
const VETERANS_MEMBER_TYPES = [
  'veterans_member', 'veterans_coordinator', 'veterans_president'
];

export default function VeteransDashboard() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const notificationCount = useNotificationBadgeCount();
  
  const [stats, setStats] = useState<VeteransStats | null>(null);
  const [recentMembers, setRecentMembers] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({});

  // Get user's member type to determine permissions
  const memberType = (profile as any)?.organization_membership?.member_type;
  const isExecutive = ['veterans_president', 'veterans_coordinator'].includes(memberType);

  // Fetch veterans league statistics
  const fetchVeteransStats = useCallback(async () => {
    try {
      const supabase = assertSupabase();
      const orgId = profile?.organization_id;
      
      if (!orgId) return;

      // Fetch veterans league members count
      const { data: members } = await supabase
        .from('organization_members')
        .select('id, created_at, member_type')
        .eq('organization_id', orgId)
        .in('member_type', VETERANS_MEMBER_TYPES);

      // Fetch pending membership approvals
      const { data: pendingApprovals } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('membership_status', 'pending')
        .in('member_type', VETERANS_MEMBER_TYPES);

      // Fetch upcoming events
      const { data: events } = await supabase
        .from('events')
        .select('id, title, start_date, location')
        .eq('organization_id', orgId)
        .gte('start_date', new Date().toISOString())
        .order('start_date', { ascending: true })
        .limit(5);

      // Calculate new members this month
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const newThisMonth = members?.filter(m => 
        new Date(m.created_at) >= monthStart
      ).length || 0;

      setStats({
        totalMembers: members?.length || 0,
        newThisMonth,
        activeEvents: events?.length || 0,
        upcomingPrograms: 0,
        pendingApprovals: pendingApprovals?.length || 0,
        totalRegions: 9,
      });

      setUpcomingEvents(events || []);

      // Get recent members
      const { data: recent } = await supabase
        .from('organization_members')
        .select('id, first_name, last_name, created_at, region_id')
        .eq('organization_id', orgId)
        .in('member_type', VETERANS_MEMBER_TYPES)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentMembers(recent || []);

    } catch (error) {
      console.error('Error fetching veterans stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    fetchVeteransStats();
  }, [fetchVeteransStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchVeteransStats();
  };

  // Loading state
  if (loading && !stats) {
    return (
      <DashboardWallpaperBackground>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#854D0E" />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading veterans league dashboard...
            </Text>
          </View>
        </SafeAreaView>
      </DashboardWallpaperBackground>
    );
  }

  return (
    <DashboardWallpaperBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
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
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                {isExecutive ? "Veterans League" : "Veterans Wing"}
              </Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {isExecutive ? 'Executive Dashboard' : 'Member Dashboard'}
              </Text>
            </View>
          </View>
          <View style={styles.headerButtons}>
            <View style={[styles.wingBadge, { backgroundColor: '#854D0E' }]}>
              <Text style={styles.wingBadgeText}>VETERANS</Text>
            </View>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => router.push('/screens/notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color="#854D0E" />
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

        <DashboardBackground settings={dashboardSettings}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#854D0E" />
            }
          >
            {/* Executive Summary Card */}
            <Card padding={20} margin={0} style={{ ...styles.summaryCard, borderLeftColor: '#854D0E' }}>
              <View style={styles.summaryHeader}>
                <View style={[styles.summaryIconContainer, { backgroundColor: '#854D0E15' }]}>
                  <Ionicons name="shield" size={28} color="#854D0E" />
                </View>
                <View style={styles.summaryInfo}>
                  <Text style={[styles.summaryTitle, { color: theme.text }]}>Veterans League Overview</Text>
                  <Text style={[styles.summarySubtitle, { color: theme.textSecondary }]}>
                    Honoring experience, building the future
                  </Text>
                </View>
              </View>
              
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: theme.text }]}>{stats?.totalMembers || 0}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Members</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: '#10B981' }]}>+{stats?.newThisMonth || 0}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>This Month</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: theme.text }]}>{stats?.activeEvents || 0}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Events</Text>
                </View>
              </View>
            </Card>

            {/* Quick Stats Cards */}
            <View style={styles.quickStatsGrid}>
              <Card padding={16} margin={0} style={styles.quickStatCard}>
                <View style={[styles.quickStatIcon, { backgroundColor: '#854D0E15' }]}>
                  <Ionicons name="person-add" size={20} color="#854D0E" />
                </View>
                <Text style={[styles.quickStatValue, { color: theme.text }]}>{stats?.pendingApprovals || 0}</Text>
                <Text style={[styles.quickStatLabel, { color: theme.textSecondary }]}>Pending</Text>
              </Card>
              
              <Card padding={16} margin={0} style={styles.quickStatCard}>
                <View style={[styles.quickStatIcon, { backgroundColor: '#8B5CF615' }]}>
                  <Ionicons name="school" size={20} color="#8B5CF6" />
                </View>
                <Text style={[styles.quickStatValue, { color: theme.text }]}>{stats?.upcomingPrograms || 0}</Text>
                <Text style={[styles.quickStatLabel, { color: theme.textSecondary }]}>Programs</Text>
              </Card>
              
              <Card padding={16} margin={0} style={styles.quickStatCard}>
                <View style={[styles.quickStatIcon, { backgroundColor: '#F59E0B15' }]}>
                  <Ionicons name="map" size={20} color="#F59E0B" />
                </View>
                <Text style={[styles.quickStatValue, { color: theme.text }]}>{stats?.totalRegions || 0}</Text>
                <Text style={[styles.quickStatLabel, { color: theme.textSecondary }]}>Regions</Text>
              </Card>
            </View>

            {/* Executive Actions (only for executives) */}
            {isExecutive && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                  {VETERANS_EXECUTIVE_ACTIONS.map((action) => (
                    <TouchableOpacity
                      key={action.id}
                      style={[styles.actionCard, { backgroundColor: theme.card }]}
                      onPress={() => {
                        // For routes that don't exist yet, show coming soon
                        if (action.route.includes('veterans-invite') || action.route.includes('veterans-executive')) {
                          Alert.alert('Coming Soon', 'Veterans League invite system is being set up.');
                        } else {
                          router.push(action.route as any);
                        }
                      }}
                    >
                      <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                        <Ionicons name={action.icon as any} size={24} color={action.color} />
                      </View>
                      <Text style={[styles.actionLabel, { color: theme.text }]}>{action.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Recent Members */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Members</Text>
                <TouchableOpacity onPress={() => router.push('/screens/membership/members-list')}>
                  <Text style={[styles.seeAll, { color: '#854D0E' }]}>See All</Text>
                </TouchableOpacity>
              </View>
              
              <Card padding={0} margin={0}>
                {recentMembers.length > 0 ? (
                  recentMembers.map((member, index) => (
                    <React.Fragment key={member.id}>
                      <View style={styles.memberItem}>
                        <View style={[styles.memberAvatar, { backgroundColor: '#854D0E15' }]}>
                          <Text style={[styles.memberInitials, { color: '#854D0E' }]}>
                            {(member.first_name?.[0] || '') + (member.last_name?.[0] || '')}
                          </Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={[styles.memberName, { color: theme.text }]}>
                            {member.first_name} {member.last_name}
                          </Text>
                          <Text style={[styles.memberDate, { color: theme.textSecondary }]}>
                            Joined {new Date(member.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                      {index < recentMembers.length - 1 && (
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={32} color={theme.textSecondary} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      No members yet
                    </Text>
                  </View>
                )}
              </Card>
            </View>

            {/* Upcoming Events */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Events</Text>
                <TouchableOpacity onPress={() => router.push('/screens/membership/events')}>
                  <Text style={[styles.seeAll, { color: '#854D0E' }]}>See All</Text>
                </TouchableOpacity>
              </View>
              
              <Card padding={0} margin={0}>
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map((event, index) => {
                    const eventDate = new Date(event.start_date);
                    return (
                      <React.Fragment key={event.id}>
                        <View style={styles.eventItem}>
                          <View style={[styles.eventDate, { backgroundColor: '#854D0E15' }]}>
                            <Text style={[styles.eventDateDay, { color: '#854D0E' }]}>
                              {eventDate.getDate()}
                            </Text>
                            <Text style={[styles.eventDateMonth, { color: '#854D0E' }]}>
                              {eventDate.toLocaleDateString('en-US', { month: 'short' })}
                            </Text>
                          </View>
                          <View style={styles.eventInfo}>
                            <Text style={[styles.eventTitle, { color: theme.text }]}>{event.title}</Text>
                            {event.location && (
                              <View style={styles.eventMeta}>
                                <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
                                <Text style={[styles.eventLocation, { color: theme.textSecondary }]}>
                                  {event.location}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        {index < upcomingEvents.length - 1 && (
                          <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="calendar-outline" size={32} color={theme.textSecondary} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      No upcoming events
                    </Text>
                  </View>
                )}
              </Card>
            </View>
          </ScrollView>
        </DashboardBackground>
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
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
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
    alignItems: 'center',
    gap: 12,
  },
  wingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  wingBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
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
    gap: 16,
  },
  summaryCard: {
    borderLeftWidth: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  summarySubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  quickStatsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickStatCard: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  quickStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  quickStatLabel: {
    fontSize: 11,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },
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
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: {
    fontSize: 16,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
  },
  memberDate: {
    fontSize: 12,
    marginTop: 2,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  eventDate: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDateDay: {
    fontSize: 18,
    fontWeight: '700',
  },
  eventDateMonth: {
    fontSize: 10,
    fontWeight: '600',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  eventLocation: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
});
