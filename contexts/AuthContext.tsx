import { logger } from '@/lib/logger';
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import * as Sentry from 'sentry-expo';
import { assertSupabase } from '@/lib/supabase';
import { getPostHog } from '@/lib/posthogClient';
import { track } from '@/lib/analytics';
import { Platform } from 'react-native';
import { routeAfterLogin, clearAllNavigationLocks } from '@/lib/routeAfterLogin';
import { useQueryClient } from '@tanstack/react-query';
import { 
  fetchEnhancedUserProfile, 
  getUserCapabilities,
  createPermissionChecker,
  createEnhancedProfile,
  type EnhancedUserProfile,
  type PermissionChecker
} from '@/lib/rbac';
import { initializeSession, signOut, isPasswordRecoveryInProgress } from '@/lib/sessionManager';
import { securityAuditor } from '@/lib/security-audit';
import { initializeVisibilityHandler, destroyVisibilityHandler } from '@/lib/visibilityHandler';
import type { User } from '@supabase/supabase-js';

export type AuthContextValue = {
  user: import('@supabase/supabase-js').User | null;
  session: import('@supabase/supabase-js').Session | null;
  profile: EnhancedUserProfile | null;
  permissions: PermissionChecker;
  loading: boolean;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  permissions: createPermissionChecker(null),
  loading: true,
  profileLoading: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

function toEnhancedProfile(p: any | null): EnhancedUserProfile | null {
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
    // Include full_name from source or construct from first/last name
    full_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || undefined,
    avatar_url: p.avatar_url,
    organization_id: p.organization_id,
    organization_name: p.organization_name,
    seat_status: p.seat_status || 'active',
    capabilities: p.capabilities || [],
    created_at: p.created_at,
    last_login_at: p.last_login_at,
  } as any;
  
  // Use createEnhancedProfile from rbac to ensure all methods are attached
  // Preserve member_type from organization_membership if available
  return createEnhancedProfile(baseProfile, {
    organization_id: p.organization_id,
    organization_name: p.organization_name,
    plan_tier: p.plan_tier || p.organization_membership?.plan_tier || 'free',
    seat_status: p.seat_status || p.organization_membership?.seat_status || 'active',
    invited_by: p.invited_by || p.organization_membership?.invited_by,
    created_at: p.created_at,
    member_type: p.organization_membership?.member_type, // Preserve member_type for role-based nav
  });
}

function isSameUserProfile(user: User, existingProfile?: EnhancedUserProfile | null): boolean {
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

async function buildFallbackProfileFromSession(
  user: User,
  existingProfile?: EnhancedUserProfile | null
): Promise<EnhancedUserProfile> {
  const safeProfile = isSameUserProfile(user, existingProfile) ? existingProfile : null;
  const userMeta = (user.user_metadata || {}) as Record<string, any>;
  const appMeta = (user.app_metadata || {}) as Record<string, any>;
  const role = (userMeta.role || appMeta.role || safeProfile?.role || 'parent') as any;
  const seatStatus =
    userMeta.seat_status ||
    appMeta.seat_status ||
    safeProfile?.seat_status ||
    safeProfile?.organization_membership?.seat_status ||
    'active';
  const planTier =
    userMeta.plan_tier ||
    userMeta.subscription_tier ||
    appMeta.plan_tier ||
    appMeta.subscription_tier ||
    safeProfile?.organization_membership?.plan_tier ||
    'free';
  const organizationId =
    userMeta.organization_id ||
    appMeta.organization_id ||
    safeProfile?.organization_id ||
    safeProfile?.organization_membership?.organization_id;
  const organizationName =
    userMeta.organization_name ||
    appMeta.organization_name ||
    safeProfile?.organization_name ||
    safeProfile?.organization_membership?.organization_name;
  const firstName =
    userMeta.first_name ||
    userMeta.given_name ||
    safeProfile?.first_name ||
    '';
  const lastName =
    userMeta.last_name ||
    userMeta.family_name ||
    safeProfile?.last_name ||
    '';
  const fullName =
    userMeta.full_name ||
    userMeta.name ||
    safeProfile?.full_name ||
    `${firstName} ${lastName}`.trim() ||
    undefined;
  const capabilities = await getUserCapabilities(role, planTier, seatStatus);

  const baseProfile = {
    id: user.id,
    email: user.email || safeProfile?.email || '',
    role,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    avatar_url: userMeta.avatar_url || userMeta.picture || safeProfile?.avatar_url,
    organization_id: organizationId,
    organization_name: organizationName,
    preschool_id: userMeta.preschool_id || appMeta.preschool_id || (safeProfile as any)?.preschool_id,
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthContextValue['user']>(null);
  const [session, setSession] = useState<AuthContextValue['session']>(null);
  const [profile, setProfile] = useState<EnhancedUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [permissions, setPermissions] = useState<PermissionChecker>(createPermissionChecker(null));
  const [lastRefreshAttempt, setLastRefreshAttempt] = useState<number>(0);
  const lastUserIdRef = useRef<string | null>(null);

  // Fetch enhanced user profile
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      setProfileLoading(true);
      const PROFILE_FETCH_TIMEOUT_MS = 12000;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<EnhancedUserProfile | null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), PROFILE_FETCH_TIMEOUT_MS);
      });
      const enhancedProfile = await Promise.race<EnhancedUserProfile | null>([
        fetchEnhancedUserProfile(userId),
        timeoutPromise,
      ]);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (!enhancedProfile) {
        console.warn('[AuthContext] fetchProfile timed out or returned null');
      }
      setProfile(enhancedProfile);
      setPermissions(createPermissionChecker(enhancedProfile));
      
      // Track profile load
      track('edudash.auth.profile_loaded', {
        user_id: userId,
        has_profile: !!enhancedProfile,
        role: enhancedProfile?.role,
        capabilities_count: enhancedProfile?.capabilities?.length || 0,
      });
      
      return enhancedProfile;
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      setProfile(null);
      setPermissions(createPermissionChecker(null));
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Refresh profile (useful when permissions change)
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id]);

  // NO-OP refresh handler for web - prevents infinite loading loops
  const handleVisibilityRefresh = useCallback(async () => {
    // For web, we completely disable session refresh on visibility changes
    // This prevents the infinite loading state when switching browser tabs
    const now = Date.now();
    
    // Only log the visibility event, don't do anything else
    logger.info('[Auth] Tab visibility changed (refresh disabled for web stability)');
    
    // Track for analytics but don't refresh anything
    track('auth.tab_visibility_change', {
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    });
    
    // Don't check session, don't refresh profile - just continue where user left off
  }, []);

  // Enhanced sign out with cache clearing
  // Simplified: Call Supabase signOut first (triggers auth listener), then clean up
  const handleSignOut = useCallback(async () => {
    try {
      console.log('[AuthContext] Starting sign-out process...');
      
      // CRITICAL: Clear all navigation locks FIRST to prevent stale locks
      try {
        const { clearAllNavigationLocks } = await import('@/lib/routeAfterLogin');
        clearAllNavigationLocks();
        console.log('[AuthContext] Navigation locks cleared');
      } catch (lockErr) {
        console.warn('[AuthContext] Failed to clear navigation locks (non-fatal):', lockErr);
      }
      
      // Call sessionManager sign out - this clears storage and calls Supabase signOut
      // The onAuthStateChange listener will handle state clearing via SIGNED_OUT event
      try {
        await signOut();
        console.log('[AuthContext] Supabase sign-out completed');
      } catch (signOutErr) {
        console.warn('[AuthContext] Sign-out failed (continuing anyway):', signOutErr);
      }
      
      // Clear state explicitly as backup (in case listener doesn't fire)
      setUser(null);
      setSession(null);
      setProfile(null);
      setPermissions(createPermissionChecker(null));
      setProfileLoading(false);
      
      // Clear TanStack Query cache
      try {
        queryClient.clear();
        console.log('[AuthContext] Query cache cleared');
      } catch (cacheErr) {
        console.warn('[AuthContext] Query cache clear failed:', cacheErr);
      }
      
      // Clear PostHog and Sentry (fire-and-forget)
      Promise.resolve().then(async () => {
        try { await getPostHog()?.reset(); } catch { /* non-fatal */ }
        try { Sentry.Native.setUser(null as any); } catch { /* non-fatal */ }
      });
      
      console.log('[AuthContext] Sign-out completed - navigation handled by route guard');
      
    } catch (error) {
      console.error('[AuthContext] Sign out failed:', error);
      // Force clear state even on error
      setUser(null);
      setSession(null);
      setProfile(null);
      setPermissions(createPermissionChecker(null));
      setProfileLoading(false);
    }
  }, [queryClient]);

  useEffect(() => {
    let unsub: { subscription?: { unsubscribe: () => void } } | null = null;
    let mounted = true;

    // Define a local fetch function to avoid dependency issues
    const fetchProfileLocal = async (userId: string) => {
      if (!mounted) return null;
      try {
        setProfileLoading(true);
        const PROFILE_FETCH_TIMEOUT_MS = 8000;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<null>((resolve) => {
          timeoutId = setTimeout(() => resolve(null), PROFILE_FETCH_TIMEOUT_MS);
        });
        const enhancedProfile = await Promise.race<EnhancedUserProfile | null>([
          fetchEnhancedUserProfile(userId),
          timeoutPromise,
        ]);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (!enhancedProfile) {
          console.warn('[AuthContext] Profile fetch returned null or timed out');
        }
        if (mounted) {
          setProfile(enhancedProfile);
          setPermissions(createPermissionChecker(enhancedProfile));
          
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
        if (mounted) {
          setProfile(null);
          setPermissions(createPermissionChecker(null));
        }
        return null;
      } finally {
        if (mounted) {
          setProfileLoading(false);
        }
      }
    };

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
        
        const canUseStoredProfile =
          !!storedSession &&
          !!storedProfile &&
          (
            (storedProfile as any)?.id === storedSession.user_id ||
            ((storedProfile as any)?.email && storedSession.email &&
              String((storedProfile as any).email).toLowerCase() === String(storedSession.email).toLowerCase())
          );

        if (storedSession && mounted) {
          setSession({ 
            access_token: storedSession.access_token, 
            refresh_token: storedSession.refresh_token, 
            expires_at: storedSession.expires_at,
            user: { id: storedSession.user_id, email: storedSession.email } 
          } as any);
          setUser({ id: storedSession.user_id, email: storedSession.email } as any);
          if (canUseStoredProfile) {
            const enhanced = toEnhancedProfile(storedProfile as any);
            setProfile(enhanced);
            setPermissions(createPermissionChecker(enhanced));
          } else {
            setProfile(null);
            setPermissions(createPermissionChecker(null));
          }
        }

        // Get current auth session
        const client = assertSupabase();
        const { data } = await client.auth.getSession();
        if (mounted) {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
        }

        // Always refresh profile on boot to avoid stale cached roles
        let currentProfile: EnhancedUserProfile | null = storedProfile as any;
        if (data.session?.user && mounted) {
          try {
            const fresh = await fetchProfileLocal(data.session.user.id);
            if (fresh) currentProfile = fresh;
          } catch (e) {
            logger.debug('Initial profile refresh failed', e);
          }
        }

        // If there's a session, identify in monitoring tools
        if (data.session?.user && mounted) {
          try {
            const ph = getPostHog();
            const phProps: Record<string, any> = {
              ...(data.session.user.email ? { email: data.session.user.email } : {}),
              ...(currentProfile?.role ? { role: currentProfile.role } : {}),
              ...(currentProfile?.organization_id ? { organization_id: currentProfile.organization_id } : {}),
              ...(currentProfile?.organization_membership?.plan_tier ? { plan_tier: currentProfile.organization_membership.plan_tier } : {}),
            };
            ph?.identify(data.session.user.id, phProps);
          } catch (e) {
            logger.debug('PostHog identify failed', e);
          }
          try {
            Sentry.Native.setUser({ 
              id: data.session.user.id, 
              email: data.session.user.email || undefined 
            } as any);
          } catch (e) {
            logger.debug('Sentry setUser failed', e);
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }

      // COMPLETELY DISABLE visibility handler for web to prevent loading loops
      // The issue is that ANY session check triggers Supabase's internal refresh mechanism
      try {
        const isWeb = Platform.OS === 'web';
        
        if (isWeb) {
          // For web: ONLY track visibility, never refresh session
          logger.info('[Visibility] Web visibility tracking enabled (NO auto-refresh)');
          initializeVisibilityHandler({
            onVisibilityChange: (isVisible) => {
              if (isVisible && mounted) {
                // Just track, don't check session
                track('auth.tab_focused', {
                  platform: 'web',
                  timestamp: new Date().toISOString(),
                });
              }
            },
            // No onSessionRefresh - this is the key fix
          });
        } else {
          // Mobile platforms can use full refresh logic
          logger.info('[Visibility] Initializing visibility handler for mobile platform');
          initializeVisibilityHandler({
            onSessionRefresh: async () => {
              const now = Date.now();
              if (now - lastRefreshAttempt < 5000) return;
              
              setLastRefreshAttempt(now);
              try {
                const { data: { session: currentSession } } = await assertSupabase().auth.getSession();
                if (currentSession && mounted) {
                  setSession(currentSession);
                  setUser(currentSession.user);
                  
                  const enhancedProfile = await fetchEnhancedUserProfile(currentSession.user.id);
                  if (enhancedProfile && mounted) {
                    setProfile(enhancedProfile);
                    setPermissions(createPermissionChecker(enhancedProfile));
                  }
                }
              } catch (error) {
                console.error('[Visibility] Mobile refresh failed:', error);
              }
            },
            onVisibilityChange: (isVisible) => {
              if (isVisible && mounted) {
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

      // Subscribe to auth changes
      const { data: listener } = assertSupabase().auth.onAuthStateChange(async (event, s) => {
        if (!mounted) return;
        // #region agent log
        console.log('[DEBUG_AGENT] AuthStateChange', JSON.stringify({event,userId:s?.user?.id,email:s?.user?.email,mounted,timestamp:Date.now()}));
        // #endregion
        
        const nextUserId = s?.user?.id ?? null;
        const lastUserId = lastUserIdRef.current;
        if (event === 'SIGNED_IN' && lastUserId && nextUserId && lastUserId !== nextUserId) {
          console.log('[AuthContext] Detected user switch, clearing cached profile and permissions');
          setProfile(null);
          setPermissions(createPermissionChecker(null));
          setProfileLoading(true);
        }
        lastUserIdRef.current = nextUserId;
        
        setSession(s ?? null);
        setUser(s?.user ?? null);

        try {
          if (event === 'SIGNED_IN' && s?.user) {
            // Fetch enhanced profile on sign in (non-blocking for routing)
            const QUICK_PROFILE_TIMEOUT_MS = 5000;
            let enhancedProfile: EnhancedUserProfile | null = null;
            let usedFallback = false;

            if (mounted) {
              setProfileLoading(true);
            }
            const profilePromise = fetchEnhancedUserProfile(s.user.id);
            try {
              const timeoutPromise = new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), QUICK_PROFILE_TIMEOUT_MS)
              );
              enhancedProfile = await Promise.race([profilePromise, timeoutPromise]) as EnhancedUserProfile | null;
            } catch (error) {
              console.warn('[AuthContext] Quick profile fetch failed:', error);
              enhancedProfile = null;
            }

            const safeExistingProfile = isSameUserProfile(s.user, profile) ? profile : null;
            if (profile && !safeExistingProfile) {
              setProfile(null);
              setPermissions(createPermissionChecker(null));
            }

            if (!enhancedProfile) {
              usedFallback = true;
              enhancedProfile = await buildFallbackProfileFromSession(s.user, safeExistingProfile);
            }

            if (mounted && enhancedProfile) {
              setProfile(enhancedProfile);
              setPermissions(createPermissionChecker(enhancedProfile));
              
              track('edudash.auth.profile_loaded', {
                user_id: s.user.id,
                has_profile: true,
                role: enhancedProfile.role,
                capabilities_count: enhancedProfile.capabilities?.length || 0,
                source: usedFallback ? 'fallback' : 'rpc',
              });
              
              securityAuditor.auditAuthenticationEvent(s.user.id, 'login', {
                role: enhancedProfile.role,
                organization: enhancedProfile.organization_id,
                capabilities_count: enhancedProfile.capabilities?.length || 0,
                source: usedFallback ? 'fallback' : 'rpc',
              });
            }

            if (mounted) {
              setProfileLoading(false);
            }

            // Best-effort: update last_login_at via RPC for OAuth and external flows
            try {
              await assertSupabase().rpc('update_user_last_login');
            } catch (e) {
              logger.debug('update_user_last_login RPC failed (non-blocking)', e);
            }

            // Register or update push token (best-effort)
            // Also checks if token needs refresh due to project ID or version changes
            try {
              const { registerPushDevice, checkAndRefreshTokenIfNeeded } = await import('@/lib/notifications');
              
              // First check if existing token needs refresh
              const wasRefreshed = await checkAndRefreshTokenIfNeeded(assertSupabase(), s.user);
              
              if (!wasRefreshed) {
                // Token didn't need refresh, do normal registration
                const result = await registerPushDevice(assertSupabase(), s.user);
                
                // Log result for debugging (no sensitive data)
                if (result.status === 'error') {
                  logger.debug('Push registration failed:', result.reason);
                } else if (result.status === 'denied') {
                  logger.debug('Push permissions denied');
                  // Could surface a non-blocking UI hint here in the future
                } else if (result.status === 'registered') {
                  logger.debug('Push registration successful');
                }
              } else {
                logger.debug('Push token was refreshed due to version/project change');
              }
            } catch (e) {
              logger.debug('Push registration exception:', e);
            }
            
            // Identify in monitoring tools
            if (mounted) {
              try {
                const ph = getPostHog();
                const phProps: Record<string, any> = {
                  ...(s.user.email ? { email: s.user.email } : {}),
                  ...(enhancedProfile?.role ? { role: enhancedProfile.role } : {}),
                  ...(enhancedProfile?.organization_id ? { organization_id: enhancedProfile.organization_id } : {}),
                  ...(enhancedProfile?.organization_membership?.plan_tier ? { plan_tier: enhancedProfile.organization_membership.plan_tier } : {}),
                };
                ph?.identify(s.user.id, phProps);
              } catch (e) {
                logger.debug('PostHog identify (auth change) failed', e);
              }
              try {
                Sentry.Native.setUser({ 
                  id: s.user.id, 
                  email: s.user.email || undefined 
                } as any);
              } catch (e) {
                logger.debug('Sentry setUser (auth change) failed', e);
              }

              track('edudash.auth.signed_in', {
                user_id: s.user.id,
                role: enhancedProfile?.role,
                profile_source: usedFallback ? 'fallback' : 'rpc',
              });

              // Check if this is a password recovery session
              // Multiple checks to ensure we don't route away from reset-password:
              // 1. Global flag set by reset-password screen (most reliable)
              // 2. recovery_sent_at exists and is recent (within 60 min)
              // 3. Current URL contains 'reset-password' (fallback check)
              const globalRecoveryFlag = isPasswordRecoveryInProgress();
              const recoverySentAt = (s.user as any).recovery_sent_at;
              const isRecoverySession = recoverySentAt && 
                (Date.now() - new Date(recoverySentAt).getTime()) < 60 * 60 * 1000; // 60 minutes
              
              // Also check current URL path as a fallback (works on both web and native)
              let isOnResetPasswordPage = false;
              try {
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  isOnResetPasswordPage = window.location.pathname.includes('reset-password');
                } else {
                  // For native, check the navigation state (expo-router provides this)
                  // We can't easily get the current route here, so rely on recovery_sent_at
                }
              } catch {
                // Ignore URL check errors
              }
              
              if (globalRecoveryFlag || isRecoverySession || isOnResetPasswordPage) {
                console.log('[AuthContext] Password recovery session detected, skipping auto-routing', {
                  globalRecoveryFlag,
                  isRecoverySession,
                  isOnResetPasswordPage,
                  recoverySentAt,
                });
                // #region agent log
                console.log('[DEBUG_AGENT] RouteAfterLogin-SKIPPED-RECOVERY', JSON.stringify({userId:s.user.id,globalRecoveryFlag,recoverySentAt,isOnResetPasswordPage,timestamp:Date.now()}));
                // #endregion
                return; // Don't route - user is on reset-password screen
              }

              // Route user after successful sign in
              try {
                // #region agent log
                console.log('[DEBUG_AGENT] RouteAfterLogin-CALLING', JSON.stringify({userId:s.user.id,role:enhancedProfile?.role,orgId:enhancedProfile?.organization_id,timestamp:Date.now()}));
                // #endregion
                await routeAfterLogin(s.user, enhancedProfile);
                // #region agent log
                console.log('[DEBUG_AGENT] RouteAfterLogin-COMPLETED', JSON.stringify({userId:s.user.id,timestamp:Date.now()}));
                // #endregion
              } catch (error) {
                console.error('Post-login routing failed:', error);
                // #region agent log
                console.log('[DEBUG_AGENT] RouteAfterLogin-FAILED', JSON.stringify({userId:s.user.id,error:String(error),timestamp:Date.now()}));
                // #endregion
              }
            }

            // If we used a fallback, refresh profile in the background
            if (usedFallback) {
              profilePromise
                .then((freshProfile) => {
                  if (freshProfile && mounted) {
                    setProfile(freshProfile);
                    setPermissions(createPermissionChecker(freshProfile));
                    if (s?.user?.id && freshProfile?.role) {
                      try {
                        clearAllNavigationLocks();
                        void routeAfterLogin(s.user, freshProfile);
                      } catch (routeError) {
                        console.warn('[AuthContext] Post-refresh routing failed:', routeError);
                      }
                    }
                  }
                })
                .catch((err) => {
                  console.warn('[AuthContext] Background profile refresh failed:', err);
                });
            }
          }

          if (event === 'SIGNED_OUT' && mounted) {
            console.log('[AuthContext] SIGNED_OUT event received, clearing all auth state');
            setProfile(null);
            setPermissions(createPermissionChecker(null));
            setUser(null);
            setSession(null);
            setProfileLoading(false);
            
            // Deregister push device
            try {
              const { deregisterPushDevice } = await import('@/lib/notifications');
              await deregisterPushDevice(assertSupabase(), { id: s?.user?.id || user?.id });
            } catch (e) {
              logger.debug('Push deregistration failed', e);
            }
            
            try { await getPostHog()?.reset(); } catch (e) { logger.debug('PostHog reset failed', e); }
            try { Sentry.Native.setUser(null as any); } catch (e) { logger.debug('Sentry clear user failed', e); }
            
            track('edudash.auth.signed_out', {});

            // Non-blocking toast to confirm sign-out
            try {
              const { toast } = await import('@/components/ui/ToastProvider');
              toast.success('You have been signed out');
            } catch (e) {
              logger.debug('Toast on sign-out failed (non-blocking)', e);
            }
            
            // Don't navigate here - let useAuthGuard handle navigation
            // This prevents conflicting navigation calls
            console.log('[AuthContext] Sign-out cleanup complete, navigation handled by useAuthGuard');
          }
        } catch (error) {
          console.error('Auth state change handler error:', error);
        }
      });
      unsub = listener;
    })();

    return () => {
      mounted = false;
      try { unsub?.subscription?.unsubscribe(); } catch (e) { logger.debug('Auth listener unsubscribe failed', e); }
      try { destroyVisibilityHandler(); } catch (e) { logger.debug('Visibility handler cleanup failed', e); }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile,
      permissions,
      loading, 
      profileLoading,
      refreshProfile,
      signOut: handleSignOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Convenience hooks for common permission checks
export function usePermissions(): PermissionChecker {
  const { permissions } = useAuth();
  return permissions;
}

export function useUserProfile(): EnhancedUserProfile | null {
  const { profile } = useAuth();
  return profile;
}
