/**
 * Post-login routing — orchestrates profile fetching then delegates to
 * `determineUserRoute` for the actual dashboard path.
 *
 * Public symbols are re-exported from focused modules so that existing
 * consumers (`import { X } from '@/lib/routeAfterLogin'`) keep working.
 *
 * @module
 */

import { assertSupabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { fetchEnhancedUserProfile, type EnhancedUserProfile } from '@/lib/rbac';
import type { User } from '@supabase/supabase-js';
import { getPendingTeacherInvite, clearPendingTeacherInvite } from '@/lib/utils/teacherInvitePending';
import { resolveSchoolTypeFromProfile } from '@/lib/schoolTypeResolver';
import { trackDashboardRouteResolution } from '@/lib/dashboard/dashboardRoutingTelemetry';

// Extracted modules
import {
  isNavigationLocked,
  setNavigationLock,
  clearNavigationLock,
  clearAllNavigationLocks,
  getNavigationLockTime,
  NAVIGATION_LOCK_TIMEOUT,
} from '@/lib/auth/navigationLocks';
import { resolveTeacherApprovalRoute } from '@/lib/auth/roleResolution';
import { determineUserRoute } from '@/lib/auth/determineRoute';

// ── Re-exports (backward-compat for 11+ consumers) ──────────
export { isNavigationLocked, clearAllNavigationLocks } from '@/lib/auth/navigationLocks';
export { COMMUNITY_SCHOOL_ID, detectRoleAndSchool } from '@/lib/auth/roleResolution';
export { validateUserAccess, getRouteForRole } from '@/lib/auth/determineRoute';

// ── Debug helpers ────────────────────────────────────────────
const debugEnabled = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true' || __DEV__;
const debugLog = (...args: unknown[]) => {
  if (debugEnabled) console.log(...args);
};

// ── AsyncStorage (optional, no-op on web) ────────────────────
type AsyncStorageType = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
} | null;

let AsyncStorage: AsyncStorageType = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  /* noop */
}

// ── Routing generation counter (prevents stale navigations) ────
let routingGeneration = 0;

// ──────────────────────────────────────────────────────────────
// Main function
// ──────────────────────────────────────────────────────────────

/**
 * Enhanced post-login routing with comprehensive RBAC integration.
 * Routes users to the appropriate dashboard based on role, capabilities,
 * and organisation membership.
 *
 * Includes timeout protection to prevent infinite hanging.
 */
export async function routeAfterLogin(
  user?: User | null,
  profile?: EnhancedUserProfile | null,
): Promise<void> {
  const userId = user?.id;
  const currentGen = ++routingGeneration;
  const isStaleRoute = () => routingGeneration !== currentGen;

  debugLog('[DEBUG_AGENT] RouteAfterLogin-ENTRY', JSON.stringify({
    userId, hasProfile: !!profile, role: profile?.role, generation: currentGen, timestamp: Date.now(),
  }));

  if (!userId) {
    console.error('No user ID provided for post-login routing');
    router.replace('/(auth)/sign-in');
    return;
  }

  // Wrap entire function in timeout to prevent hanging
  const overallTimeout = setTimeout(() => {
    console.error('🚦 [ROUTE] routeAfterLogin overall timeout (15s) - forcing fallback navigation');
    debugLog('[DEBUG_AGENT] RouteAfterLogin-TIMEOUT', JSON.stringify({ userId, timestamp: Date.now() }));
    clearNavigationLock(userId);
    router.replace('/profiles-gate');
  }, 15000);

  try {
    // Clear stale locks
    const lockTime = getNavigationLockTime(userId);
    if (lockTime && Date.now() - lockTime > NAVIGATION_LOCK_TIMEOUT) {
      console.log('🚦 [ROUTE] Clearing stale navigation lock for user:', userId);
      clearNavigationLock(userId);
    }

    // Prevent concurrent navigation attempts
    if (isNavigationLocked(userId)) {
      console.log('🚦 [ROUTE] Navigation already in progress for user (early check), skipping');
      clearTimeout(overallTimeout);
      return;
    }

    setNavigationLock(userId);
    console.log('🚦 [ROUTE] Navigation lock acquired early for user:', userId);

    // ── Profile hydration ────────────────────
    let enhancedProfile = profile as any;
    if (enhancedProfile && typeof enhancedProfile.hasCapability !== 'function') {
      const capabilities = Array.isArray(enhancedProfile.capabilities)
        ? enhancedProfile.capabilities
        : [];
      enhancedProfile = {
        ...enhancedProfile,
        capabilities,
        hasCapability: (capability: string) => capabilities.includes(capability),
      };
    }

    const needsEnhanced = !enhancedProfile || !enhancedProfile.role;
    if (needsEnhanced) {
      debugLog('[ROUTE DEBUG] Fetching enhanced profile for user:', userId);
      const fetchPromise = fetchEnhancedUserProfile(userId);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 9000),
      );
      try {
        enhancedProfile = (await Promise.race([fetchPromise, timeoutPromise])) as any;
        debugLog('[ROUTE DEBUG] fetchEnhancedUserProfile result:', enhancedProfile ? 'SUCCESS' : 'NULL');
      } catch (fetchError) {
        console.error('[ROUTE DEBUG] Profile fetch failed:', fetchError);
        enhancedProfile = null;
        clearNavigationLock(userId);
      }
    }

    if (!enhancedProfile) {
      console.error('Failed to fetch user profile for routing - routing to profiles-gate');
      track('edudash.auth.route_failed', { user_id: userId, reason: 'no_profile' });
      clearNavigationLock(userId);
      clearTimeout(overallTimeout);
      router.replace('/profiles-gate');
      return;
    }

    // ── Pending teacher invite ───────────────
    const pendingInvite = await getPendingTeacherInvite();
    if (pendingInvite?.token && pendingInvite?.email) {
      await clearPendingTeacherInvite();
      clearNavigationLock(userId);
      clearTimeout(overallTimeout);
      router.replace(
        `/screens/teacher-invite-accept?token=${encodeURIComponent(pendingInvite.token)}&email=${encodeURIComponent(pendingInvite.email)}`,
      );
      return;
    }

    // ── Force password change ────────────────
    const forcePasswordChange = user?.user_metadata?.force_password_change;
    if (forcePasswordChange) {
      console.log('🚦 [ROUTE] User needs to change password on first login');
      track('edudash.auth.force_password_change', {
        user_id: userId,
        created_by_admin: user?.user_metadata?.created_by_admin,
      });
      clearNavigationLock(userId);
      clearTimeout(overallTimeout);
      router.replace('/screens/change-password-required' as any);
      return;
    }

    // ── Pending plan selection ────────────────
    try {
      const raw = await AsyncStorage?.getItem('pending_plan_selection');
      if (raw) {
        await AsyncStorage?.removeItem('pending_plan_selection');
        try {
          const pending = JSON.parse(raw);
          const planTier = pending?.planTier;
          const billing = pending?.billing === 'annual' ? 'annual' : 'monthly';
          if (planTier) {
            track('edudash.auth.bridge_to_checkout', { user_id: userId, plan_tier: planTier, billing });
            clearNavigationLock(userId);
            router.replace({
              pathname: '/screens/subscription-setup' as any,
              params: { planId: String(planTier), billing, auto: '1' },
            } as any);
            return;
          }
        } catch { /* ignore parse errors */ }
      }
    } catch { /* best-effort */ }

    // ── Determine destination ────────────────
    let route = determineUserRoute(enhancedProfile);
    const teacherApprovalRoute = await resolveTeacherApprovalRoute(enhancedProfile);
    if (teacherApprovalRoute) route = teacherApprovalRoute;

    const resolvedSchoolType = resolveSchoolTypeFromProfile(enhancedProfile);

    track('edudash.auth.route_after_login', {
      user_id: userId,
      role: enhancedProfile.role,
      resolved_school_type: resolvedSchoolType,
      target_dashboard: route.path,
      organization_id: enhancedProfile.organization_id,
      seat_status: enhancedProfile.seat_status,
      plan_tier: enhancedProfile.organization_membership?.plan_tier,
      route: route.path,
      has_params: !!route.params,
    });

    trackDashboardRouteResolution({
      userId,
      role: enhancedProfile.role,
      resolvedSchoolType,
      targetDashboard: route.path,
      source: 'routeAfterLogin',
      organizationId: enhancedProfile.organization_id,
    });

    if (typeof window !== 'undefined') {
      (window as any).dashboardSwitching = true;
    }

    console.log('🚦 [ROUTE] Navigating to route:', route.path);
    clearTimeout(overallTimeout);

    // Stale-generation check — if a newer routeAfterLogin call was made, skip this one
    if (isStaleRoute()) {
      console.log('🚦 [ROUTE] Skipping stale route (gen', currentGen, 'vs current', routingGeneration, ')');
      return;
    }

    try {
      // Skip stale navigations when auth user switched mid-flight
      const { data: { user: activeUser } } = await assertSupabase().auth.getUser();
      if (activeUser?.id && activeUser.id !== userId) {
        console.log('🚦 [ROUTE] Skipping stale navigation for user:', userId, 'active user is:', activeUser.id);
        return;
      }

      if (route.params) {
        router.replace({ pathname: route.path as any, params: route.params } as any);
      } else {
        router.replace(route.path as any);
      }
      console.log('🚦 [ROUTE] router.replace call completed successfully');
    } catch (navigationError) {
      console.error('🚦 [ROUTE] Navigation failed, falling back to profiles-gate:', navigationError);
      router.replace('/profiles-gate');
    } finally {
      clearNavigationLock(userId);
      if (typeof window !== 'undefined') {
        delete (window as any).dashboardSwitching;
      }
      console.log('🚦 [ROUTE] Navigation lock cleared for user:', userId);
    }
  } catch (error) {
    clearTimeout(overallTimeout);
    reportError(new Error('Post-login routing failed'), { userId: user?.id, error });
    if (user?.id) clearNavigationLock(user.id);
    router.replace('/profiles-gate');
  }
}
