import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import type {
  Organization,
  OrganizationStats,
  OrganizationType,
} from '@/lib/screen-styles/super-admin-organizations.styles';

/** Result returned by fetchOrganizations */
export interface FetchOrganizationsResult {
  organizations: Organization[];
  stats: OrganizationStats;
}

/**
 * Fetches organizations from preschools, schools, and organizations tables,
 * merges them, and computes aggregate stats.
 */
export async function fetchOrganizationsData(): Promise<FetchOrganizationsResult> {
  const supabase = assertSupabase();

  logger.debug('[Organizations] Fetching organizations...');

  // Fetch from multiple tables in parallel
  const [preschoolsRes, schoolsRes, orgsRes] = await Promise.all([
    supabase
      .from('preschools')
      .select(`
        id, name, email, phone, address, city, province, country,
        is_active, is_verified, created_at, updated_at, metadata,
        principal_id, logo_url, subscription_tier, subscription_status,
        subscription_plan_id
      `)
      .order('created_at', { ascending: false }),

    supabase
      .from('schools')
      .select(`
        id, name, email, phone, address, city, province, country,
        is_active, created_at, updated_at, metadata, logo_url,
        subscription_tier, subscription_status
      `)
      .order('created_at', { ascending: false }),

    supabase
      .from('organizations')
      .select(`
        id, name, contact_email, contact_phone, address, city, province,
        country, is_active, organization_type, created_at, updated_at,
        metadata, logo_url, subscription_tier, subscription_status, plan_tier
      `)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  logger.debug('[Organizations] Preschools response:', {
    count: preschoolsRes.data?.length || 0,
    error: preschoolsRes.error?.message,
  });
  logger.debug('[Organizations] Schools response:', {
    count: schoolsRes.data?.length || 0,
    error: schoolsRes.error?.message,
  });
  logger.debug('[Organizations] Orgs response:', {
    count: orgsRes.data?.length || 0,
    error: orgsRes.error?.message,
  });

  // Process preschools
  const preschools: Organization[] = (preschoolsRes.data || []).map((p: any) => ({
    id: `preschool_${p.id}`,
    name: p.name || 'Unnamed Preschool',
    type: 'preschool' as OrganizationType,
    status: p.is_active ? 'active' : 'inactive',
    contact_email: p.email || '',
    contact_phone: p.phone,
    address: p.address,
    city: p.city,
    province: p.province,
    country: p.country || 'South Africa',
    student_count: 0,
    teacher_count: 0,
    created_at: p.created_at,
    last_active_at: p.updated_at,
    is_verified: p.is_verified || false,
    logo_url: p.logo_url,
    metadata: p.metadata,
    subscription_tier: p.subscription_tier || null,
    subscription_status: p.subscription_status || null,
    subscription_plan_id: p.subscription_plan_id || null,
  }));

  // Process K-12 schools
  const k12Schools: Organization[] = (schoolsRes.data || []).map((s: any) => ({
    id: `school_${s.id}`,
    name: s.name || 'Unnamed School',
    type: 'k12' as OrganizationType,
    status: s.is_active ? 'active' : 'inactive',
    contact_email: s.email || '',
    contact_phone: s.phone,
    address: s.address,
    city: s.city,
    province: s.province,
    country: s.country || 'South Africa',
    student_count: 0,
    teacher_count: 0,
    created_at: s.created_at,
    last_active_at: s.updated_at,
    is_verified: false,
    logo_url: s.logo_url,
    metadata: s.metadata,
    subscription_tier: s.subscription_tier || null,
    subscription_status: s.subscription_status || null,
  }));

  // Process generic organizations
  const otherOrgs: Organization[] = (orgsRes.data || []).map((o: any) => ({
    id: `org_${o.id}`,
    name: o.name || 'Unnamed Organization',
    type: (o.organization_type || 'org') as OrganizationType,
    status: o.is_active ? 'active' : 'inactive',
    contact_email: o.contact_email || '',
    contact_phone: o.contact_phone,
    address: o.address,
    city: o.city,
    province: o.province,
    country: o.country || 'South Africa',
    student_count: 0,
    teacher_count: 0,
    created_at: o.created_at,
    last_active_at: o.updated_at,
    is_verified: false,
    logo_url: o.logo_url,
    metadata: o.metadata,
    subscription_tier: o.subscription_tier || o.plan_tier || null,
    subscription_status: o.subscription_status || null,
  }));

  const allOrgs = [...preschools, ...k12Schools, ...otherOrgs];

  // Calculate stats
  const stats: OrganizationStats = {
    total: allOrgs.length,
    preschools: preschools.length,
    k12_schools: k12Schools.length,
    skills_centers: allOrgs.filter(o => o.type === 'skills').length,
    other_orgs: otherOrgs.length,
    active: allOrgs.filter(o => o.status === 'active').length,
    pending: allOrgs.filter(o => o.status === 'pending').length,
    suspended: allOrgs.filter(o => o.status === 'suspended').length,
    verified: allOrgs.filter(o => o.is_verified).length,
    with_subscription: 0,
  };

  // Fetch subscription counts
  try {
    const { data: subscriptions, error: subErr } = await supabase
      .from('subscriptions')
      .select('school_id, user_id, status')
      .eq('status', 'active');

    if (subErr) {
      logger.debug('[Organizations] Subscription query error:', subErr.message);
    } else if (subscriptions) {
      const orgsWithSubs = new Set<string>();
      subscriptions.forEach((sub: any) => {
        if (sub.school_id) orgsWithSubs.add(sub.school_id);
      });
      stats.with_subscription = orgsWithSubs.size;
    }
  } catch (subError) {
    logger.debug('Could not fetch subscription counts:', subError);
  }

  track('superadmin_organizations_viewed', {
    total_count: allOrgs.length,
    preschool_count: preschools.length,
    k12_count: k12Schools.length,
  });

  return { organizations: allOrgs, stats };
}
