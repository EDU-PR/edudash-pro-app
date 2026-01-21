/**
 * K-12 Student Dashboard Screen
 * 
 * Main dashboard for K-12 school students.
 * Shows classes, assignments, grades, and upcoming deadlines.
 * 
 * Routes here when: profile.organization_membership.school_type is one of:
 * - k12, k12_school, combined, primary, secondary, community_school
 * AND user role is 'student'
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth, usePermissions } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { track } from '@/lib/analytics';

const { width } = Dimensions.get('window');

// Quick action items for K-12 student
const quickActions = [
  { id: 'classes', icon: 'grid', label: 'Classes', route: '/(k12)/student/classes', color: '#4F46E5' },
  { id: 'assignments', icon: 'document-text', label: 'Tasks', route: '/(k12)/student/assignments', color: '#10B981' },
  { id: 'grades', icon: 'ribbon', label: 'Grades', route: '/(k12)/student/grades', color: '#F59E0B' },
  { id: 'schedule', icon: 'calendar', label: 'Schedule', route: '/(k12)/student/schedule', color: '#8B5CF6' },
  { id: 'library', icon: 'library', label: 'Library', route: '/(k12)/library', color: '#3B82F6' },
  { id: 'ai', icon: 'sparkles', label: 'Study AI', route: '/(k12)/ai-tutor', color: '#EC4899' },
];

// Mock data for upcoming assignments - TODO: Replace with real data from Supabase
const mockUpcomingAssignments = [
  { id: '1', title: 'Math Homework - Chapter 5', subject: 'Mathematics', dueDate: 'Tomorrow', status: 'pending' },
  { id: '2', title: 'Essay: Climate Change', subject: 'English', dueDate: 'Mar 15', status: 'pending' },
  { id: '3', title: 'Science Lab Report', subject: 'Physics', dueDate: 'Mar 18', status: 'in_progress' },
];

// Mock data for today's classes - TODO: Replace with real data from Supabase
const mockTodaysClasses = [
  { id: '1', name: 'Mathematics', time: '08:00 - 09:00', room: 'Room 201', teacher: 'Mr. Johnson', current: false },
  { id: '2', name: 'English Literature', time: '09:15 - 10:15', room: 'Room 105', teacher: 'Ms. Williams', current: true },
  { id: '3', name: 'Physics', time: '11:00 - 12:00', room: 'Lab 3', teacher: 'Dr. Smith', current: false },
];

// Mock metrics - TODO: Replace with real data from Supabase
const mockMetrics = {
  avgGrade: 'A-',
  attendance: 98,
  pendingTasks: 5,
  completedToday: 2,
};

interface QuickStatProps {
  icon: string;
  label: string;
  value: string | number;
  color: string;
  colors: any;
}

const QuickStat: React.FC<QuickStatProps> = ({ icon, label, value, color, colors }) => (
  <View style={[styles.quickStat, { backgroundColor: colors.surface }]}>
    <View style={[styles.quickStatIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon as any} size={20} color={color} />
    </View>
    <View>
      <Text style={[styles.quickStatValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.quickStatLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  </View>
);

export default function K12StudentDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile, user, loading: authLoading, profileLoading } = useAuth();
  const permissions = usePermissions();
  const { theme } = useTheme();
  const { tier } = useSubscription();
  const params = useLocalSearchParams<{ schoolType?: string; mode?: string }>();

  const [refreshing, setRefreshing] = useState(false);
  const [todaysClasses, setTodaysClasses] = useState(mockTodaysClasses);
  const [upcomingAssignments, setUpcomingAssignments] = useState(mockUpcomingAssignments);
  const [metrics, setMetrics] = useState(mockMetrics);

  // Get school and user info from profile
  const schoolName = (profile as any)?.organization_membership?.organization_name || 'Your School';
  const userName = profile?.full_name || profile?.email?.split('@')[0] || 'Student';
  const schoolType = params.schoolType || (profile as any)?.organization_membership?.school_type || 'k12';
  const grade = 'Grade 10'; // TODO: Get from profile/student record

  // RBAC checks - students use 'student' role
  const canView = permissions?.hasRole ? permissions.hasRole('student') : false;
  const hasAccess = permissions?.can ? permissions.can('access_mobile_app') : false;

  // Track dashboard view
  useEffect(() => {
    if (canView && hasAccess && user?.id) {
      track('k12.student.dashboard_view', {
        user_id: user.id,
        school_type: schoolType,
        tier,
        platform: Platform.OS,
      });
    }
  }, [canView, hasAccess, user?.id, schoolType, tier]);

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
      if (!canView || !hasAccess) {
        hasRedirectedRef.current = true;
        router.replace('/profiles-gate');
      }
    }
  }, [authLoading, profileLoading, user?.id, canView, hasAccess]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    track('k12.student.dashboard_refresh', { user_id: user?.id });
    // TODO: Fetch real data from Supabase
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, [user?.id]);

  const handleQuickAction = (route: string, actionId: string) => {
    track('k12.student.quick_action_tap', { action: actionId, user_id: user?.id });
    // TODO: Enable navigation when routes exist
    // router.push(route as any);
    console.log('[K12 Student] Quick action:', actionId, route);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Find current class
  const currentClass = todaysClasses.find(c => c.current);

  // Loading state
  if (authLoading || profileLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>
              {getGreeting()},
            </Text>
            <Text style={[styles.userName, { color: theme.colors.text }]}>{userName}</Text>
            <Text style={[styles.schoolName, { color: theme.colors.textSecondary }]}>
              {grade} • {schoolName}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => {
                track('k12.student.notifications_tap', { user_id: user?.id });
                // TODO: Navigate to notifications
              }}
            >
              <Ionicons name="notifications-outline" size={24} color={theme.colors.text} />
              <View style={[styles.notificationBadge, { backgroundColor: theme.colors.error }]}>
                <Text style={styles.notificationBadgeText}>2</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => {
                track('k12.student.profile_tap', { user_id: user?.id });
                router.push('/screens/settings' as any);
              }}
            >
              <LinearGradient
                colors={['#8B5CF6', '#EC4899']}
                style={styles.profileGradient}
              >
                <Text style={styles.profileInitial}>
                  {userName.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats Row */}
        <View style={styles.quickStatsRow}>
          <QuickStat
            icon="ribbon"
            label="Average"
            value={metrics.avgGrade}
            color="#F59E0B"
            colors={theme.colors}
          />
          <QuickStat
            icon="checkmark-circle"
            label="Attendance"
            value={`${metrics.attendance}%`}
            color="#10B981"
            colors={theme.colors}
          />
          <QuickStat
            icon="document-text"
            label="Pending"
            value={metrics.pendingTasks}
            color="#3B82F6"
            colors={theme.colors}
          />
        </View>

        {/* Current Class Banner (if any) */}
        {currentClass && (
          <TouchableOpacity 
            style={styles.currentClassBanner}
            activeOpacity={0.8}
            onPress={() => {
              track('k12.student.current_class_tap', { 
                classId: currentClass.id, 
                className: currentClass.name,
                user_id: user?.id 
              });
            }}
          >
            <LinearGradient
              colors={['#4F46E5', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.currentClassGradient}
            >
              <View style={styles.currentClassLive}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>NOW</Text>
              </View>
              <View style={styles.currentClassInfo}>
                <Text style={styles.currentClassName}>{currentClass.name}</Text>
                <Text style={styles.currentClassDetails}>
                  {currentClass.room} • {currentClass.teacher}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.quickActionCard, { backgroundColor: theme.colors.surface }]}
                onPress={() => handleQuickAction(action.route, action.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
                  <Ionicons name={action.icon as any} size={24} color={action.color} />
                </View>
                <Text style={[styles.quickActionLabel, { color: theme.colors.text }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Upcoming Assignments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Upcoming Tasks</Text>
            <TouchableOpacity onPress={() => {
              track('k12.student.see_all_tasks_tap', { user_id: user?.id });
            }}>
              <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {upcomingAssignments.map((assignment) => (
            <TouchableOpacity
              key={assignment.id}
              style={[styles.assignmentCard, { backgroundColor: theme.colors.surface }]}
              activeOpacity={0.7}
              onPress={() => {
                track('k12.student.assignment_tap', { 
                  assignmentId: assignment.id, 
                  subject: assignment.subject,
                  user_id: user?.id 
                });
              }}
            >
              <View style={[styles.assignmentIcon, { 
                backgroundColor: assignment.status === 'in_progress' ? '#F59E0B20' : '#3B82F620' 
              }]}>
                <Ionicons 
                  name={assignment.status === 'in_progress' ? 'time' : 'document-text'} 
                  size={20} 
                  color={assignment.status === 'in_progress' ? '#F59E0B' : '#3B82F6'} 
                />
              </View>
              <View style={styles.assignmentInfo}>
                <Text style={[styles.assignmentTitle, { color: theme.colors.text }]}>{assignment.title}</Text>
                <Text style={[styles.assignmentSubject, { color: theme.colors.textSecondary }]}>
                  {assignment.subject} • Due {assignment.dueDate}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Today's Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Today's Schedule</Text>
            <TouchableOpacity onPress={() => {
              track('k12.student.full_week_tap', { user_id: user?.id });
            }}>
              <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>Full Week</Text>
            </TouchableOpacity>
          </View>
          {todaysClasses.filter(c => !c.current).map((classInfo) => (
            <View
              key={classInfo.id}
              style={[styles.scheduleItem, { backgroundColor: theme.colors.surface }]}
            >
              <View style={styles.scheduleTime}>
                <Text style={[styles.scheduleTimeText, { color: theme.colors.primary }]}>
                  {classInfo.time.split(' - ')[0]}
                </Text>
              </View>
              <View style={[styles.scheduleDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.scheduleInfo}>
                <Text style={[styles.scheduleName, { color: theme.colors.text }]}>{classInfo.name}</Text>
                <Text style={[styles.scheduleDetails, { color: theme.colors.textSecondary }]}>
                  {classInfo.room} • {classInfo.teacher}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* AI Study Assistant Card */}
        <TouchableOpacity 
          style={styles.aiCard} 
          activeOpacity={0.8}
          onPress={() => {
            track('k12.student.ai_study_buddy_tap', { user_id: user?.id });
            // TODO: Navigate to AI tutor
          }}
        >
          <LinearGradient
            colors={['#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiCardGradient}
          >
            <View style={styles.aiCardContent}>
              <View style={styles.aiCardIcon}>
                <Ionicons name="sparkles" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.aiCardText}>
                <Text style={styles.aiCardTitle}>AI Study Buddy</Text>
                <Text style={styles.aiCardSubtitle}>
                  Get help with homework, practice problems, and exam prep
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  schoolName: {
    fontSize: 14,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  profileGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  quickStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  quickStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickStatLabel: {
    fontSize: 11,
  },
  currentClassBanner: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  currentClassGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  currentClassLive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 14,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  currentClassInfo: {
    flex: 1,
  },
  currentClassName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  currentClassDetails: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: (width - 56) / 3,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  assignmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  assignmentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  assignmentSubject: {
    fontSize: 13,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  scheduleTime: {
    width: 50,
    alignItems: 'center',
  },
  scheduleTimeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scheduleDivider: {
    width: 2,
    height: 30,
    borderRadius: 1,
    marginHorizontal: 12,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  scheduleDetails: {
    fontSize: 13,
  },
  aiCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  aiCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  aiCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  aiCardText: {
    flex: 1,
  },
  aiCardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  aiCardSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
  },
});
