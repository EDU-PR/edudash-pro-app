/**
 * Custom hook for AI Quota management logic
 * @module components/super-admin/ai-quotas/useAIQuotaManagement
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin } from '@/lib/roleUtils';
import {
  AIQuotaSettings,
  GlobalQuotaConfig,
  UsageStatistics,
  QuotaFilters,
  DEFAULT_GLOBAL_CONFIG,
  DEFAULT_USAGE_STATS,
  DEFAULT_FILTERS,
} from './types';

/**
 * Hook for managing AI quota data and operations
 */
export function useAIQuotaManagement() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [schoolQuotas, setSchoolQuotas] = useState<AIQuotaSettings[]>([]);
  const [globalConfig, setGlobalConfig] = useState<GlobalQuotaConfig>(DEFAULT_GLOBAL_CONFIG);
  const [usageStats, setUsageStats] = useState<UsageStatistics>(DEFAULT_USAGE_STATS);
  const [filters, setFilters] = useState<QuotaFilters>(DEFAULT_FILTERS);

  const isAuthorized = isSuperAdmin(profile?.role);

  /**
   * Fetch AI quotas from the database
   */
  const fetchAIQuotas = useCallback(async () => {
    if (!isAuthorized) {
      Alert.alert('Access Denied', 'Super admin privileges required');
      return;
    }

    try {
      setLoading(true);

      const quotasResponse = await assertSupabase().rpc('get_superadmin_ai_quotas');
      
      if (quotasResponse.error) {
        console.error('AI quotas RPC error:', quotasResponse.error);
        throw new Error('Failed to fetch AI quota data');
      }

      if (!quotasResponse.data?.success) {
        throw new Error(quotasResponse.data?.error || 'Failed to fetch AI quota data');
      }

      const responseData = quotasResponse.data.data;
      
      // Set real school quotas from database
      const realQuotas: AIQuotaSettings[] = (responseData.school_quotas || []).map((quota: any) => ({
        id: quota.id,
        school_id: quota.school_id,
        school_name: quota.school_name,
        plan_type: quota.plan_type,
        monthly_limit: quota.monthly_limit,
        current_usage: quota.current_usage,
        reset_date: quota.reset_date,
        overage_allowed: quota.overage_allowed,
        overage_limit: quota.overage_limit,
        cost_per_overage: quota.cost_per_overage,
        warnings_enabled: quota.warnings_enabled,
        warning_thresholds: quota.warning_thresholds,
        is_suspended: quota.is_suspended,
        last_updated: quota.last_updated,
      }));

      setSchoolQuotas(realQuotas);

      // Update global config from database
      if (responseData.global_config) {
        setGlobalConfig({
          free_tier_limit: responseData.global_config.free_tier_limit,
          basic_tier_limit: responseData.global_config.basic_tier_limit,
          pro_tier_limit: responseData.global_config.pro_tier_limit,
          enterprise_tier_limit: responseData.global_config.enterprise_tier_limit,
          overage_rate: responseData.global_config.overage_rate,
          warning_thresholds: responseData.global_config.warning_thresholds,
          suspension_threshold: responseData.global_config.suspension_threshold,
          auto_reset_enabled: responseData.global_config.auto_reset_enabled,
          cost_alerts_enabled: responseData.global_config.cost_alerts_enabled,
        });
      }

      // Update usage statistics from database
      if (responseData.usage_stats) {
        setUsageStats({
          total_tokens_used: responseData.usage_stats.total_tokens_used,
          total_cost: responseData.usage_stats.total_cost,
          average_cost_per_school: responseData.usage_stats.average_cost_per_school,
          schools_over_limit: responseData.usage_stats.schools_over_limit,
          schools_suspended: responseData.usage_stats.schools_suspended,
          projected_monthly_cost: responseData.usage_stats.projected_monthly_cost,
          top_consuming_schools: responseData.usage_stats.top_consuming_schools,
        });
      }

      console.log(`AI Quotas: Loaded ${realQuotas.length} schools`);

    } catch (error) {
      console.error('Failed to fetch AI quotas:', error);
      Alert.alert('Error', 'Failed to load AI quota settings');
    } finally {
      setLoading(false);
    }
  }, [isAuthorized]);

  /**
   * Refresh data with pull-to-refresh
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAIQuotas();
    setRefreshing(false);
  }, [fetchAIQuotas]);

  /**
   * Update individual school quota
   */
  const updateSchoolQuota = useCallback(async (
    school: AIQuotaSettings, 
    newLimit: number, 
    overageAllowed: boolean
  ) => {
    try {
      setSaving(true);

      const updatedSchool: AIQuotaSettings = {
        ...school,
        monthly_limit: newLimit,
        overage_allowed: overageAllowed,
        last_updated: new Date().toISOString(),
      };

      setSchoolQuotas(prev => prev.map(s => 
        s.id === school.id ? updatedSchool : s
      ));

      track('superadmin_ai_quota_updated', {
        school_id: school.school_id,
        school_name: school.school_name,
        old_limit: school.monthly_limit,
        new_limit: newLimit,
        overage_allowed: overageAllowed,
      });

      const { error: logError } = await assertSupabase()
        .from('audit_logs')
        .insert({
          admin_user_id: profile?.id,
          action: 'ai_quota_updated',
          target_user_id: school.school_id,
          details: {
            school_name: school.school_name,
            old_limit: school.monthly_limit,
            new_limit: newLimit,
            overage_allowed: overageAllowed,
          },
        });

      if (logError) {
        console.error('Failed to log quota update:', logError);
      }

      Alert.alert('Success', 'AI quota updated successfully');

    } catch (error) {
      console.error('Failed to update AI quota:', error);
      Alert.alert('Error', 'Failed to update AI quota');
    } finally {
      setSaving(false);
    }
  }, [profile?.id]);

  /**
   * Suspend or reactivate school AI access
   */
  const suspendSchool = useCallback(async (school: AIQuotaSettings) => {
    const action = school.is_suspended ? 'reactivate' : 'suspend';
    
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} School`,
      `Are you sure you want to ${action} AI access for ${school.school_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: action === 'suspend' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const updatedSchool: AIQuotaSettings = {
                ...school,
                is_suspended: !school.is_suspended,
                last_updated: new Date().toISOString(),
              };

              setSchoolQuotas(prev => prev.map(s => 
                s.id === school.id ? updatedSchool : s
              ));

              track('superadmin_ai_access_toggled', {
                school_id: school.school_id,
                school_name: school.school_name,
                action: action,
                reason: action === 'suspend' ? 'manual_admin_action' : 'admin_reactivation',
              });

              const { error: logError } = await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: `ai_access_${action}ed`,
                  target_user_id: school.school_id,
                  details: {
                    school_name: school.school_name,
                    reason: `Manual ${action} by super admin`,
                    current_usage: school.current_usage,
                    monthly_limit: school.monthly_limit,
                  },
                });

              if (logError) {
                console.error('Failed to log AI access toggle:', logError);
              }

              Alert.alert('Success', `AI access ${action}ed for ${school.school_name}`);

            } catch (error) {
              console.error(`Failed to ${action} AI access:`, error);
              Alert.alert('Error', `Failed to ${action} AI access`);
            }
          }
        }
      ]
    );
  }, [profile?.id]);

  /**
   * Reset school usage to zero
   */
  const resetSchoolUsage = useCallback(async (school: AIQuotaSettings) => {
    Alert.alert(
      'Reset Usage',
      `Are you sure you want to reset AI usage for ${school.school_name}? This will set their current usage to 0.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              const updatedSchool: AIQuotaSettings = {
                ...school,
                current_usage: 0,
                is_suspended: false,
                last_updated: new Date().toISOString(),
              };

              setSchoolQuotas(prev => prev.map(s => 
                s.id === school.id ? updatedSchool : s
              ));

              track('superadmin_ai_usage_reset', {
                school_id: school.school_id,
                school_name: school.school_name,
                previous_usage: school.current_usage,
              });

              const { error: logError } = await assertSupabase()
                .from('audit_logs')
                .insert({
                  admin_user_id: profile?.id,
                  action: 'ai_usage_reset',
                  target_user_id: school.school_id,
                  details: {
                    school_name: school.school_name,
                    previous_usage: school.current_usage,
                    reset_reason: 'Manual admin reset',
                  },
                });

              if (logError) {
                console.error('Failed to log usage reset:', logError);
              }

              Alert.alert('Success', 'AI usage reset successfully');

            } catch (error) {
              console.error('Failed to reset AI usage:', error);
              Alert.alert('Error', 'Failed to reset AI usage');
            }
          }
        }
      ]
    );
  }, [profile?.id]);

  /**
   * Update global AI configuration
   */
  const updateGlobalConfig = useCallback(async (onComplete?: () => void) => {
    try {
      setSaving(true);

      track('superadmin_global_ai_config_updated', {
        free_tier_limit: globalConfig.free_tier_limit,
        basic_tier_limit: globalConfig.basic_tier_limit,
        pro_tier_limit: globalConfig.pro_tier_limit,
        enterprise_tier_limit: globalConfig.enterprise_tier_limit,
        overage_rate: globalConfig.overage_rate,
      });

      const { error: logError } = await assertSupabase()
        .from('audit_logs')
        .insert({
          admin_user_id: profile?.id,
          action: 'global_ai_config_updated',
          details: {
            config_changes: globalConfig,
          },
        });

      if (logError) {
        console.error('Failed to log global config update:', logError);
      }

      Alert.alert('Success', 'Global AI configuration updated successfully');
      onComplete?.();

    } catch (error) {
      console.error('Failed to update global config:', error);
      Alert.alert('Error', 'Failed to update global configuration');
    } finally {
      setSaving(false);
    }
  }, [globalConfig, profile?.id]);

  // Initial fetch
  useEffect(() => {
    fetchAIQuotas();
  }, [fetchAIQuotas]);

  // Filter schools based on current filters
  const filteredSchools = schoolQuotas.filter(school => {
    if (filters.plan !== 'all' && school.plan_type !== filters.plan) return false;
    if (filters.status !== 'all') {
      if (filters.status === 'over_limit' && school.current_usage <= school.monthly_limit) return false;
      if (filters.status === 'suspended' && !school.is_suspended) return false;
      if (filters.status === 'normal' && (school.current_usage > school.monthly_limit || school.is_suspended)) return false;
    }
    if (filters.search && !school.school_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  return {
    // State
    loading,
    refreshing,
    saving,
    isAuthorized,
    schoolQuotas,
    filteredSchools,
    globalConfig,
    usageStats,
    filters,
    
    // Setters
    setGlobalConfig,
    setFilters,
    
    // Actions
    onRefresh,
    updateSchoolQuota,
    suspendSchool,
    resetSchoolUsage,
    updateGlobalConfig,
  };
}
