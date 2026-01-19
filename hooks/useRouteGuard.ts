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
  const { user, loading, profile } = useAuth();
  const hasNavigated = useRef(false);
  
  useEffect(() => {
    // Don't redirect while loading
    if (loading) {
      hasNavigated.current = false;
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
    
    // Not authenticated: redirect to sign-in (unless on auth route)
    if (!user) {
      if (!isAuthRoute && !hasNavigated.current) {
        console.log('[AuthGuard] No user, redirecting to sign-in from:', pathname);
        hasNavigated.current = true;
        router.replace('/(auth)/sign-in');
      }
      return;
    }
    
    // Authenticated: redirect from auth routes to dashboard
    if (user && isAuthRoute && !hasNavigated.current) {
      // Don't redirect if on reset-password (user might be changing password)
      if (pathname.includes('reset-password')) {
        return;
      }
      
      console.log('[AuthGuard] User authenticated, redirecting from auth route:', pathname);
      hasNavigated.current = true;
      
      // Route based on role
      const role = profile?.role;
      switch (role) {
        case 'super_admin':
        case 'superadmin':
          router.replace('/(super-admin)/dashboard');
          break;
        case 'principal':
        case 'principal_admin':
          router.replace('/(tabs)/principal-hub');
          break;
        case 'teacher':
          router.replace('/(tabs)/teacher-hub');
          break;
        case 'parent':
        default:
          router.replace('/(tabs)/parent-hub');
          break;
      }
    }
    
    // Reset navigation flag when pathname changes
    return () => {
      hasNavigated.current = false;
    };
  }, [pathname, user, loading, profile?.role]);
};
