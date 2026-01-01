/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { assertSupabase } from '@/lib/supabase';

type Tier = 'free' | 'parent_starter' | 'parent_plus' | 'starter' | 'basic' | 'premium' | 'pro' | 'enterprise';

type Seats = { total: number; used: number } | null;

type TierSource = 'organization' | 'school_plan' | 'school_default' | 'user' | 'unknown';

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
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    
    console.log('[SubscriptionContext] useEffect triggered, refreshTrigger:', refreshTrigger);
    
    // Add a small delay to prevent rapid successive calls
    const fetchSubscriptionData = async () => {
      console.log('[SubscriptionContext] fetchSubscriptionData started');
      try {
        const { data: userRes, error: userError } = await assertSupabase().auth.getUser();
        console.log('[SubscriptionContext] auth.getUser result:', userError ? 'ERROR' : 'SUCCESS', userRes?.user?.id);
        if (userError || !userRes.user) {
          if (mounted) setReady(true);
          return;
        }
        
        const user = userRes.user;
        
        if (!mounted) return; // Prevent state updates if unmounted
        
        let t: Tier = 'free';
        let source: TierSource = 'unknown';
        const normalizeTier = (v: string): string => String(v || '').trim().toLowerCase().replace(/-/g, '_');
        const knownTiers: Tier[] = ['free', 'parent_starter', 'parent_plus', 'starter', 'basic', 'premium', 'pro', 'enterprise'];
        const metaTierRaw = (user?.user_metadata as any)?.subscription_tier as string | undefined;
        const metaTier = metaTierRaw ? normalizeTier(metaTierRaw) : '';
        console.log('[SubscriptionContext] === TIER CHECK START ===');
        console.log('[SubscriptionContext] User ID:', user.id);
        console.log('[SubscriptionContext] User metadata tier:', metaTierRaw, '-> normalized:', metaTier);
        // Don't set tier from metadata yet - always check DB first for paid subscriptions
        let metadataTier: Tier | null = null;
        if (metaTier && knownTiers.includes(metaTier as Tier)) {
          metadataTier = metaTier as Tier;
          console.log('[SubscriptionContext] Found metadata tier (will use as fallback):', metadataTier);
        }

        // Try to detect org or school-owned subscription using schema
        let seatsData: Seats = null;
        try {
          // First, get user's preschool_id AND organization_id from profiles table
          let schoolId: string | undefined;
          let orgId: string | undefined;
          
          // Try user metadata first (fastest)
          schoolId = (user?.user_metadata as any)?.preschool_id;
          orgId = (user?.user_metadata as any)?.organization_id;
          
          // If not in metadata, query profiles table (current standard)
          let userRole: string | undefined;
          if ((!schoolId || !orgId) && user.id) {
            try {
              const { data: profileData, error: profileError } = await assertSupabase()
                .from('profiles')
                .select('preschool_id, organization_id, role')
                .eq('id', user.id)
                .maybeSingle();
              
              if (profileError) {
                console.warn('[SubscriptionContext] Error querying profiles:', profileError);
              }
              
              if (profileData?.preschool_id) schoolId = profileData.preschool_id;
              if (profileData?.organization_id) orgId = profileData.organization_id;
              if (profileData?.role) userRole = profileData.role;
              console.log('[SubscriptionContext] Profile data:', { schoolId, orgId, userRole });
            } catch (profileErr) {
              console.error('[SubscriptionContext] Exception querying profiles:', profileErr);
            }
          }
          
          console.log('[SubscriptionContext] Final org/school IDs:', { orgId, schoolId });

          // Check user-scoped tiers FIRST (parent subscriptions take precedence)
          // This ensures standalone users and users with personal subscriptions get the correct tier
          if (mounted) {
            console.log('[SubscriptionContext] === CHECKING DATABASE ===');
            try {
              const supabase = assertSupabase();
              console.log('[SubscriptionContext] Fetching user_ai_usage for user:', user.id);
              const { data: usage, error: usageError } = await supabase
                .from('user_ai_usage')
                .select('current_tier')
                .eq('user_id', user.id)
                .maybeSingle();
              
              console.log('[SubscriptionContext] user_ai_usage result:', JSON.stringify(usage), 'error:', JSON.stringify(usageError));
              
              const { data: tierRow, error: tierError } = await supabase
                .from('user_ai_tiers')
                .select('tier, expires_at')
                .eq('user_id', user.id)
                .maybeSingle();

              console.log('[SubscriptionContext] user_ai_tiers result:', JSON.stringify(tierRow), 'error:', JSON.stringify(tierError));

              // Handle enum types - Supabase returns enums as strings, but ensure we convert properly
              const usageTier = (usage as any)?.current_tier;
              const tierRowTier = (tierRow as any)?.tier;
              
              console.log('[SubscriptionContext] usageTier:', usageTier, 'tierRowTier:', tierRowTier);
              
              // Prefer user_ai_tiers.tier if it's a paid tier, otherwise use user_ai_usage.current_tier
              // This ensures PayFast webhook updates take precedence even if user_ai_usage was created with 'free'
              const paidTiers = ['parent_starter', 'parent_plus', 'starter', 'basic', 'premium', 'pro', 'enterprise'];
              let rawTier = '';
              
              // Check tierRowTier first (from user_ai_tiers - source of truth for subscriptions)
              if (tierRowTier && paidTiers.includes(normalizeTier(String(tierRowTier)))) {
                rawTier = tierRowTier;
                console.log('[SubscriptionContext] Using user_ai_tiers.tier (paid):', rawTier);
              } else if (usageTier && paidTiers.includes(normalizeTier(String(usageTier)))) {
                rawTier = usageTier;
                console.log('[SubscriptionContext] Using user_ai_usage.current_tier (paid):', rawTier);
              } else {
                // Fallback to whatever is available
                rawTier = usageTier || tierRowTier || '';
                console.log('[SubscriptionContext] Using fallback tier:', rawTier);
              }
              
              console.log('[SubscriptionContext] rawTier from DB:', rawTier);
              
              // Convert to string and normalize (handles enum types, null, undefined)
              const aiTierStr = normalizeTier(String(rawTier || ''));
              
              console.log('[SubscriptionContext] Normalized tier:', aiTierStr, 'isKnown:', knownTiers.includes(aiTierStr as Tier));
              
              // ALWAYS use database tier when available - ignore JWT metadata to avoid stale cached values
              if (aiTierStr && knownTiers.includes(aiTierStr as Tier)) {
                t = aiTierStr as Tier;
                source = 'user';
                console.log('[SubscriptionContext] ✅ Set tier from DB:', t);
              } else if (usageTier !== undefined || tierRowTier !== undefined) {
                // DB returned a value but it wasn't in knownTiers - default to 'free'
                t = 'free';
                source = 'user';
                console.log('[SubscriptionContext] ✅ DB has tier record, defaulting to free');
              } else if (metadataTier) {
                // Only use metadata as fallback if NO DB record exists at all
                t = metadataTier;
                source = 'user';
                console.log('[SubscriptionContext] ⚠️ Using metadata tier as fallback (no DB record):', t);
              }
            } catch (err) {
              // Log error for debugging
              console.error('[SubscriptionContext] ❌ Error reading user_ai_usage/user_ai_tiers:', err);
              // If DB query failed, use metadata as fallback
              if (metadataTier) {
                t = metadataTier;
                source = 'user';
                console.log('[SubscriptionContext] Using metadata tier after DB error:', t);
              }
            }
          }

          // Organization path - ONLY for TEACHERS who have NO personal tier record
          // Parents NEVER inherit from organization - they must have their own subscription
          const isTeacher = userRole === 'teacher' || userRole === 'principal' || userRole === 'admin';
          if (orgId && mounted && source === 'unknown' && isTeacher) {
            try {
              const { data: org } = await assertSupabase()
                .from('organizations')
                .select('plan_tier')
                .eq('id', orgId)
                .maybeSingle();
              if (org?.plan_tier) {
                const tierStr = normalizeTier(String(org.plan_tier));
                const orgKnownTiers: Tier[] = ['free','starter','premium','enterprise'];
                if (orgKnownTiers.includes(tierStr as Tier)) {
                  t = tierStr as Tier;
                  source = 'organization';
                  console.log('[SubscriptionContext] Teacher inheriting organization tier:', t);
                }
              }
            } catch {/* ignore */}
          } else if (orgId && source === 'unknown' && !isTeacher) {
            console.log('[SubscriptionContext] Parent/Student - not inheriting org tier, using personal tier');
          }
          
          // School subscription - ONLY for teachers/staff who have no personal or org tier
          // Parents don't inherit from school either
          if (schoolId && mounted && source === 'unknown' && isTeacher) {
            try {
              const { data: sub } = await assertSupabase()
                .from('subscriptions')
                .select('id, plan_id, seats_total, seats_used, status')
                .eq('school_id', schoolId)
                .in('status', ['active','trialing'])
                .maybeSingle();
              
              if (sub) {
                try {
                  const { data: planRow } = await assertSupabase()
                    .from('subscription_plans')
                    .select('tier')
                    .eq('id', sub.plan_id)
                    .maybeSingle();
                  const tierStr = normalizeTier(planRow?.tier || '');
                  const schoolKnownTiers: Tier[] = ['free','starter','premium','enterprise'];
                  if (schoolKnownTiers.includes(tierStr as Tier)) {
                    t = tierStr as Tier;
                    source = 'school_plan';
                  }
                } catch {/* ignore */}

                seatsData = { total: sub.seats_total ?? 0, used: sub.seats_used ?? 0 };
              } else {
                // Fall back to preschools.subscription_tier
                try {
                  const { data: school } = await assertSupabase()
                    .from('preschools')
                    .select('subscription_tier')
                    .eq('id', schoolId)
                    .maybeSingle();
                  if (school?.subscription_tier) {
                    const tierStr = normalizeTier(String(school.subscription_tier));
                    const schoolKnownTiers: Tier[] = ['free','starter','premium','enterprise'];
                    if (schoolKnownTiers.includes(tierStr as Tier)) {
                      t = tierStr as Tier;
                      source = 'school_default';
                    }
                  }
                } catch {/* ignore */}
              }
            } catch {/* ignore */}
          }

        } catch (outerError) {
          console.error('[SubscriptionContext] ❌ Outer try-catch error:', outerError);
        }

        if (mounted) {
          console.log('[SubscriptionContext] FINAL tier result:', t, 'source:', source);
          setTier(t);
          setTierSource(source);
          setTierSourceDetail(source);
          setSeats(seatsData);
          setReady(true);
        }
      } catch (err) {
        if (mounted) {
          // Always set ready to true to prevent blocking the UI
          setTier('free'); // Safe fallback
          setSeats(null);
          setReady(true);
        }
      }
    };
    
    // Run immediately on mount, no throttle delay needed
    console.log('[SubscriptionContext] Scheduling fetchSubscriptionData...');
    fetchSubscriptionData();
    
    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [refreshTrigger]); // Add refreshTrigger as dependency

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
