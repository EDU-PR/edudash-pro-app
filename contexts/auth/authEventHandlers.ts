/**
 * Auth Event Handlers
 * 
 * Extracted from AuthContext.tsx to comply with WARP.md file size guidelines.
 * Contains auth state change event handlers and related utilities.
 */
import { logger } from '@/lib/logger';
import * as Sentry from 'sentry-expo';
import { assertSupabase } from '@/lib/supabase';
import { getPostHog } from '@/lib/posthogClient';
import { track } from '@/lib/analytics';
import { Platform } from 'react-native';
import { routeAfterLogin } from '@/lib/routeAfterLogin';
import { 
  fetchEnhancedUserProfile, 
  createPermissionChecker,
  type EnhancedUserProfile,
  type PermissionChecker
} from '@/lib/rbac';
import { securityAuditor } from '@/lib/security-audit';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

export interface AuthStateSetters {
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setProfile: (profile: EnhancedUserProfile | null) => void;
  setPermissions: (permissions: PermissionChecker) => void;
  setProfileLoading: (loading: boolean) => void;
}

export interface AuthEventHandlerOptions {
  mounted: { current: boolean };
  setters: AuthStateSetters;
  currentUser: User | null;
}

/**
 * Fetch user profile with proper state management
 */
export async function fetchProfileWithStateUpdate(
  userId: string,
  options: AuthEventHandlerOptions
): Promise<EnhancedUserProfile | null> {
  const { mounted, setters } = options;
  
  if (!mounted.current) return null;
  
  try {
    setters.setProfileLoading(true);
    const enhancedProfile = await fetchEnhancedUserProfile(userId);
    
    if (mounted.current) {
      setters.setProfile(enhancedProfile);
      setters.setPermissions(createPermissionChecker(enhancedProfile));
      
      track('edudash.auth.profile_loaded', {
        user_id: userId,
        has_profile: !!enhancedProfile,
        role: enhancedProfile?.role,
        capabilities_count: enhancedProfile?.capabilities?.length || 0,
      });
      
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
    if (mounted.current) {
      setters.setProfile(null);
      setters.setPermissions(createPermissionChecker(null));
    }
    return null;
  } finally {
    if (mounted.current) {
      setters.setProfileLoading(false);
    }
  }
}

/**
 * Handle SIGNED_IN auth event
 */
export async function handleSignedIn(
  session: Session,
  options: AuthEventHandlerOptions
): Promise<void> {
  const { mounted, setters } = options;
  
  if (!session.user || !mounted.current) return;

  // Fetch enhanced profile on sign in
  const enhancedProfile = await fetchProfileWithStateUpdate(session.user.id, options);

  // Best-effort: update last_login_at via RPC for OAuth and external flows
  try {
    await assertSupabase().rpc('update_user_last_login');
  } catch (e) {
    logger.debug('update_user_last_login RPC failed (non-blocking)', e);
  }

  // Register or update push token (best-effort)
  await registerPushDeviceForUser(session.user);

  // Identify in monitoring tools
  if (mounted.current) {
    identifyUserInMonitoring(session.user, enhancedProfile);

    track('edudash.auth.signed_in', {
      user_id: session.user.id,
      role: enhancedProfile?.role,
    });

    // Route user after successful sign in
    try {
      await routeAfterLogin(session.user, enhancedProfile);
    } catch (error) {
      console.error('Post-login routing failed:', error);
    }
  }
}

/**
 * Handle SIGNED_OUT auth event
 */
export async function handleSignedOut(
  session: Session | null,
  options: AuthEventHandlerOptions
): Promise<void> {
  const { mounted, setters, currentUser } = options;
  
  console.log('[AuthEventHandlers] SIGNED_OUT event received, clearing all auth state');
  
  if (mounted.current) {
    setters.setProfile(null);
    setters.setPermissions(createPermissionChecker(null));
    setters.setUser(null);
    setters.setSession(null);
    setters.setProfileLoading(false);
  }
  
  // Deregister push device
  await deregisterPushDeviceForUser(session?.user?.id || currentUser?.id);
  
  // Clear monitoring tools
  try { 
    await getPostHog()?.reset(); 
  } catch (e) { 
    logger.debug('PostHog reset failed', e); 
  }
  
  try { 
    Sentry.Native.setUser(null as any); 
  } catch (e) { 
    logger.debug('Sentry clear user failed', e); 
  }
  
  track('edudash.auth.signed_out', {});

  // Non-blocking toast to confirm sign-out
  try {
    const { toast } = await import('@/components/ui/ToastProvider');
    toast.success('You have been signed out');
  } catch (e) {
    logger.debug('Toast on sign-out failed (non-blocking)', e);
  }
  
  console.log('[AuthEventHandlers] Sign-out cleanup complete');
}

/**
 * Register push device for authenticated user
 */
async function registerPushDeviceForUser(user: User): Promise<void> {
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

/**
 * Deregister push device for user
 */
async function deregisterPushDeviceForUser(userId: string | undefined): Promise<void> {
  if (!userId) return;
  
  try {
    const { deregisterPushDevice } = await import('@/lib/notifications');
    await deregisterPushDevice(assertSupabase(), { id: userId });
  } catch (e) {
    logger.debug('Push deregistration failed', e);
  }
}

/**
 * Identify user in monitoring tools (PostHog, Sentry)
 */
export function identifyUserInMonitoring(
  user: User,
  profile: EnhancedUserProfile | null
): void {
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
    logger.debug('PostHog identify (auth change) failed', e);
  }
  
  try {
    Sentry.Native.setUser({ 
      id: user.id, 
      email: user.email || undefined 
    } as any);
  } catch (e) {
    logger.debug('Sentry setUser (auth change) failed', e);
  }
}

/**
 * Main auth state change handler
 */
export async function createAuthStateChangeHandler(
  options: AuthEventHandlerOptions
) {
  return async (event: AuthChangeEvent, session: Session | null) => {
    const { mounted, setters } = options;
    
    if (!mounted.current) return;
    
    setters.setSession(session ?? null);
    setters.setUser(session?.user ?? null);

    try {
      if (event === 'SIGNED_IN' && session) {
        await handleSignedIn(session, options);
      }

      if (event === 'SIGNED_OUT') {
        await handleSignedOut(session, options);
      }
    } catch (error) {
      console.error('Auth state change handler error:', error);
    }
  };
}
