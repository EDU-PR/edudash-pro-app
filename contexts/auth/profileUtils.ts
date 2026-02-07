/**
 * Auth Profile Utilities
 * 
 * Extracted from AuthContext.tsx to reduce file size.
 * Contains profile conversion, comparison, persistence, and fallback building.
 * 
 * @module contexts/auth/profileUtils
 */

import { logger } from '@/lib/logger';
import { assertSupabase } from '@/lib/supabase';
import {
  getUserCapabilities,
  createEnhancedProfile,
  type EnhancedUserProfile,
} from '@/lib/rbac';
import { updateStoredProfile } from '@/lib/sessionManager';
import type { User } from '@supabase/supabase-js';

/**
 * Convert a raw profile object to an EnhancedUserProfile.
 * If already enhanced (has hasRole/hasCapability methods), returns as-is.
 */
export function toEnhancedProfile(p: any | null): EnhancedUserProfile | null {
  if (!p) return null;

  if (typeof p.hasRole === 'function' && typeof p.hasCapability === 'function') {
    return p as EnhancedUserProfile;
  }

  const baseProfile = {
    id: p.id,
    email: p.email,
    role: p.role,
    first_name: p.first_name,
    last_name: p.last_name,
    full_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || undefined,
    avatar_url: p.avatar_url,
    organization_id: p.organization_id,
    organization_name: p.organization_name,
    seat_status: p.seat_status || 'active',
    capabilities: p.capabilities || [],
    created_at: p.created_at,
    last_login_at: p.last_login_at,
  } as any;

  return createEnhancedProfile(baseProfile, {
    organization_id: p.organization_id,
    organization_name: p.organization_name,
    plan_tier: p.plan_tier || p.organization_membership?.plan_tier || 'free',
    seat_status: p.seat_status || p.organization_membership?.seat_status || 'active',
    invited_by: p.invited_by || p.organization_membership?.invited_by,
    created_at: p.created_at,
    member_type: p.organization_membership?.member_type,
  });
}

/**
 * Check if a Supabase User matches an existing EnhancedUserProfile 
 * by id or email.
 */
export function isSameUserProfile(
  user: User,
  existingProfile?: EnhancedUserProfile | null
): boolean {
  if (!existingProfile) return false;
  if (existingProfile.id && existingProfile.id === user.id) return true;
  if (
    existingProfile.email &&
    user.email &&
    existingProfile.email.toLowerCase() === user.email.toLowerCase()
  ) {
    return true;
  }
  return false;
}

/**
 * Persist an EnhancedUserProfile snapshot to local storage.
 * Fire-and-forget — errors are logged but not thrown.
 */
export async function persistProfileSnapshot(
  enhancedProfile: EnhancedUserProfile | null,
  user?: User | null
): Promise<void> {
  if (!enhancedProfile) return;
  try {
    const organizationName =
      enhancedProfile.organization_name ||
      enhancedProfile.organization_membership?.organization_name ||
      undefined;
    await updateStoredProfile({
      id: enhancedProfile.id,
      email: enhancedProfile.email || user?.email || undefined,
      role: enhancedProfile.role as any,
      organization_id: enhancedProfile.organization_id || undefined,
      organization_name: organizationName,
      preschool_id: (enhancedProfile as any)?.preschool_id || undefined,
      preschool_name: organizationName,
      first_name: enhancedProfile.first_name || undefined,
      last_name: enhancedProfile.last_name || undefined,
      full_name: enhancedProfile.full_name || undefined,
      avatar_url: enhancedProfile.avatar_url || undefined,
      seat_status:
        (enhancedProfile as any)?.seat_status ||
        enhancedProfile.organization_membership?.seat_status ||
        undefined,
      capabilities: enhancedProfile.capabilities || [],
      last_login_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn('AuthProfileUtils', 'Failed to persist profile snapshot:', error);
  }
}

/**
 * Build an EnhancedUserProfile from session metadata and database queries
 * when the primary RPC fetch fails. Uses multiple fallback sources with
 * timeout-guarded DB queries (1.5-2s).
 */
export async function buildFallbackProfileFromSession(
  user: User,
  existingProfile?: EnhancedUserProfile | null
): Promise<EnhancedUserProfile> {
  const safeProfile = isSameUserProfile(user, existingProfile) ? existingProfile : null;
  let dbProfile: any = null;

  try {
    const profileQuery = assertSupabase()
      .from('profiles')
      .select('id, email, role, first_name, last_name, full_name, preschool_id, organization_id, seat_status')
      .eq('id', user.id)
      .maybeSingle();
    const result: any = await Promise.race([
      profileQuery,
      new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    dbProfile = result?.data ?? result ?? null;

    if (!dbProfile?.id) {
      try {
        const altResult: any = await Promise.race([
          assertSupabase()
            .from('profiles')
            .select('id, email, role, first_name, last_name, full_name, preschool_id, organization_id, seat_status')
            .eq('auth_user_id', user.id)
            .maybeSingle(),
          new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);
        const altProfile = altResult?.data ?? altResult ?? null;
        if (altProfile?.id) {
          dbProfile = altProfile;
        }
      } catch {
        // non-fatal
      }
    }
  } catch {
    dbProfile = null;
  }

  const userMeta = (user.user_metadata || {}) as Record<string, any>;
  const appMeta = (user.app_metadata || {}) as Record<string, any>;

  if (__DEV__) {
    logger.debug('AuthProfileUtils', 'buildFallbackProfileFromSession dbProfile:', {
      hasData: !!dbProfile,
      role: dbProfile?.role,
      organization_id: dbProfile?.organization_id,
      preschool_id: dbProfile?.preschool_id,
      email: dbProfile?.email,
    });
  }

  const role = (dbProfile?.role || userMeta.role || appMeta.role || safeProfile?.role || 'parent') as any;
  const seatStatus =
    dbProfile?.seat_status || userMeta.seat_status || appMeta.seat_status ||
    safeProfile?.seat_status || safeProfile?.organization_membership?.seat_status || 'active';
  const planTier =
    userMeta.plan_tier || userMeta.subscription_tier ||
    appMeta.plan_tier || appMeta.subscription_tier ||
    safeProfile?.organization_membership?.plan_tier || 'free';

  let organizationId =
    dbProfile?.organization_id || dbProfile?.preschool_id ||
    userMeta.organization_id || appMeta.organization_id ||
    safeProfile?.organization_id || safeProfile?.organization_membership?.organization_id;
  let organizationName =
    dbProfile?.organization_name || userMeta.organization_name || appMeta.organization_name ||
    safeProfile?.organization_name || safeProfile?.organization_membership?.organization_name;

  const firstName = dbProfile?.first_name || userMeta.first_name || userMeta.given_name || safeProfile?.first_name || '';
  const lastName = dbProfile?.last_name || userMeta.last_name || userMeta.family_name || safeProfile?.last_name || '';
  const fullName = dbProfile?.full_name || userMeta.full_name || userMeta.name || safeProfile?.full_name || `${firstName} ${lastName}`.trim() || undefined;

  const FALLBACK_QUERY_TIMEOUT = 2000;

  // Best-effort: resolve organization from organization_members table
  if (!organizationId) {
    try {
      const candidateUserIds = new Set<string>();
      candidateUserIds.add(user.id);
      try {
        const profileRowResult: any = await Promise.race([
          assertSupabase().from('profiles').select('id').eq('auth_user_id', user.id).maybeSingle(),
          new Promise((resolve) => setTimeout(() => resolve(null), FALLBACK_QUERY_TIMEOUT)),
        ]);
        const profileRow = profileRowResult?.data ?? profileRowResult;
        if (profileRow?.id) candidateUserIds.add(profileRow.id);
      } catch { /* non-fatal */ }

      const membershipResult: any = await Promise.race([
        assertSupabase()
          .from('organization_members')
          .select('organization_id')
          .in('user_id', Array.from(candidateUserIds))
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        new Promise((resolve) => setTimeout(() => resolve(null), FALLBACK_QUERY_TIMEOUT)),
      ]);
      const membership = membershipResult?.data ?? membershipResult;
      if (membership?.organization_id) organizationId = membership.organization_id;
    } catch { /* non-fatal */ }
  }

  // Best-effort: resolve organization name from DB
  if (organizationId && !organizationName) {
    try {
      const preschoolResult: any = await Promise.race([
        assertSupabase().from('preschools').select('name').eq('id', organizationId).maybeSingle(),
        new Promise((resolve) => setTimeout(() => resolve(null), FALLBACK_QUERY_TIMEOUT)),
      ]);
      const preschool = preschoolResult?.data ?? preschoolResult;
      if (preschool?.name) {
        organizationName = preschool.name;
      } else {
        const orgResult: any = await Promise.race([
          assertSupabase().from('organizations').select('name').eq('id', organizationId).maybeSingle(),
          new Promise((resolve) => setTimeout(() => resolve(null), FALLBACK_QUERY_TIMEOUT)),
        ]);
        const org = orgResult?.data ?? orgResult;
        if (org?.name) organizationName = org.name;
      }
    } catch { /* non-fatal */ }
  }

  const capabilities = await getUserCapabilities(role, planTier, seatStatus);

  const baseProfile = {
    id: user.id,
    email: dbProfile?.email || user.email || safeProfile?.email || '',
    role,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    avatar_url: userMeta.avatar_url || userMeta.picture || safeProfile?.avatar_url,
    organization_id: organizationId,
    organization_name: organizationName,
    preschool_id:
      dbProfile?.preschool_id || userMeta.preschool_id || appMeta.preschool_id ||
      (safeProfile as any)?.preschool_id || organizationId,
    seat_status: seatStatus,
    capabilities,
    created_at: safeProfile?.created_at || new Date().toISOString(),
    last_login_at: safeProfile?.last_login_at || new Date().toISOString(),
  } as any;

  const orgMembership =
    safeProfile?.organization_membership ||
    (organizationId
      ? {
          organization_id: organizationId,
          organization_name: organizationName || 'Unknown',
          plan_tier: planTier,
          seat_status: seatStatus,
          invited_by: safeProfile?.organization_membership?.invited_by,
          joined_at: safeProfile?.organization_membership?.joined_at || baseProfile.created_at,
          member_type: safeProfile?.organization_membership?.member_type,
          school_type: safeProfile?.organization_membership?.school_type,
        }
      : undefined);

  return createEnhancedProfile(baseProfile, orgMembership);
}
