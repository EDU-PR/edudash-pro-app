/**
 * Session Manager — Profile Operations
 * 
 * Handles fetching user profiles from the database, computing capabilities,
 * and building minimal profiles from auth metadata.
 */

import { assertSupabase } from '@/lib/supabase';
import { reportError } from '@/lib/monitoring';
import type { UserProfile, User } from './types';

/**
 * Helper to wrap a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallback), ms)
    ),
  ]);
}

/**
 * Fetch user profile from database
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    let profile = null;
    let profileError = null;

    const profileSelect = `
        id,
        auth_user_id,
        email,
        role,
        first_name,
        last_name,
        avatar_url,
        created_at,
        preschool_id,
        organization_id,
        is_active
      `;

    const { data: profileData, error: fetchError } = await assertSupabase()
      .from('profiles')
      .select(profileSelect)
      .eq('id', userId)
      .maybeSingle();

    if (!fetchError && profileData) {
      profile = profileData;
    } else {
      profileError = fetchError;
    }

    // Fallback: Some deployments use profiles.auth_user_id instead of id
    if (!profile) {
      const { data: authLinkedProfile, error: authLinkedError } = await assertSupabase()
        .from('profiles')
        .select(profileSelect)
        .eq('auth_user_id', userId)
        .maybeSingle();
      if (!authLinkedError && authLinkedProfile) {
        profile = authLinkedProfile;
      } else if (authLinkedError && !profileError) {
        profileError = authLinkedError;
      }
    }

    if (profileError && !profile) {
      console.error('Failed to fetch user profile:', profileError);
      return null;
    }

    if (!profile) {
      console.warn('No profile row found for user:', userId);
      const capabilities = await getUserCapabilities('parent', undefined);
      return {
        id: userId,
        email: '',
        role: 'parent',
        first_name: '',
        last_name: '',
        avatar_url: '',
        organization_id: undefined,
        organization_name: undefined,
        seat_status: 'active',
        capabilities,
        created_at: new Date().toISOString(),
        last_login_at: null as any,
      };
    }

    const planTier = undefined;
    const capabilities = await getUserCapabilities(profile.role, planTier);

    const resolvedOrgId = profile.organization_id || profile.preschool_id;
    const resolvedPreschoolId = profile.preschool_id || profile.organization_id;
    let organizationName: string | undefined;
    let preschoolName: string | undefined;

    if (resolvedOrgId || resolvedPreschoolId) {
      const candidateIds = Array.from(new Set([resolvedOrgId, resolvedPreschoolId].filter(Boolean))) as string[];
      for (const candidateId of candidateIds) {
        try {
          const { data: pres } = await assertSupabase()
            .from('preschools')
            .select('name')
            .eq('id', candidateId)
            .maybeSingle();
          if (pres?.name) {
            preschoolName = pres.name;
            organizationName = pres.name;
            break;
          }
        } catch {
          // non-fatal
        }
        try {
          const { data: org } = await assertSupabase()
            .from('organizations')
            .select('name')
            .eq('id', candidateId)
            .maybeSingle();
          if (org?.name) {
            organizationName = org.name;
            break;
          }
        } catch {
          // non-fatal
        }
      }
    }

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      first_name: profile.first_name,
      last_name: profile.last_name,
      avatar_url: profile.avatar_url,
      organization_id: resolvedOrgId,
      organization_name: organizationName,
      preschool_id: resolvedPreschoolId,
      preschool_name: preschoolName,
      seat_status: profile.is_active !== false ? 'active' : 'inactive',
      capabilities,
      created_at: profile.created_at,
      last_login_at: (profile as any).last_login_at ?? null,
    };
  } catch (error) {
    reportError(new Error('Failed to fetch user profile'), { userId, error });
    return null;
  }
}

/**
 * Get user capabilities based on role and subscription tier
 */
export async function getUserCapabilities(role: string, planTier?: string): Promise<string[]> {
  const normalizedRole = (String(role || 'parent').toLowerCase());
  const baseCapabilities: Record<string, string[]> = {
    super_admin: [
      'access_mobile_app',
      'view_all_organizations',
      'manage_organizations',
      'view_billing',
      'manage_subscriptions',
      'access_admin_tools',
    ],
    principal_admin: [
      'access_mobile_app',
      'view_school_metrics',
      'manage_teachers',
      'manage_students',
      'access_principal_hub',
      'generate_reports',
    ],
    principal: [
      'access_mobile_app',
      'view_school_metrics',
      'manage_teachers',
      'manage_students',
      'access_principal_hub',
      'generate_reports',
    ],
    teacher: [
      'access_mobile_app',
      'manage_classes',
      'create_assignments',
      'grade_assignments',
      'view_class_analytics',
    ],
    parent: [
      'access_mobile_app',
      'view_child_progress',
      'communicate_with_teachers',
      'access_homework_help',
    ],
  };

  const capabilities = baseCapabilities[normalizedRole] || baseCapabilities['parent'];

  if (planTier === 'premium' || planTier === 'enterprise') {
    capabilities.push('ai_lesson_generation', 'advanced_analytics');
  }

  if (planTier === 'enterprise') {
    capabilities.push(
      'ai_grading_assistance',
      'bulk_operations',
      'custom_reports',
      'sso_access',
      'priority_support'
    );
  }

  return capabilities;
}

/**
 * Build a minimal profile from auth user metadata (fallback when profile fetch fails or times out)
 */
export async function buildMinimalProfileFromUser(user: User, overrides?: Partial<UserProfile>): Promise<UserProfile> {
  let dbProfile: Partial<UserProfile> | null = null;
  try {
    const profileQuery = assertSupabase()
      .from('profiles')
      .select('id, email, role, first_name, last_name, full_name, preschool_id, organization_id, seat_status')
      .eq('id', user.id)
      .maybeSingle();
    const profileResult = await withTimeout(profileQuery as any, 1500, null as any);
    if (profileResult) {
      dbProfile = profileResult as Partial<UserProfile>;
    }
  } catch {
    // Non-fatal fallback
  }

  const mergedOverrides = { ...(dbProfile || {}), ...(overrides || {}) };
  const userMeta = (user.user_metadata || {}) as Record<string, any>;
  const appMeta = (user.app_metadata || {}) as Record<string, any>;
  const role = (mergedOverrides?.role ||
    userMeta.role ||
    appMeta.role ||
    'parent') as UserProfile['role'];
  const planTier =
    userMeta.plan_tier ||
    userMeta.subscription_tier ||
    appMeta.plan_tier ||
    appMeta.subscription_tier;
  const capabilities = await getUserCapabilities(role, planTier);
  const firstName = mergedOverrides?.first_name || userMeta.first_name || userMeta.given_name || '';
  const lastName = mergedOverrides?.last_name || userMeta.last_name || userMeta.family_name || '';
  const fullName =
    mergedOverrides?.full_name ||
    userMeta.full_name ||
    userMeta.name ||
    `${firstName} ${lastName}`.trim() ||
    undefined;
  const organizationId =
    mergedOverrides?.organization_id ||
    mergedOverrides?.preschool_id ||
    userMeta.organization_id ||
    appMeta.organization_id ||
    userMeta.preschool_id ||
    appMeta.preschool_id;
  const preschoolId =
    mergedOverrides?.preschool_id ||
    userMeta.preschool_id ||
    appMeta.preschool_id;

  return {
    id: user.id,
    email: mergedOverrides?.email || user.email || '',
    role,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    avatar_url: mergedOverrides?.avatar_url || userMeta.avatar_url || userMeta.picture,
    organization_id: organizationId,
    organization_name: mergedOverrides?.organization_name || userMeta.organization_name || appMeta.organization_name,
    preschool_id: preschoolId,
    seat_status: mergedOverrides?.seat_status || 'active',
    capabilities,
    created_at: mergedOverrides?.created_at || new Date().toISOString(),
    last_login_at: mergedOverrides?.last_login_at || new Date().toISOString(),
  };
}
