/**
 * useRealtimeTier Hook
 * 
 * Provides real-time subscription updates by listening to user_ai_tiers
 * and user_ai_usage table changes via Supabase Realtime.
 * 
 * Complies with WARP.md:
 * - Hooks ≤200 lines
 * - Multi-tenant security with user_id scoping
 * - Analytics tracking for tier changes
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { track } from '@/lib/analytics';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface TierStatus {
  tier: string;
  tierDisplayName: string;
  isActive: boolean;
  expiresAt: string | null;
  quotaUsed: number;
  quotaLimit: number;
  quotaPercentage: number;
  lastUpdated: Date;
}

export interface UseRealtimeTierOptions {
  /** Enable real-time updates (default: true) */
  enabled?: boolean;
  /** Custom user ID (defaults to current auth user) */
  userId?: string;
  /** Callback when tier changes */
  onTierChange?: (newTier: string, oldTier: string) => void;
}

/**
 * Hook for real-time tier status updates
 */
export function useRealtimeTier(options: UseRealtimeTierOptions = {}) {
  const { enabled = true, userId: customUserId, onTierChange } = options;
  const { user } = useAuth();
  const { tier: contextTier, refresh: refreshContext } = useSubscription();
  
  const userId = customUserId || user?.id;
  const [tierStatus, setTierStatus] = useState<TierStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const previousTierRef = useRef<string | null>(null);
  
  /**
   * Fetch current tier status from database
   */
  const fetchTierStatus = useCallback(async () => {
    if (!userId) return;
    
    try {
      const supabase = assertSupabase();
      
      // Fetch from user_ai_usage (contains current_tier)
      const { data: usageData, error: usageError } = await supabase
        .from('user_ai_usage')
        .select('current_tier, chat_messages_today, exams_generated_this_month, last_monthly_reset_at')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (usageError) throw usageError;
      
      // Also try to fetch from user_ai_tiers for more details
      const { data: tierData, error: tierError } = await supabase
        .from('user_ai_tiers')
        .select('tier, expires_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      
      // Determine effective tier
      const effectiveTier = tierData?.tier || usageData?.current_tier || contextTier || 'free';
      
      // Get tier limits
      const { data: limitsData } = await supabase
        .from('ai_usage_tiers')
        .select('chat_messages_per_day, exams_per_month')
        .eq('tier_name', effectiveTier)
        .maybeSingle();
      
      const quotaLimit = limitsData?.chat_messages_per_day || 10;
      const quotaUsed = usageData?.chat_messages_today || 0;
      
      const newStatus: TierStatus = {
        tier: effectiveTier,
        tierDisplayName: formatTierName(effectiveTier),
        isActive: !tierData?.expires_at || new Date(tierData.expires_at) > new Date(),
        expiresAt: tierData?.expires_at || null,
        quotaUsed,
        quotaLimit,
        quotaPercentage: quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0,
        lastUpdated: new Date(),
      };
      
      // Detect tier changes
      if (previousTierRef.current && previousTierRef.current !== effectiveTier) {
        track('edudash.subscription.tier_changed', {
          old_tier: previousTierRef.current,
          new_tier: effectiveTier,
          user_id: userId,
          source: 'realtime',
        });
        
        onTierChange?.(effectiveTier, previousTierRef.current);
      }
      
      previousTierRef.current = effectiveTier;
      setTierStatus(newStatus);
      setError(null);
      
    } catch (err) {
      console.error('[useRealtimeTier] Error fetching tier status:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch tier status'));
    } finally {
      setIsLoading(false);
    }
  }, [userId, contextTier, onTierChange]);
  
  /**
   * Set up real-time subscription
   */
  useEffect(() => {
    if (!enabled || !userId) return;
    
    // Initial fetch
    fetchTierStatus();
    
    // Set up real-time subscription
    const supabase = assertSupabase();
    
    const channel = supabase.channel(`tier-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes
          schema: 'public',
          table: 'user_ai_usage',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('[useRealtimeTier] user_ai_usage change detected:', payload);
          fetchTierStatus();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_ai_tiers',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('[useRealtimeTier] user_ai_tiers change detected:', payload);
          fetchTierStatus();
          
          // Also refresh the subscription context
          refreshContext();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useRealtimeTier] Realtime subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useRealtimeTier] Realtime subscription error');
        }
      });
    
    channelRef.current = channel;
    
    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, userId, fetchTierStatus, refreshContext]);
  
  /**
   * Manual refresh function
   */
  const refresh = useCallback(() => {
    setIsLoading(true);
    fetchTierStatus();
  }, [fetchTierStatus]);
  
  return {
    tierStatus,
    isLoading,
    error,
    refresh,
    tier: tierStatus?.tier || contextTier || 'free',
    tierDisplayName: tierStatus?.tierDisplayName || formatTierName(contextTier || 'free'),
    isActive: tierStatus?.isActive ?? true,
    quotaPercentage: tierStatus?.quotaPercentage || 0,
  };
}

/**
 * Format tier name for display
 */
function formatTierName(tier: string): string {
  const names: Record<string, string> = {
    free: 'Free',
    parent_starter: 'Parent Starter',
    parent_plus: 'Parent Plus',
    starter: 'Starter',
    premium: 'Premium',
    pro: 'Pro',
    enterprise: 'Enterprise',
    school_starter: 'School Starter',
    school_premium: 'School Premium',
    school_pro: 'School Pro',
  };
  
  const normalized = tier.toLowerCase().replace('-', '_');
  return names[normalized] || tier.charAt(0).toUpperCase() + tier.slice(1);
}

export default useRealtimeTier;
