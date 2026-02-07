import { logger } from '@/lib/logger';
import { authDebug } from '@/lib/authDebug';
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
import { initializeSession, signOut, isPasswordRecoveryInProgress, syncSessionFromSupabase, clearStoredAuthData, updateStoredProfile } from '@/lib/sessionManager';
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

const debugEnabled = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true' || __DEV__;
const debugLog = (...args: unknown[]) => {
  if (debugEnabled) logger.debug('AuthContext', ...args);
};

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

async function persistProfileSnapshot(
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
    logger.warn('AuthContext', 'Failed to persist profile snapshot:', error);
  }
}

async function buildFallbackProfileFromSession(
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
    // Supabase queries resolve to { data, error } — unwrap the data
    dbProfile = result?.data ?? result ?? null;

    // Fallback: if profiles.id != auth uid, try auth_user_id column
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
    logger.debug('AuthContext', 'buildFallbackProfileFromSession dbProfile:', {
      hasData: !!dbProfile,
      role: dbProfile?.role,
      organization_id: dbProfile?.organization_id,
      preschool_id: dbProfile?.preschool_id,
      email: dbProfile?.email,
    });
  }

  const role = (dbProfile?.role || userMeta.role || appMeta.role || safeProfile?.role || 'parent') as any;
  const seatStatus =
    dbProfile?.seat_status ||
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
  let organizationId =
    dbProfile?.organization_id ||
    dbProfile?.preschool_id ||
    userMeta.organization_id ||
    appMeta.organization_id ||
    safeProfile?.organization_id ||
    safeProfile?.organization_membership?.organization_id;
  let organizationName =
    dbProfile?.organization_name ||
    userMeta.organization_name ||
    appMeta.organization_name ||
    safeProfile?.organization_name ||
    safeProfile?.organization_membership?.organization_name;
  const firstName =
    dbProfile?.first_name ||
    userMeta.first_name ||
    userMeta.given_name ||
    safeProfile?.first_name ||
    '';
  const lastName =
    dbProfile?.last_name ||
    userMeta.last_name ||
    userMeta.family_name ||
    safeProfile?.last_name ||
    '';
  const fullName =
    dbProfile?.full_name ||
    userMeta.full_name ||
    userMeta.name ||
    safeProfile?.full_name ||
    `${firstName} ${lastName}`.trim() ||
    undefined;
  // Best-effort: if org is missing, try to resolve from organization_members
  // All queries have 2s timeouts to prevent sign-in hang
  const FALLBACK_QUERY_TIMEOUT = 2000;
  if (!organizationId) {
    try {
      const candidateUserIds = new Set<string>();
      candidateUserIds.add(user.id);

      // If profiles.id differs from auth uid, include it as a lookup key.
      try {
        const profileRowResult: any = await Promise.race([
          assertSupabase().from('profiles').select('id').eq('auth_user_id', user.id).maybeSingle(),
          new Promise((resolve) => setTimeout(() => resolve(null), FALLBACK_QUERY_TIMEOUT)),
        ]);
        const profileRow = profileRowResult?.data ?? profileRowResult;
        if (profileRow?.id) {
          candidateUserIds.add(profileRow.id);
        }
      } catch {
        // non-fatal
      }

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
      if (membership?.organization_id) {
        organizationId = membership.organization_id;
      }
    } catch {
      // non-fatal
    }
  }

  // Best-effort: if org ID exists but org name is missing, resolve from DB
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
        if (org?.name) {
          organizationName = org.name;
        }
      }
    } catch {
      // non-fatal – org name will remain undefined
    }
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
      dbProfile?.preschool_id ||
      userMeta.preschool_id ||
      appMeta.preschool_id ||
      (safeProfile as any)?.preschool_id ||
      organizationId,
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
  const [session, setSessionRaw] = useState<AuthContextValue['session']>(null);
  const sessionRef = useRef<AuthContextValue['session']>(null);
  const setSession = useCallback((s: AuthContextValue['session']) => {
    sessionRef.current = s;
    setSessionRaw(s);
  }, []);
  const [profile, _setProfile] = useState<EnhancedUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, _setProfileLoading] = useState(false);
  const [permissions, setPermissions] = useState<PermissionChecker>(createPermissionChecker(null));
  const [lastRefreshAttempt, setLastRefreshAttempt] = useState<number>(0);
  const lastUserIdRef = useRef<string | null>(null);
  const orgNameRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef<EnhancedUserProfile | null>(null);
  const profileLoadingRef = useRef(false);

  // Wrapped setters that keep refs in sync for use inside closures
  const setProfile = useCallback((p: EnhancedUserProfile | null) => {
    profileRef.current = p;
    _setProfile(p);
  }, []);
  const setProfileLoading = useCallback((v: boolean) => {
    profileLoadingRef.current = v;
    _setProfileLoading(v);
  }, []);

  // Fetch enhanced user profile
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      setProfileLoading(true);
      const PROFILE_FETCH_TIMEOUT_MS = 12000;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<EnhancedUserProfile | null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), PROFILE_FETCH_TIMEOUT_MS);
      });
      let enhancedProfile = await Promise.race<EnhancedUserProfile | null>([
        fetchEnhancedUserProfile(userId),
        timeoutPromise,
      ]);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (!enhancedProfile) {
        logger.warn('AuthContext', 'fetchProfile timed out or returned null');
        try {
          const { getStoredProfileForUser } = await import('@/lib/sessionManager');
          const storedProfile = await getStoredProfileForUser(userId);
          if (storedProfile) {
            enhancedProfile = toEnhancedProfile(storedProfile as any);
          }
        } catch (storedErr) {
          logger.warn('AuthContext', 'Stored profile fallback failed:', storedErr);
        }
      }
      if (!enhancedProfile) {
        logger.warn('AuthContext', 'Falling back to session metadata for profile');
        try {
          const { data: { user: authUser } } = await assertSupabase().auth.getUser();
          if (authUser?.id === userId) {
            enhancedProfile = await buildFallbackProfileFromSession(authUser, profile);
          }
        } catch (fallbackErr) {
          logger.warn('AuthContext', 'Fallback profile build failed:', fallbackErr);
        }
      }
      // EMERGENCY: If everything else failed, build from whatever user info we have
      if (!enhancedProfile) {
        logger.warn('AuthContext', 'fetchProfile: ALL resolution failed — building emergency profile');
        try {
          const { data: { user: authUser } } = await assertSupabase().auth.getUser();
          const u = authUser || { id: userId } as any;
          const meta = (u.user_metadata || {}) as Record<string, any>;
          const appMeta = (u.app_metadata || {}) as Record<string, any>;
          enhancedProfile = toEnhancedProfile({
            id: userId,
            email: u.email || '',
            role: meta.role || appMeta.role || 'parent',
            first_name: meta.first_name || meta.given_name || '',
            last_name: meta.last_name || meta.family_name || '',
            full_name: meta.full_name || meta.name || '',
            organization_id: meta.organization_id || meta.preschool_id || null,
            organization_name: meta.organization_name || null,
            seat_status: 'active',
            capabilities: [],
          });
        } catch (emergencyErr) {
          logger.warn('AuthContext', 'Emergency profile build failed:', emergencyErr);
        }
      }
      setProfile(enhancedProfile);
      setPermissions(createPermissionChecker(enhancedProfile));
      void persistProfileSnapshot(enhancedProfile, user);
      
      // Track profile load
      track('edudash.auth.profile_loaded', {
        user_id: userId,
        has_profile: !!enhancedProfile,
        role: enhancedProfile?.role,
        capabilities_count: enhancedProfile?.capabilities?.length || 0,
      });
      
      return enhancedProfile;
    } catch (error) {
      logger.error('AuthContext', 'Failed to fetch user profile:', error);
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
      logger.debug('AuthContext', 'Starting sign-out process...');
      
      // CRITICAL: Clear all navigation locks FIRST to prevent stale locks
      try {
        const { clearAllNavigationLocks } = await import('@/lib/routeAfterLogin');
        clearAllNavigationLocks();
        logger.debug('AuthContext', 'Navigation locks cleared');
      } catch (lockErr) {
        logger.warn('AuthContext', 'Failed to clear navigation locks (non-fatal):', lockErr);
      }
      
      // Call sessionManager sign out - this clears storage and calls Supabase signOut
      // The onAuthStateChange listener will handle state clearing via SIGNED_OUT event
      try {
        await signOut();
        logger.debug('AuthContext', 'Supabase sign-out completed');
      } catch (signOutErr) {
        logger.warn('AuthContext', 'Sign-out failed (continuing anyway):', signOutErr);
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
        logger.debug('AuthContext', 'Query cache cleared');
      } catch (cacheErr) {
        logger.warn('AuthContext', 'Query cache clear failed:', cacheErr);
      }
      
      // Clear PostHog and Sentry (fire-and-forget)
      Promise.resolve().then(async () => {
        try { await getPostHog()?.reset(); } catch { /* non-fatal */ }
        try { Sentry.Native.setUser(null as any); } catch { /* non-fatal */ }
      });
      
      logger.debug('AuthContext', 'Sign-out completed - navigation handled by route guard');
      
    } catch (error) {
      logger.error('AuthContext', 'Sign out failed:', error);
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
        let enhancedProfile = await Promise.race<EnhancedUserProfile | null>([
          fetchEnhancedUserProfile(userId),
          timeoutPromise,
        ]);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (!enhancedProfile) {
          logger.warn('AuthContext', 'Profile fetch returned null or timed out');
          // Priority: fresh DB read before stale stored profile
          try {
            const { data: { user: authUser } } = await assertSupabase().auth.getUser();
            if (authUser?.id === userId) {
              const FALLBACK_TIMEOUT_MS = 5000;
              enhancedProfile = await Promise.race([
                buildFallbackProfileFromSession(authUser, profile),
                new Promise<null>((resolve) => setTimeout(() => {
                  logger.warn('AuthContext', 'buildFallbackProfileFromSession timed out after 5s (boot)');
                  resolve(null);
                }, FALLBACK_TIMEOUT_MS)),
              ]) as EnhancedUserProfile | null;
            }
          } catch (fallbackErr) {
            logger.warn('AuthContext', 'Fallback profile build failed:', fallbackErr);
          }
        }
        if (!enhancedProfile) {
          // Last resort: stored profile from previous session
          try {
            const { getStoredProfileForUser } = await import('@/lib/sessionManager');
            const storedProfile = await getStoredProfileForUser(userId);
            if (storedProfile) {
              enhancedProfile = toEnhancedProfile(storedProfile as any);
            }
          } catch (storedErr) {
            logger.warn('AuthContext', 'Stored profile fallback failed:', storedErr);
          }
        }
        // EMERGENCY: Build minimal profile from auth user metadata so user is never stranded
        if (!enhancedProfile) {
          logger.warn('AuthContext', 'fetchProfileLocal: ALL resolution failed — building emergency profile for', userId);
          try {
            const { data: { user: authUser } } = await assertSupabase().auth.getUser();
            const u = authUser || { id: userId } as any;
            const meta = (u.user_metadata || {}) as Record<string, any>;
            const appMeta = (u.app_metadata || {}) as Record<string, any>;
            enhancedProfile = toEnhancedProfile({
              id: userId,
              email: u.email || '',
              role: meta.role || appMeta.role || 'parent',
              first_name: meta.first_name || meta.given_name || '',
              last_name: meta.last_name || meta.family_name || '',
              full_name: meta.full_name || meta.name || '',
              organization_id: meta.organization_id || meta.preschool_id || null,
              organization_name: meta.organization_name || null,
              seat_status: 'active',
              capabilities: [],
            });
          } catch (emergencyErr) {
            logger.warn('AuthContext', 'Emergency profile build in fetchProfileLocal failed:', emergencyErr);
          }
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
        logger.error('AuthContext', 'Failed to fetch user profile:', error);
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
        authDebug('initializeSession.result', {
          hasStoredSession: !!storedSession,
          storedUserId: storedSession?.user_id,
          hasStoredProfile: !!storedProfile,
          storedProfileId: (storedProfile as any)?.id,
        });
        
        // Debug session restoration
        debugLog('=== SESSION RESTORATION DEBUG ===');
        logger.debug('AuthContext', 'Stored session exists:', !!storedSession);
        logger.debug('AuthContext', 'Stored profile exists:', !!storedProfile);
        if (storedSession) {
          logger.debug('AuthContext', 'Session user_id:', storedSession.user_id);
          logger.debug('AuthContext', 'Session email:', storedSession.email);
          logger.debug('AuthContext', 'Session expires_at:', new Date(storedSession.expires_at * 1000).toISOString());
        }
        if (storedProfile) {
          logger.debug('AuthContext', 'Profile role:', storedProfile.role);
          logger.debug('AuthContext', 'Profile org_id:', storedProfile.organization_id);
          logger.debug('AuthContext', 'Profile email:', storedProfile.email);
        }
        logger.debug('AuthContext', '================================');
        
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
        authDebug('auth.getSession', {
          hasSession: !!data.session,
          userId: data.session?.user?.id,
        });
        // Keep sessionManager storage in sync (handles auth flows that bypass signInWithSession)
        syncSessionFromSupabase(data.session ?? null).catch(() => {});
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
            authDebug('profile.refresh.boot', { userId: data.session.user.id, success: !!fresh });
          } catch (e) {
            logger.debug('Initial profile refresh failed', e);
            authDebug('profile.refresh.boot', { userId: data.session.user.id, success: false });
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
          // Mobile platforms can use lightweight session refresh
          logger.info('[Visibility] Initializing visibility handler for mobile platform');
          initializeVisibilityHandler({
            onSessionRefresh: async () => {
              const now = Date.now();
              // Throttle: at most once every 60 seconds (was 30s – too aggressive, causes re-render storms)
              if (now - lastRefreshAttempt < 60000) return;
              
              setLastRefreshAttempt(now);
              try {
                // Lightweight: just validate/refresh the session token.
                // Do NOT re-fetch the full profile — that triggers expensive RPCs
                // and can cause SIGNED_IN events leading to infinite loops.
                const { data: { session: currentSession } } = await assertSupabase().auth.getSession();
                if (currentSession && mounted) {
                  // Only update state if the access_token actually changed.
                  // Setting new object references even for identical sessions causes
                  // full component tree re-renders → Dash AI re-init → audio focus → AppState blip loop.
                  const prevToken = sessionRef.current?.access_token;
                  if (prevToken !== currentSession.access_token) {
                    setSession(currentSession);
                    setUser(currentSession.user);
                  }
                }
              } catch (error) {
                logger.error('AuthContext', 'Mobile session refresh failed:', error);
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
            refreshDelay: 2000,
          });
        }
      } catch (e) {
        logger.debug('[Visibility] Handler initialization failed', e);
      }

      // Subscribe to auth changes
      const { data: listener } = assertSupabase().auth.onAuthStateChange(async (event, s) => {
        if (!mounted) return;
        // #region agent log
        debugLog('[DEBUG_AGENT] AuthStateChange', JSON.stringify({event,userId:s?.user?.id,email:s?.user?.email,mounted,timestamp:Date.now()}));
        // #endregion
        authDebug('auth.state', { event, userId: s?.user?.id });

        // Sync session storage for auth flows that bypass sessionManager
        try {
          if (event === 'SIGNED_OUT') {
            await clearStoredAuthData();
          } else {
            await syncSessionFromSupabase(s ?? null);
          }
        } catch {
          // Non-fatal: keep going
        }
        
        const nextUserId = s?.user?.id ?? null;
        const lastUserId = lastUserIdRef.current;
        if (event === 'SIGNED_IN' && lastUserId && nextUserId && lastUserId !== nextUserId) {
          logger.debug('AuthContext', 'Detected user switch, clearing cached profile and permissions');
          setProfile(null);
          setPermissions(createPermissionChecker(null));
          setProfileLoading(true);
        }
        lastUserIdRef.current = nextUserId;
        
        // Only update session/user state if the token actually changed.
        // Supabase fires TOKEN_REFRESHED / SIGNED_IN events frequently;
        // setting new object references for identical sessions cascades
        // re-renders through RootLayoutContent → Dash AI re-init → AppState cycling.
        const prevToken = sessionRef.current?.access_token;
        const nextToken = s?.access_token;
        if (prevToken !== nextToken || event === 'SIGNED_OUT') {
          setSession(s ?? null);
          setUser(s?.user ?? null);
        }

        try {
          if (event === 'SIGNED_IN' && s?.user) {
            // ── De-duplicate: skip full re-processing if we already
            //    have a valid profile for the SAME user and are not loading.
            //    Supabase fires SIGNED_IN on token refresh, realtime reconnect,
            //    etc. – these should NOT trigger a full profile re-fetch + re-nav.
            const alreadyResolved =
              profileRef.current?.id === s.user.id &&
              !profileLoadingRef.current &&
              lastUserIdRef.current === s.user.id;
            if (alreadyResolved) {
              debugLog('[AuthContext] Skipping duplicate SIGNED_IN for already-resolved user:', s.user.id);
              // Token already synced by the prevToken !== nextToken check above.
              // Do NOT call setSession/setUser here — they create new object
              // references that cascade re-renders through the entire tree.
              return;
            }

            authDebug('auth.signed_in', { userId: s.user.id });
            // Fetch enhanced profile on sign in (non-blocking for routing)
            const QUICK_PROFILE_TIMEOUT_MS = 8000;
            let enhancedProfile: EnhancedUserProfile | null = null;
            let usedFallback = false;
            let profileSource: 'rpc' | 'stored' | 'fallback' = 'rpc';
            let needsOrgNameRefresh = false;

            if (mounted) {
              setProfileLoading(true);
            }
            const profilePromise = fetchEnhancedUserProfile(s.user.id, s);
            try {
              const timeoutPromise = new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), QUICK_PROFILE_TIMEOUT_MS)
              );
              enhancedProfile = await Promise.race([profilePromise, timeoutPromise]) as EnhancedUserProfile | null;
            } catch (error) {
              logger.warn('AuthContext', 'Quick profile fetch failed:', error);
              enhancedProfile = null;
            }

            const safeExistingProfile = isSameUserProfile(s.user, profile) ? profile : null;
            if (profile && !safeExistingProfile) {
              setProfile(null);
              setPermissions(createPermissionChecker(null));
            }

            try {
              // Priority: fresh DB read (buildFallbackProfileFromSession does a quick 1.5s
              // profiles table read) BEFORE stale stored profile. Stored profiles may have
              // outdated role (e.g. role changed from parent → teacher in DB).
              if (!enhancedProfile) {
                try {
                  const FALLBACK_TIMEOUT_MS = 5000;
                  const fallbackResult = await Promise.race([
                    buildFallbackProfileFromSession(s.user, safeExistingProfile),
                    new Promise<null>((resolve) => setTimeout(() => {
                      logger.warn('AuthContext', 'buildFallbackProfileFromSession timed out after 5s');
                      resolve(null);
                    }, FALLBACK_TIMEOUT_MS)),
                  ]);
                  if (fallbackResult) {
                    enhancedProfile = fallbackResult;
                    profileSource = 'fallback';
                    authDebug('profile.fallback', { userId: s.user.id });
                  }
                } catch (fallbackErr) {
                  logger.warn('AuthContext', 'Fallback profile build failed:', fallbackErr);
                  enhancedProfile = null;
                }
              }

              // Last resort: use stored profile from previous session
              if (!enhancedProfile) {
                try {
                  const { getStoredProfileForUser } = await import('@/lib/sessionManager');
                  const storedProfile = await getStoredProfileForUser(s.user.id);
                  if (storedProfile) {
                    enhancedProfile = toEnhancedProfile(storedProfile as any);
                    profileSource = 'stored';
                  }
                } catch (storedErr) {
                  logger.warn('AuthContext', 'Stored profile fallback failed:', storedErr);
                }
              }

              // EMERGENCY FALLBACK: If ALL profile resolution paths failed,
              // create a minimal profile from the Supabase user object so
              // routeAfterLogin still fires and the user is never stranded
              // on the sign-in screen.
              if (!enhancedProfile && s.user) {
                logger.warn('AuthContext', 'ALL profile resolution failed — creating emergency minimal profile from user metadata');
                const userMeta = (s.user.user_metadata || {}) as Record<string, any>;
                const appMeta = (s.user.app_metadata || {}) as Record<string, any>;
                const emergencyRole = (userMeta.role || appMeta.role || 'parent') as string;
                const emergencyProfile = {
                  id: s.user.id,
                  email: s.user.email || '',
                  role: emergencyRole,
                  first_name: userMeta.first_name || userMeta.given_name || '',
                  last_name: userMeta.last_name || userMeta.family_name || '',
                  full_name: userMeta.full_name || userMeta.name || '',
                  organization_id: userMeta.organization_id || userMeta.preschool_id || null,
                  organization_name: userMeta.organization_name || null,
                  seat_status: 'active',
                  capabilities: [],
                };
                enhancedProfile = toEnhancedProfile(emergencyProfile);
                profileSource = 'fallback';
                usedFallback = true;
              }

              usedFallback = profileSource !== 'rpc';

              if (mounted && enhancedProfile) {
                setProfile(enhancedProfile);
                setPermissions(createPermissionChecker(enhancedProfile));
                void persistProfileSnapshot(enhancedProfile, s.user);
                if (__DEV__) {
                  logger.debug('AuthContext', 'Resolved org after sign-in:', {
                    organization_id: enhancedProfile.organization_id,
                    organization_name: enhancedProfile.organization_name,
                    preschool_id: (enhancedProfile as any)?.preschool_id,
                    membership: enhancedProfile.organization_membership,
                  });
                }

                const resolvedOrgName =
                  enhancedProfile.organization_name ||
                  enhancedProfile.organization_membership?.organization_name ||
                  '';
                needsOrgNameRefresh =
                  !resolvedOrgName ||
                  String(resolvedOrgName).trim().length === 0 ||
                  String(resolvedOrgName).trim().toLowerCase() === 'unknown';
                if (needsOrgNameRefresh) {
                  logger.warn('[AuthContext] Organization name missing after sign-in', {
                    user_id: s.user.id,
                    organization_id: enhancedProfile.organization_id,
                    profile_source: profileSource,
                  });
                }
                
                track('edudash.auth.profile_loaded', {
                  user_id: s.user.id,
                  has_profile: true,
                  role: enhancedProfile.role,
                  capabilities_count: enhancedProfile.capabilities?.length || 0,
                  source: profileSource,
                });
                
                securityAuditor.auditAuthenticationEvent(s.user.id, 'login', {
                  role: enhancedProfile.role,
                  organization: enhancedProfile.organization_id,
                  capabilities_count: enhancedProfile.capabilities?.length || 0,
                  source: profileSource,
                });
              }
            } catch (profileErr) {
              logger.warn('AuthContext', 'Sign-in profile resolution failed:', profileErr);
            } finally {
              // CRITICAL: Route BEFORE setting profileLoading=false
              // If we set profileLoading=false first, useAuthGuard sees profile loaded + user on auth route
              // and fires its own simpler navigation, racing with routeAfterLogin below.
              // By routing first, we ensure the correct route is used (determineUserRoute has full SOA/K12 logic).
              
              // SAFETY NET: If enhancedProfile is STILL null (e.g. catch block ran),
              // build an absolute-minimum profile so the user is never stranded.
              if (!enhancedProfile && mounted && s?.user) {
                logger.warn('AuthContext', 'enhancedProfile is null — building last-resort profile');
                try {
                  const meta = (s.user.user_metadata || {}) as Record<string, any>;
                  const appMeta = (s.user.app_metadata || {}) as Record<string, any>;
                  enhancedProfile = toEnhancedProfile({
                    id: s.user.id,
                    email: s.user.email || '',
                    role: meta.role || appMeta.role || 'parent',
                    first_name: meta.first_name || '',
                    last_name: meta.last_name || '',
                    full_name: meta.full_name || meta.name || '',
                    organization_id: meta.organization_id || meta.preschool_id || null,
                    organization_name: null,
                    seat_status: 'active',
                    capabilities: [],
                  });
                  if (enhancedProfile) {
                    setProfile(enhancedProfile);
                    setPermissions(createPermissionChecker(enhancedProfile));
                  }
                } catch {
                  logger.error('AuthContext', 'Last-resort profile build failed');
                }
              }
              
              if (mounted && enhancedProfile) {
                // Check if this is a password recovery session
                const globalRecoveryFlag = isPasswordRecoveryInProgress();
                const recoverySentAt = (s.user as any).recovery_sent_at;
                const isRecoverySession = recoverySentAt && 
                  (Date.now() - new Date(recoverySentAt).getTime()) < 60 * 60 * 1000;
                
                let isOnResetPasswordPage = false;
                try {
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    isOnResetPasswordPage = window.location.pathname.includes('reset-password');
                  }
                } catch {
                  // Ignore
                }
                
                if (globalRecoveryFlag || isRecoverySession || isOnResetPasswordPage) {
                  logger.debug('AuthContext', 'Password recovery session detected, skipping auto-routing', {
                    globalRecoveryFlag,
                    isRecoverySession,
                    isOnResetPasswordPage,
                    recoverySentAt,
                  });
                  // #region agent log
                  debugLog('[DEBUG_AGENT] RouteAfterLogin-SKIPPED-RECOVERY', JSON.stringify({userId:s.user.id,globalRecoveryFlag,recoverySentAt,isOnResetPasswordPage,timestamp:Date.now()}));
                  // #endregion
                } else {
                  // Route user after successful sign in
                  try {
                    // #region agent log
                    debugLog('[DEBUG_AGENT] RouteAfterLogin-CALLING', JSON.stringify({userId:s.user.id,role:enhancedProfile?.role,orgId:enhancedProfile?.organization_id,timestamp:Date.now()}));
                    // #endregion
                    await routeAfterLogin(s.user, enhancedProfile);
                    // #region agent log
                    debugLog('[DEBUG_AGENT] RouteAfterLogin-COMPLETED', JSON.stringify({userId:s.user.id,timestamp:Date.now()}));
                    // #endregion
                    authDebug('routeAfterLogin.called', { userId: s.user.id });

                    // Register device session (non-blocking) — Option B multi-device awareness
                    import('@/lib/deviceSessionTracker').then(({ registerDeviceSession }) => {
                      registerDeviceSession().then((result) => {
                        if (result.isNewDevice && result.otherDevices.length > 0) {
                          const names = result.otherDevices.map(d => d.device_name || d.platform).join(', ');
                          import('@/components/ui/ToastProvider').then(({ toast }) => {
                            toast.info(`Also signed in on: ${names}`, 5000);
                          }).catch(() => {});
                        }
                      }).catch(() => {});
                    }).catch(() => {});
                  } catch (error) {
                    logger.error('AuthContext', 'Post-login routing failed:', error);
                    // #region agent log
                    debugLog('[DEBUG_AGENT] RouteAfterLogin-FAILED', JSON.stringify({userId:s.user.id,error:String(error),timestamp:Date.now()}));
                    // #endregion
                  }
                }
              }

              if (mounted) {
                setProfileLoading(false);
              }

              // Force a profile refresh shortly after login if org name is missing.
              // This helps resolve "My School" headers caused by timing or RPC fallbacks.
              if (mounted && needsOrgNameRefresh && s?.user?.id) {
                const refreshUserId = s.user.id;
                // Clear any existing org name refresh timer
                if (orgNameRefreshTimerRef.current) {
                  clearTimeout(orgNameRefreshTimerRef.current);
                }
                orgNameRefreshTimerRef.current = setTimeout(async () => {
                  orgNameRefreshTimerRef.current = null;
                  if (!mounted || lastUserIdRef.current !== refreshUserId) return;
                  setProfileLoading(true);
                  try {
                    const refreshed = await fetchEnhancedUserProfile(refreshUserId, s);
                    if (refreshed && mounted && lastUserIdRef.current === refreshUserId) {
                      setProfile(refreshed);
                      setPermissions(createPermissionChecker(refreshed));
                      void persistProfileSnapshot(refreshed, s.user);
                      const refreshedOrgName =
                        refreshed.organization_name ||
                        refreshed.organization_membership?.organization_name ||
                        '';
                      if (!refreshedOrgName || String(refreshedOrgName).trim().toLowerCase() === 'unknown') {
                        logger.warn('[AuthContext] Org name still missing after forced refresh', {
                          user_id: refreshUserId,
                          organization_id: refreshed.organization_id,
                        });
                      } else {
                        logger.info('[AuthContext] Org name resolved after forced refresh', {
                          user_id: refreshUserId,
                          organization_id: refreshed.organization_id,
                          organization_name: refreshedOrgName,
                        });
                      }
                    }
                  } catch (refreshErr) {
                    logger.warn('[AuthContext] Forced profile refresh failed', refreshErr);
                  } finally {
                    if (mounted) {
                      setProfileLoading(false);
                    }
                  }
                }, 1500);
              }
            }

            // Best-effort monitoring (PostHog, Sentry, analytics)
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
                profile_source: profileSource,
              });
            }

            // Best-effort background operations (non-blocking, fire-and-forget)
            // These MUST NOT block routing - they run after navigation has been initiated
            const bgUserId = s.user.id;
            const bgUser = s.user;
            
            // Update last_login_at (fire-and-forget)
            // Note: .rpc() returns PostgrestBuilder (PromiseLike, no .catch), so wrap in Promise.resolve
            Promise.resolve(assertSupabase().rpc('update_user_last_login')).catch((e) => {
              logger.debug('update_user_last_login RPC failed (non-blocking)', e);
            });

            // Register/refresh push tokens (fire-and-forget)
            (async () => {
              try {
                const { registerPushDevice, checkAndRefreshTokenIfNeeded } = await import('@/lib/notifications');
                const wasRefreshed = await checkAndRefreshTokenIfNeeded(assertSupabase(), bgUser);
                if (!wasRefreshed) {
                  const result = await registerPushDevice(assertSupabase(), bgUser);
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
            })();

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
                        logger.warn('AuthContext', 'Post-refresh routing failed:', routeError);
                      }
                    }
                  }
                })
                .catch((err) => {
                  logger.warn('AuthContext', 'Background profile refresh failed:', err);
                });
            }
          }

          if (event === 'SIGNED_OUT' && mounted) {
            authDebug('auth.signed_out', { userId: s?.user?.id || user?.id });
            logger.debug('AuthContext', 'SIGNED_OUT event received, clearing all auth state');
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

            // Deactivate device session (non-blocking)
            import('@/lib/deviceSessionTracker').then(({ deactivateDeviceSession }) => {
              deactivateDeviceSession().catch(() => {});
            }).catch(() => {});
            
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
            logger.debug('AuthContext', 'Sign-out cleanup complete, navigation handled by useAuthGuard');
          }
        } catch (error) {
          logger.error('AuthContext', 'Auth state change handler error:', error);
        }
      });
      unsub = listener;
    })();

    return () => {
      mounted = false;
      if (orgNameRefreshTimerRef.current) {
        clearTimeout(orgNameRefreshTimerRef.current);
        orgNameRefreshTimerRef.current = null;
      }
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
