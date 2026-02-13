/**
 * Profile fetching with multi-level fallback.
 *
 * Extracted from AuthContext.tsx to comply with WARP.md (≤400 lines).
 * Used by the boot-time initial fetch and the auth-listener SIGNED_IN handler.
 *
 * @module contexts/auth/profileFetch
 */

import { logger } from '@/lib/logger';
import { assertSupabase } from '@/lib/supabase';
import { fetchEnhancedUserProfile, createPermissionChecker, type EnhancedUserProfile } from '@/lib/rbac';
import { track } from '@/lib/analytics';
import { securityAuditor } from '@/lib/security-audit';
import { toEnhancedProfile, buildFallbackProfileFromSession } from '@/contexts/auth/profileUtils';

export interface ProfileFetchSetters {
  setProfile: (p: EnhancedUserProfile | null) => void;
  setPermissions: (p: ReturnType<typeof createPermissionChecker>) => void;
  setProfileLoading: (v: boolean) => void;
}

/**
 * Fetch an enhanced profile for `userId`, trying in order:
 * 1. RPC via `fetchEnhancedUserProfile` (with timeout)
 * 2. DB-direct fallback via `buildFallbackProfileFromSession`
 * 3. Stored profile from previous session
 * 4. Emergency minimal profile from auth metadata
 *
 * When `setters` is provided, React state is updated along the way.
 */
export async function fetchProfileWithFallbacks(
  userId: string,
  setters: ProfileFetchSetters | null,
  existingProfile: EnhancedUserProfile | null,
  options: { mounted: boolean; timeoutMs?: number } = { mounted: true },
): Promise<EnhancedUserProfile | null> {
  const TIMEOUT = options.timeoutMs ?? 8000;
  try {
    setters?.setProfileLoading(true);

    // 1. RPC fetch
    let enhancedProfile = await raceWithTimeout(fetchEnhancedUserProfile(userId), TIMEOUT);

    // 2. DB fallback
    if (!enhancedProfile) {
      logger.warn('profileFetch', 'RPC returned null / timed out — trying DB fallback');
      try {
        const { data: { user: authUser } } = await assertSupabase().auth.getUser();
        if (authUser?.id === userId) {
          enhancedProfile = await raceWithTimeout(
            buildFallbackProfileFromSession(authUser, existingProfile),
            5000,
          );
        }
      } catch (e) {
        logger.warn('profileFetch', 'DB fallback failed:', e);
      }
    }

    // 3. Stored profile
    if (!enhancedProfile) {
      try {
        const { getStoredProfileForUser } = await import('@/lib/sessionManager');
        const stored = await getStoredProfileForUser(userId);
        if (stored) enhancedProfile = toEnhancedProfile(stored as any);
      } catch (e) {
        logger.warn('profileFetch', 'Stored profile fallback failed:', e);
      }
    }

    // 4. Emergency
    if (!enhancedProfile) {
      enhancedProfile = buildEmergencyProfile(userId);
    }

    if (options.mounted && setters) {
      setters.setProfile(enhancedProfile);
      setters.setPermissions(createPermissionChecker(enhancedProfile));
    }

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

    return enhancedProfile;
  } catch (error) {
    logger.error('profileFetch', 'Failed to fetch profile:', error);
    if (options.mounted && setters) {
      setters.setProfile(null);
      setters.setPermissions(createPermissionChecker(null));
    }
    return null;
  } finally {
    if (options.mounted) {
      setters?.setProfileLoading(false);
    }
  }
}

// ── Helpers ──────────────────────────────────

async function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function buildEmergencyProfile(userId: string): EnhancedUserProfile | null {
  logger.warn('profileFetch', 'ALL resolution failed — building emergency profile for', userId);
  try {
    // Synchronous build from whatever we can gather — the caller already tried getUser()
    // so we don't do another network round-trip here.
    return toEnhancedProfile({
      id: userId,
      email: '',
      role: 'parent',
      first_name: '',
      last_name: '',
      full_name: '',
      organization_id: null,
      organization_name: null,
      seat_status: 'active',
      capabilities: [],
    });
  } catch {
    logger.error('profileFetch', 'Emergency profile build failed');
    return null;
  }
}
