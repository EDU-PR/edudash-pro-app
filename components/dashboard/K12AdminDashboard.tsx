/**
 * K-12 School Admin Dashboard
 * 
 * Dashboard for K-12 schools (Grade R to Grade 12) like EduDash Pro Community School.
 * Focused on:
 * - Aftercare program management
 * - Grade-based student organization (R-12)
 * - Attendance tracking
 * - Payment management
 * 
 * Different from preschool dashboard which focuses on early childhood education.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assertSupabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

interface AftercareStat {
  total: number;
  pendingPayment: number;
  paid: number;
  enrolled: number;
}

interface GradeCount {
  grade: string;
  count: number;
}

export function K12AdminDashboard() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AftercareStat>({ total: 0, pendingPayment: 0, paid: 0, enrolled: 0 });
  const [gradeBreakdown, setGradeBreakdown] = useState<GradeCount[]>([]);
  const [recentRegistrations, setRecentRegistrations] = useState<any[]>([]);
  
  const styles = useMemo(() => createStyles(theme, insets.top), [theme, insets.top]);
  
  const organizationId = profile?.organization_id || profile?.preschool_id;
  const userName = profile?.first_name || user?.user_metadata?.first_name || 'Admin';
  
  // EduDash Pro schools share aftercare data (Community School and Main School)
  const EDUDASH_PRO_SCHOOL_IDS = [
    '00000000-0000-0000-0000-000000000001', // EduDash Pro Community School
    '00000000-0000-0000-0000-000000000003', // EduDash Pro Main School
  ];
  const isEdudashProSchool = organizationId && EDUDASH_PRO_SCHOOL_IDS.includes(organizationId);
  
  // Get greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const supabase = assertSupabase();
      
      // Fetch aftercare registrations stats
      // EduDash Pro schools query both Community and Main school registrations
      const query = supabase
        .from('aftercare_registrations')
        .select('id, status, child_grade, child_first_name, child_last_name, created_at')
        .order('created_at', { ascending: false });
      
      const { data: registrations, error } = isEdudashProSchool
        ? await query.in('preschool_id', EDUDASH_PRO_SCHOOL_IDS)
        : await query.eq('preschool_id', organizationId);
      
      if (error && error.code !== '42P01') {
        console.error('[K12Dashboard] Error fetching registrations:', error);
      }
      
      const data = registrations || [];
      
      // Calculate stats
      setStats({
        total: data.length,
        pendingPayment: data.filter(r => r.status === 'pending_payment').length,
        paid: data.filter(r => r.status === 'paid').length,
        enrolled: data.filter(r => r.status === 'enrolled').length,
      });
      
      // Grade breakdown
      const grades: Record<string, number> = {};
      data.forEach(r => {
        const grade = r.child_grade || 'Unknown';
        grades[grade] = (grades[grade] || 0) + 1;
      });
      
      // Sort grades properly (R, 1, 2, ... 12)
      const gradeOrder = ['R', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
      const sortedGrades = Object.entries(grades)
        .map(([grade, count]) => ({ grade, count }))
        .sort((a, b) => {
          const aIdx = gradeOrder.indexOf(a.grade);
          const bIdx = gradeOrder.indexOf(b.grade);
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
      
      setGradeBreakdown(sortedGrades);
      
      // Recent registrations (last 5)
      setRecentRegistrations(data.slice(0, 5));
      
    } catch (err) {
      console.error('[K12Dashboard] Load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  // Quick actions for K-12 admin
  const quickActions = [
    {
      id: 'aftercare',
      title: 'Aftercare Registrations',
      icon: 'time-outline',
      color: '#8B5CF6',
      badge: stats.pendingPayment > 0 ? stats.pendingPayment : undefined,
      onPress: () => router.push('/screens/aftercare-admin'),
    },
    {
      id: 'students',
      title: 'Students',
      icon: 'people-outline',
      color: '#3B82F6',
      badge: stats.enrolled,
      onPress: () => router.push('/screens/student-management'),
    },
    {
      id: 'attendance',
      title: 'Attendance',
      icon: 'checkbox-outline',
      color: '#10B981',
      onPress: () => router.push('/screens/attendance'),
    },
    {
      id: 'payments',
      title: 'Payments',
      icon: 'card-outline',
      color: '#F59E0B',
      badge: stats.pendingPayment > 0 ? stats.pendingPayment : undefined,
      onPress: () => router.push('/screens/payment-management'),
    },
    {
      id: 'announcements',
      title: 'Announcements',
      icon: 'megaphone-outline',
      color: '#EC4899',
      onPress: () => router.push('/screens/announcements'),
    },
    {
      id: 'calendar',
      title: 'Calendar',
      icon: 'calendar-outline',
      color: '#06B6D4',
      onPress: () => router.push('/screens/calendar'),
    },
    {
      id: 'messages',
      title: 'Messages',
      icon: 'chatbubbles-outline',
      color: '#6366F1',
      onPress: () => router.push('/screens/messages'),
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings-outline',
      color: '#64748B',
      onPress: () => router.push('/screens/school-settings'),
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={['#1E3A5F', '#0F172A']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.userName}>{userName} 👋</Text>
          <Text style={styles.schoolName}>EduDash Pro Community School</Text>
          <View style={styles.schoolTypeBadge}>
            <Text style={styles.schoolTypeText}>K-12 School • Grade R to Grade 12</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Stats Overview */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Aftercare Overview</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: '#3B82F620' }]}>
            <Ionicons name="people" size={24} color="#3B82F6" />
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Registrations</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#F59E0B20' }]}>
            <Ionicons name="time" size={24} color="#F59E0B" />
            <Text style={styles.statNumber}>{stats.pendingPayment}</Text>
            <Text style={styles.statLabel}>Pending Payment</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#10B98120' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.statNumber}>{stats.paid}</Text>
            <Text style={styles.statLabel}>Paid</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#8B5CF620' }]}>
            <Ionicons name="school" size={24} color="#8B5CF6" />
            <Text style={styles.statNumber}>{stats.enrolled}</Text>
            <Text style={styles.statLabel}>Enrolled</Text>
          </View>
        </View>
      </View>

      {/* Grade Breakdown */}
      {gradeBreakdown.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Students by Grade</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeScroll}>
            {gradeBreakdown.map(({ grade, count }) => (
              <View key={grade} style={styles.gradeCard}>
                <Text style={styles.gradeLabel}>Grade {grade}</Text>
                <Text style={styles.gradeCount}>{count}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map(action => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionCard}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: `${action.color}20` }]}>
                <Ionicons name={action.icon as any} size={24} color={action.color} />
                {action.badge !== undefined && action.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{action.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent Registrations */}
      {recentRegistrations.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Registrations</Text>
            <TouchableOpacity onPress={() => router.push('/screens/aftercare-admin')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentRegistrations.map(reg => (
            <View key={reg.id} style={styles.registrationItem}>
              <View style={styles.registrationAvatar}>
                <Text style={styles.registrationAvatarText}>
                  {reg.child_first_name?.[0] || '?'}
                </Text>
              </View>
              <View style={styles.registrationInfo}>
                <Text style={styles.registrationName}>
                  {reg.child_first_name} {reg.child_last_name}
                </Text>
                <Text style={styles.registrationGrade}>Grade {reg.child_grade}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(reg.status) + '20' }
              ]}>
                <Text style={[styles.statusText, { color: getStatusColor(reg.status) }]}>
                  {formatStatus(reg.status)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Bottom padding */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending_payment': return '#F59E0B';
    case 'paid': return '#10B981';
    case 'enrolled': return '#3B82F6';
    case 'cancelled': return '#EF4444';
    default: return '#64748B';
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case 'pending_payment': return 'Pending';
    case 'paid': return 'Paid';
    case 'enrolled': return 'Enrolled';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}

const createStyles = (theme: any, topInset: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
    gap: 16,
  },
  loadingText: {
    color: theme.textSecondary,
    fontSize: 16,
  },
  header: {
    paddingTop: topInset + 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    gap: 4,
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  schoolName: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  schoolTypeBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  schoolTypeText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    padding: 20,
    marginTop: -20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  statCard: {
    width: isTablet ? '23%' : '47%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  section: {
    padding: 20,
    paddingTop: 0,
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
    color: theme.text,
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '600',
  },
  gradeScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  gradeCard: {
    backgroundColor: theme.card,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  gradeLabel: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  gradeCount: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: isTablet ? '23%' : '47%',
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
  },
  registrationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  registrationAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F620',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registrationAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  registrationInfo: {
    flex: 1,
  },
  registrationName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  registrationGrade: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default K12AdminDashboard;
