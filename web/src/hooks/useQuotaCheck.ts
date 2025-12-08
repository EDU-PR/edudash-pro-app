import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  current_tier: string;
  upgrade_available: boolean;
}

export interface QuotaUsage {
  exams_generated_this_month: number;
  explanations_requested_this_month: number;
  chat_messages_today: number;
  current_tier: string;
  last_monthly_reset_at: string;
  last_daily_reset_at: string;
}

/**
 * Hook for checking and managing AI usage quotas
 * Integrates with the database quota system
 */
export function useQuotaCheck(userId: string | undefined) {
  const [usage, setUsage] = useState<QuotaUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  // Fetch current usage
  const fetchUsage = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_ai_usage')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // Ignore "not found" error
        console.error('[Quota] Failed to fetch usage:', error);
        return;
      }

      if (data) {
        setUsage(data);
      }
    } catch (error) {
      console.error('[Quota] Fetch error:', error);
    }
  }, [userId, supabase]);

  // Check if user can make a request
  const checkQuota = useCallback(async (
    requestType: 'exam_generation' | 'explanation' | 'chat_message'
  ): Promise<QuotaCheckResult | null> => {
    if (!userId) {
      console.error('[Quota] No user ID provided');
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('check_ai_usage_limit', {
        p_user_id: userId,
        p_request_type: requestType,
      });

      if (error) {
        console.error('[Quota] Check failed:', error);
        return null;
      }

      console.log('[Quota] Check result:', data);
      
      // Refresh usage data
      await fetchUsage();

      return data as QuotaCheckResult;
    } catch (error) {
      console.error('[Quota] Check error:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, supabase, fetchUsage]);

  // Increment usage after successful request
  const incrementUsage = useCallback(async (
    requestType: 'exam_generation' | 'explanation' | 'chat_message',
    status: 'success' | 'error' = 'success'
  ) => {
    if (!userId) return;

    try {
      await supabase.rpc('increment_ai_usage', {
        p_user_id: userId,
        p_request_type: requestType,
        p_status: status,
      });

      console.log('[Quota] Incremented:', requestType, status);
      
      // Refresh usage data
      await fetchUsage();
    } catch (error) {
      console.error('[Quota] Increment error:', error);
    }
  }, [userId, supabase, fetchUsage]);

  // Load initial usage on mount
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    usage,
    loading,
    checkQuota,
    incrementUsage,
    refreshUsage: fetchUsage,
  };
}
