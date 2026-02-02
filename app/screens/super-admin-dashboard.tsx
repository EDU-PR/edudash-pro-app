import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity, RefreshControl, Switch, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ThemedStatusBar from '@/components/ui/ThemedStatusBar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';
import { useTheme } from '@/contexts/ThemeContext';
import { isSuperAdmin } from '@/lib/roleUtils';
import { assertSupabase } from '@/lib/supabase';
import { listActivePlans } from '@/lib/subscriptions/rpc-subscriptions';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { SuperAdminAIControl, SuperAdminAIControlState } from '@/services/superadmin/SuperAdminAIControl';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface DashboardStats {
  total_users: number;
  active_users: number;
  total_organizations: number;
  active_seats: number;
  monthly_revenue: number;
  ai_usage_cost: number;
  system_health: 'healthy' | 'degraded' | 'down';
  pending_issues: number;
}

interface RecentAlert {
  id: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: string;
}

interface SystemStatus {
  database: { status: string; color: string; };
  api: { status: string; color: string; };
  security: { status: string; color: string; };
}

interface FeatureFlag {
  name: string;
  percentage: number;
  color: string;
  enabled: boolean;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  badge?: number;
}

export default function SuperAdminDashboardScreen() {
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const { theme, isDark } = useTheme();
  const { showAlert, alertProps } = useAlertModal();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [aiControl, setAiControl] = useState<SuperAdminAIControlState | null>(null);
  const [aiControlLoading, setAiControlLoading] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordModalMessage, setPasswordModalMessage] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const passwordResolverRef = useRef<((ok: boolean) => void) | null>(null);

  // Quick actions configuration
  const quickActions: QuickAction[] = [
    {
      id: 'ai-command-center',
      title: 'Dash AI Command Center',
      description: 'Admin controls for agentic AI operations',
      icon: 'flash',
      route: '/screens/super-admin-ai-command-center',
      color: '#00f5ff',
      badge: 0,
    },
    {
      id: 'organizations',
      title: 'Organizations',
      description: 'View & manage all registered organizations',
      icon: 'business',
      route: '/screens/super-admin-organizations',
      color: '#10b981',
      badge: dashboardStats?.total_organizations || 0,
    },
    {
      id: 'school-onboarding',
      title: 'School Onboarding',
      description: 'Create and onboard new schools',
      icon: 'school',
      route: '/screens/super-admin/school-onboarding-wizard',
      color: '#00f5ff',
      badge: 0,
    },
    {
      id: 'users',
      title: 'User Management',
      description: 'Manage users, roles, and permissions',
      icon: 'people',
      route: '/screens/super-admin-users',
      color: '#3b82f6',
      badge: dashboardStats?.pending_issues || 0,
    },
    {
      id: 'admin-management',
      title: 'Admin Management',
      description: 'Create and manage admin users',
      icon: 'people-circle',
      route: '/screens/super-admin-admin-management',
      color: '#6366f1',
    },
    {
      id: 'ai-quotas',
      title: 'Dash AI Quota Management',
      description: 'Monitor and manage Dash AI usage quotas',
      icon: 'hardware-chip',
      route: '/screens/super-admin-ai-quotas',
      color: '#10b981',
    },
    {
      id: 'content-moderation',
      title: 'Content Moderation',
      description: 'Review and moderate user content',
      icon: 'shield-checkmark',
      route: '/screens/super-admin-moderation',
      color: '#f59e0b',
    },
    {
      id: 'announcements',
      title: 'Announcements',
      description: 'Broadcast messages to all schools',
      icon: 'megaphone',
      route: '/screens/super-admin-announcements',
      color: '#ec4899',
    },
    {
      id: 'whatsapp-integration',
      title: 'WhatsApp Hub',
      description: 'Manage WhatsApp communications',
      icon: 'logo-whatsapp',
      route: '/screens/super-admin-whatsapp',
      color: '#25d366',
    },
    {
      id: 'system-monitoring',
      title: 'System Monitoring',
      description: 'View system health and performance',
      icon: 'analytics',
      route: '/screens/super-admin-system-monitoring',
      color: '#f59e0b',
    },
    {
      id: 'devops',
      title: 'DevOps & Integrations',
      description: 'GitHub, EAS, Vercel, Claude & Campaigns',
      icon: 'git-branch',
      route: '/screens/super-admin-devops',
      color: '#059669',
    },
    {
      id: 'system-test',
      title: 'System Tests',
      description: 'Run comprehensive system validation',
      icon: 'checkmark-circle',
      route: '/screens/super-admin-system-test',
      color: '#8b5cf6',
    },
  ];

  // Fetch dashboard data with real system health
  const fetchDashboardData = useCallback(async () => {
    if (!isSuperAdmin(profile?.role)) return;

    try {
      setLoading(true);
      
      // Fetch dashboard data, system health, subscriptions, error logs, and AI costs
      const [dashboardResponse, healthResponse, logsResponse, aiCostResponse] = await Promise.all([
        assertSupabase().rpc('get_superadmin_dashboard_data'),
        assertSupabase().rpc('get_system_health_metrics'),
        assertSupabase().rpc('get_recent_error_logs', { hours_back: 24 }),
        assertSupabase().rpc('get_superadmin_ai_usage_cost', { days_back: 30 })
      ]);
      
      let systemHealthStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
      let pendingIssues = 0;
      let totalOrgs = 0;
      let activeSeats = 0;
      let monthlyRevenue = 0;
      let aiUsageCost = 0;
      
      // Process system health
      if (healthResponse.data?.success) {
        const dbStatus = healthResponse.data.data.database_status;
        const errorCount = healthResponse.data.data.recent_errors_24h || 0;
        
        if (dbStatus === 'critical' || errorCount > 10) {
          systemHealthStatus = 'down';
          pendingIssues += 3;
        } else if (dbStatus === 'degraded' || errorCount > 5) {
          systemHealthStatus = 'degraded';
          pendingIssues += 1;
        }
      }
      
      // Process AI usage cost data
      if (aiCostResponse.data?.success && aiCostResponse.data.data) {
        aiUsageCost = aiCostResponse.data.data.monthly_cost || 0;
        if (__DEV__) {
        console.log(`AI usage cost for last 30 days: $${aiUsageCost}`);
        }
      } else if (aiCostResponse.error) {
        if (__DEV__) {
        console.warn('AI cost RPC error:', aiCostResponse.error);
        }
      }
      
      // Fetch data in parallel - hybrid system for preschools AND K-12 schools
      const [preschoolsResponse, schoolsResponse, subscriptionsResponse, usersResponse] = await Promise.all([
        // Get active preschools
        assertSupabase().from('preschools').select('id').eq('is_active', true),
        // Get active K-12 schools 
        assertSupabase().from('schools').select('id').eq('is_active', true),
        // Get active subscriptions with billing info
        assertSupabase().from('subscriptions').select('id,seats_total,plan_id,status,billing_frequency').eq('status', 'active'),
        // Get total users count (with limit for performance)
        assertSupabase().from('profiles').select('id').limit(1000)
      ]);
      
      // Process hybrid tenant count (preschools + K-12 schools)
      const preschoolCount = (preschoolsResponse.data || []).length;
      const schoolCount = (schoolsResponse.data || []).length;
      totalOrgs = preschoolCount + schoolCount;
      
      if (__DEV__) {
      console.log(`Dashboard tenant count: ${preschoolCount} preschools + ${schoolCount} K-12 schools = ${totalOrgs} total`);
      }
      
      // Process subscriptions for seats and revenue (supports both preschools and K-12 schools)
      const subscriptions = subscriptionsResponse.data || [];
      if (subscriptions.length > 0) {
        // Count total active seats across all educational institutions
        activeSeats = subscriptions.reduce((sum, sub: any) => sum + (sub.seats_total || 0), 0);
        
        // Get pricing data for revenue calculation
        const planIds = Array.from(new Set(subscriptions.map((s: any) => s.plan_id).filter(Boolean)));
        if (planIds.length > 0) {
          const plans = await listActivePlans(assertSupabase());
          const relevantPlans = (plans || []).filter((plan) => planIds.includes(plan.id));
          // Build price map like the old dashboard
          const priceByPlanId: Record<string, { monthly: number; annual: number | null }> = {};
          relevantPlans.forEach((p: any) => {
            priceByPlanId[p.id] = {
              monthly: Number(p.price_monthly || 0),
              annual: p.price_annual != null ? Number(p.price_annual) : null
            };
          });
          
          // Calculate monthly revenue: annual plans normalized to monthly by dividing by 12
          // This works for both preschools and K-12 schools
          monthlyRevenue = subscriptions.reduce((sum, sub: any) => {
            const price = priceByPlanId[sub.plan_id];
            if (!price) return sum;
            if (String(sub.billing_frequency) === 'annual' && price.annual && price.annual > 0) {
              return sum + (price.annual / 12);
            }
            return sum + (price.monthly || 0);
          }, 0);
        }
      }
      
      if (__DEV__) {
      console.log(`Dashboard subscription summary: ${subscriptions.length} active subscriptions, ${activeSeats} seats, R${Math.round(monthlyRevenue)} monthly revenue`);
      }
      
      // Process recent alerts from error logs
      const alerts: RecentAlert[] = [];
      if (logsResponse.data?.success && logsResponse.data.data?.logs) {
        const errorLogs = logsResponse.data.data.logs.slice(0, 3);
        alerts.push(...errorLogs.map((log: any, index: number) => ({
          id: `log_${index}`,
          message: log.message || 'System error occurred',
          severity: log.level === 'error' ? 'high' : log.level === 'warning' ? 'medium' : 'low',
          timestamp: log.timestamp
        })));
      }
      
      // Add some system-generated alerts
      if (systemHealthStatus === 'down') {
        alerts.unshift({
          id: 'sys_down',
          message: 'System health degraded - immediate attention required',
          severity: 'high',
          timestamp: new Date().toISOString()
        });
      }
      
      setRecentAlerts(alerts);
      
      if (dashboardResponse.error) {
        console.error('[SuperAdminDashboard] Dashboard RPC error:', dashboardResponse.error);
      }
      
      // Use direct user count like old dashboard, with RPC as backup
      const totalUsers = (usersResponse.data || []).length;
      const stats = dashboardResponse.data?.data?.user_stats;
      
      setDashboardStats({
        total_users: totalUsers || stats?.total_users || 0,
        active_users: stats?.active_users || 0,
        total_organizations: totalOrgs,
        active_seats: activeSeats,
        monthly_revenue: monthlyRevenue,
        ai_usage_cost: aiUsageCost,
        system_health: systemHealthStatus,
        pending_issues: pendingIssues,
      });
      
      // Set system status based on health data
      const dbStatus = healthResponse.data?.data?.database_status || 'unknown';
      const dbColor = dbStatus === 'healthy' ? '#10b981' : dbStatus === 'degraded' ? '#f59e0b' : '#ef4444';
      
      setSystemStatus({
        database: {
          status: dbStatus === 'healthy' ? 'Operational' : dbStatus === 'degraded' ? 'Degraded' : 'Issues',
          color: dbColor
        },
        api: {
          status: systemHealthStatus === 'healthy' ? 'All Systems Go' : 'Some Issues',
          color: systemHealthStatus === 'healthy' ? '#10b981' : '#f59e0b'
        },
        security: {
          status: healthResponse.data?.data?.rls_enabled ? 'Protected' : 'Warning',
          color: healthResponse.data?.data?.rls_enabled ? '#10b981' : '#f59e0b'
        }
      });
      
      // Get real feature flags from database config_kv table
      const { data: configData } = await assertSupabase()
        .from('config_kv')
        .select('key, value')
        .in('key', [
          'ai_gateway_enabled',
          'principal_hub_rollout',
          'stem_generator_enabled',
          'mobile_app_rollout',
          'payment_gateway_enabled'
        ]);

      const configMap = (configData || []).reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, any>);

      const flags: FeatureFlag[] = [
        {
          name: 'AI Gateway',
          percentage: configMap.ai_gateway_enabled === true || process.env.EXPO_PUBLIC_AI_ENABLED === 'true' ? 100 : 0,
          color: configMap.ai_gateway_enabled === true || process.env.EXPO_PUBLIC_AI_ENABLED === 'true' ? '#10b981' : '#ef4444',
          enabled: configMap.ai_gateway_enabled === true || process.env.EXPO_PUBLIC_AI_ENABLED === 'true'
        },
        {
          name: 'Principal Hub',
          percentage: totalOrgs > 0 ? (configMap.principal_hub_rollout?.percentage || 85) : 0,
          color: totalOrgs > 0 ? '#f59e0b' : '#6b7280',
          enabled: totalOrgs > 0
        },
        {
          name: 'STEM Generator',
          percentage: configMap.stem_generator_enabled === true ? 100 : 50, // Gradual rollout
          color: configMap.stem_generator_enabled === true ? '#10b981' : '#f59e0b',
          enabled: configMap.stem_generator_enabled === true
        },
        {
          name: 'Payment Gateway',
          percentage: activeSeats > 0 ? 100 : 0, // Enable if we have active subscriptions
          color: activeSeats > 0 ? '#10b981' : '#6b7280',
          enabled: activeSeats > 0
        },
        {
          name: 'Mobile App',
          percentage: configMap.mobile_app_rollout?.percentage || 75,
          color: (configMap.mobile_app_rollout?.percentage || 75) > 50 ? '#10b981' : '#f59e0b',
          enabled: (configMap.mobile_app_rollout?.percentage || 75) > 0
        },
      ];
      
      setFeatureFlags(flags);
    } catch (error) {
      console.error('[SuperAdminDashboard] Failed to fetch dashboard data:', error);
      // Minimal fallback with error alert
      setDashboardStats({
        total_users: 0,
        active_users: 0,
        total_organizations: 0,
        active_seats: 0,
        monthly_revenue: 0,
        ai_usage_cost: 0,
        system_health: 'degraded',
        pending_issues: 1,
      });
      setRecentAlerts([{
        id: 'error',
        message: 'Failed to load dashboard data - check connection',
        severity: 'high',
        timestamp: new Date().toISOString()
      }]);
      
      // Show user-friendly error
      showAlert({
        title: 'Dashboard Error',
        message: 'Unable to load dashboard data. Please check your connection and try again.',
        type: 'error',
        buttons: [
          { text: 'Retry', onPress: () => fetchDashboardData() },
          { text: 'Cancel', style: 'cancel' },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.role, showAlert]);

  const loadAIControl = useCallback(async (force = false) => {
    if (!isSuperAdmin(profile?.role) || !user?.id) return;

    setAiControlLoading(true);
    try {
      const state = await SuperAdminAIControl.getControlState({ force });
      setAiControl(state);
    } catch (error) {
      console.error('[SuperAdminDashboard] Failed to load AI control state:', error);
      showAlert({
        title: 'AI Control',
        message: 'Unable to load AI autonomy controls. Please try again.',
        type: 'error',
      });
    } finally {
      setAiControlLoading(false);
    }
  }, [profile?.role, showAlert, user?.id]);

  const requestPassword = useCallback(async (actionLabel: string): Promise<boolean> => {
    if (!user?.email) {
      showAlert({
        title: 'Password Required',
        message: 'Please sign in again to verify your password.',
        type: 'warning',
      });
      return false;
    }

    setPasswordValue('');
    setPasswordError(null);
    setPasswordModalMessage(`Enter your password to ${actionLabel}.`);
    setPasswordModalVisible(true);

    return new Promise((resolve) => {
      passwordResolverRef.current = resolve;
    });
  }, [showAlert, user?.email]);

  const closePasswordModal = useCallback((confirmed: boolean) => {
    setPasswordSubmitting(false);
    setPasswordModalVisible(false);
    setPasswordValue('');
    setPasswordError(null);
    if (passwordResolverRef.current) {
      passwordResolverRef.current(confirmed);
      passwordResolverRef.current = null;
    }
  }, []);

  const handlePasswordConfirm = useCallback(async () => {
    if (!user?.email) {
      setPasswordError('Email not available. Please sign in again.');
      return;
    }

    if (!passwordValue) {
      setPasswordError('Enter your password to continue.');
      return;
    }

    setPasswordSubmitting(true);
    try {
      const { error } = await assertSupabase().auth.signInWithPassword({
        email: user.email,
        password: passwordValue,
      });

      if (error) {
        setPasswordError('Incorrect password. Please try again.');
        setPasswordSubmitting(false);
        return;
      }

      closePasswordModal(true);
    } catch (error) {
      console.error('[SuperAdminDashboard] Password confirmation failed:', error);
      setPasswordError('Unable to verify password. Please try again.');
      setPasswordSubmitting(false);
    }
  }, [closePasswordModal, passwordValue, user?.email]);

  const claimOwnership = useCallback(async () => {
    if (!user?.id) return;
    const confirmed = await requestPassword('claim ownership');
    if (!confirmed) return;

    setAiControlLoading(true);
    try {
      const updated = await SuperAdminAIControl.claimOwnership(user.id);
      setAiControl(updated);
      showAlert({
        title: 'Ownership Claimed',
        message: 'You are now the platform owner for Dash AI autonomy.',
        type: 'success',
      });
    } catch (error) {
      console.error('[SuperAdminDashboard] Failed to claim ownership:', error);
      showAlert({
        title: 'Ownership Error',
        message: 'Unable to claim ownership. It may already be claimed.',
        type: 'error',
      });
    } finally {
      setAiControlLoading(false);
    }
  }, [requestPassword, showAlert, user?.id]);

  const updateAIControl = useCallback(async (patch: Partial<SuperAdminAIControlState>) => {
    if (!user?.id) return;
    if (!aiControl) return;

    const isOwner = aiControl.owner_user_id === user.id;
    if (!isOwner) {
      showAlert({
        title: 'Owner Only',
        message: 'Only the platform owner can change Dash AI autonomy settings.',
        type: 'warning',
      });
      return;
    }

    const isEnablingAutonomy = patch.autonomy_enabled === true && !aiControl.autonomy_enabled;
    const isUpgradingMode =
      patch.autonomy_mode !== undefined &&
      patch.autonomy_mode !== aiControl.autonomy_mode &&
      ['copilot', 'full'].includes(patch.autonomy_mode);
    const isEnablingHighRisk = patch.auto_execute_high === true && !aiControl.auto_execute_high;

    if (isEnablingAutonomy || isUpgradingMode || isEnablingHighRisk) {
      const confirmed = await requestPassword('activate Dash AI autonomy privileges');
      if (!confirmed) return;
    }

    setAiControlLoading(true);
    try {
      const updated = await SuperAdminAIControl.updateControlState(patch, user.id, { force: true });
      setAiControl(updated);
    } catch (error) {
      console.error('[SuperAdminDashboard] Failed to update AI control state:', error);
      showAlert({
        title: 'Update Error',
        message: 'Unable to update AI autonomy settings. Please try again.',
        type: 'error',
      });
    } finally {
      setAiControlLoading(false);
    }
  }, [aiControl, requestPassword, showAlert, user?.id]);

  const applyAutonomyPreset = useCallback(async (preset: 'lockdown' | 'assistant' | 'copilot' | 'full') => {
    if (!aiControl) return;

    switch (preset) {
      case 'lockdown':
        await updateAIControl({
          autonomy_enabled: false,
          autonomy_mode: 'assistant',
          auto_execute_low: true,
          auto_execute_medium: false,
          auto_execute_high: false,
        });
        break;
      case 'assistant':
        await updateAIControl({
          autonomy_enabled: true,
          autonomy_mode: 'assistant',
          auto_execute_low: true,
          auto_execute_medium: false,
          auto_execute_high: false,
        });
        break;
      case 'copilot':
        await updateAIControl({
          autonomy_enabled: true,
          autonomy_mode: 'copilot',
          auto_execute_low: true,
          auto_execute_medium: true,
          auto_execute_high: false,
        });
        break;
      case 'full':
        await updateAIControl({
          autonomy_enabled: true,
          autonomy_mode: 'full',
          auto_execute_low: true,
          auto_execute_medium: true,
          auto_execute_high: true,
        });
        break;
      default:
        break;
    }
  }, [aiControl, updateAIControl]);

  useEffect(() => {
    fetchDashboardData();
    loadAIControl(true);
    
    // Track dashboard opening
    if (user?.id) {
      track('edudash.superadmin.dashboard_opened', {
        user_id: user.id,
        platform: Platform.OS,
      });
    }
  }, [fetchDashboardData, loadAIControl, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchDashboardData(), loadAIControl(true)]);
    setRefreshing(false);
  }, [fetchDashboardData, loadAIControl]);

  const handleQuickAction = (action: QuickAction) => {
    track('edudash.superadmin.quick_action', {
      user_id: user?.id,
      action_id: action.id,
      route: action.route,
    });
    
    router.push(action.route as any);
  };

  const getAlertColor = (severity: 'high' | 'medium' | 'low'): string => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatAlertTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hr ago`;
    return `${Math.floor(diffMins / 1440)} day ago`;
  };

  const isOwner = !!aiControl?.owner_user_id && aiControl?.owner_user_id === user?.id;
  const isOwnerUnclaimed = aiControl ? !aiControl.owner_user_id : false;
  const canEditAIControl = isOwner && !aiControlLoading;
  const highRiskAvailable = aiControl?.autonomy_mode === 'full';
  const ownerStatusText = !aiControl
    ? 'Owner status unavailable.'
    : isOwner
      ? 'You control Dash AI autonomy.'
      : isOwnerUnclaimed
        ? 'Ownership is unclaimed.'
        : 'Owned by another account.';

  // Show loading state while checking authentication
  if (authLoading || profileLoading) {
    return (
      <View style={styles.container}>
        <ThemedStatusBar />
        <SafeAreaView style={styles.loadingContainer}>
          <EduDashSpinner size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading admin profile…
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  // Access control: Check if user has super admin access
  if (!profile || !isSuperAdmin(profile.role)) {
    return (
      <View style={styles.container}>
        <ThemedStatusBar />
        <SafeAreaView style={styles.accessDeniedContainer}>
          <Ionicons name="shield-checkmark" size={64} color={theme.error} />
          <Text style={[styles.accessDeniedText, { color: theme.text }]}>
            Access Denied
          </Text>
          <Text style={[styles.accessDeniedSubtext, { color: theme.textSecondary }]}>
            Super Admin privileges required
          </Text>
          <Text style={[styles.debugText, { color: theme.textTertiary }]}>
            Current role: {profile?.role || 'undefined'}
          </Text>
          <TouchableOpacity 
            style={[styles.signOutButton, { backgroundColor: theme.error }]}
            onPress={() => router.replace('/(auth)/sign-in' as any)}
          >
            <Text style={[styles.signOutButtonText, { color: theme.onError }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <DesktopLayout role="super_admin" title="Super Admin">
      <View style={styles.container}>
        <ThemedStatusBar />
      
      {/* Quick Access Bar - AI Command Center + Health Status */}
      <View style={[styles.quickAccessBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity 
          style={[styles.aiButton, { backgroundColor: '#8b5cf6' }]}
          onPress={() => router.push('/screens/super-admin-ai-command-center' as any)}
        >
          <Ionicons name="flash" size={16} color="#fff" />
          <Text style={styles.aiButtonText}>Dash AI Command</Text>
        </TouchableOpacity>
        
        {/* Health indicator */}
        <View style={[styles.healthIndicator, { 
          backgroundColor: dashboardStats?.system_health === 'healthy' ? '#10b98108' : '#f59e0b08',
          borderColor: dashboardStats?.system_health === 'healthy' ? '#10b981' : '#f59e0b'
        }]}>
          <Ionicons 
            name={dashboardStats?.system_health === 'healthy' ? 'checkmark-circle' : 'warning'} 
            size={14} 
            color={dashboardStats?.system_health === 'healthy' ? '#10b981' : '#f59e0b'} 
          />
          <Text style={[styles.healthText, { 
            color: dashboardStats?.system_health === 'healthy' ? '#10b981' : '#f59e0b'
          }]}>
            {dashboardStats?.system_health === 'healthy' ? 'All Systems Operational' : 'System Issues'}
          </Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Dash AI Owner Controls */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Dash AI Owner Controls</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
            One-owner autonomy controls for when you're away
          </Text>
          <View style={[styles.aiControlCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.aiControlHeader}>
              <View style={styles.aiControlOwnerInfo}>
                <Text style={[styles.aiControlTitle, { color: theme.text }]}>Platform Owner</Text>
                <Text style={[styles.aiControlSubtext, { color: theme.textSecondary }]}>
                  {ownerStatusText}
                </Text>
              </View>
              {aiControlLoading ? (
                <EduDashSpinner size="small" color={theme.primary} />
              ) : !aiControl ? (
                <View style={[
                  styles.aiOwnerBadge,
                  { backgroundColor: theme.warningLight, borderColor: theme.warning }
                ]}>
                  <Text style={[styles.aiOwnerBadgeText, { color: theme.warning }]}>
                    OFFLINE
                  </Text>
                </View>
              ) : isOwnerUnclaimed ? (
                <TouchableOpacity
                  style={[styles.aiOwnerButton, { backgroundColor: theme.primary }]}
                  onPress={claimOwnership}
                >
                  <Text style={[styles.aiOwnerButtonText, { color: theme.onPrimary }]}>Claim</Text>
                </TouchableOpacity>
              ) : (
                <View style={[
                  styles.aiOwnerBadge,
                  {
                    backgroundColor: isOwner ? theme.successLight : theme.warningLight,
                    borderColor: isOwner ? theme.success : theme.warning,
                  }
                ]}>
                  <Text style={[
                    styles.aiOwnerBadgeText,
                    { color: isOwner ? theme.success : theme.warning }
                  ]}>
                    {isOwner ? 'OWNER' : 'READ ONLY'}
                  </Text>
                </View>
              )}
            </View>

            {!aiControl && !aiControlLoading && (
              <Text style={[styles.aiControlSubtext, { color: theme.textSecondary }]}>
                Unable to load autonomy settings. Pull to refresh.
              </Text>
            )}

            {aiControl && (
              <>
                <View style={[styles.aiControlDivider, { backgroundColor: theme.divider }]} />

                <View style={styles.aiControlRow}>
                  <View style={styles.aiControlInfo}>
                    <Text style={[styles.aiControlLabel, { color: theme.text }]}>Autonomy Enabled</Text>
                    <Text style={[styles.aiControlHint, { color: theme.textSecondary }]}>
                      Allow Dash AI to run tasks when you're unavailable
                    </Text>
                  </View>
                  <Switch
                    value={!!aiControl.autonomy_enabled}
                    onValueChange={(value) => updateAIControl({ autonomy_enabled: value })}
                    disabled={!canEditAIControl}
                  />
                </View>

                <View style={styles.aiControlRow}>
                  <View style={styles.aiControlInfo}>
                    <Text style={[styles.aiControlLabel, { color: theme.text }]}>Autonomy Mode</Text>
                    <Text style={[styles.aiControlHint, { color: theme.textSecondary }]}>
                      Choose how proactive Dash should be
                    </Text>
                  </View>
                </View>
                <View style={styles.aiModeRow}>
                  {(['assistant', 'copilot', 'full'] as const).map((mode) => {
                    const isActive = aiControl.autonomy_mode === mode;
                    return (
                      <TouchableOpacity
                        key={mode}
                        style={[
                          styles.aiModeButton,
                          {
                            backgroundColor: isActive ? theme.primary : theme.surfaceVariant,
                            borderColor: isActive ? theme.primary : theme.border,
                            opacity: canEditAIControl ? 1 : 0.6,
                          }
                        ]}
                        onPress={() =>
                          updateAIControl({
                            autonomy_mode: mode,
                            ...(mode !== 'full' ? { auto_execute_high: false } : {})
                          })
                        }
                        disabled={!canEditAIControl}
                      >
                        <Text style={[
                          styles.aiModeButtonText,
                          { color: isActive ? theme.onPrimary : theme.text }
                        ]}>
                          {mode === 'assistant' ? 'Assistant' : mode === 'copilot' ? 'Copilot' : 'Full'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={[styles.aiControlDivider, { backgroundColor: theme.divider }]} />

                <View style={styles.aiControlRow}>
                  <View style={styles.aiControlInfo}>
                    <Text style={[styles.aiControlLabel, { color: theme.text }]}>Auto-execute Low Risk</Text>
                    <Text style={[styles.aiControlHint, { color: theme.textSecondary }]}>
                      Routine actions (safe to run automatically)
                    </Text>
                  </View>
                  <Switch
                    value={!!aiControl.auto_execute_low}
                    onValueChange={(value) => updateAIControl({ auto_execute_low: value })}
                    disabled={!canEditAIControl}
                  />
                </View>

                <View style={styles.aiControlRow}>
                  <View style={styles.aiControlInfo}>
                    <Text style={[styles.aiControlLabel, { color: theme.text }]}>Auto-execute Medium Risk</Text>
                    <Text style={[styles.aiControlHint, { color: theme.textSecondary }]}>
                      Requires more caution; enable for copilot/full
                    </Text>
                  </View>
                  <Switch
                    value={!!aiControl.auto_execute_medium}
                    onValueChange={(value) => updateAIControl({ auto_execute_medium: value })}
                    disabled={!canEditAIControl || aiControl.autonomy_mode === 'assistant'}
                  />
                </View>

                <View style={styles.aiControlRow}>
                  <View style={styles.aiControlInfo}>
                    <Text style={[styles.aiControlLabel, { color: theme.text }]}>Auto-execute High Risk</Text>
                    <Text style={[styles.aiControlHint, { color: theme.textSecondary }]}>
                      Only available in Full mode
                    </Text>
                  </View>
                  <Switch
                    value={!!aiControl.auto_execute_high && highRiskAvailable}
                    onValueChange={(value) => updateAIControl({ auto_execute_high: value })}
                    disabled={!canEditAIControl || !highRiskAvailable}
                  />
                </View>

                <View style={styles.aiControlRow}>
                  <View style={styles.aiControlInfo}>
                    <Text style={[styles.aiControlLabel, { color: theme.text }]}>Confirm Navigation</Text>
                    <Text style={[styles.aiControlHint, { color: theme.textSecondary }]}>
                      Require approval before app navigation
                    </Text>
                  </View>
                  <Switch
                    value={!!aiControl.require_confirm_navigation}
                    onValueChange={(value) => updateAIControl({ require_confirm_navigation: value })}
                    disabled={!canEditAIControl}
                  />
                </View>

                {!aiControl.autonomy_enabled && (
                  <Text style={[styles.aiControlNote, { color: theme.textSecondary }]}>
                    Autonomy is disabled. Dash will request approval for actions.
                  </Text>
                )}

                <View style={styles.aiPresetRow}>
                  <TouchableOpacity
                    style={[
                      styles.aiPresetButton,
                      { borderColor: theme.border, backgroundColor: theme.surfaceVariant, opacity: canEditAIControl ? 1 : 0.6 }
                    ]}
                    onPress={() => applyAutonomyPreset('lockdown')}
                    disabled={!canEditAIControl}
                  >
                    <Text style={[styles.aiPresetButtonText, { color: theme.text }]}>Lockdown</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.aiPresetButton,
                      { borderColor: theme.border, backgroundColor: theme.surfaceVariant, opacity: canEditAIControl ? 1 : 0.6 }
                    ]}
                    onPress={() => applyAutonomyPreset('assistant')}
                    disabled={!canEditAIControl}
                  >
                    <Text style={[styles.aiPresetButtonText, { color: theme.text }]}>Assistant</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.aiPresetButton,
                      { borderColor: theme.border, backgroundColor: theme.surfaceVariant, opacity: canEditAIControl ? 1 : 0.6 }
                    ]}
                    onPress={() => applyAutonomyPreset('copilot')}
                    disabled={!canEditAIControl}
                  >
                    <Text style={[styles.aiPresetButtonText, { color: theme.text }]}>Copilot</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.aiPresetButton,
                      { borderColor: theme.border, backgroundColor: theme.surfaceVariant, opacity: canEditAIControl ? 1 : 0.6 }
                    ]}
                    onPress={() => applyAutonomyPreset('full')}
                    disabled={!canEditAIControl}
                  >
                    <Text style={[styles.aiPresetButtonText, { color: theme.text }]}>Full</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Global Platform Overview */}
        {dashboardStats && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Global Platform Overview</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Empowering educational institutions across South Africa</Text>
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
                <Ionicons name="business" size={24} color="#3b82f6" />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dashboardStats.total_organizations}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active Organizations</Text>
                <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>All institution types</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
                <Ionicons name="card" size={24} color="#10b981" />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  R{Math.round(dashboardStats.monthly_revenue).toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Monthly Revenue</Text>
                <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>Subscriptions</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
                <Ionicons name="alert-circle" size={24} color="#f59e0b" />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dashboardStats.pending_issues}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Critical Issues</Text>
                <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>Needs attention</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
                <Ionicons name="flash" size={24} color="#8b5cf6" />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  ${Math.round(dashboardStats.ai_usage_cost).toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>AI Usage Cost</Text>
                <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>Last 30 days</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
                <Ionicons name="people" size={24} color="#06b6d4" />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dashboardStats.total_users}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Users</Text>
                <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>
                  {dashboardStats.active_users} active
                </Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
                <Ionicons name="person-add" size={24} color="#ec4899" />
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dashboardStats.active_seats}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active Seats</Text>
                <Text style={[styles.statSubtext, { color: theme.textTertiary }]}>Licensed</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Alerts */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Alerts</Text>
          <View style={[styles.alertsContainer, { backgroundColor: theme.surface }]}>
            {recentAlerts.length > 0 ? (
              recentAlerts.map((alert) => (
                <View key={alert.id} style={[styles.alertItem, { borderBottomColor: theme.divider }]}>
                  <View style={[
                    styles.alertIndicator, 
                    { backgroundColor: getAlertColor(alert.severity) }
                  ]} />
                  <View style={styles.alertContent}>
                    <Text style={[styles.alertText, { color: theme.text }]}>{alert.message}</Text>
                    <Text style={[styles.alertTime, { color: theme.textSecondary }]}>
                      {formatAlertTime(alert.timestamp)}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyAlertsText, { color: theme.textSecondary }]}>No recent alerts</Text>
            )}
          </View>
        </View>

        {/* Feature Flag Status */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Feature Flag Status</Text>
          <View style={[styles.featureFlagsContainer, { backgroundColor: theme.surface }]}>
            {featureFlags.map((flag, index) => (
              <View 
                key={flag.name} 
                style={[styles.featureFlag, { 
                  borderBottomColor: index === featureFlags.length - 1 ? 'transparent' : theme.divider 
                }]}
              >
                <Text style={[styles.featureName, { color: theme.text }]}>{flag.name}</Text>
                <View style={[styles.featureStatusBadge, { backgroundColor: flag.color }]}>
                  <Text style={[styles.featureStatusText, { color: '#ffffff' }]}>
                    {flag.percentage}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.actionCard, { backgroundColor: theme.surface }]}
                onPress={() => handleQuickAction(action)}
              >
                <View style={styles.actionHeader}>
                  <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                    <Ionicons name={action.icon as any} size={24} color={action.color} />
                  </View>
                  {action.badge !== undefined && action.badge > 0 && (
                    <View style={[styles.actionBadge, { backgroundColor: theme.error }]}>
                      <Text style={[styles.actionBadgeText, { color: theme.onError }]}>
                        {action.badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.actionTitle, { color: theme.text }]}>{action.title}</Text>
                <Text style={[styles.actionDescription, { color: theme.textSecondary }]}>
                  {action.description}
                </Text>
                <View style={styles.actionFooter}>
                  <Ionicons name="arrow-forward" size={16} color={action.color} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* System Status */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>System Status</Text>
          <View style={[styles.statusCard, { backgroundColor: theme.surface }]}>
            {systemStatus ? (
              <>
                <View style={styles.statusItem}>
                  <Ionicons name="server" size={20} color={systemStatus.database.color} />
                  <View style={styles.statusInfo}>
                    <Text style={[styles.statusLabel, { color: theme.text }]}>Database</Text>
                    <Text style={[styles.statusValue, { color: systemStatus.database.color }]}>
                      {systemStatus.database.status}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.statusItem}>
                  <Ionicons name="cloud" size={20} color={systemStatus.api.color} />
                  <View style={styles.statusInfo}>
                    <Text style={[styles.statusLabel, { color: theme.text }]}>API Services</Text>
                    <Text style={[styles.statusValue, { color: systemStatus.api.color }]}>
                      {systemStatus.api.status}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.statusItem}>
                  <Ionicons name="shield-checkmark" size={20} color={systemStatus.security.color} />
                  <View style={styles.statusInfo}>
                    <Text style={[styles.statusLabel, { color: theme.text }]}>Security</Text>
                    <Text style={[styles.statusValue, { color: systemStatus.security.color }]}>
                      {systemStatus.security.status}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.statusItem}>
                <EduDashSpinner size="small" color={theme.primary} />
                <View style={styles.statusInfo}>
                  <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Loading system status...</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading dashboard data...
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => closePasswordModal(false)}
      >
        <View style={styles.passwordOverlay}>
          <View style={[styles.passwordCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.passwordTitle, { color: theme.text }]}>Confirm Password</Text>
            <Text style={[styles.passwordMessage, { color: theme.textSecondary }]}>
              {passwordModalMessage}
            </Text>
            <TextInput
              value={passwordValue}
              onChangeText={setPasswordValue}
              placeholder="Enter your password"
              placeholderTextColor={theme.textTertiary}
              secureTextEntry
              autoCapitalize="none"
              style={[
                styles.passwordInput,
                {
                  backgroundColor: theme.surfaceVariant,
                  borderColor: passwordError ? theme.error : theme.border,
                  color: theme.text,
                },
              ]}
            />
            {passwordError && (
              <Text style={[styles.passwordError, { color: theme.error }]}>{passwordError}</Text>
            )}
            <View style={styles.passwordActions}>
              <TouchableOpacity
                style={[styles.passwordButton, { borderColor: theme.border }]}
                onPress={() => closePasswordModal(false)}
                disabled={passwordSubmitting}
              >
                <Text style={[styles.passwordButtonText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.passwordButton, { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={handlePasswordConfirm}
                disabled={passwordSubmitting}
              >
                {passwordSubmitting ? (
                  <EduDashSpinner size="small" color={theme.onPrimary} />
                ) : (
                  <Text style={[styles.passwordButtonText, { color: theme.onPrimary }]}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AlertModal {...alertProps} />
      
      </View>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedText: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  accessDeniedSubtext: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  debugText: {
    fontSize: 12,
    marginBottom: 24,
    textAlign: 'center',
  },
  signOutButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  quickAccessBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  aiButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  subtitleText: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
    opacity: 0.7,
  },
  healthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    alignSelf: 'flex-start',
  },
  healthText: {
    fontSize: 11,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 8,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%', // Mobile-first: 2 cards per row
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  statSubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 24,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 18,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  aiControlCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  aiControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  aiControlOwnerInfo: {
    flex: 1,
  },
  aiControlTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  aiControlSubtext: {
    fontSize: 12,
    lineHeight: 16,
  },
  aiOwnerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  aiOwnerButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  aiOwnerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  aiOwnerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  aiControlDivider: {
    height: 1,
    marginVertical: 12,
  },
  aiControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  aiControlInfo: {
    flex: 1,
    paddingRight: 12,
  },
  aiControlLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  aiControlHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  aiModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  aiModeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  aiModeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  aiControlNote: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  aiPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  aiPresetButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  aiPresetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  passwordOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  passwordCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  passwordTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  passwordMessage: {
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  passwordError: {
    marginTop: 8,
    fontSize: 12,
  },
  passwordActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  passwordButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 96,
    alignItems: 'center',
  },
  passwordButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    padding: 14,
    borderRadius: 12,
    minHeight: 130,
    marginBottom: 12,
    // Better touch targets for mobile
    minWidth: 160,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  actionDescription: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  actionFooter: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    minHeight: 52, // Better touch target
  },
  statusInfo: {
    marginLeft: 12,
    flex: 1,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  statusValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingOverlay: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  alertsContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    minHeight: 60, // Better touch target
  },
  alertIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    lineHeight: 20,
  },
  alertTime: {
    fontSize: 12,
  },
  emptyAlertsText: {
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 24,
  },
  featureFlagsContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  featureFlag: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    minHeight: 56, // Better touch target
  },
  featureName: {
    fontSize: 14,
    fontWeight: '600',
  },
  featureStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 50,
    alignItems: 'center',
  },
  featureStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
