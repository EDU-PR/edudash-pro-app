/**
 * Session Initialization Hook
 * 
 * Extracted from AuthContext to meet WARP.md file size limits.
 * Handles initial session restoration, monitoring tools setup, and visibility handling.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Sentry from 'sentry-expo';
import { logger } from '@/lib/logger';
import { assertSupabase } from '@/lib/supabase';
import { getPostHog } from '@/lib/posthogClient';
import { track } from '@/lib/analytics';
import { 
  fetchEnhancedUserProfile, 
  createPermissionChecker,
  createEnhancedProfile,
  type EnhancedUserProfile,
  type PermissionChecker
} from '@/lib/rbac';
import { initializeSession } from '@/lib/sessionManager';
import { securityAuditor } from '@/lib/security-audit';
import { initializeVisibilityHandler, destroyVisibilityHandler } from '@/lib/visibilityHandler';
import { routeAfterLogin } from '@/lib/routeAfterLogin';
import type { Session, User } from '@supabase/supabase-js';

export interface SessionState {
  user: User | null;
  session: Session | null;
  profile: EnhancedUserProfile | null;
  permissions: PermissionChecker;
  loading: boolean;
  profileLoading: boolean;
}

export interface SessionActions {
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: EnhancedUserProfile | null) => void;
  setPermissions: (permissions: PermissionChecker) => void;
  setLoading: (loading: boolean) => void;
  setProfileLoading: (loading: boolean) => void;
}

/**
 * Convert raw profile data to EnhancedUserProfile
 */
export function toEnhancedProfile(p: any | null): EnhancedUserProfile | null {
  if (!p) return null;
  
  // If already an enhanced profile, return as is
  if (typeof p.hasRole === 'function' && typeof p.hasCapability === 'function') {
    return p as EnhancedUserProfile;
  }
  
  // Create enhanced profile using the same logic as createEnhancedProfile
  const baseProfile = {
    id: p.id,
    email: p.email,
    role: p.role,
    first_name: p.first_name,
    last_name: p.last_name,
    avatar_url: p.avatar_url,
    organization_id: p.organization_id,
    organization_name: p.organization_name,
    seat_status: p.seat_status || 'active',
    capabilities: p.capabilities || [],
    created_at: p.created_at,
    last_login_at: p.last_login_at,
  } as any;
  
  // Use createEnhancedProfile from rbac to ensure all methods are attached
  return createEnhancedProfile(baseProfile, {
    organization_id: p.organization_id,
    organization_name: p.organization_name,
    plan_tier: p.plan_tier || 'free',
    seat_status: p.seat_status || 'active',
    invited_by: p.invited_by,
    created_at: p.created_at,
  });
}

/**
 * Hook to initialize and manage auth session lifecycle
 */
export function useSessionInitialization(
  state: SessionState,
  actions: SessionActions,
  currentUser: User | null,
): void {
  const lastRefreshAttempt = useRef<number>(0);
  const mountedRef = useRef(true);

  // Fetch enhanced profile helper
  const fetchProfileLocal = useCallback(async (userId: string): Promise<EnhancedUserProfile | null> => {
    if (!mountedRef.current) return null;
    try {
      actions.setProfileLoading(true);
      const enhancedProfile = await fetchEnhancedUserProfile(userId);
      if (mountedRef.current) {
        actions.setProfile(enhancedProfile);
        actions.setPermissions(createPermissionChecker(enhancedProfile));
        
        // Track profile load
        track('edudash.auth.profile_loaded', {
          user_id: userId,
          has_profile: !!enhancedProfile,
          role: enhancedProfile?.role,
          capabilities_count: enhancedProfile?.capabilities?.length || 0,
        });
        
        // Security audit for authentication
        if (enhancedProfile) {
          securityAuditor.auditAuthenticationEvent(userId, 'login', {
            role: enhancedProfile.role,
            organization: enhancedProfile.organization_id,
            capabilities_count: enhancedProfile.capabilities?.length || 0,
          });
        }
      }
      return enhancedProfile;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      if (mountedRef.current) {
        actions.setProfile(null);
        actions.setPermissions(createPermissionChecker(null));
      }
      return null;
    } finally {
      if (mountedRef.current) {
        actions.setProfileLoading(false);
      }
    }
  }, [actions]);

  // Identify user in monitoring tools
  const identifyInMonitoring = useCallback((user: User, profile: EnhancedUserProfile | null) => {
    try {
      const ph = getPostHog();
      const phProps: Record<string, any> = {
        ...(user.email ? { email: user.email } : {}),
        ...(profile?.role ? { role: profile.role } : {}),
        ...(profile?.organization_id ? { organization_id: profile.organization_id } : {}),
        ...(profile?.organization_membership?.plan_tier ? { plan_tier: profile.organization_membership.plan_tier } : {}),
      };
      ph?.identify(user.id, phProps);
    } catch (e) {
      logger.debug('PostHog identify failed', e);
    }
    try {
      Sentry.Native.setUser({ 
        id: user.id, 
        email: user.email || undefined 
      } as any);
    } catch (e) {
      logger.debug('Sentry setUser failed', e);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let unsub: { subscription?: { unsubscribe: () => void } } | null = null;

    // Theme fix: ensure theme provider doesn't flicker on refresh
    try {
      const root = (globalThis as any)?.document?.documentElement;
      if (root && typeof (globalThis as any).matchMedia === 'function') {
        const prefersDark = (globalThis as any).matchMedia('(prefers-color-scheme: dark)')?.matches;
        if (prefersDark) root.classList.add('dark'); else root.classList.remove('dark');
      }
    } catch { /* Intentional: non-fatal */ }

    (async () => {
      try {
        // Initialize session from storage first
        const { session: storedSession, profile: storedProfile } = await initializeSession();
        
        // Debug session restoration
        console.log('=== SESSION RESTORATION DEBUG ===');
        console.log('Stored session exists:', !!storedSession);
        console.log('Stored profile exists:', !!storedProfile);
        if (storedSession) {
          console.log('Session user_id:', storedSession.user_id);
          console.log('Session email:', storedSession.email);
          console.log('Session expires_at:', new Date(storedSession.expires_at * 1000).toISOString());
        }
        if (storedProfile) {
          console.log('Profile role:', storedProfile.role);
          console.log('Profile org_id:', storedProfile.organization_id);
          console.log('Profile email:', storedProfile.email);
        }
        console.log('================================');
        
        if (storedSession && storedProfile && mountedRef.current) {
          actions.setSession({ 
            access_token: storedSession.access_token, 
            refresh_token: storedSession.refresh_token, 
            expires_at: storedSession.expires_at,
            user: { id: storedSession.user_id, email: storedSession.email } 
          } as any);
          actions.setUser({ id: storedSession.user_id, email: storedSession.email } as any);
          const enhanced = toEnhancedProfile(storedProfile as any);
          actions.setProfile(enhanced);
          actions.setPermissions(createPermissionChecker(enhanced));
        }

        // Get current auth session
        const client = assertSupabase();
        const { data } = await client.auth.getSession();
        if (mountedRef.current) {
          actions.setSession(data.session ?? null);
          actions.setUser(data.session?.user ?? null);
        }

        // Always refresh profile on boot to avoid stale cached roles
        let currentProfile: EnhancedUserProfile | null = storedProfile as any;
        if (data.session?.user && mountedRef.current) {
          try {
            const fresh = await fetchProfileLocal(data.session.user.id);
            if (fresh) currentProfile = fresh;
          } catch (e) {
            logger.debug('Initial profile refresh failed', e);
          }
        }

        // If there's a session, identify in monitoring tools
        if (data.session?.user && mountedRef.current) {
          identifyInMonitoring(data.session.user, currentProfile);
        }
      } finally {
        if (mountedRef.current) {
          actions.setLoading(false);
        }
      }

      // Setup visibility handler based on platform
      setupVisibilityHandler(mountedRef, lastRefreshAttempt, actions, fetchProfileLocal);

      // Subscribe to auth changes
      const { data: listener } = assertSupabase().auth.onAuthStateChange(async (event, s) => {
        if (!mountedRef.current) return;
        
        actions.setSession(s ?? null);
        actions.setUser(s?.user ?? null);

        await handleAuthStateChange(
          event, 
          s, 
          mountedRef, 
          actions, 
          fetchProfileLocal, 
          identifyInMonitoring,
          currentUser
        );
      });
      unsub = listener;
    })();

    return () => {
      mountedRef.current = false;
      try { unsub?.subscription?.unsubscribe(); } catch (e) { logger.debug('Auth listener unsubscribe failed', e); }
      try { destroyVisibilityHandler(); } catch (e) { logger.debug('Visibility handler cleanup failed', e); }
    };
  }, []);
}

/**
 * Setup visibility handler based on platform
 */
function setupVisibilityHandler(
  mountedRef: React.MutableRefObject<boolean>,
  lastRefreshAttempt: React.MutableRefObject<number>,
  actions: SessionActions,
  fetchProfileLocal: (userId: string) => Promise<EnhancedUserProfile | null>,
): void {
  try {
    const isWeb = Platform.OS === 'web';
    
    if (isWeb) {
      // For web: ONLY track visibility, never refresh session
      logger.info('[Visibility] Web visibility tracking enabled (NO auto-refresh)');
      initializeVisibilityHandler({
        onVisibilityChange: (isVisible) => {
          if (isVisible && mountedRef.current) {
            track('auth.tab_focused', {
              platform: 'web',
              timestamp: new Date().toISOString(),
            });
          }
        },
      });
    } else {
      // Mobile platforms can use full refresh logic
      logger.info('[Visibility] Initializing visibility handler for mobile platform');
      initializeVisibilityHandler({
        onSessionRefresh: async () => {
          const now = Date.now();
          if (now - lastRefreshAttempt.current < 5000) return;
          
          lastRefreshAttempt.current = now;
          try {
            const { data: { session: currentSession } } = await assertSupabase().auth.getSession();
            if (currentSession && mountedRef.current) {
              actions.setSession(currentSession);
              actions.setUser(currentSession.user);
              
              const enhancedProfile = await fetchProfileLocal(currentSession.user.id);
              if (enhancedProfile && mountedRef.current) {
                actions.setProfile(enhancedProfile);
                actions.setPermissions(createPermissionChecker(enhancedProfile));
              }
            }
          } catch (error) {
            console.error('[Visibility] Mobile refresh failed:', error);
          }
        },
        onVisibilityChange: (isVisible) => {
          if (isVisible && mountedRef.current) {
            track('auth.tab_focused', {
              platform: 'mobile',
              timestamp: new Date().toISOString(),
            });
          }
        },
        refreshDelay: 1000,
      });
    }
  } catch (e) {
    logger.debug('[Visibility] Handler initialization failed', e);
  }
}

/**
 * Handle auth state changes (sign in, sign out, etc.)
 */
async function handleAuthStateChange(
  event: string,
  s: Session | null,
  mountedRef: React.MutableRefObject<boolean>,
  actions: SessionActions,
  fetchProfileLocal: (userId: string) => Promise<EnhancedUserProfile | null>,
  identifyInMonitoring: (user: User, profile: EnhancedUserProfile | null) => void,
  currentUser: User | null,
): Promise<void> {
  try {
    if (event === 'SIGNED_IN' && s?.user) {
      const enhancedProfile = await fetchProfileLocal(s.user.id);

      // Best-effort: update last_login_at via RPC
      try {
        await assertSupabase().rpc('update_user_last_login');
      } catch (e) {
        logger.debug('update_user_last_login RPC failed (non-blocking)', e);
      }

      // Register push device
      await registerPushDeviceOnSignIn(s.user);
      
      // Identify in monitoring tools
      if (mountedRef.current) {
        identifyInMonitoring(s.user, enhancedProfile);

        track('edudash.auth.signed_in', {
          user_id: s.user.id,
          role: enhancedProfile?.role,
        });

        // Route user after successful sign in
        try {
          await routeAfterLogin(s.user, enhancedProfile);
        } catch (error) {
          console.error('Post-login routing failed:', error);
        }
      }
    }

    if (event === 'SIGNED_OUT' && mountedRef.current) {
      console.log('[AuthContext] SIGNED_OUT event received, clearing all auth state');
      actions.setProfile(null);
      actions.setPermissions(createPermissionChecker(null));
      actions.setUser(null);
      actions.setSession(null);
      actions.setProfileLoading(false);
      
      // Deregister push device
      try {
        const { deregisterPushDevice } = await import('@/lib/notifications');
        await deregisterPushDevice(assertSupabase(), { id: s?.user?.id || currentUser?.id });
      } catch (e) {
        logger.debug('Push deregistration failed', e);
      }
      
      try { await getPostHog()?.reset(); } catch (e) { logger.debug('PostHog reset failed', e); }
      try { Sentry.Native.setUser(null as any); } catch (e) { logger.debug('Sentry clear user failed', e); }
      
      track('edudash.auth.signed_out', {});

      // Non-blocking toast
      try {
        const { toast } = await import('@/components/ui/ToastProvider');
        toast.success('You have been signed out');
      } catch (e) {
        logger.debug('Toast on sign-out failed (non-blocking)', e);
      }
      
      console.log('[AuthContext] Sign-out cleanup complete');
    }
  } catch (error) {
    console.error('Auth state change handler error:', error);
  }
}

/**
 * Register push device on sign in
 */
async function registerPushDeviceOnSignIn(user: User): Promise<void> {
  try {
    const { registerPushDevice, checkAndRefreshTokenIfNeeded } = await import('@/lib/notifications');
    
    // First check if existing token needs refresh
    const wasRefreshed = await checkAndRefreshTokenIfNeeded(assertSupabase(), user);
    
    if (!wasRefreshed) {
      // Token didn't need refresh, do normal registration
      const result = await registerPushDevice(assertSupabase(), user);
      
      if (result.status === 'error') {
        logger.debug('Push registration failed:', result.reason);
      } else if (result.status === 'denied') {
        logger.debug('Push permissions denied');
      } else if (result.status === 'registered') {
        logger.debug('Push registration successful');
      }
    } else {
      logger.debug('Push token was refreshed due to version/project change');
    }
  } catch (e) {
    logger.debug('Push registration exception:', e);
  }
}
