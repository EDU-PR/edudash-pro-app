/**
 * Youth President Dashboard - Youth Wing Executive Overview
 * Manage youth members, events, programs and initiatives
 * Tailored from National President dashboard design
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
} from '@/components/membership/dashboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Youth Wing specific stats interface
interface YouthStats {
  totalMembers: number;
  newThisMonth: number;
  activeEvents: number;
  upcomingPrograms: number;
  pendingApprovals: number;
  totalRegions: number;
  ageBreakdown: {
    under18: number;
    age18to25: number;
    age26to35: number;
  };
}

// Youth Wing Executive Actions
const YOUTH_EXECUTIVE_ACTIONS = [
  { id: '1', label: 'Members', icon: 'people', color: '#3B82F6', route: '/screens/membership/members-list' },
  { id: '2', label: 'Invite Members', icon: 'person-add', color: '#10B981', route: '/screens/membership/youth-invite-code' },
  { id: '3', label: 'Office Structure', icon: 'people-circle', color: '#8B5CF6', route: '/screens/membership/youth-executive-invite' },
  { id: '4', label: 'Events', icon: 'calendar', color: '#06B6D4', route: '/screens/membership/events' },
  { id: '5', label: 'Programs', icon: 'school', color: '#F59E0B', route: '/screens/membership/programs' },
  { id: '6', label: 'Budget', icon: 'wallet', color: '#EF4444', route: '/screens/membership/budget-requests' },
  { id: '7', label: 'Documents', icon: 'document-text', color: '#6366F1', route: '/screens/membership/documents' },
];

export default function YouthPresidentDashboard() {
  const { theme } = useTheme();
  const { profile, user } = useAuth();
  const insets = useSafeAreaInsets();
  const notificationCount = useNotificationBadgeCount();

  // Route guard: Ensure youth_secretary is redirected to their own dashboard
  React.useEffect(() => {
    const memberType = (profile as any)?.organization_membership?.member_type;
    if (profile && memberType === 'youth_secretary') {
      console.log('[YouthPresidentDashboard] Access denied - youth_secretary detected - redirecting to secretary dashboard');
      router.replace('/screens/membership/youth-secretary-dashboard');
    }
  }, [profile]);
  
  const [stats, setStats] = useState<YouthStats | null>(null);
  const [recentMembers, setRecentMembers] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [pendingBudgetCount, setPendingBudgetCount] = useState(0);
  const [pendingEventProposalsCount, setPendingEventProposalsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // Youth president uses organization branding from OrganizationBrandingContext
  // No need for local dashboard settings state

  // Fetch youth wing statistics
  const fetchYouthStats = useCallback(async () => {
    try {
      const supabase = assertSupabase();
      const orgId = profile?.organization_id;
      
      if (!orgId) return;

      // Fetch youth wing members count - include all members for the wing president to manage
      // This includes youth members, coordinators, and members assigned to the youth wing
      // Fetch both birth_year and date_of_birth for age calculation
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('id, created_at, birth_year, date_of_birth, member_type, wing')
        .eq('organization_id', orgId)
        .or('wing.eq.youth,member_type.ilike.youth%,member_type.eq.learner,member_type.eq.regional_manager');

      // Fetch pending membership approvals for the organization
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

      // Fetch upcoming programs (courses with future start dates)
      const { data: upcomingProgramsData } = await supabase
        .from('courses')
        .select('id')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .gte('start_date', new Date().toISOString())
        .is('deleted_at', null);

      // Fetch actual regions count
      const { count: regionsCount } = await supabase
        .from('organization_regions')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_active', true);

      // Fetch pending budget requests
      const { data: pendingBudgets, count: pendingBudgetCount } = await supabase
        .from('organization_budgets')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('status', ['pending', 'proposed', 'draft', 'frozen']);

      // Fetch pending event proposals (events awaiting approval)
      // Note: Status filter requires CHECK constraint on events.status column
      // Migration: 20260110_fix_events_status_constraint.sql
      let pendingEventProposalsCount = 0;
      try {
        const { count, error } = await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .in('status', ['pending', 'proposed', 'draft']);
        
        if (error) {
          // If status filter fails (e.g., constraint not applied), return 0
          console.warn('Events status filter failed - ensure migration 20260110_fix_events_status_constraint.sql is applied:', error.message);
          pendingEventProposalsCount = 0;
        } else {
          pendingEventProposalsCount = count || 0;
        }
      } catch (err) {
        console.warn('Error fetching pending event proposals:', err);
        pendingEventProposalsCount = 0;
      }

      setPendingBudgetCount(pendingBudgetCount || 0);
      setPendingEventProposalsCount(pendingEventProposalsCount || 0);

      // Calculate age breakdown
      // Support both birth_year and date_of_birth fields
      const currentYear = new Date().getFullYear();
      const currentDate = new Date();
      const ageBreakdown = {
        under18: 0,
        age18to25: 0,
        age26to35: 0,
      };

      members?.forEach(m => {
        let age: number | null = null;
        
        // Try birth_year first (faster calculation)
        if (m.birth_year) {
          age = currentYear - m.birth_year;
        } 
        // Fallback to date_of_birth if birth_year is not available
        else if (m.date_of_birth) {
          try {
            const birthDate = new Date(m.date_of_birth);
            if (!isNaN(birthDate.getTime())) {
              age = currentYear - birthDate.getFullYear();
              const monthDiff = currentDate.getMonth() - birthDate.getMonth();
              // Adjust if birthday hasn't occurred this year
              if (monthDiff < 0 || (monthDiff === 0 && currentDate.getDate() < birthDate.getDate())) {
                age--;
              }
            }
          } catch (e) {
            console.warn('Error parsing date_of_birth:', m.date_of_birth, e);
          }
        }
        
        // Categorize age if we have a valid age
        if (age !== null && age >= 0) {
          if (age < 18) ageBreakdown.under18++;
          else if (age <= 25) ageBreakdown.age18to25++;
          else if (age <= 35) ageBreakdown.age26to35++;
        }
      });

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
        upcomingPrograms: upcomingProgramsData?.length || 0,
        pendingApprovals: pendingApprovals?.length || 0,
        totalRegions: regionsCount || 0,
        ageBreakdown,
      });

      setUpcomingEvents(events || []);

      // Get recent members (all types)
      // CRITICAL: Exclude the current user (president) from the list
      let recentQuery = supabase
        .from('organization_members')
        .select('id, first_name, last_name, created_at, region_id, member_type')
        .eq('organization_id', orgId);
      
      // Exclude current user (president shouldn't see themselves in recent members)
      if (user?.id) {
        recentQuery = recentQuery.neq('user_id', user.id);
      }
      
      const { data: recent } = await recentQuery
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentMembers(recent || []);

    } catch (error) {
      console.error('Error fetching youth stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.organization_id]);

  useEffect(() => {
    fetchYouthStats();
  }, [fetchYouthStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchYouthStats();
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
              Loading youth dashboard...
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
            <Text style={[styles.headerTitle, { color: theme.text }]}>Youth President</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Youth Wing Dashboard</Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <View style={styles.youthBadge}>
            <Text style={styles.youthBadgeText}>YOUTH</Text>
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
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/screens/settings')}
          >
            <Ionicons name="settings-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <DashboardBackground>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
        >
          {/* Custom Greeting - Loaded from OrganizationBrandingContext */}

          {/* Executive Summary Card */}
        <Card padding={20} margin={0} style={{ ...styles.summaryCard, borderLeftColor: '#10B981' }}>
          <View style={styles.summaryHeader}>
            <View style={[styles.summaryIconContainer, { backgroundColor: '#10B98115' }]}>
              <Ionicons name="people" size={28} color="#10B981" />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={[styles.summaryTitle, { color: theme.text }]}>Youth Wing Overview</Text>
              <Text style={[styles.summarySubtitle, { color: theme.textSecondary }]}>
                Building the future leaders of tomorrow
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
            <View style={[styles.quickStatIcon, { backgroundColor: '#3B82F615' }]}>
              <Ionicons name="person-add" size={20} color="#3B82F6" />
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

        {/* Executive Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {YOUTH_EXECUTIVE_ACTIONS.map((action) => (
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

        {/* Age Demographics */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Age Demographics</Text>
          <Card padding={20} margin={0}>
            <View style={styles.demographicsRow}>
              <View style={styles.demographicItem}>
                <View style={[styles.demographicBar, { backgroundColor: '#3B82F6', height: Math.max(20, (stats?.ageBreakdown.under18 || 0) * 2) }]} />
                <Text style={[styles.demographicValue, { color: theme.text }]}>{stats?.ageBreakdown.under18 || 0}</Text>
                <Text style={[styles.demographicLabel, { color: theme.textSecondary }]}>Under 18</Text>
              </View>
              <View style={styles.demographicItem}>
                <View style={[styles.demographicBar, { backgroundColor: '#10B981', height: Math.max(20, (stats?.ageBreakdown.age18to25 || 0) * 2) }]} />
                <Text style={[styles.demographicValue, { color: theme.text }]}>{stats?.ageBreakdown.age18to25 || 0}</Text>
                <Text style={[styles.demographicLabel, { color: theme.textSecondary }]}>18-25</Text>
              </View>
              <View style={styles.demographicItem}>
                <View style={[styles.demographicBar, { backgroundColor: '#8B5CF6', height: Math.max(20, (stats?.ageBreakdown.age26to35 || 0) * 2) }]} />
                <Text style={[styles.demographicValue, { color: theme.text }]}>{stats?.ageBreakdown.age26to35 || 0}</Text>
                <Text style={[styles.demographicLabel, { color: theme.textSecondary }]}>26-35</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => router.push('/screens/membership/events')}>
              <Text style={[styles.seeAll, { color: theme.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <Card padding={0} margin={0}>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event, index) => (
                <View key={event.id}>
                  <TouchableOpacity style={styles.eventItem}>
                    <View style={[styles.eventDateBadge, { backgroundColor: '#10B98115' }]}>
                      <Text style={[styles.eventDateDay, { color: '#10B981' }]}>
                        {new Date(event.start_date).getDate()}
                      </Text>
                      <Text style={[styles.eventDateMonth, { color: '#10B981' }]}>
                        {new Date(event.start_date).toLocaleString('default', { month: 'short' }).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.eventInfo}>
                      <Text style={[styles.eventTitle, { color: theme.text }]}>{event.title}</Text>
                      <View style={styles.eventMeta}>
                        <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
                        <Text style={[styles.eventLocation, { color: theme.textSecondary }]}>
                          {event.location || 'TBA'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {index < upcomingEvents.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={40} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No upcoming events</Text>
                <TouchableOpacity 
                  style={[styles.createButton, { backgroundColor: theme.primary }]}
                  onPress={() => router.push('/screens/membership/create-event')}
                >
                  <Text style={styles.createButtonText}>Create Event</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        </View>

        {/* Pending Approvals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Pending Approvals</Text>
            {((stats?.pendingApprovals || 0) + pendingBudgetCount + pendingEventProposalsCount) > 0 && (
              <View style={[styles.urgentBadge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.urgentText}>
                  {(stats?.pendingApprovals || 0) + pendingBudgetCount + pendingEventProposalsCount}
                </Text>
              </View>
            )}
          </View>
          
          <Card padding={0} margin={0}>
            {(() => {
              const approvalItems = [
                { icon: 'person-add', color: '#3B82F6', title: 'Membership Applications', description: `${stats?.pendingApprovals || 0} youth members awaiting approval`, type: 'members', count: stats?.pendingApprovals || 0 },
                { icon: 'cash', color: '#F59E0B', title: 'Budget Requests', description: `${pendingBudgetCount} budget ${pendingBudgetCount === 1 ? 'request' : 'requests'} pending approval`, type: 'budget', count: pendingBudgetCount },
                { icon: 'calendar', color: '#10B981', title: 'Event Proposals', description: `${pendingEventProposalsCount} event ${pendingEventProposalsCount === 1 ? 'proposal' : 'proposals'} awaiting approval`, type: 'events', count: pendingEventProposalsCount },
              ].filter(item => item.count > 0);

              if (approvalItems.length === 0) {
                return (
                  <View style={styles.emptyState}>
                    <Ionicons name="checkmark-circle-outline" size={40} color={theme.textSecondary} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No pending approvals</Text>
                  </View>
                );
              }

              return approvalItems.map((item, index) => (
                <View key={index}>
                  <TouchableOpacity 
                    style={styles.approvalItem}
                    onPress={() => handleApprovalPress(item.type)}
                  >
                    <View style={[styles.approvalIcon, { backgroundColor: item.color + '15' }]}>
                      <Ionicons name={item.icon as any} size={20} color={item.color} />
                    </View>
                    <View style={styles.approvalInfo}>
                      <Text style={[styles.approvalTitle, { color: theme.text }]}>{item.title}</Text>
                      <Text style={[styles.approvalDescription, { color: theme.textSecondary }]}>
                        {item.description}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                  {index < approvalItems.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                </View>
              ));
            })()}
          </Card>
        </View>

        {/* Recent Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Members</Text>
            <TouchableOpacity onPress={() => router.push('/screens/membership/members-list')}>
              <Text style={[styles.seeAll, { color: theme.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <Card padding={0} margin={0}>
            {recentMembers.length > 0 ? (
              recentMembers.map((member, index) => (
                <View key={member.id}>
                  <View style={styles.memberItem}>
                    <View style={[styles.memberAvatar, { backgroundColor: '#10B98115' }]}>
                      <Text style={[styles.memberInitials, { color: '#10B981' }]}>
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
                    <View style={[styles.newBadge, { backgroundColor: '#10B98115' }]}>
                      <Text style={[styles.newBadgeText, { color: '#10B981' }]}>NEW</Text>
                    </View>
                  </View>
                  {index < recentMembers.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  )}
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={40} color={theme.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No recent members</Text>
              </View>
            )}
          </Card>
        </View>
        </ScrollView>
      </DashboardBackground>

      {/* Note: Youth President uses organization branding from OrganizationBrandingContext */}
      {/* Wallpaper settings are managed at the organization level by CEO/National Admin */}
    </SafeAreaView>
    </DashboardWallpaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Custom Header
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  hamburgerButton: {
    padding: 4,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  youthBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  youthBadgeText: {
    color: '#fff',
    fontSize: 12,
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

  // Summary Card
  summaryCard: {
    borderLeftWidth: 4,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  summaryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  summarySubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
  },

  // Quick Stats
  quickStatsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickStatCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
  },
  quickStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  quickStatLabel: {
    fontSize: 10,
    marginTop: 2,
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

  // Actions Grid
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
    textAlign: 'center',
  },

  // Demographics
  demographicsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 120,
  },
  demographicItem: {
    alignItems: 'center',
    flex: 1,
  },
  demographicBar: {
    width: 40,
    borderRadius: 8,
    marginBottom: 8,
    minHeight: 20,
  },
  demographicValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  demographicLabel: {
    fontSize: 11,
    marginTop: 2,
  },

  // Events
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  eventDateBadge: {
    width: 50,
    height: 50,
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

  // Approvals
  approvalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  approvalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalInfo: {
    flex: 1,
  },
  approvalTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  approvalDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  urgentBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  urgentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Members
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
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Empty State
  emptyState: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  createButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  
  // Greeting
  greetingContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  greetingSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
});
