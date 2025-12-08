/**
 * Organization Lookup Utilities
 *
 * Provides organization resolution for principal dashboard.
 * Handles multiple lookup strategies: ID, slug, name, membership tables.
 */

import { assertSupabase } from '@/lib/supabase';
import { warn, log } from '@/lib/debug';
import type { User } from '@supabase/supabase-js';

/** UUID regex pattern for validation */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID
 */
export const isUuid = (str: string): boolean => UUID_REGEX.test(str);

/**
 * Organization data shape returned from lookup
 */
export interface OrganizationData {
  id: string;
  name: string;
  subscription_status?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  capacity?: number;
}

/**
 * Resolve organization identifier from user profile
 */
export const resolveOrgIdentifier = (
  userProfile: Record<string, unknown>,
  user: User
): string | undefined => {
  const rawOrgId = userProfile.organization_id as string | undefined;
  const rawPreschoolId = userProfile.preschool_id as string | undefined;
  const rawTenantSlug = userProfile.tenant_slug as string | undefined;

  const metaSlugCandidates: (string | undefined)[] = [
    user?.user_metadata?.tenant_slug as string | undefined,
    user?.user_metadata?.preschool_slug as string | undefined,
    user?.user_metadata?.school_slug as string | undefined,
    user?.user_metadata?.school_id as string | undefined,
  ];

  let orgIdentifier: string | undefined = rawOrgId || rawPreschoolId || rawTenantSlug;
  
  if (!orgIdentifier) {
    const metaSlug = metaSlugCandidates.find(
      (s) => typeof s === 'string' && s.length > 0 && !isUuid(String(s))
    );
    if (metaSlug) orgIdentifier = String(metaSlug);
  }

  return orgIdentifier;
};

/**
 * Lookup organization by UUID
 */
export const fetchOrganizationById = async (id: string): Promise<OrganizationData | null> => {
  const client = assertSupabase();

  // Try organizations table first
  const { data: orgData } = await client
    .from('organizations')
    .select('id, name, plan_tier, created_at, address, phone, email')
    .eq('id', id)
    .maybeSingle();

  if (orgData) {
    return {
      id: orgData.id,
      name: orgData.name,
      subscription_status: 'active',
      address: orgData.address,
      phone: orgData.phone,
      email: orgData.email,
    };
  }

  // Try preschools table
  const { data: preschoolData } = await client
    .from('preschools')
    .select('id, name, address, phone, email, subscription_status, subscription_plan, capacity')
    .eq('id', id)
    .maybeSingle();

  if (preschoolData) {
    return {
      id: preschoolData.id,
      name: preschoolData.name,
      subscription_status: preschoolData.subscription_status || 'active',
      address: preschoolData.address,
      phone: preschoolData.phone,
      email: preschoolData.email,
      capacity: preschoolData.capacity,
    };
  }

  return null;
};

/**
 * Lookup organization by slug or name
 */
export const fetchOrganizationBySlug = async (slug: string): Promise<OrganizationData | null> => {
  const client = assertSupabase();

  // Try preschools tenant_slug first
  try {
    const { data: preschoolBySlug } = await client
      .from('preschools')
      .select('id, name, address, phone, email, subscription_status, capacity')
      .eq('tenant_slug', slug)
      .maybeSingle();

    if (preschoolBySlug) {
      return {
        id: preschoolBySlug.id,
        name: preschoolBySlug.name,
        subscription_status: preschoolBySlug.subscription_status || 'active',
        address: preschoolBySlug.address,
        phone: preschoolBySlug.phone,
        email: preschoolBySlug.email,
        capacity: preschoolBySlug.capacity,
      };
    }
  } catch (e) {
    warn('preschools.tenant_slug lookup failed:', e);
  }

  // Try organizations by name (slug with dashes replaced by spaces)
  try {
    const { data: orgByName } = await client
      .from('organizations')
      .select('id, name, plan_tier, created_at')
      .ilike('name', slug.replace(/-/g, ' '))
      .maybeSingle();

    if (orgByName) {
      return {
        id: orgByName.id,
        name: orgByName.name,
        subscription_status: 'active',
        address: null,
        phone: null,
        email: null,
      };
    }
  } catch (e) {
    warn('organizations name lookup failed:', e);
  }

  // Try preschools by name
  try {
    const { data: preschoolByName } = await client
      .from('preschools')
      .select('id, name, address, phone, email, subscription_status, capacity')
      .ilike('name', slug.replace(/-/g, ' '))
      .maybeSingle();

    if (preschoolByName) {
      return {
        id: preschoolByName.id,
        name: preschoolByName.name,
        subscription_status: preschoolByName.subscription_status || 'active',
        address: preschoolByName.address,
        phone: preschoolByName.phone,
        email: preschoolByName.email,
        capacity: preschoolByName.capacity,
      };
    }
  } catch (e) {
    warn('preschools name lookup failed:', e);
  }

  return null;
};

/**
 * Lookup organization via membership tables (fallback strategy)
 */
export const fetchOrganizationViaMembership = async (
  userId: string,
  authUserId: string
): Promise<string | null> => {
  const client = assertSupabase();

  // Try organization_members table
  const { data: alternativeOrg } = await client
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (alternativeOrg?.organization_id) {
    log('✅ Found organization via organization_members table');
    return alternativeOrg.organization_id as string;
  }

  // Try users table (preschool_id field)
  try {
    const { data: selfUser, error: selfErr } = await client
      .from('users')
      .select('id, auth_user_id, preschool_id, role')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (selfErr) {
      warn('Self users row lookup error:', selfErr?.message);
    }

    if (selfUser?.preschool_id) {
      log('✅ Resolved organization from self users row (preschool_id)');
      return selfUser.preschool_id as string;
    }
  } catch (e) {
    warn('Self users row lookup threw:', e);
  }

  return null;
};

/**
 * Main organization lookup function
 * Combines all lookup strategies
 */
export const lookupOrganization = async (
  orgIdentifier: string | undefined,
  profileId: string,
  authUserId: string
): Promise<OrganizationData | null> => {
  if (!orgIdentifier) {
    warn('⚠️ No organization identifier found in profile, checking organization membership');
    const membershipOrgId = await fetchOrganizationViaMembership(profileId, authUserId);
    if (membershipOrgId) {
      orgIdentifier = membershipOrgId;
    }
  } else {
    log('✅ Found organization identifier in profile:', orgIdentifier);
  }

  if (!orgIdentifier) {
    return null;
  }

  // Try ID-based lookup for UUIDs, slug-based otherwise
  if (isUuid(orgIdentifier)) {
    return fetchOrganizationById(orgIdentifier);
  }

  // Try slug first, then ID
  const bySlug = await fetchOrganizationBySlug(orgIdentifier);
  if (bySlug) return bySlug;

  return fetchOrganizationById(orgIdentifier);
};
