/**
 * Youth Secretary Dashboard - Youth Wing Secretary Overview
 * Manage documentation, communications, meeting minutes, and administrative tasks
 * Tailored from Youth President dashboard but focused on secretary responsibilities
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
  DashboardWallpaperSettings,
  type DashboardSettings,
} from '@/components/membership/dashboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Youth Secretary specific stats interface
interface SecretaryStats {
  totalMembers: number;
  newThisMonth: number;
  pendingDocuments: number;
  upcomingMeetings: number;
  pendingApprovals: number;
  totalRegions: number;
}

// Youth Secretary Actions - Focused on documentation and administration
const YOUTH_SECRETARY_ACTIONS = [
  { id: '1', label: 'Members', icon: 'people', color: '#3B82F6', route: '/screens/membership/members-list' },
  { id: '2', label: 'Documents', icon: 'document-text', color: '#8B5CF6', route: '/screens/membership/documents' },
  { id: '3', label: 'Meeting Minutes', icon: 'clipboard', color: '#10B981', route: '/screens/membership/documents' },
  { id: '4', label: 'Events', icon: 'calendar', color: '#06B6D4', route: '/screens/membership/events' },
  { id: '5', label: 'Communications', icon: 'chatbubbles', color: '#F59E0B', route: '/screens/membership/broadcast' },
  { id: '6', label: 'Approvals', icon: 'checkmark-circle', color: '#EF4444', route: '/screens/membership/pending-approvals' },
];

export default function YouthSecretaryDashboard() {
  const { theme } = useTheme();
  const { profile, user } = useAuth();
  const insets = useSafeAreaInsets();
  const notificationCount = useNotificationBadgeCount();

  // Route guard: Ensure only youth_secretary can access this dashboard
  React.useEffect(() => {
    const memberType = (profile as any)?.organization_membership?.member_type;
    if (profile && memberType !== 'youth_secretary') {
      console.log('[YouthSecretaryDashboard] Access denied - member_type:', memberType, '- redirecting to correct dashboard');
      // Redirect to appropriate dashboard based on member_type
      if (memberType === 'youth_president' || memberType === 'youth_deputy' || memberType === 'youth_treasurer') {
        router.replace('/screens/membership/youth-president-dashboard');
      } else if (memberType?.startsWith('youth_')) {
        router.replace('/screens/membership/youth-president-dashboard');
      } else {
        // Fallback to parent dashboard if not a youth member
        router.replace('/screens/parent-dashboard');
      }
    }
  }, [profile]);
  
  const [stats, setStats] = useState<SecretaryStats | null>(null);
  const [recentMembers, setRecentMembers] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [pendingBudgetCount, setPendingBudgetCount] = useState(0);
  const [pendingEventProposalsCount, setPendingEventProposalsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showWallpaperSettings, setShowWallpaperSettings] = useState(false);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({});

  // Fetch youth wing statistics
  const fetchSecretaryStats = useCallback(async () => {
    try {
      const supabase = assertSupabase();
      const orgId = profile?.organization_id;
      
      if (!orgId) return;

      // Fetch youth wing members count
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('id, created_at, member_type, wing')
        .eq('organization_id', orgId)
        .or('wing.eq.youth,member_type.ilike.youth%,member_type.eq.learner,member_type.eq.regional_manager')
        .neq('user_id', user?.id || ''); // Exclude self

      // Fetch pending membership approvals
      const { data: pendingApprovals } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', orgId)
        .eq('membership_status', 'pending');

      // Fetch upcoming events
      const { data: events } = await supabase
        .from('events')
        .select('id, title, start_date, location')
        .eq('organization_id', orgId)
        .gte('start_date', new Date().toISOString())
        .order('start_date', { ascending: true })
        .limit(5);

      // Fetch pending budget requests
      const { count: pendingBudgetCount } = await supabase
        .from('organization_budgets')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('status', ['pending', 'proposed', 'draft', 'frozen']);

      // Fetch pending event proposals
      const { count: pendingEventProposalsCount } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('status', ['pending', 'proposed', 'draft']);

      setPendingBudgetCount(pendingBudgetCount || 0);
      setPendingEventProposalsCount(pendingEventProposalsCount || 0);

      // Calculate new members this month
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const newThisMonth = members?.filter(m => 
        new Date(m.created_at) >= monthStart
      ).length || 0;

      // Fetch regions count
      const { count: regionsCount } = await supabase
        .from('organization_regions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_active', true);

      setStats({
        totalMembers: members?.length || 0,
        newThisMonth,
        pendingDocuments: 0, // TODO: Implement document tracking
        upcomingMeetings: events?.length || 0,
        pendingApprovals: pendingApprovals?.length || 0,
        totalRegions: regionsCount || 0,
      });

      setUpcomingEvents(events || []);

      // Get recent members (exclude self)
      const { data: recent } = await supabase
        .from('organization_members')
        .select('id, first_name, last_name, created_at, region_id, member_type')
        .eq('organization_id', orgId)
        .neq('user_id', user?.id || '')
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentMembers(recent || []);

    } catch (error) {
      console.error('Error fetching secretary stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.organization_id, user?.id]);

  useEffect(() => {
    fetchSecretaryStats();
  }, [fetchSecretaryStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSecretaryStats();
  };

  const handleApprovalPress = (type: string) => {
    if (type === 'members') {
      router.push('/screens/membership/pending-approvals');
    } else {
      Alert.alert('Coming Soon', 'This feature will be available soon.');
    }
  };

  // Loading state
  if (loading && !stats) {
    return (
      <DashboardWallpaperBackground>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading secretary dashboard...
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
            <Text style={[styles.headerTitle, { color: theme.text }]}>Youth Secretary</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Administrative Dashboard</Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <View style={styles.youthBadge}>
            <Text style={styles.youthBadgeText}>SECRETARY</Text>
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

      <DashboardBackground settings={dashboardSettings}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
          {/* Executive Summary Card */}
          <Card padding={20} margin={0} style={{ ...styles.summaryCard, borderLeftColor: '#3B82F6' }}>
            <View style={styles.summaryHeader}>
              <View style={[styles.summaryIconContainer, { backgroundColor: '#3B82F615' }]}>
                <Ionicons name="document-text" size={28} color="#3B82F6" />
              </View>
              <View style={styles.summaryInfo}>
                <Text style={[styles.summaryTitle, { color: theme.text }]}>Secretary Overview</Text>
                <Text style={[styles.summarySubtitle, { color: theme.textSecondary }]}>
                  Manage documentation and administration
                </Text>
              </View>
            </View>
          </Card>

          {/* Quick Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Ionicons name="people" size={24} color="#3B82F6" />
              <Text style={[styles.statValue, { color: theme.text }]}>{stats?.totalMembers || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Members</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Ionicons name="person-add" size={24} color="#10B981" />
              <Text style={[styles.statValue, { color: theme.text }]}>{stats?.newThisMonth || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>New This Month</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Ionicons name="checkmark-circle" size={24} color="#F59E0B" />
              <Text style={[styles.statValue, { color: theme.text }]}>
                {(stats?.pendingApprovals || 0) + pendingBudgetCount + pendingEventProposalsCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pending Approvals</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.card }]}>
              <Ionicons name="calendar" size={24} color="#06B6D4" />
              <Text style={[styles.statValue, { color: theme.text }]}>{stats?.upcomingMeetings || 0}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Upcoming Events</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {YOUTH_SECRETARY_ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[styles.actionCard, { backgroundColor: theme.card }]}
                  onPress={() => router.push(action.route as any)}
                >
                  <View style={[styles.actionIconContainer, { backgroundColor: action.color + '20' }]}>
                    <Ionicons name={action.icon as any} size={24} color={action.color} />
                  </View>
                  <Text style={[styles.actionLabel, { color: theme.text }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Pending Approvals */}
          {((stats?.pendingApprovals || 0) + pendingBudgetCount + pendingEventProposalsCount) > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Pending Approvals</Text>
                <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.badgeText}>
                    {(stats?.pendingApprovals || 0) + pendingBudgetCount + pendingEventProposalsCount}
                  </Text>
                </View>
              </View>
              <View style={styles.approvalList}>
                {[
                  { icon: 'person-add', color: '#3B82F6', title: 'Membership Applications', description: `${stats?.pendingApprovals || 0} youth members awaiting approval`, type: 'members', count: stats?.pendingApprovals || 0 },
                  { icon: 'cash', color: '#F59E0B', title: 'Budget Requests', description: `${pendingBudgetCount} budget ${pendingBudgetCount === 1 ? 'request' : 'requests'} pending approval`, type: 'budget', count: pendingBudgetCount },
                  { icon: 'calendar', color: '#10B981', title: 'Event Proposals', description: `${pendingEventProposalsCount} event ${pendingEventProposalsCount === 1 ? 'proposal' : 'proposals'} awaiting approval`, type: 'events', count: pendingEventProposalsCount },
                ]
                  .filter(item => item.count > 0)
                  .map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.approvalCard, { backgroundColor: theme.card }]}
                      onPress={() => handleApprovalPress(item.type)}
                    >
                      <View style={[styles.approvalIcon, { backgroundColor: item.color + '20' }]}>
                        <Ionicons name={item.icon as any} size={20} color={item.color} />
                      </View>
                      <View style={styles.approvalContent}>
                        <Text style={[styles.approvalTitle, { color: theme.text }]}>{item.title}</Text>
                        <Text style={[styles.approvalDescription, { color: theme.textSecondary }]}>{item.description}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
          )}

          {/* Recent Members */}
          {recentMembers.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Members</Text>
              {recentMembers.map((member, index) => (
                <View key={member.id || index} style={[styles.memberCard, { backgroundColor: theme.card }]}>
                  <View style={[styles.memberAvatar, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={[styles.memberInitials, { color: theme.primary }]}>
                      {`${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, { color: theme.text }]}>
                      {`${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Unknown Member'}
                    </Text>
                    <Text style={[styles.memberMeta, { color: theme.textSecondary }]}>
                      {member.member_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Member'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Events</Text>
              {upcomingEvents.slice(0, 3).map((event, index) => (
                <View key={event.id || index} style={[styles.eventCard, { backgroundColor: theme.card }]}>
                  <View style={[styles.eventIcon, { backgroundColor: '#06B6D420' }]}>
                    <Ionicons name="calendar" size={20} color="#06B6D4" />
                  </View>
                  <View style={styles.eventContent}>
                    <Text style={[styles.eventTitle, { color: theme.text }]}>{event.title || 'Untitled Event'}</Text>
                    <Text style={[styles.eventMeta, { color: theme.textSecondary }]}>
                      {event.start_date ? new Date(event.start_date).toLocaleDateString() : 'Date TBD'}
                      {event.location ? ` • ${event.location}` : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
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
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hamburgerButton: {
    marginRight: 12,
    padding: 4,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  youthBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  youthBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationCount: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  summaryCard: {
    marginBottom: 20,
    borderLeftWidth: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 44) / 2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (SCREEN_WIDTH - 44) / 3,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  approvalList: {
    gap: 12,
  },
  approvalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  approvalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approvalContent: {
    flex: 1,
  },
  approvalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  approvalDescription: {
    fontSize: 13,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitials: {
    fontSize: 16,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberMeta: {
    fontSize: 12,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventMeta: {
    fontSize: 12,
  },
});
