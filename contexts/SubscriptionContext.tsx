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
 * 
 * TESTING MODE: 24-hour trial reset for internal testing
 * When EXPO_PUBLIC_SUBSCRIPTION_TEST_MODE=true and tier is not 'free',
 * the subscription will auto-reset to 'free' 24 hours after first upgrade.
 * Remove this when Google Play Store approves for production.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { assertSupabase } from '@/lib/supabase';

// Test mode configuration - set to true during Google Play internal testing
const SUBSCRIPTION_TEST_MODE = process.env.EXPO_PUBLIC_SUBSCRIPTION_TEST_MODE === 'true' || __DEV__;
const TRIAL_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const TRIAL_START_KEY = 'subscription_trial_start';

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
  trialHoursRemaining?: number;
  isTestMode: boolean;
  assignSeat: (subscriptionId: string, userId: string) => Promise<boolean>;
  revokeSeat: (subscriptionId: string, userId: string) => Promise<boolean>;
  refresh: () => void;
  resetTrial: () => Promise<void>;
};

export const SubscriptionContext = createContext<Ctx>({
  ready: false,
  tier: 'free',
  seats: null,
  tierSource: 'unknown',
  tierSourceDetail: undefined,
  trialHoursRemaining: undefined,
  isTestMode: SUBSCRIPTION_TEST_MODE,
  assignSeat: async () => false,
  revokeSeat: async () => false,
  refresh: () => {},
  resetTrial: async () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tier, setTier] = useState<Tier>('free');
  const [seats, setSeats] = useState<Seats>(null);
  const [tierSource, setTierSource] = useState<TierSource>('unknown');
  const [tierSourceDetail, setTierSourceDetail] = useState<string | undefined>(undefined);
  const [trialHoursRemaining, setTrialHoursRemaining] = useState<number | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Function to manually refresh subscription data
  const refresh = () => {
    console.log('[SubscriptionContext] Manual refresh triggered');
    setRefreshTrigger(prev => prev + 1);
  };

  // Function to reset trial timer (for testing)
  const resetTrial = async () => {
    if (SUBSCRIPTION_TEST_MODE) {
      console.log('[SubscriptionContext] 🧪 TEST MODE: Manually resetting trial');
      await AsyncStorage.removeItem(TRIAL_START_KEY);
      refresh();
    }
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
          
          // TESTING MODE: Check and handle 24-hour trial reset
          if (SUBSCRIPTION_TEST_MODE && finalTier !== 'free') {
            try {
              const trialStart = await AsyncStorage.getItem(TRIAL_START_KEY);
              const now = Date.now();
              
              if (!trialStart) {
                // First time with paid tier - start the trial timer
                await AsyncStorage.setItem(TRIAL_START_KEY, now.toString());
                console.log('[SubscriptionContext] 🧪 TEST MODE: Started 24h trial timer');
                setTrialHoursRemaining(24);
              } else {
                const elapsed = now - parseInt(trialStart, 10);
                const hoursLeft = Math.max(0, (TRIAL_DURATION_MS - elapsed) / (60 * 60 * 1000));
                setTrialHoursRemaining(hoursLeft);
                
                if (elapsed >= TRIAL_DURATION_MS) {
                  // Trial expired - reset to free tier
                  console.log('[SubscriptionContext] 🧪 TEST MODE: 24h trial expired, resetting to free');
                  
                  const supabase = assertSupabase();
                  await supabase
                    .from('profiles')
                    .update({ subscription_tier: 'free' })
                    .eq('id', userId);
                  
                  // Clear trial timer for next test cycle
                  await AsyncStorage.removeItem(TRIAL_START_KEY);
                  setTrialHoursRemaining(undefined);
                  
                  finalTier = 'free';
                  source = 'profile';
                } else {
                  console.log(`[SubscriptionContext] 🧪 TEST MODE: Trial active, ${hoursLeft.toFixed(1)}h remaining`);
                }
              }
            } catch (trialErr) {
              console.warn('[SubscriptionContext] Trial check error:', trialErr);
            }
          } else {
            setTrialHoursRemaining(undefined);
          }
          
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

  const value = useMemo<Ctx>(() => ({ 
    ready, 
    tier, 
    seats, 
    tierSource, 
    tierSourceDetail, 
    trialHoursRemaining,
    isTestMode: SUBSCRIPTION_TEST_MODE,
    assignSeat, 
    revokeSeat, 
    refresh,
    resetTrial,
  }), [ready, tier, seats, tierSource, tierSourceDetail, trialHoursRemaining]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
