import React, { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import MarketingLanding from '@/components/marketing/MarketingLanding';
import { routeAfterLogin } from '@/lib/routeAfterLogin';

/**
 * Root index route - shows marketing landing for unauthenticated users,
 * redirects authenticated users directly to their dashboard (bypassing profiles-gate)
 */
export default function Index() {
  const { session, user, profile, loading } = useAuth();
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    // Only redirect if auth is loaded and user is authenticated
    if (!loading && session && user && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      console.log('[Index] User is authenticated, routing to dashboard');
      
      // If we have a profile with a role, route directly to dashboard
      if (profile?.role) {
        console.log('[Index] User has role:', profile.role, '- routing via routeAfterLogin');
        routeAfterLogin(user, profile).catch((err) => {
          console.error('[Index] routeAfterLogin failed:', err);
          // Fallback to profiles-gate if routing fails
          router.replace('/profiles-gate');
        });
      } else {
        // No role yet - go to profiles-gate for setup
        console.log('[Index] No role found, going to profiles-gate for setup');
        router.replace('/profiles-gate');
      }
    }
  }, [session, user, profile, loading]);

  // Show landing page for unauthenticated users or while loading
  return <MarketingLanding />;
}
