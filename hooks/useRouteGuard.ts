/**
 * Route Guard Hooks
 *
 * Handles auth-based navigation and mobile-web restrictions.
 * The auth guard automatically redirects:
 * - Unauthenticated users to sign-in (from protected routes)
 * - Authenticated users to their dashboard (from auth routes)
 */

import { useCallback, useEffect, useRef } from 'react';
import { useLocalSearchParams, usePathname, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { isSignOutInProgress } from '@/lib/authActions';
import { isNavigationLocked } from '@/lib/routeAfterLogin';
import { authDebug } from '@/lib/authDebug';
import { isPasswordRecoveryInProgress } from '@/lib/sessionManager';
import { resolveIsRecoveryFlow } from '@/lib/auth/recoveryFlow';
import {
  resolveExplicitSchoolTypeFromProfile,
  resolveOrganizationId,
  resolveSchoolTypeFromProfile,
} from '@/lib/schoolTypeResolver';
import { getDashboardRouteForRole, isDashboardRouteMismatch } from '@/lib/dashboard/routeMatrix';
import {
  trackDashboardRouteMismatch,
  trackDashboardRouteResolution,
} from '@/lib/dashboard/dashboardRoutingTelemetry';

/**
 * Mobile web guard - currently no-op
 */
export const useMobileWebGuard = () => {
  // no-op (no mobile web restrictions)
  useEffect(() => {}, []);
};

/**
 * Auth guard - handles redirect based on authentication state
 */
export const useAuthGuard = () => {
  const pathname = usePathname();
  const searchParams = useLocalSearchParams<Record<string, string | string[]>>();
  const { user, loading, profile, profileLoading } = useAuth();
  const hasNavigated = useRef(false);
  const lastAttemptAt = useRef(0);
  const lastRedirectKey = useRef<string | null>(null);
  const lastRedirectAt = useRef(0);
  const lastUserId = useRef<string | null>(null);
  const lastMismatchKey = useRef<string | null>(null);
  const authRouteSeenAt = useRef<number | null>(null);
  const signingOut = isSignOutInProgress();
  const AUTH_ROUTE_PROFILE_GRACE_MS = 3500;
  const REDIRECT_DEDUP_WINDOW_MS = 1200;

  const safeReplace = useCallback((to: string, reason: string) => {
    const from = typeof pathname === 'string' ? pathname : '';
    if (from === to) {
      return false;
    }

    const key = `${from}->${to}`;
    const now = Date.now();
    if (lastRedirectKey.current === key && now - lastRedirectAt.current < REDIRECT_DEDUP_WINDOW_MS) {
      authDebug('guard.redirect_skipped', { from, to, reason });
      return false;
    }

    lastRedirectKey.current = key;
    lastRedirectAt.current = now;
    authDebug('guard.redirect', { from, to, reason });
    router.replace(to as any);
    return true;
  }, [pathname]);
  
  useEffect(() => {
    // Reset navigation attempt when the authenticated user changes
    const currentUserId = user?.id ?? null;
    if (currentUserId !== lastUserId.current) {
      hasNavigated.current = false;
      lastAttemptAt.current = 0;
      lastUserId.current = currentUserId;
      authRouteSeenAt.current = currentUserId ? Date.now() : null;
    }

    if (signingOut) {
      hasNavigated.current = false;
      return;
    }
    // Don't redirect while auth is still loading
    if (loading) {
      // NOTE: Do NOT reset hasNavigated here — loading can flip true→false
      // during the auth flow, and resetting the guard allows duplicate navigation.
      return;
    }
    
    // Determine if current route is an auth route
    const isAuthRoute =
      typeof pathname === 'string' &&
      (pathname === '/' ||
        pathname === '/landing' ||
        pathname.startsWith('/(auth)') ||
        pathname.includes('sign-in') ||
        pathname.includes('sign-up') ||
        pathname.includes('signup') ||
        pathname.includes('register') ||
        pathname.includes('forgot-password') ||
        pathname.includes('reset-password') ||
        pathname.includes('auth-callback') ||
        pathname.includes('verify'));

    const isAuthCallbackRoute =
      typeof pathname === 'string' && pathname.includes('auth-callback');

    const typeParam = Array.isArray(searchParams.type) ? searchParams.type[0] : searchParams.type;
    const flowParam = Array.isArray(searchParams.flow) ? searchParams.flow[0] : searchParams.flow;
    const isRecoveryFlow = resolveIsRecoveryFlow({
      type: typeParam,
      flow: flowParam,
      hasRecoveryFlag: isPasswordRecoveryInProgress(),
    });
    
    const isProfilesGate =
      typeof pathname === 'string' && pathname.includes('profiles-gate');
    const isOnboardingRoute =
      typeof pathname === 'string' &&
      (pathname === '/onboarding' || pathname.startsWith('/onboarding/'));

    const isOrgAdminFamilyRoute =
      typeof pathname === 'string' &&
      (pathname === '/screens/org-admin-dashboard' ||
        pathname.startsWith('/screens/org-admin/') ||
        pathname.startsWith('/screens/admin-tertiary'));

    // Not authenticated: redirect to sign-in (unless on auth route)
    if (!user) {
      authRouteSeenAt.current = null;
      if (!isAuthRoute && !isOnboardingRoute && !hasNavigated.current) {
        console.log('[AuthGuard] No user, redirecting to sign-in from:', pathname);
        hasNavigated.current = true;
        safeReplace('/(auth)/sign-in', 'no_user');
      }
      return;
    }

    // Authenticated but missing profile: avoid dashboards getting stuck loading
    if (user && !profileLoading && !profile && !isAuthRoute && !isProfilesGate && !isOnboardingRoute) {
      console.log('[AuthGuard] Missing profile, redirecting to profiles-gate from:', pathname);
      hasNavigated.current = true;
      safeReplace('/profiles-gate', 'missing_profile_protected_route');
      return;
    }
    
    // Authenticated: redirect from auth routes to dashboard
    if (user && isAuthRoute) {
      if (!authRouteSeenAt.current) {
        authRouteSeenAt.current = Date.now();
      }
      // If profile is still loading, let AuthContext handle routing first
      if (profileLoading) {
        return;
      }
      // If AuthContext's routeAfterLogin already has an active navigation lock,
      // don't compete — it's already handling the routing.
      if (isNavigationLocked(user.id)) {
        return;
      }
      // If profile is missing after loading, route to profile gate to avoid auth-route dead ends
      if (!profile) {
        const elapsed = Date.now() - (authRouteSeenAt.current || Date.now());
        // Give AuthContext a short grace window to resolve profile after SIGNED_IN.
        // Without this, native can jump to profiles-gate prematurely and appear frozen.
        if (elapsed < AUTH_ROUTE_PROFILE_GRACE_MS) {
          return;
        }
        if (!isProfilesGate && !hasNavigated.current) {
          console.log('[AuthGuard] Authenticated without profile on auth route, redirecting to profiles-gate');
          hasNavigated.current = true;
          safeReplace('/profiles-gate', 'missing_profile_after_auth_grace');
        }
        return;
      }
      authRouteSeenAt.current = null;
      // Avoid redirecting with a stale profile from a different user
      if (profile?.id && user?.id && profile.id !== user.id) {
        console.log('[AuthGuard] Stale profile detected, waiting for refresh');
        return;
      }
      // Don't redirect if on reset-password (user might be changing password)
      if (pathname.includes('reset-password')) {
        return;
      }

      // Auth callbacks and recovery flows must remain callback-controlled.
      if (isAuthCallbackRoute || isRecoveryFlow) {
        return;
      }

      // Allow a retry if we're still on the auth route after a previous attempt
      const now = Date.now();
      if (hasNavigated.current && now - lastAttemptAt.current < 1500) {
        return;
      }
      
      console.log('[AuthGuard] User authenticated, redirecting from auth route:', pathname);
      hasNavigated.current = true;
      lastAttemptAt.current = now;
      
      // Route based on role + school type from shared route matrix
      const role = profile?.role || (user.user_metadata as any)?.role || null;
      const resolvedSchoolType = resolveSchoolTypeFromProfile(
        profile || (user.user_metadata as any) || {}
      );
      const hasOrganization = Boolean(
        resolveOrganizationId(profile || (user.user_metadata as any) || {})
      );
      const normalizedRole = String(role || '').toLowerCase();

      let targetDashboard = getDashboardRouteForRole({
        role,
        resolvedSchoolType,
        hasOrganization,
      });
      if (!targetDashboard) {
        if (normalizedRole === 'super_admin' || normalizedRole === 'superadmin') {
          targetDashboard = '/screens/super-admin-dashboard';
        } else if (normalizedRole === 'admin') {
          const explicitSchoolType = resolveExplicitSchoolTypeFromProfile(
            profile || (user.user_metadata as any) || {}
          );
          targetDashboard = explicitSchoolType
            ? '/screens/admin-dashboard'
            : '/screens/org-admin-dashboard';
        } else {
          targetDashboard = '/screens/parent-dashboard';
        }
      }

      trackDashboardRouteResolution({
        userId: user.id,
        role,
        resolvedSchoolType,
        targetDashboard,
        source: 'useAuthGuard.auth-route',
        organizationId: resolveOrganizationId(profile || (user.user_metadata as any) || {}),
      });

      safeReplace(String(targetDashboard), 'authenticated_auth_route');
      return;
    }

    if (user && profile && !profileLoading && !isAuthRoute && typeof pathname === 'string') {
      // Hard guard: school tenants must never render org-admin/tertiary dashboard family.
      if (isOrgAdminFamilyRoute) {
        const explicitSchoolType = resolveExplicitSchoolTypeFromProfile(profile);
        if (explicitSchoolType) {
          const role = profile.role || (user.user_metadata as any)?.role || null;
          const normalizedRole = String(role || '').toLowerCase().trim();
          const hasOrganization = Boolean(resolveOrganizationId(profile));
          const schoolDashboard =
            normalizedRole === 'admin'
              ? '/screens/admin-dashboard'
              : getDashboardRouteForRole({
                  role,
                  resolvedSchoolType: explicitSchoolType,
                  hasOrganization,
                }) || '/screens/principal-dashboard';

          if (pathname !== schoolDashboard && !hasNavigated.current) {
            hasNavigated.current = true;
            lastAttemptAt.current = Date.now();
            safeReplace(String(schoolDashboard), `school_dashboard_guard:${String(explicitSchoolType)}`);
            return;
          }
        }
      }

      const role = profile.role || (user.user_metadata as any)?.role || null;
      const resolvedSchoolType = resolveSchoolTypeFromProfile(profile);
      const expectedDashboard = getDashboardRouteForRole({
        role,
        resolvedSchoolType,
        hasOrganization: Boolean(resolveOrganizationId(profile)),
      });

      const isDashboardPath = pathname.includes('dashboard');
      if (isDashboardPath && expectedDashboard && isDashboardRouteMismatch(pathname, expectedDashboard)) {
        const mismatchKey = `${user.id}:${pathname}:${expectedDashboard}`;
        if (lastMismatchKey.current !== mismatchKey) {
          lastMismatchKey.current = mismatchKey;
          trackDashboardRouteMismatch({
            userId: user.id,
            role,
            resolvedSchoolType,
            currentPath: pathname,
            targetDashboard: expectedDashboard,
            source: 'useAuthGuard.passive-check',
            organizationId: resolveOrganizationId(profile),
            reason: 'dashboard_family_mismatch',
          });
        }
      } else if (!isDashboardRouteMismatch(pathname, expectedDashboard || pathname)) {
        lastMismatchKey.current = null;
      }
    }
    
    // NOTE: Do NOT reset hasNavigated in cleanup — it resets on user change (line above).
    // Resetting on every re-run caused an infinite re-render loop because:
    // setProfileLoading(false) → effect re-runs → cleanup resets hasNavigated → navigates → pathname changes → loop
  }, [
    pathname,
    searchParams.type,
    searchParams.flow,
    user,
    loading,
    profile?.role,
    profile?.id,
    profile?.organization_id,
    profile?.preschool_id,
    profile?.organization_membership?.school_type,
    (profile as any)?.organization_membership?.organization_kind,
    (profile as any)?.organization_type,
    profileLoading,
    signingOut,
    safeReplace,
  ]);
};
