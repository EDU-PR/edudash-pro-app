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

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { normalizeTierName, type CapabilityTier } from '@/lib/tiers';
import { resolveCapabilityTier } from '@/lib/tiers/resolveEffectiveTier';

const TAG = 'SubscriptionContext';

// Test mode configuration - set to true during Google Play internal testing
const SUBSCRIPTION_TEST_MODE = process.env.EXPO_PUBLIC_SUBSCRIPTION_TEST_MODE === 'true';
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
  capabilityTier: CapabilityTier;
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
  capabilityTier: 'free',
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
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [tier, setTier] = useState<Tier>('free');
  const [capabilityTier, setCapabilityTier] = useState<CapabilityTier>('free');
  const [seats, setSeats] = useState<Seats>(null);
  const [tierSource, setTierSource] = useState<TierSource>('unknown');
  const [tierSourceDetail, setTierSourceDetail] = useState<string | undefined>(undefined);
  const [trialHoursRemaining, setTrialHoursRemaining] = useState<number | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const lastUserIdRef = useRef<string | null>(null);

  // Function to manually refresh subscription data
  const refresh = () => {
    logger.debug(TAG, 'Manual refresh triggered');
    setRefreshTrigger(prev => prev + 1);
  };

  // Function to reset trial timer (for testing)
  const resetTrial = async () => {
    if (SUBSCRIPTION_TEST_MODE) {
      logger.debug(TAG, 'TEST MODE: Manually resetting trial');
      await AsyncStorage.removeItem(TRIAL_START_KEY);
      refresh();
    }
  };

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    const prevUserId = lastUserIdRef.current;
    if (prevUserId !== nextUserId) {
      // Reset state when switching accounts to avoid cross-user bleed.
      setReady(false);
      setTier('free');
      setCapabilityTier('free');
      setSeats(null);
      setTierSource('unknown');
      setTierSourceDetail(undefined);
      setTrialHoursRemaining(undefined);
      if (SUBSCRIPTION_TEST_MODE) {
        AsyncStorage.removeItem(TRIAL_START_KEY).catch(() => {});
      }
    }
    lastUserIdRef.current = nextUserId;
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    
    logger.debug(TAG, 'useEffect triggered, refreshTrigger:', refreshTrigger);
    
    const fetchSubscriptionData = async () => {
      logger.debug(TAG, 'Fetching subscription data...');
      try {
        // Note: setReady(false) is NOT called here to avoid double re-render.
        // The account-switching effect above already resets ready when user?.id changes.
        const { data: userRes, error: userError } = await assertSupabase().auth.getUser();
        
        if (userError || !userRes.user) {
          logger.debug(TAG, 'No authenticated user');
          if (mounted) {
            setTier('free');
            setCapabilityTier('free');
            setTierSource('unknown');
            setTierSourceDetail(undefined);
            setSeats(null);
            setTrialHoursRemaining(undefined);
            setReady(true);
          }
          return;
        }
        
        const userId = userRes.user.id;
        logger.debug(TAG, 'User ID:', userId);
        
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
            setCapabilityTier('free');
            setTierSource('unknown');
            setReady(true);
          }
          return;
        }
        
        logger.debug(TAG, 'Profile data:', profile);
        
        let finalTier: Tier = 'free';
        let source: TierSource = 'unknown';
        let sourceDetail: string | undefined = undefined;
        let seatsData: Seats = null;
        
        // Get tier from profile (single source of truth)
        if (profile?.subscription_tier) {
          const tierStr = String(profile.subscription_tier);
          finalTier = normalizeTierName(tierStr) as Tier;
          source = 'profile';
          logger.debug(TAG, 'Tier from profile:', finalTier);
        }

        const roleLower = String(profile?.role || '').trim().toLowerCase();
        const isSuperAdmin = roleLower === 'super_admin' || roleLower === 'superadmin';
        if (isSuperAdmin) {
          finalTier = 'enterprise';
          source = 'profile';
          sourceDetail = 'super_admin_override';
          logger.debug(TAG, 'Super admin override to enterprise tier');
        }

        // If a parent subscription was cancelled and end date has passed, downgrade to free
        if (roleLower === 'parent') {
          try {
            const { data: cancelledSub } = await assertSupabase()
              .from('subscriptions')
              .select('status, end_date')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (cancelledSub?.status === 'cancelled' && cancelledSub.end_date) {
              const ended = new Date(cancelledSub.end_date) <= new Date();
              if (ended && finalTier !== 'free') {
                await assertSupabase()
                  .from('profiles')
                  .update({ subscription_tier: 'free' })
                  .eq('id', userId);
                
                finalTier = 'free';
                source = 'profile';
                logger.debug(TAG, 'Cancelled subscription ended; downgraded to free');
              }
            }
          } catch (err) {
            console.warn('[SubscriptionContext] Cancelled subscription check error:', err);
          }
        }
        
        const isStaff = ['teacher', 'principal', 'principal_admin', 'admin', 'staff'].includes(roleLower);
        const schoolIdCandidates = Array.from(
          new Set(
            [profile?.organization_id, profile?.preschool_id]
              .map((value) => String(value || '').trim())
              .filter(Boolean),
          ),
        );

        // Some staff records are linked via organization_members only.
        if (isStaff && schoolIdCandidates.length === 0) {
          try {
            const { data: membership } = await assertSupabase()
              .from('organization_members')
              .select('organization_id')
              .eq('user_id', userId)
              .in('membership_status', ['active', 'pending'])
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (membership?.organization_id) {
              schoolIdCandidates.push(String(membership.organization_id));
            }
          } catch (err) {
            console.warn('[SubscriptionContext] Error resolving school from organization_members:', err);
          }
        }

        logger.debug(TAG, 'Tier resolution context:', {
          role: roleLower,
          profileTier: profile?.subscription_tier || null,
          schoolIdCandidates,
        });

        // Priority: active school subscription tier + seat counts.
        if (isStaff && schoolIdCandidates.length > 0) {
          try {
            const { data: subs, error: subsError } = await assertSupabase()
              .from('subscriptions')
              .select('id, school_id, status, plan_id, seats_total, seats_used, created_at')
              .in('school_id', schoolIdCandidates)
              .in('status', ['active', 'trialing'])
              .order('created_at', { ascending: false })
              .limit(1);

            if (subsError) throw subsError;

            const activeSub = Array.isArray(subs) && subs.length > 0 ? subs[0] : null;
            if (activeSub) {
              seatsData = { total: activeSub.seats_total ?? 0, used: activeSub.seats_used ?? 0 };
              if (activeSub.plan_id) {
                const { data: plan, error: planError } = await assertSupabase()
                  .from('subscription_plans')
                  .select('tier')
                  .eq('id', activeSub.plan_id)
                  .maybeSingle();

                if (planError) throw planError;

                const planTier = plan?.tier ? normalizeTierName(String(plan.tier)) : null;
                if (planTier && (finalTier === 'free' || source === 'unknown')) {
                  finalTier = planTier as Tier;
                  source = 'school';
                  sourceDetail = 'subscription';
                  logger.debug(TAG, 'Tier from active school subscription:', finalTier);
                }
              }
            }
          } catch (err) {
            console.warn('[SubscriptionContext] Error fetching active subscription:', err);
          }
        }

        // Fallback: organization-level tier fields.
        if (finalTier === 'free' && isStaff && schoolIdCandidates.length > 0) {
          try {
            const { data: org } = await assertSupabase()
              .from('organizations')
              .select('subscription_tier, plan_tier')
              .in('id', schoolIdCandidates)
              .limit(1)
              .maybeSingle();

            const orgSubscriptionTier = org?.subscription_tier ? String(org.subscription_tier).toLowerCase() : '';
            const orgPlanTier = org?.plan_tier ? String(org.plan_tier).toLowerCase() : '';
            const inheritedOrgTier = orgSubscriptionTier && orgSubscriptionTier !== 'free'
              ? orgSubscriptionTier
              : orgPlanTier && orgPlanTier !== 'free'
                ? orgPlanTier
                : null;

            if (inheritedOrgTier) {
              finalTier = normalizeTierName(inheritedOrgTier) as Tier;
              source = 'organization';
              sourceDetail = orgSubscriptionTier && orgSubscriptionTier !== 'free'
                ? 'subscription_tier'
                : 'plan_tier';
              logger.debug(TAG, 'Staff inheriting organization tier:', finalTier);
            }
          } catch (err) {
            console.warn('[SubscriptionContext] Error fetching organization tier:', err);
          }
        }

        // Legacy preschool fallback for seats/tier.
        if (finalTier === 'free' && isStaff && profile?.preschool_id) {
          try {
            const { data: school } = await assertSupabase()
              .from('preschools')
              .select('subscription_tier')
              .eq('id', profile.preschool_id)
              .maybeSingle();

            if (school?.subscription_tier && String(school.subscription_tier).toLowerCase() !== 'free') {
              finalTier = normalizeTierName(String(school.subscription_tier)) as Tier;
              source = 'school';
              sourceDetail = 'subscription_tier';
              logger.debug(TAG, 'Staff inheriting legacy preschool tier:', finalTier);
            }
          } catch (err) {
            console.warn('[SubscriptionContext] Error fetching preschool tier:', err);
          }
        }
        
        if (mounted) {
          logger.debug(TAG, 'FINAL tier:', finalTier, 'source:', source);
          
          // TESTING MODE: Check and handle 24-hour trial reset
          if (SUBSCRIPTION_TEST_MODE && finalTier !== 'free' && source === 'profile') {
            try {
              const trialStart = await AsyncStorage.getItem(TRIAL_START_KEY);
              const now = Date.now();
              
              if (!trialStart) {
                // First time with paid tier - start the trial timer
                await AsyncStorage.setItem(TRIAL_START_KEY, now.toString());
                logger.debug(TAG, 'TEST MODE: Started 24h trial timer');
                setTrialHoursRemaining(24);
              } else {
                const elapsed = now - parseInt(trialStart, 10);
                const hoursLeft = Math.max(0, (TRIAL_DURATION_MS - elapsed) / (60 * 60 * 1000));
                setTrialHoursRemaining(hoursLeft);
                
                if (elapsed >= TRIAL_DURATION_MS) {
                  // Trial expired - reset to free tier
                  logger.debug(TAG, 'TEST MODE: 24h trial expired, resetting to free');
                  
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
                  logger.debug(TAG, `TEST MODE: Trial active, ${hoursLeft.toFixed(1)}h remaining`);
                }
              }
            } catch (trialErr) {
              console.warn('[SubscriptionContext] Trial check error:', trialErr);
            }
          } else {
            setTrialHoursRemaining(undefined);
          }
          
          const capTier = resolveCapabilityTier(String(finalTier));
          setCapabilityTier(capTier);

          setTier(finalTier);
          setTierSource(source);
          setTierSourceDetail(sourceDetail ?? source);
          setSeats(seatsData);
          setReady(true);
        }
      } catch (err) {
        console.error('[SubscriptionContext] Fatal error:', err);
        if (mounted) {
          setTier('free');
          setCapabilityTier('free');
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
  }, [refreshTrigger, user?.id]);

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
    capabilityTier,
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
