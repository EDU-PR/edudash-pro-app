/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * SubscriptionContext - SIMPLIFIED
 * 
 * Single Source of Truth: profiles.subscription_tier
 * 
 * The database has a trigger (trigger_sync_subscription_tier) that automatically
 * syncs profiles.subscription_tier to user_ai_tiers and user_ai_usage tables.
 * 
 * This context now ONLY reads from profiles.subscription_tier for simplicity.
 * Teachers can inherit from their organization if they don't have a personal tier.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { assertSupabase } from '@/lib/supabase';

// All valid tiers from tier_name_aligned enum
type Tier = 
  | 'free' 
  | 'trial'
  | 'parent_starter' 
  | 'parent_plus' 
  | 'teacher_starter'
  | 'teacher_pro'
  | 'school_starter'
  | 'school_premium'
  | 'school_pro'
  | 'school_enterprise'
  // Legacy values for backwards compatibility
  | 'starter' 
  | 'basic' 
  | 'premium' 
  | 'pro' 
  | 'enterprise';

type Seats = { total: number; used: number } | null;

type TierSource = 'profile' | 'organization' | 'school' | 'unknown';

type Ctx = {
  ready: boolean;
  tier: Tier;
  seats: Seats;
  tierSource: TierSource;
  tierSourceDetail?: string;
  assignSeat: (subscriptionId: string, userId: string) => Promise<boolean>;
  revokeSeat: (subscriptionId: string, userId: string) => Promise<boolean>;
  refresh: () => void;
};

export const SubscriptionContext = createContext<Ctx>({
  ready: false,
  tier: 'free',
  seats: null,
  tierSource: 'unknown',
  tierSourceDetail: undefined,
  assignSeat: async () => false,
  revokeSeat: async () => false,
  refresh: () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tier, setTier] = useState<Tier>('free');
  const [seats, setSeats] = useState<Seats>(null);
  const [tierSource, setTierSource] = useState<TierSource>('unknown');
  const [tierSourceDetail, setTierSourceDetail] = useState<string | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Function to manually refresh subscription data
  const refresh = () => {
    console.log('[SubscriptionContext] Manual refresh triggered');
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    let mounted = true;
    
    console.log('[SubscriptionContext] useEffect triggered, refreshTrigger:', refreshTrigger);
    
    const fetchSubscriptionData = async () => {
      console.log('[SubscriptionContext] Fetching subscription data...');
      try {
        const { data: userRes, error: userError } = await assertSupabase().auth.getUser();
        
        if (userError || !userRes.user) {
          console.log('[SubscriptionContext] No authenticated user');
          if (mounted) setReady(true);
          return;
        }
        
        const userId = userRes.user.id;
        console.log('[SubscriptionContext] User ID:', userId);
        
        if (!mounted) return;
        
        // SINGLE SOURCE OF TRUTH: Read from profiles.subscription_tier
        const { data: profile, error: profileError } = await assertSupabase()
          .from('profiles')
          .select('subscription_tier, role, organization_id, preschool_id')
          .eq('id', userId)
          .maybeSingle();
        
        if (profileError) {
          console.error('[SubscriptionContext] Error fetching profile:', profileError);
          if (mounted) {
            setTier('free');
            setTierSource('unknown');
            setReady(true);
          }
          return;
        }
        
        console.log('[SubscriptionContext] Profile data:', profile);
        
        let finalTier: Tier = 'free';
        let source: TierSource = 'unknown';
        let seatsData: Seats = null;
        
        // Get tier from profile (single source of truth)
        if (profile?.subscription_tier) {
          const tierStr = String(profile.subscription_tier).toLowerCase();
          finalTier = tierStr as Tier;
          source = 'profile';
          console.log('[SubscriptionContext] ✅ Tier from profile:', finalTier);
        }
        
        // For teachers/principals/admins with 'free' tier, check organization tier
        const isStaff = ['teacher', 'principal', 'admin'].includes(profile?.role || '');
        if (finalTier === 'free' && isStaff && profile?.organization_id) {
          try {
            const { data: org } = await assertSupabase()
              .from('organizations')
              .select('plan_tier')
              .eq('id', profile.organization_id)
              .maybeSingle();
            
            if (org?.plan_tier && org.plan_tier !== 'free') {
              finalTier = String(org.plan_tier).toLowerCase() as Tier;
              source = 'organization';
              console.log('[SubscriptionContext] ✅ Teacher inheriting org tier:', finalTier);
            }
          } catch (err) {
            console.warn('[SubscriptionContext] Error fetching org tier:', err);
          }
        }
        
        // For staff with school_id, also check school subscription for seats
        if (isStaff && profile?.preschool_id) {
          try {
            const { data: sub } = await assertSupabase()
              .from('subscriptions')
              .select('seats_total, seats_used, status')
              .eq('school_id', profile.preschool_id)
              .in('status', ['active', 'trialing'])
              .maybeSingle();
            
            if (sub) {
              seatsData = { total: sub.seats_total ?? 0, used: sub.seats_used ?? 0 };
              
              // If still free and school has active subscription, inherit school tier
              if (finalTier === 'free') {
                const { data: school } = await assertSupabase()
                  .from('preschools')
                  .select('subscription_tier')
                  .eq('id', profile.preschool_id)
                  .maybeSingle();
                
                if (school?.subscription_tier && school.subscription_tier !== 'free') {
                  finalTier = String(school.subscription_tier).toLowerCase() as Tier;
                  source = 'school';
                  console.log('[SubscriptionContext] ✅ Teacher inheriting school tier:', finalTier);
                }
              }
            }
          } catch (err) {
            console.warn('[SubscriptionContext] Error fetching school subscription:', err);
          }
        }
        
        if (mounted) {
          console.log('[SubscriptionContext] FINAL tier:', finalTier, 'source:', source);
          setTier(finalTier);
          setTierSource(source);
          setTierSourceDetail(source);
          setSeats(seatsData);
          setReady(true);
        }
      } catch (err) {
        console.error('[SubscriptionContext] Fatal error:', err);
        if (mounted) {
          setTier('free');
          setTierSource('unknown');
          setSeats(null);
          setReady(true);
        }
      }
    };
    
    fetchSubscriptionData();
    
    return () => {
      mounted = false;
    };
  }, [refreshTrigger]);

  const assignSeat = async (subscriptionId: string, userId: string) => {
    try {
      const { data, error } = await assertSupabase().rpc('rpc_assign_teacher_seat', { 
        target_user_id: userId 
      });
      
      if (error) {
        console.error('Seat assignment RPC error:', error?.message || error);
        // Throw the error with the actual message so the UI can show it
        throw new Error(error?.message || 'Failed to assign seat');
      }
      return true;
    } catch (err) {
      console.error('Seat assignment failed:', err);
      // Re-throw to let the UI handle it
      throw err;
    }
  };

  const revokeSeat = async (subscriptionId: string, userId: string) => {
    try {
      const { data, error } = await assertSupabase().rpc('rpc_revoke_teacher_seat', { 
        target_user_id: userId 
      });
      
      if (error) {
        console.error('Seat revocation RPC error:', error?.message || error);
        throw new Error(error?.message || 'Failed to revoke seat');
      }
      return true;
    } catch (err) {
      console.error('Seat revocation failed:', err);
      throw err;
    }
  };

  const value = useMemo<Ctx>(() => ({ ready, tier, seats, tierSource, tierSourceDetail, assignSeat, revokeSeat, refresh }), [ready, tier, seats, tierSource, tierSourceDetail]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
