/**
 * K-12 Parent Dashboard Screen
 * 
 * Main dashboard for K-12 school parents.
 * Shows children's progress, grades, attendance, and school updates.
 * 
 * Routes here when: profile.organization_membership.school_type is one of:
 * - k12, k12_school, combined, primary, secondary, community_school
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, usePermissions } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { track } from '@/lib/analytics';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { hasCapability, getRequiredTier, type Tier } from '@/lib/ai/capabilities';
import { useNotificationBadgeCount } from '@/hooks/useNotificationCount';
import { styles } from './_dashboard.styles';
import { ChildCard } from './_ChildCard';
import { useK12ParentData } from './_useK12ParentData';
import DashOrb from '@/components/dash-orb';
import { MobileNavDrawer } from '@/components/navigation/MobileNavDrawer';

// Quick action items for K-12 parent
const quickActions = [
  { id: 'children', icon: 'people', label: 'Children', route: '/screens/parent-children', color: '#4F46E5' },
  { id: 'progress', icon: 'ribbon', label: 'Progress', route: '/screens/parent-progress', color: '#10B981' },
  { id: 'attendance', icon: 'calendar-outline', label: 'Attendance', route: '/screens/parent-attendance', color: '#F59E0B' },
  { id: 'messages', icon: 'chatbubbles', label: 'Messages', route: '/screens/parent-messages', color: '#3B82F6' },
  { id: 'payments', icon: 'card', label: 'Payments', route: '/screens/parent-payments', color: '#8B5CF6' },
  { id: 'announcements', icon: 'megaphone', label: 'News', route: '/screens/parent-announcements', color: '#EF4444' },
];

// Second row of quick actions - AI/Study features from PWA
const aiQuickActions = [
  { id: 'dash-ai', icon: 'sparkles', label: 'Dash AI', route: '/screens/dash-assistant', color: '#7C3AED' },
  { id: 'exam-prep', icon: 'school', label: 'Exam Prep', route: '/screens/exam-prep', color: '#EC4899' },
  { id: 'homework', icon: 'document-text', label: 'Homework', route: '/screens/homework', color: '#06B6D4' },
  { id: 'weekly-report', icon: 'stats-chart', label: 'Reports', route: '/screens/parent-weekly-report', color: '#F97316' },
];

export default function K12ParentDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user, loading: authLoading, profileLoading } = useAuth();
  const permissions = usePermissions();
  const { theme } = useTheme();
  const { tier } = useSubscription();
  const flags = getFeatureFlagsSync();
  const params = useLocalSearchParams<{ schoolType?: string; mode?: string }>();
  const notificationCount = useNotificationBadgeCount();
  
  const [refreshing, setRefreshing] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Get school and user info from profile
  const schoolName = (profile as any)?.organization_membership?.organization_name || 
                     (profile as any)?.organization_name || 
                     'EduDash Pro Community School';
  const userName = profile?.full_name || profile?.email?.split('@')[0] || 'Parent';
  const schoolType = params.schoolType || (profile as any)?.organization_membership?.school_type || 'k12';
  const organizationId = (profile as any)?.organization_id || (profile as any)?.preschool_id;

    // RBAC checks
  const canView = permissions?.hasRole ? permissions.hasRole('parent') : true;
  const hasAccess = permissions?.can ? permissions.can('access_mobile_app') : true;

  // Use the K12 parent data hook for data fetching
  // NOTE: Pass profile?.id (internal profile ID), NOT user?.id (auth user ID)
  const {
    children,
    recentUpdates,
    upcomingEvents,
    dataLoading,
    fetchChildrenData,
  } = useK12ParentData(profile?.id, organizationId);

  // Track dashboard view
  useEffect(() => {
    if (canView && hasAccess && user?.id) {
      track('k12.parent.dashboard_view', {
        user_id: user.id,
        school_type: schoolType,
        tier,
        platform: Platform.OS,
      });
    }
  }, [canView, hasAccess, user?.id, schoolType, tier]);

  // Load data on mount - use profile.id for data fetching
  useEffect(() => {
    if (profile?.id && !authLoading && !profileLoading) {
      fetchChildrenData();
    }
  }, [profile?.id, authLoading, profileLoading, fetchChildrenData]);

  // Redirect if unauthorized
  const hasRedirectedRef = React.useRef(false);
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (!authLoading && !profileLoading) {
      if (!user?.id) {
        hasRedirectedRef.current = true;
        router.replace('/(auth)/sign-in');
        return;
      }
    }
  }, [authLoading, profileLoading, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    track('k12.parent.dashboard_refresh', { user_id: user?.id });
    await fetchChildrenData();
    setRefreshing(false);
  }, [user?.id, fetchChildrenData]);

  const handleQuickAction = (route: string, actionId: string) => {
    track('k12.parent.quick_action_tap', { action: actionId, user_id: user?.id });
    router.push(route as any);
    console.log('[K12 Parent] Quick action:', actionId, route);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const normalizeTierForCapabilities = (value?: string | null): Tier => {
    const raw = String(value || 'free').toLowerCase().replace(/-/g, '_');
    if (raw === 'trial') return 'starter';
    if (raw === 'parent_starter' || raw === 'teacher_starter' || raw === 'school_starter' || raw === 'starter' || raw === 'basic') {
      return 'starter';
    }
    if (raw === 'parent_plus' || raw === 'teacher_pro' || raw === 'school_premium' || raw === 'school_pro' || raw === 'premium' || raw === 'pro') {
      return 'premium';
    }
    if (raw === 'school_enterprise' || raw === 'enterprise') {
      return 'enterprise';
    }
    return 'free';
  };

  const tierForCaps = normalizeTierForCapabilities(tier);
  const canUseExamPrep = flags.exam_prep_enabled && hasCapability(tierForCaps, 'exam.practice');
  const requiredExamTier = getRequiredTier('exam.practice');

  // Loading state
  if (authLoading || profileLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* FIXED HEADER - Does not scroll */}
      <View style={[styles.fixedHeader, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeftSection}>
          <TouchableOpacity
            style={styles.hamburgerButton}
            onPress={() => setIsDrawerOpen(true)}
            accessibilityLabel="Open navigation menu"
          >
            <Ionicons name="menu" size={28} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrapper}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Parent Dashboard</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => {
              track('k12.parent.notifications_tap', { user_id: user?.id });
              router.push('/screens/notifications' as any);
            }}
          >
            <Ionicons name="notifications-outline" size={24} color={theme.text} />
            {notificationCount > 0 && (
              <View style={[styles.notificationBadge, { backgroundColor: theme.error }]}>
                <Text style={styles.notificationBadgeText}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => {
              track('k12.parent.profile_tap', { user_id: user?.id });
              router.push('/screens/settings' as any);
            }}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.profileGradient}
            >
              <Text style={styles.profileInitial}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* SCROLLABLE CONTENT */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting Card */}
        <View style={[styles.greetingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.greeting, { color: theme.textSecondary }]}>
            {getGreeting()},
          </Text>
          <Text style={[styles.userName, { color: theme.text }]}>{userName}</Text>
          <Text style={[styles.schoolName, { color: theme.textSecondary }]}>{schoolName}</Text>
        </View>

        {/* School Type Badge */}
        <View style={styles.schoolTypeBadge}>
          <LinearGradient
            colors={['#4F46E5', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.schoolTypeBadgeGradient}
          >
            <Ionicons name="school" size={14} color="#FFFFFF" />
            <Text style={styles.schoolTypeBadgeText}>
              {schoolType === 'combined' ? 'K-12 School' : 
               schoolType === 'primary' ? 'Primary School' :
               schoolType === 'secondary' ? 'Secondary School' :
               schoolType === 'community_school' ? 'Community School' : 'K-12 School'}
            </Text>
          </LinearGradient>
        </View>

        {/* Children Cards */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Children</Text>
          {dataLoading ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
          ) : children.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <Ionicons name="people-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                No children linked to your account yet
              </Text>
            </View>
          ) : (
            children.map((child) => (
              <ChildCard key={child.id} child={child} colors={theme} />
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.quickActionCard, { backgroundColor: theme.surface }]}
                onPress={() => handleQuickAction(action.route, action.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
                  <Ionicons name={action.icon as any} size={24} color={action.color} />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.text }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* AI & Learning Tools - PWA Feature Migration */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>AI & Learning Tools</Text>
          <View style={styles.quickActionsGrid}>
            {aiQuickActions.map((action) => {
              const isExamPrep = action.id === 'exam-prep';
              const isDisabled = isExamPrep && !canUseExamPrep;
              return (
              <TouchableOpacity
                key={action.id}
                style={[
                  styles.quickActionCard, 
                  { backgroundColor: theme.surface },
                  isDisabled && styles.quickActionDisabled
                ]}
                onPress={() => {
                  if (isDisabled) {
                    if (!flags.exam_prep_enabled) {
                      Alert.alert(
                        'Exam Prep Unavailable',
                        'Exam Prep is currently disabled in this build. Please try again later.',
                        [{ text: 'OK', style: 'default' }]
                      );
                      return;
                    }

                    const tierLabel = requiredExamTier ? requiredExamTier.charAt(0).toUpperCase() + requiredExamTier.slice(1) : 'Starter';
                    Alert.alert(
                      'Exam Prep Locked',
                      `Exam Prep requires ${tierLabel} plan or higher.\n\nUpgrade your subscription to unlock this feature.`,
                      [
                        { text: 'Not now', style: 'cancel' },
                        { text: 'Upgrade', onPress: () => router.push('/screens/subscription-setup' as any) }
                      ]
                    );
                    return;
                  }
                  handleQuickAction(action.route, action.id);
                }}
                activeOpacity={0.7}
                disabled={isDisabled}
              >
                {isDisabled && (
                  <View style={[styles.quickActionLockBadge, { backgroundColor: theme.surfaceVariant }]}>
                    <Ionicons name="lock-closed" size={12} color={theme.textSecondary} />
                  </View>
                )}
                <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
                  <Ionicons name={action.icon as any} size={24} color={action.color} />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.text }]}>{action.label}</Text>
              </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Dash AI Card - Homework Helper */}
        <TouchableOpacity 
          style={styles.dashAICard} 
          activeOpacity={0.8}
          onPress={() => {
            track('k12.parent.dash_ai_tap', { user_id: user?.id });
            router.push('/screens/dash-assistant' as any);
          }}
        >
          <LinearGradient
            colors={['#7C3AED', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.dashAIGradient}
          >
            <View style={styles.dashAIContent}>
              <View style={styles.dashAIIcon}>
                <Ionicons name="sparkles" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.dashAIText}>
                <Text style={styles.dashAITitle}>Ask Dash AI</Text>
                <Text style={styles.dashAISubtitle}>
                  Get instant homework help & study tips
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Recent Updates */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Updates</Text>
            <TouchableOpacity onPress={() => {
              track('k12.parent.see_all_updates_tap', { user_id: user?.id });
            }}>
              <Text style={[styles.seeAllText, { color: theme.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentUpdates.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <Ionicons name="newspaper-outline" size={32} color={theme.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                No recent updates
              </Text>
            </View>
          ) : (
            recentUpdates.map((update) => (
              <View 
                key={update.id} 
                style={[styles.updateCard, { backgroundColor: theme.surface }]}
              >
                <View style={[styles.updateIcon, { backgroundColor: update.color + '20' }]}>
                  <Ionicons name={update.icon as any} size={18} color={update.color} />
                </View>
                <View style={styles.updateInfo}>
                  <Text style={[styles.updateChild, { color: theme.textSecondary }]}>{update.child}</Text>
                  <Text style={[styles.updateMessage, { color: theme.text }]}>{update.message}</Text>
                </View>
                <Text style={[styles.updateTime, { color: theme.textSecondary }]}>{update.time}</Text>
              </View>
            ))
          )}
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => {
              track('k12.parent.see_all_events_tap', { user_id: user?.id });
              router.push('/screens/parent-events' as any);
            }}>
              <Text style={[styles.seeAllText, { color: theme.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {upcomingEvents.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
              <Ionicons name="calendar-outline" size={32} color={theme.textSecondary} />
              <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                No upcoming events
              </Text>
            </View>
          ) : (
            upcomingEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={[styles.eventCard, { backgroundColor: theme.surface }]}
                activeOpacity={0.7}
                onPress={() => {
                  track('k12.parent.event_tap', { eventId: event.id, user_id: user?.id });
                }}
              >
                <View style={[styles.eventDate, { backgroundColor: theme.primary + '20' }]}>
                  <Text style={[styles.eventDateText, { color: theme.primary }]}>
                    {event.date.split(' ')[1]}
                  </Text>
                  <Text style={[styles.eventMonthText, { color: theme.primary }]}>
                    {event.date.split(' ')[0]}
                  </Text>
                </View>
                <View style={styles.eventInfo}>
                  <Text style={[styles.eventTitle, { color: theme.text }]}>{event.title}</Text>
                  <Text style={[styles.eventTime, { color: theme.textSecondary }]}>{event.time}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* School Communication Card */}
        <TouchableOpacity 
          style={styles.communicationCard} 
          activeOpacity={0.8}
          onPress={() => {
            track('k12.parent.school_communication_tap', { user_id: user?.id });
            // TODO: Navigate to school communication
          }}
        >
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.communicationGradient}
          >
            <View style={styles.communicationContent}>
              <View style={styles.communicationIcon}>
                <Ionicons name="school" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.communicationText}>
                <Text style={styles.communicationTitle}>School Communication</Text>
                <Text style={styles.communicationSubtitle}>
                  Stay connected with teachers and school updates
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Floating Dash AI Orb - Role-aware, works for all users */}
      <DashOrb 
        position="bottom-right"
        size={56}
        onCommandExecuted={(cmd) => track('dash_orb_command', { command: cmd, screen: 'k12_parent_dashboard' })}
      />

      {/* Mobile Navigation Drawer */}
      <MobileNavDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        navItems={[
          { id: 'home', label: 'Dashboard', icon: 'home', route: '/(k12)/parent/dashboard' },
          { id: 'children', label: 'My Children', icon: 'people', route: '/screens/parent-children' },
          { id: 'progress', label: 'Progress', icon: 'ribbon', route: '/screens/parent-progress' },
          { id: 'attendance', label: 'Attendance', icon: 'calendar-outline', route: '/screens/parent-attendance' },
          { id: 'messages', label: 'Messages', icon: 'chatbubbles', route: '/screens/parent-messages' },
          { id: 'payments', label: 'Payments', icon: 'card', route: '/screens/parent-payments' },
          { id: 'announcements', label: 'Announcements', icon: 'megaphone', route: '/screens/parent-announcements' },
          { id: 'reports', label: 'Weekly Reports', icon: 'stats-chart', route: '/screens/parent-weekly-report' },
          { id: 'account', label: 'Account', icon: 'person-circle', route: '/screens/account' },
          { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/settings' },
        ]}
      />
    </SafeAreaView>
  );
}
