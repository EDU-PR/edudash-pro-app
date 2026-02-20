/**
 * RBAC Profile Fetching
 * 
 * Handles fetching and building enhanced user profiles with organization
 * membership, capabilities, and permission checking.
 */

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import { shouldAllowFallback, trackFallbackUsage } from '@/lib/security-config';
import { getCurrentSession } from '@/lib/sessionManager';
import type { UserProfile } from '@/lib/sessionManager';
import { log, warn, debug, error as logError } from '@/lib/debug';

import { Role } from './constants';
import {
  EnhancedUserProfile,
  OrganizationMember,
  OrganizationData,
  DatabaseProfile,
  normalizeRole,
  getUserCapabilities,
  createEnhancedProfile,
} from './profile-utils';

/**
 * Fetch complete user profile with organization membership and permissions
 */
export async function fetchEnhancedUserProfile(
  userId: string,
  sessionOverride?: { user?: { id: string; email?: string }; access_token?: string; refresh_token?: string } | null
): Promise<EnhancedUserProfile | null> {
  try {
    log('Attempting to fetch profile for authenticated user:', userId);
    
    // Session validation with optimized timeouts
    let session: { user: { id: string; email?: string }; access_token?: string } | null = null;
    let sessionUserId: string | null = null;
    let storedSession: import('@/lib/sessionManager').UserSession | null = null;
    
    const SESSION_CHECK_TIMEOUT = 6000;
    
    // Use provided session override first (most reliable during auth transitions)
    if (sessionOverride?.user?.id) {
      sessionUserId = sessionOverride.user.id;
      session = {
        user: {
          id: sessionOverride.user.id,
          email: sessionOverride.user.email ?? undefined,
        },
        access_token: sessionOverride.access_token,
      };
    }

    // Try stored session first (fastest)
    log('[Profile] Checking stored session first...');
    if (!sessionUserId) {
      try {
        storedSession = await getCurrentSession();
        if (storedSession?.user_id) {
          sessionUserId = storedSession.user_id;
          log('[Profile] Stored session result: SUCCESS, user:', sessionUserId);
          session = {
            user: { id: storedSession.user_id, email: storedSession.email },
            access_token: storedSession.access_token
          };
        }
      } catch (e) {
        log('[Profile] getCurrentSession() failed:', e);
      }
    }

    // If stored session belongs to a different user, treat it as stale and continue.
    // Do not clear stored auth data here; this can happen during account switch
    // transitions and clearing storage can invalidate the new session.
    if (storedSession?.user_id && userId && storedSession.user_id !== userId) {
      debug('[Profile] Stored session mismatch, ignoring stale cached session', {
        storedUserId: storedSession.user_id,
        requestedUserId: userId,
      });
      storedSession = null;
      sessionUserId = null;
      session = null;
    }
    
    // Try Supabase in-memory session next (fast, no network)
    if (!sessionUserId) {
      log('[Profile] No stored session, trying auth.getSession()...');
      try {
        const getSessionPromise = assertSupabase().auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getSession timeout')), 2500)
        );
        const { data: { session: currentSession } } = await Promise.race([
          getSessionPromise,
          timeoutPromise,
        ]) as any;
        if (currentSession?.user?.id) {
          sessionUserId = currentSession.user.id;
          log('[Profile] auth.getSession() result: SUCCESS, user:', sessionUserId);
          session = {
            user: {
              id: currentSession.user.id,
              email: currentSession.user.email ?? undefined,
            },
            access_token: currentSession.access_token,
          };
        }
      } catch (e) {
        log('[Profile] auth.getSession() failed or timed out:', e);
      }
    }

    // Try getUser() if no stored or in-memory session
    if (!sessionUserId) {
      log('[Profile] No stored session, trying getUser()...');
      try {
        const getUserPromise = assertSupabase().auth.getUser();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('getUser timeout')), SESSION_CHECK_TIMEOUT)
        );
        const { data: { user } } = await Promise.race([getUserPromise, timeoutPromise]) as any;
        if (user?.id) {
          sessionUserId = user.id;
          log('[Profile] getUser() result: SUCCESS, user:', sessionUserId);
          session = { user };
        }
      } catch (e) {
        log('[Profile] getUser() failed or timed out:', e);
      }
    }
    
    // Trust provided userId if we couldn't validate via other means
    if (!sessionUserId && userId) {
      log('[Profile] No session validated, trusting provided userId for RPC call:', userId);
      sessionUserId = userId;
      session = { user: { id: userId } };
    }

    // Block if user ID mismatch
    if (sessionUserId && sessionUserId !== userId) {
      debug('[Profile] User ID mismatch during profile fetch (likely switch race)', {
        requestedUserId: userId,
        sessionUserId,
      });
      return null;
    }
    
    // Keep a single client instance so any session sync applies to the RPC call.
    const supabase = assertSupabase();

    // If caller provided session tokens, sync them into the Supabase client.
    if (
      sessionOverride?.access_token &&
      sessionOverride?.refresh_token &&
      sessionOverride?.user?.id === userId
    ) {
      try {
        await supabase.auth.setSession({
          access_token: sessionOverride.access_token,
          refresh_token: sessionOverride.refresh_token,
        });
      } catch (sessionSyncError) {
        debug('[Profile] Session override sync failed (non-fatal):', sessionSyncError);
      }
    }

    // If our custom session storage is populated but Supabase auth has no
    // in-memory session yet, explicitly set it so auth.uid() resolves.
    try {
      const { data: { session: clientSession } } = await supabase.auth.getSession();
      const missingClientSession = !clientSession?.access_token;
      const hasStoredTokens = !!storedSession?.access_token && !!storedSession?.refresh_token;

      if (missingClientSession && hasStoredTokens) {
        debug('[Profile] Supabase session missing, restoring from stored session');
        await supabase.auth.setSession({
          access_token: storedSession!.access_token,
          refresh_token: storedSession!.refresh_token,
        });
      }
    } catch (sessionSyncError) {
      debug('[Profile] Session sync failed (non-fatal):', sessionSyncError);
    }

    // Fetch profile
    let profile = null;
    let profileError = null;

    log('[Profile] Calling get_my_profile RPC...');
    // Avoid maybeSingle() here: it sets Accept=object+json and turns
    // "no rows" into a 406 error, which can wedge profile loading.
    const rpcCall = () => supabase.rpc('get_my_profile');
    const rpcTimeoutMs = 8000;
    const rpcTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('RPC timeout')), rpcTimeoutMs)
    );

    let rpcData: any = null;
    let rpcError: any = null;
    
    ({ data: rpcData, error: rpcError } = await Promise.race([rpcCall(), rpcTimeout]).catch(err => {
      log('[Profile] RPC call failed or timed out:', err.message);
      return { data: null, error: err };
    }) as any);

    // Single retry on timeout
    if ((!rpcData || (Array.isArray(rpcData) && rpcData.length === 0)) && rpcError && String(rpcError.message || '').includes('timeout')) {
      debug('Retrying get_my_profile RPC once after timeout...');
      await new Promise(res => setTimeout(res, 300));
      ({ data: rpcData, error: rpcError } = await Promise.race([rpcCall(), rpcTimeout]).catch(err => {
        log('[Profile] RPC retry failed or timed out:', err.message);
        return { data: null, error: err };
      }) as any);
    }

    const rpcProfile = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (rpcProfile && (rpcProfile as any).id) {
      profile = rpcProfile as any;
      debug('RPC get_my_profile succeeded');
    } else {
      profileError = rpcError;
      debug('RPC get_my_profile failed or returned null');
      if (rpcError) {
        debug('[Profile] get_my_profile error details', {
          message: (rpcError as any)?.message,
          code: (rpcError as any)?.code,
          details: (rpcError as any)?.details,
          hint: (rpcError as any)?.hint,
          status: (rpcError as any)?.status,
        });
      }

      // Fallback 1: Try direct table read
      try {
        const { data: selfProfile } = await assertSupabase()
          .from('profiles')
          .select('id,auth_user_id,email,role,first_name,last_name,avatar_url,created_at,preschool_id,organization_id')
          .eq('id', userId)
          .maybeSingle();
        if (selfProfile && (selfProfile as any).id) {
          profile = selfProfile as any;
          debug('Using direct profiles table read as fallback');
        }
      } catch (selfReadErr) {
        debug('Direct profiles read failed (non-fatal):', selfReadErr);
      }

      // Fallback 1b: Some deployments use profiles.auth_user_id instead of id
      if (!profile) {
        try {
          const { data: authLinkedProfile } = await assertSupabase()
            .from('profiles')
            .select('id,auth_user_id,email,role,first_name,last_name,avatar_url,created_at,preschool_id,organization_id')
            .eq('auth_user_id', userId)
            .maybeSingle();
          if (authLinkedProfile && (authLinkedProfile as any).id) {
            profile = authLinkedProfile as any;
            debug('Using profiles.auth_user_id lookup as fallback');
          }
        } catch (authLinkedErr) {
          debug('profiles.auth_user_id lookup failed (non-fatal):', authLinkedErr);
        }
      }
      
      // Fallback 2: Try debug RPC
      if (!profile) {
        try {
          const { data: directProfile } = await assertSupabase()
            .rpc('debug_get_profile_direct', { target_auth_id: userId })
            .maybeSingle();
          if (directProfile && (directProfile as any).id) {
            profile = directProfile as any;
            debug('Using direct profile as fallback');
          }
        } catch (directError) {
          debug('Direct profile fetch failed:', directError);
        }
      }
    }
    
    if (!profile) {
      if (!(profileError && (profileError as any).code === 'PGRST116')) {
        logError('Failed to fetch basic user profile:', profileError);
      }
      
      // Check if fallback is allowed
      const sessionToken = session?.access_token || storedSession?.access_token || '';
      const sessionId = sessionToken ? sessionToken.substring(0, 32) : '';
      if (!sessionId || !shouldAllowFallback(sessionId)) {
        logError('SECURITY: Fallback profile not allowed - returning null');
        return null;
      }
      
      trackFallbackUsage(sessionId);
      
      if (!session?.user) {
        return null;
      }
      
      const fallbackProfile: UserProfile = {
        id: session.user.id,
        email: session.user.email || 'unknown@example.com',
        role: 'parent' as any,
        first_name: 'User',
        last_name: '',
        avatar_url: undefined,
        organization_id: undefined,
        organization_name: undefined,
        seat_status: 'inactive' as any,
        capabilities: [],
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      };
      
      const enhancedFallback = createEnhancedProfile(fallbackProfile, {
        organization_id: null,
        organization_name: null,
        plan_tier: 'free',
        seat_status: 'inactive',
        invited_by: null,
        created_at: new Date().toISOString(),
      });
      
      track('edudash.security.fallback_profile_used', {
        user_id: session.user.id,
        email: session.user.email,
        reason: 'database_access_failed',
        timestamp: new Date().toISOString(),
      });
      
      warn('SECURITY: Using fallback profile with minimal permissions');
      return enhancedFallback;
    }
    
    debug('Successfully fetched profile');
    
    // Resolve organization
    const { org, orgMember, resolvedOrgId } = await resolveOrganization(profile, session, userId);
    
    // Get capabilities
    const capabilities = await getUserCapabilities(
      profile.role,
      org?.subscription_tier || org?.plan_tier || 'free',
      orgMember?.seat_status
    );

    // Resolve final organization ID
    const { finalOrgId, source: orgIdSource } = resolveOrganizationId(
      profile as DatabaseProfile,
      resolvedOrgId,
      orgMember as OrganizationMember | null
    );

    log('[Profile] Final organization_id resolution:', {
      userId: profile.id,
      email: profile.email,
      finalOrgId,
      source: orgIdSource,
      organizationName: org?.name || null,
    });
    if (!org?.name) {
      warn('[Profile] Organization name unresolved after resolution', {
        userId: profile.id,
        resolvedOrgId,
        profileOrganizationId: (profile as any)?.organization_id,
        profilePreschoolId: (profile as any)?.preschool_id,
        memberOrganizationId: orgMember?.organization_id || null,
      });
    }

    // Create base profile
    const baseProfile: UserProfile = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      first_name: profile.first_name,
      last_name: profile.last_name,
      full_name: profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || undefined,
      avatar_url: profile.avatar_url,
      organization_id: finalOrgId,
      organization_name: org?.name,
      preschool_id: (profile as any)?.preschool_id,
      seat_status: orgMember?.seat_status || 'active',
      capabilities,
      created_at: profile.created_at,
      last_login_at: profile.last_login_at,
    };

    // Create enhanced profile
    const enhancedProfile = createEnhancedProfile(baseProfile, {
      organization_id: baseProfile.organization_id,
      organization_name: org?.name,
      plan_tier: org?.subscription_tier || org?.plan_tier || 'free',
      seat_status: orgMember?.seat_status || 'active',
      invited_by: orgMember?.invited_by,
      created_at: orgMember?.created_at,
      member_type: orgMember?.member_type,
      school_type: org?.school_type,
    });
    
    // Track profile fetch
    track('edudash.rbac.profile_fetched', {
      user_id: userId,
      role: normalizeRole(profile.role) || 'unknown',
      has_org: !!orgMember || !!profile.preschool_id,
      seat_status: orgMember?.seat_status || 'active',
      plan_tier: org?.subscription_tier || org?.plan_tier || 'free',
      capabilities_count: capabilities.length,
      database_success: true,
    });
    
    // Monitor superadmin access
    if (normalizeRole(profile.role) === 'super_admin') {
      track('edudash.security.superadmin_access', {
        user_id: userId,
        timestamp: new Date().toISOString(),
        session_source: 'profile_fetch'
      });
      warn('SECURITY: Super admin profile accessed - monitoring enabled');
    }
    
    return enhancedProfile;
  } catch (error) {
    logError('Error in fetchEnhancedUserProfile:', error);
    reportError(new Error('Failed to fetch enhanced user profile'), { userId, error });
    
    // Error fallback handling
    return handleFetchError(userId, error);
  }
}

/**
 * Resolve organization details from profile data
 */
async function resolveOrganization(
  profile: any,
  session: any,
  userId: string
): Promise<{ org: OrganizationData | null; orgMember: OrganizationMember | null; resolvedOrgId: string | null }> {
  let orgMember: OrganizationMember | null = null;
  let org: OrganizationData | null = null;
  let resolvedOrgId: string | null = null;

  const isUuid = (v: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  
  const sessionMeta = (session?.user as { user_metadata?: Record<string, unknown> })?.user_metadata || {};
  const profileData = profile as DatabaseProfile;
  const orgIdentifierRaw: string | undefined =
    profileData.preschool_id ||
    profileData.organization_id ||
    profileData.tenant_slug ||
    (sessionMeta.tenant_slug as string | undefined) ||
    (sessionMeta.preschool_slug as string | undefined) ||
    (sessionMeta.school_slug as string | undefined);

  debug('[Profile] Organization identifier sources:', {
    preschool_id: profileData.preschool_id,
    organization_id: profileData.organization_id,
    orgIdentifierRaw,
  });

  if (orgIdentifierRaw) {
    try {
      if (isUuid(orgIdentifierRaw)) {
        // Try preschools by id first
        const { data: presById } = await assertSupabase()
          .from('preschools')
          .select('id, name, subscription_tier, school_type')
          .eq('id', orgIdentifierRaw)
          .maybeSingle();
        if (presById) {
          org = presById;
          resolvedOrgId = presById.id;
          
          // Override school_type from organizations if null
          if (!presById.school_type) {
            try {
              const { data: orgTypeCheck } = await assertSupabase()
                .from('organizations')
                .select('type')
                .eq('id', orgIdentifierRaw)
                .maybeSingle();
              if (orgTypeCheck?.type) {
                org = { ...presById, school_type: orgTypeCheck.type };
                debug('[Profile] Used organizations.type to override preschools.school_type:', orgTypeCheck.type);
              }
            } catch (e) {
              debug('organizations.type fallback lookup failed', e);
            }
          }
        } else {
          // Try organizations by id
          const { data: orgById } = await assertSupabase()
            .from('organizations')
            .select('id, name, plan_tier, type')
            .eq('id', orgIdentifierRaw)
            .maybeSingle();
          if (orgById) {
            org = { ...orgById, school_type: orgById.type };
            resolvedOrgId = orgById.id;
          }
        }
      } else {
        // Treat as tenant slug - try preschools first
        try {
          const { data: presBySlug } = await assertSupabase()
            .from('preschools')
            .select('id, name, subscription_tier, school_type')
            .eq('tenant_slug', orgIdentifierRaw)
            .maybeSingle();
          if (presBySlug) {
            org = presBySlug;
            resolvedOrgId = presBySlug.id;
            
            if (!presBySlug.school_type) {
              try {
                const { data: orgTypeCheck } = await assertSupabase()
                  .from('organizations')
                  .select('type')
                  .eq('id', presBySlug.id)
                  .maybeSingle();
                if (orgTypeCheck?.type) {
                  org = { ...presBySlug, school_type: orgTypeCheck.type };
                }
              } catch (e) {
                debug('organizations.type fallback lookup (slug) failed', e);
              }
            }
          }
        } catch (e) {
          debug('preschools by tenant_slug lookup failed', e);
        }

        if (!resolvedOrgId) {
          try {
            const { data: orgBySlug } = await assertSupabase()
              .from('organizations')
              .select('id, name, plan_tier, type')
              .eq('tenant_slug', orgIdentifierRaw)
              .maybeSingle();
            if (orgBySlug) {
              org = { ...orgBySlug, school_type: orgBySlug.type };
              resolvedOrgId = orgBySlug.id;
            }
          } catch (e2) {
            debug('organizations by tenant_slug lookup failed', e2);
          }
        }
      }
    } catch (e) {
      warn('Organization resolution failed:', e);
    }
  }

  debug('[Profile] Resolved organization ID:', resolvedOrgId);

  if (!resolvedOrgId) {
    try {
      const candidateUserIds = Array.from(new Set([
        userId,
        profileData?.id,
        (profileData as any)?.auth_user_id,
      ].filter(Boolean))) as string[];

      if (candidateUserIds.length > 0) {
        const { data: latestMembership } = await assertSupabase()
          .from('organization_members')
          .select('organization_id, seat_status, invited_by, created_at, member_type, user_id')
          .in('user_id', candidateUserIds)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestMembership?.organization_id) {
          resolvedOrgId = latestMembership.organization_id;
          if (!orgMember) {
            orgMember = {
              organization_id: latestMembership.organization_id,
              seat_status: latestMembership.seat_status || 'active',
              invited_by: latestMembership.invited_by,
              created_at: latestMembership.created_at,
              member_type: latestMembership.member_type,
            } as OrganizationMember;
          }
          debug('[Profile] Resolved organization from organization_members:', resolvedOrgId);
        }
      }
    } catch (e) {
      debug('organization_members fallback lookup failed', e);
    }
  }

  if (!resolvedOrgId && normalizeRole(profile.role) === 'teacher') {
    try {
      const email = profile.email || session?.user?.email;
      const filters: string[] = [];
      if (profile.id) filters.push(`user_id.eq.${profile.id}`);
      if (session?.user?.id) filters.push(`auth_user_id.eq.${session.user.id}`);
      if (email) filters.push(`email.eq.${email}`);

      if (filters.length > 0) {
        const { data: teacherRow } = await assertSupabase()
          .from('teachers')
          .select('preschool_id')
          .or(filters.join(','))
          .maybeSingle();
        if (teacherRow?.preschool_id) {
          resolvedOrgId = teacherRow.preschool_id;
          debug('[Profile] Resolved organization from teachers table:', resolvedOrgId);
        }
      }
    } catch (e) {
      debug('teachers table fallback lookup failed', e);
    }
  }

  // Fetch organization member data
  const userRole = normalizeRole(profile.role);
  const isPrincipal = userRole === 'principal_admin' || userRole === 'principal';
  const profileOrgId = profile.organization_id || profile.preschool_id;
  const orgIdToUse = profileOrgId || resolvedOrgId;

  if (orgIdToUse) {
    if (!isPrincipal || !profileOrgId) {
      try {
        const { data: memberData, error: memberError } = await assertSupabase()
          .rpc('get_my_org_member', { p_org_id: orgIdToUse });

        if (!memberError) {
          const memberResult = Array.isArray(memberData) ? memberData[0] : memberData;
          if (memberResult) {
            orgMember = memberResult as OrganizationMember;
          }
        }
      } catch (e) {
        debug('get_my_org_member RPC failed', e);
      }
    }

    // Fetch member_type from organization_members if missing
    const targetOrgId = profileOrgId || orgIdToUse;
    const needsMemberTypeFetch = !orgMember?.member_type;
    
    if (needsMemberTypeFetch && targetOrgId) {
      try {
        const { data: memberTypeData } = await assertSupabase()
          .from('organization_members')
          .select('member_type, seat_status, invited_by, created_at, organization_id')
          .eq('organization_id', targetOrgId)
          .eq('user_id', userId)
          .maybeSingle();

        if (memberTypeData) {
          if (!orgMember) {
            orgMember = {
              organization_id: targetOrgId,
              seat_status: memberTypeData.seat_status || 'active',
              invited_by: memberTypeData.invited_by,
              created_at: memberTypeData.created_at,
              member_type: memberTypeData.member_type,
            } as OrganizationMember;
          } else {
            orgMember.member_type = memberTypeData.member_type;
            if (!orgMember.organization_id) {
              orgMember.organization_id = targetOrgId;
            }
          }
        }
      } catch (e) {
        debug('organization_members query failed', e);
      }
    }

    // Load org details if not already loaded
    if (!org) {
      try {
        const { data: orgData } = await assertSupabase()
          .from('preschools')
          .select('id, name, subscription_tier, school_type')
          .eq('id', orgIdToUse)
          .maybeSingle();
        if (orgData) {
          org = orgData as OrganizationData;
        }
      } catch (e) {
        debug('preschools by id lookup failed', e);
      }
    }
    
    if (!org && orgIdToUse) {
      try {
        const { data: orgData } = await assertSupabase()
          .from('organizations')
          .select('id, name, plan_tier, type')
          .eq('id', orgIdToUse)
          .maybeSingle();
        if (orgData) {
          org = { ...orgData, school_type: orgData.type } as OrganizationData;
        }
      } catch (e) {
        debug('organizations by id lookup failed', e);
      }
    }
  }

  return { org, orgMember, resolvedOrgId };
}

/**
 * Resolve final organization ID with priority logic
 */
function resolveOrganizationId(
  profileData: DatabaseProfile,
  resolvedId: string | null,
  memberData: OrganizationMember | null
): { finalOrgId: string | undefined; source: string } {
  const userRole = normalizeRole(profileData.role);
  const isPrincipal = userRole === 'principal_admin' || userRole === 'principal';
  const profileOrgId = profileData.organization_id || profileData.preschool_id;

  // Prioritize profileOrgId if user has member_type (SOA member)
  if (memberData?.member_type && profileOrgId) {
    return {
      finalOrgId: profileOrgId,
      source: 'profiles table (SOA member with member_type)',
    };
  }

  if (isPrincipal && profileOrgId) {
    return {
      finalOrgId: profileOrgId,
      source: 'profiles table (principal priority)',
    };
  }

  const finalId = (profileOrgId && (profileOrgId === resolvedId || !resolvedId)) 
    ? profileOrgId 
    : resolvedId || memberData?.organization_id || profileOrgId;
  const source = (profileOrgId && finalId === profileOrgId)
    ? 'profiles table (priority)'
    : resolvedId
    ? 'resolvedOrgId (from lookup)'
    : memberData?.organization_id
    ? 'organization_members table'
    : profileOrgId
    ? 'profiles table (fallback)'
    : 'none';

  return { finalOrgId: finalId, source };
}

/**
 * Handle fetch errors with security-conscious fallback
 */
async function handleFetchError(userId: string, error: any): Promise<EnhancedUserProfile | null> {
  const { data: { session } } = await assertSupabase().auth.getSession();

  let sessionUserId: string | null = session?.user?.id ?? null;
  let storedSession: import('@/lib/sessionManager').UserSession | null = null;
  
  if (!sessionUserId) {
    try {
      storedSession = await getCurrentSession();
      if (storedSession?.user_id) sessionUserId = storedSession.user_id;
    } catch (e) {
      debug('getCurrentSession() failed in error fallback', e);
    }
  }

  if (!sessionUserId || sessionUserId !== userId) {
    logError('Authentication validation failed in error handler');
    return null;
  }

  if (!session?.user) {
    return null;
  }
  
  const fallbackProfile: UserProfile = {
    id: session.user.id,
    email: session.user.email || 'unknown@example.com',
    role: 'parent' as any,
    first_name: 'User',
    last_name: '',
    avatar_url: undefined,
    organization_id: undefined,
    organization_name: undefined,
    seat_status: 'inactive' as any,
    capabilities: [],
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
  };
  
  const enhancedFallback = createEnhancedProfile(fallbackProfile, {
    organization_id: null,
    organization_name: null,
    plan_tier: 'free',
    seat_status: 'inactive',
    invited_by: null,
    created_at: new Date().toISOString(),
  });
  
  const sessionToken = session?.access_token || storedSession?.access_token || '';
  const sessionId = sessionToken ? sessionToken.substring(0, 32) : '';
  if (sessionId) {
    trackFallbackUsage(sessionId);
  }

  track('edudash.security.error_fallback_profile_used', {
    user_id: sessionUserId,
    email: session?.user?.email || storedSession?.email,
    error: error instanceof Error ? error.message : 'Unknown error',
    timestamp: new Date().toISOString(),
  });
  
  warn('SECURITY: Using error fallback profile with minimal permissions');
  return enhancedFallback;
}
