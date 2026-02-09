/**
 * SuperAdmin Dashboard - Main Dashboard Component
 * 
 * Integrates with deployed RPC functions to show real platform metrics,
 * user statistics, and system health status for superadmin oversight.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { styles } from './SuperAdminDashboard.styles';

interface SuperAdminDashboardProps {
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

interface DashboardData {
  user_stats: {
    total_users: number;
    active_users: number;
    inactive_users: number;
    superadmins: number;
    principals: number;
    teachers: number;
    parents: number;
  };
  generated_at: string;
  success: boolean;
}

interface SystemTestResult {
  test_suite: string;
  run_at: string;
  superadmin_count: number;
  current_user_role: string;
  current_user_id: string;
  is_superadmin: boolean;
  system_status: string;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ loading, setLoading }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showAlert, alertProps } = useAlertModal();
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: dashboardResult, error: dashboardError } = await assertSupabase()
        .rpc('get_superadmin_dashboard_data');

      if (dashboardError) {
        throw new Error(`Dashboard data error: ${dashboardError.message}`);
      }

      if (dashboardResult && dashboardResult.success) {
        setDashboardData(dashboardResult.data ? {
          user_stats: dashboardResult.data.user_stats,
          generated_at: dashboardResult.data.generated_at || dashboardResult.generated_at,
          success: dashboardResult.success,
        } : dashboardResult);
      } else {
        throw new Error('Dashboard data fetch was not successful');
      }

      const { data: systemResult, error: systemError } = await assertSupabase()
        .rpc('test_superadmin_system');

      if (systemError) {
        logger.warn('System test error:', systemError.message);
      } else if (systemResult) {
        setSystemStatus(systemResult);
      }

      track('superadmin.dashboard.accessed', {
        user_id: user?.id,
        platform: Platform.OS,
        timestamp: new Date().toISOString(),
      });

    } catch (err: any) {
      logger.error('Failed to fetch dashboard data:', err);
      setError(err.message || 'Failed to load dashboard');
      showAlert({ title: 'Error', message: 'Failed to load dashboard data. Please try refreshing.' });
    } finally {
      setLoading(false);
    }
  }, [setLoading, user?.id, showAlert]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [fetchDashboardData, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

  const handleQuickAction = useCallback((action: string, route?: string) => {
    track('superadmin.quick_action', {
      action,
      user_id: user?.id,
      platform: Platform.OS,
    });

    if (route) {
      router.push(route as any);
    } else {
      showAlert({ title: 'Coming Soon', message: `${action} functionality will be available soon.` });
    }
  }, [user?.id, showAlert]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'operational':
        return theme.success || '#10b981';
      case 'no_superadmins':
        return theme.error || '#ef4444';
      default:
        return theme.warning || '#f59e0b';
    }
  };

  const formatNumber = (num: number) => num.toLocaleString();

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <SkeletonLoader height={120} style={{ margin: 16 }} />
        <SkeletonLoader height={200} style={{ margin: 16 }} />
        <SkeletonLoader height={150} style={{ margin: 16 }} />
      </View>
    );
  }

  if (error && !dashboardData) {
    return (
      <View style={[styles.container, styles.errorContainer, { backgroundColor: theme.background }]}>
        <Ionicons name="warning" size={48} color={theme.error} />
        <Text style={[styles.errorTitle, { color: theme.text }]}>Dashboard Error</Text>
        <Text style={[styles.errorMessage, { color: theme.textSecondary }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={onRefresh}
        >
          <Text style={[styles.retryButtonText, { color: theme.onPrimary }]}>Retry</Text>
        </TouchableOpacity>
        <AlertModal {...alertProps} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          colors={[theme.primary]}
        />
      }
    >
      {/* System Status Card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="pulse" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>System Status</Text>
        </View>
        
        {systemStatus ? (
          <View style={styles.systemStatusContainer}>
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Overall Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(systemStatus.system_status)}20` }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(systemStatus.system_status) }]} />
                <Text style={[styles.statusText, { color: getStatusColor(systemStatus.system_status) }]}>
                  {systemStatus.system_status.toUpperCase()}
                </Text>
              </View>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>SuperAdmins Online</Text>
              <Text style={[styles.statusValue, { color: theme.text }]}>{systemStatus.superadmin_count}</Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Your Access Level</Text>
              <Text style={[styles.statusValue, { color: systemStatus.is_superadmin ? theme.success : theme.warning }]}>
                {systemStatus.is_superadmin ? 'SuperAdmin' : 'Limited'}
              </Text>
            </View>
            
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Last Health Check</Text>
              <Text style={[styles.statusValue, { color: theme.text }]}>
                {new Date(systemStatus.run_at).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.statusLoadingContainer}>
            <EduDashSpinner size="small" color={theme.primary} />
            <Text style={[styles.statusLoadingText, { color: theme.textSecondary }]}>
              Checking system status...
            </Text>
          </View>
        )}
      </View>

      {/* User Statistics */}
      {dashboardData && (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="people" size={24} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Platform Users</Text>
          </View>
          
          <View style={styles.statsGrid}>
            {[
              { value: dashboardData.user_stats.total_users, label: 'Total Users', color: theme.text },
              { value: dashboardData.user_stats.active_users, label: 'Active Users', color: theme.success },
              { value: dashboardData.user_stats.inactive_users, label: 'Inactive Users', color: theme.warning },
              { value: dashboardData.user_stats.superadmins, label: 'SuperAdmins', color: theme.error },
              { value: dashboardData.user_stats.principals, label: 'Principals', color: theme.primary },
              { value: dashboardData.user_stats.teachers, label: 'Teachers', color: theme.text },
              { value: dashboardData.user_stats.parents, label: 'Parents', color: theme.text },
            ].map(({ value, label, color }) => (
              <View key={label} style={styles.statItem}>
                <Text style={[styles.statValue, { color }]}>{formatNumber(value)}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
              </View>
            ))}
          </View>
          
          <Text style={[styles.dataTimestamp, { color: theme.textTertiary }]}>
            Last updated: {new Date(dashboardData.generated_at).toLocaleString()}
          </Text>
        </View>
      )}

      {/* Quick Actions */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="flash" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Quick Actions</Text>
        </View>
        
        <View style={styles.quickActionsGrid}>
          {[
            { label: 'User Management', icon: 'people-outline' as const, route: '/screens/super-admin-users' },
            { label: 'AI Quotas', icon: 'flash-outline' as const, route: '/screens/super-admin-ai-quotas' },
            { label: 'System Health', icon: 'pulse-outline' as const, route: '/screens/super-admin-system-monitor' },
            { label: 'Settings', icon: 'settings-outline' as const, route: '/screens/super-admin-settings' },
          ].map(({ label, icon, route }) => (
            <TouchableOpacity
              key={label}
              style={[styles.quickActionButton, { borderColor: theme.divider }]}
              onPress={() => handleQuickAction(label, route)}
            >
              <Ionicons name={icon} size={24} color={theme.primary} />
              <Text style={[styles.quickActionText, { color: theme.text }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent Activity */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="time" size={24} color={theme.primary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Recent Activity</Text>
        </View>
        
        <View style={styles.activityList}>
          {[
            { text: 'System health check completed', time: '2 minutes ago', color: theme.success },
            { text: 'Dashboard data refreshed', time: '5 minutes ago', color: theme.primary },
            { text: 'User management system accessed', time: '12 minutes ago', color: theme.warning },
          ].map(({ text, time, color }) => (
            <View key={text} style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: color }]} />
              <View style={styles.activityContent}>
                <Text style={[styles.activityText, { color: theme.text }]}>{text}</Text>
                <Text style={[styles.activityTime, { color: theme.textSecondary }]}>{time}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <AlertModal {...alertProps} />
    </ScrollView>
  );
};

export default SuperAdminDashboard;
