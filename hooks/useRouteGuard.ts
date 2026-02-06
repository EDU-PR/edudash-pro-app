/**
 * Route Guard Hooks
 *
 * Handles auth-based navigation and mobile-web restrictions.
 * The auth guard automatically redirects:
 * - Unauthenticated users to sign-in (from protected routes)
 * - Authenticated users to their dashboard (from auth routes)
 */

import { useEffect, useRef } from 'react';
import { usePathname, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { isSignOutInProgress } from '@/lib/authActions';
import { isNavigationLocked } from '@/lib/routeAfterLogin';
import { authDebug } from '@/lib/authDebug';

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
  const { user, loading, profile, profileLoading } = useAuth();
  const hasNavigated = useRef(false);
  const lastAttemptAt = useRef(0);
  const lastUserId = useRef<string | null>(null);
  const signingOut = isSignOutInProgress();
  
  useEffect(() => {
    // Reset navigation attempt when the authenticated user changes
    const currentUserId = user?.id ?? null;
    if (currentUserId !== lastUserId.current) {
      hasNavigated.current = false;
      lastAttemptAt.current = 0;
      lastUserId.current = currentUserId;
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
    
    const isProfilesGate =
      typeof pathname === 'string' && pathname.includes('profiles-gate');

    // Not authenticated: redirect to sign-in (unless on auth route)
    if (!user) {
      if (!isAuthRoute && !hasNavigated.current) {
        console.log('[AuthGuard] No user, redirecting to sign-in from:', pathname);
        authDebug('guard.redirect', { from: pathname, to: '/(auth)/sign-in' });
        hasNavigated.current = true;
        router.replace('/(auth)/sign-in');
      }
      return;
    }

    // Authenticated but missing profile: avoid dashboards getting stuck loading
    if (user && !profileLoading && !profile && !isAuthRoute && !isProfilesGate) {
      console.log('[AuthGuard] Missing profile, redirecting to profiles-gate from:', pathname);
      authDebug('guard.redirect', { from: pathname, to: '/profiles-gate' });
      hasNavigated.current = true;
      router.replace('/profiles-gate');
      return;
    }
    
    // Authenticated: redirect from auth routes to dashboard
    if (user && isAuthRoute) {
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
        if (!isProfilesGate && !hasNavigated.current) {
          console.log('[AuthGuard] Authenticated without profile on auth route, redirecting to profiles-gate');
          authDebug('guard.redirect', { from: pathname, to: '/profiles-gate' });
          hasNavigated.current = true;
          router.replace('/profiles-gate');
        }
        return;
      }
      // Avoid redirecting with a stale profile from a different user
      if (profile?.id && user?.id && profile.id !== user.id) {
        console.log('[AuthGuard] Stale profile detected, waiting for refresh');
        return;
      }
      // Don't redirect if on reset-password (user might be changing password)
      if (pathname.includes('reset-password')) {
        return;
      }

      // Allow a retry if we're still on the auth route after a previous attempt
      const now = Date.now();
      if (hasNavigated.current && now - lastAttemptAt.current < 1500) {
        return;
      }
      
      console.log('[AuthGuard] User authenticated, redirecting from auth route:', pathname);
      authDebug('guard.redirect', { from: pathname, to: 'dashboard' });
      hasNavigated.current = true;
      lastAttemptAt.current = now;
      
      // Route based on role + school type
      const role = profile?.role || (user.user_metadata as any)?.role;
      const schoolType =
        profile?.organization_membership?.school_type ||
        (user.user_metadata as any)?.school_type ||
        (user.user_metadata as any)?.organization_type;
      const k12Types = new Set(['k12', 'k12_school', 'combined', 'primary', 'secondary', 'community_school']);
      const isK12 = schoolType ? k12Types.has(String(schoolType).toLowerCase()) : false;

      switch (role) {
        case 'super_admin':
        case 'superadmin':
          router.replace('/screens/super-admin-dashboard');
          break;
        case 'principal':
        case 'principal_admin':
          router.replace('/screens/principal-dashboard');
          break;
        case 'teacher':
          router.replace('/screens/teacher-dashboard');
          break;
        case 'student':
        case 'learner':
          router.replace(isK12 ? '/(k12)/student/dashboard' : '/screens/learner-dashboard');
          break;
        case 'parent':
        default:
          router.replace(isK12 ? '/(k12)/parent/dashboard' : '/screens/parent-dashboard');
          break;
      }
    }
    
    // NOTE: Do NOT reset hasNavigated in cleanup — it resets on user change (line above).
    // Resetting on every re-run caused an infinite re-render loop because:
    // setProfileLoading(false) → effect re-runs → cleanup resets hasNavigated → navigates → pathname changes → loop
  }, [pathname, user, loading, profile?.role, profile?.id, profileLoading, signingOut]);
};
