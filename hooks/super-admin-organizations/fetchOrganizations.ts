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

interface OrgCounts {
  student_count: number;
  teacher_count: number;
  active_student_count: number;
  active_teacher_count: number;
}

const TEACHER_ROLES = new Set(['teacher', 'assistant_teacher', 'head_teacher', 'educator']);
const STATUS_RANK: Record<string, number> = {
  active: 4,
  pending: 3,
  suspended: 2,
  inactive: 1,
};
const TYPE_RANK: Record<OrganizationType, number> = {
  k12: 5,
  preschool: 4,
  skills: 3,
  org: 2,
  all: 1,
};

function getOrCreateCounts(map: Map<string, OrgCounts>, key: string): OrgCounts {
  const existing = map.get(key);
  if (existing) return existing;
  const created: OrgCounts = {
    student_count: 0,
    teacher_count: 0,
    active_student_count: 0,
    active_teacher_count: 0,
  };
  map.set(key, created);
  return created;
}

export function getOrganizationBucketType(
  rawType: string | null | undefined,
  source: 'preschool' | 'school' | 'organization'
): OrganizationType {
  if (source === 'school') return 'k12';

  const normalized = String(rawType || '').trim().toLowerCase();
  if (!normalized) return source === 'preschool' ? 'preschool' : 'org';
  if (normalized === 'preschool' || normalized === 'ecd') return 'preschool';
  if (normalized.includes('skills')) return 'skills';
  if (
    normalized === 'k12' ||
    normalized === 'primary' ||
    normalized === 'secondary' ||
    normalized === 'combined' ||
    normalized === 'community_school' ||
    normalized === 'community-school'
  ) {
    return 'k12';
  }
  return 'org';
}

function isActiveStudent(row: { is_active?: boolean | null; status?: string | null }): boolean {
  if (row.is_active === false) return false;
  const status = String(row.status || '').toLowerCase();
  return !['inactive', 'withdrawn', 'archived'].includes(status);
}

function getSourcePriority(prefixedId: string): number {
  const source = prefixedId.split('_')[0];
  if (source === 'school') return 3;
  if (source === 'preschool') return 2;
  return 1;
}

function getRawId(prefixedId: string): string {
  return prefixedId.split('_').slice(1).join('_');
}

function bestStatus(current: string, candidate: string): Organization['status'] {
  return (STATUS_RANK[candidate] || 0) > (STATUS_RANK[current] || 0)
    ? (candidate as Organization['status'])
    : (current as Organization['status']);
}

function bestType(current: OrganizationType, candidate: OrganizationType): OrganizationType {
  return (TYPE_RANK[candidate] || 0) > (TYPE_RANK[current] || 0) ? candidate : current;
}

export function dedupeOrganizationsByRawId(records: Organization[]): Organization[] {
  const merged = new Map<
    string,
    {
      primary: Organization;
      sourceIds: Set<string>;
      rawTypes: Set<string>;
      type: OrganizationType;
      status: Organization['status'];
      is_verified: boolean;
      student_count: number;
      teacher_count: number;
      active_student_count: number;
      active_teacher_count: number;
    }
  >();

  records.forEach((record) => {
    const rawId = getRawId(record.id);
    const current = merged.get(rawId);
    const activeStudentCount = record.active_student_count ?? record.student_count ?? 0;
    const activeTeacherCount = record.active_teacher_count ?? record.teacher_count ?? 0;

    if (!current) {
      merged.set(rawId, {
        primary: { ...record },
        sourceIds: new Set([record.id]),
        rawTypes: new Set([String(record.organization_type_raw || record.type)]),
        type: record.type,
        status: record.status,
        is_verified: !!record.is_verified,
        student_count: record.student_count || 0,
        teacher_count: record.teacher_count || 0,
        active_student_count: activeStudentCount,
        active_teacher_count: activeTeacherCount,
      });
      return;
    }

    // Keep highest-priority source as the canonical row id.
    if (getSourcePriority(record.id) > getSourcePriority(current.primary.id)) {
      current.primary = { ...current.primary, ...record };
    } else {
      // Keep canonical source, but fill gaps from secondary rows.
      current.primary = {
        ...record,
        ...current.primary,
        name: current.primary.name || record.name,
        contact_email: current.primary.contact_email || record.contact_email,
        contact_phone: current.primary.contact_phone || record.contact_phone,
        address: current.primary.address || record.address,
        city: current.primary.city || record.city,
        province: current.primary.province || record.province,
        country: current.primary.country || record.country,
        logo_url: current.primary.logo_url || record.logo_url,
      };
    }

    current.sourceIds.add(record.id);
    current.rawTypes.add(String(record.organization_type_raw || record.type));
    current.type = bestType(current.type, record.type);
    current.status = bestStatus(current.status, record.status);
    current.is_verified = current.is_verified || !!record.is_verified;
    current.student_count += record.student_count || 0;
    current.teacher_count += record.teacher_count || 0;
    current.active_student_count += activeStudentCount;
    current.active_teacher_count += activeTeacherCount;
  });

  return Array.from(merged.values()).map((item) => {
    const sourceList = Array.from(item.sourceIds);
    return {
      ...item.primary,
      type: item.type,
      status: item.status,
      is_verified: item.is_verified,
      student_count: item.student_count,
      teacher_count: item.teacher_count,
      active_student_count: item.active_student_count,
      active_teacher_count: item.active_teacher_count,
      organization_type_raw: Array.from(item.rawTypes).join(' | '),
      metadata: {
        ...(item.primary.metadata || {}),
        source_count: sourceList.length,
        source_ids: sourceList,
      },
    };
  });
}

/**
 * Fetches organizations from preschools, schools, and organizations tables,
 * merges them, and computes aggregate stats.
 */
export async function fetchOrganizationsData(): Promise<FetchOrganizationsResult> {
  const supabase = assertSupabase();

  logger.debug('[Organizations] Fetching organizations...');

  // Fetch from multiple tables in parallel
  const [preschoolsRes, schoolsRes, orgsRes, studentsRes, teachersRes, profilesRes] = await Promise.all([
    supabase
      .from('preschools')
      .select(`
        id, name, email, phone, address, city, province, country,
        is_active, is_verified, created_at, updated_at, metadata,
        principal_id, logo_url, subscription_tier, subscription_status,
        subscription_plan_id, school_type
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
        metadata, logo_url, subscription_tier, subscription_status, plan_tier, type
      `)
      .order('created_at', { ascending: false }),

    supabase
      .from('students')
      .select('id, preschool_id, organization_id, is_active, status'),

    supabase
      .from('teachers')
      .select('id, preschool_id, auth_user_id, user_id, is_active'),

    supabase
      .from('profiles')
      .select('id, preschool_id, organization_id, auth_user_id, role, is_active'),
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
  logger.debug('[Organizations] Students response:', {
    count: studentsRes.data?.length || 0,
    error: studentsRes.error?.message,
  });
  logger.debug('[Organizations] Teachers response:', {
    count: teachersRes.data?.length || 0,
    error: teachersRes.error?.message,
  });
  logger.debug('[Organizations] Profiles response:', {
    count: profilesRes.data?.length || 0,
    error: profilesRes.error?.message,
  });

  // Aggregate per-entity student/teacher counts
  const countByEntity = new Map<string, OrgCounts>();
  const teacherMemberIds = new Map<string, Set<string>>();
  const activeTeacherMemberIds = new Map<string, Set<string>>();

  const students = studentsRes.data || [];
  students.forEach((student: any) => {
    const entityKey =
      student.organization_id
        ? `org_${student.organization_id}`
        : student.preschool_id
          ? `preschool_${student.preschool_id}`
          : null;
    if (!entityKey) return;
    const counts = getOrCreateCounts(countByEntity, entityKey);
    counts.student_count += 1;
    if (isActiveStudent(student)) counts.active_student_count += 1;
  });

  const addTeacherMember = (entityKey: string | null, memberId: string, isActive: boolean) => {
    if (!entityKey) return;
    const allTeachers = teacherMemberIds.get(entityKey) || new Set<string>();
    allTeachers.add(memberId);
    teacherMemberIds.set(entityKey, allTeachers);

    if (isActive) {
      const activeTeachers = activeTeacherMemberIds.get(entityKey) || new Set<string>();
      activeTeachers.add(memberId);
      activeTeacherMemberIds.set(entityKey, activeTeachers);
    }
  };

  const teachers = teachersRes.data || [];
  teachers.forEach((teacher: any) => {
    const entityKey = teacher.preschool_id ? `preschool_${teacher.preschool_id}` : null;
    const teacherMemberId = String(teacher.auth_user_id || teacher.user_id || `teacher:${teacher.id}`);
    addTeacherMember(entityKey, teacherMemberId, teacher.is_active !== false);
  });

  const profiles = profilesRes.data || [];
  profiles.forEach((profile: any) => {
    const role = String(profile.role || '').toLowerCase();
    if (!TEACHER_ROLES.has(role)) return;
    const entityKey =
      profile.organization_id
        ? `org_${profile.organization_id}`
        : profile.preschool_id
          ? `preschool_${profile.preschool_id}`
          : null;
    const profileMemberId = String(profile.auth_user_id || `profile:${profile.id}`);
    addTeacherMember(entityKey, profileMemberId, profile.is_active !== false);
  });

  teacherMemberIds.forEach((memberSet, entityKey) => {
    const counts = getOrCreateCounts(countByEntity, entityKey);
    counts.teacher_count = memberSet.size;
    counts.active_teacher_count = (activeTeacherMemberIds.get(entityKey) || new Set()).size;
  });

  const readCounts = (entityKey: string): OrgCounts =>
    countByEntity.get(entityKey) || {
      student_count: 0,
      teacher_count: 0,
      active_student_count: 0,
      active_teacher_count: 0,
    };

  // Process preschools
  const preschools: Organization[] = (preschoolsRes.data || []).map((p: any) => ({
    id: `preschool_${p.id}`,
    name: p.name || 'Unnamed Preschool',
    type: getOrganizationBucketType(p.school_type, 'preschool'),
    organization_type_raw: p.school_type || null,
    status: p.is_active ? 'active' : 'inactive',
    contact_email: p.email || '',
    contact_phone: p.phone,
    address: p.address,
    city: p.city,
    province: p.province,
    country: p.country || 'South Africa',
    ...readCounts(`preschool_${p.id}`),
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
    type: getOrganizationBucketType('k12', 'school'),
    organization_type_raw: 'k12',
    status: s.is_active ? 'active' : 'inactive',
    contact_email: s.email || '',
    contact_phone: s.phone,
    address: s.address,
    city: s.city,
    province: s.province,
    country: s.country || 'South Africa',
    ...readCounts(`school_${s.id}`),
    created_at: s.created_at,
    last_active_at: s.updated_at,
    is_verified: false,
    logo_url: s.logo_url,
    metadata: s.metadata,
    subscription_tier: s.subscription_tier || null,
    subscription_status: s.subscription_status || null,
  }));

  // Process generic organizations
  const otherOrgs: Organization[] = (orgsRes.data || []).map((o: any) => {
    const normalizedOrgType = String(o.organization_type || '').toLowerCase();
    const normalizedLegacyType = String(o.type || '').toLowerCase();
    const resolvedRawType =
      (!normalizedOrgType || normalizedOrgType === 'org') && normalizedLegacyType && normalizedLegacyType !== 'org'
        ? o.type
        : (o.organization_type || o.type || null);

    return {
      id: `org_${o.id}`,
      name: o.name || 'Unnamed Organization',
      type: getOrganizationBucketType(resolvedRawType, 'organization'),
      organization_type_raw: resolvedRawType,
      status: o.is_active ? 'active' : 'inactive',
      contact_email: o.contact_email || '',
      contact_phone: o.contact_phone,
      address: o.address,
      city: o.city,
      province: o.province,
      country: o.country || 'South Africa',
      ...readCounts(`org_${o.id}`),
      created_at: o.created_at,
      last_active_at: o.updated_at,
      is_verified: false,
      logo_url: o.logo_url,
      metadata: o.metadata,
      subscription_tier: o.subscription_tier || o.plan_tier || null,
      subscription_status: o.subscription_status || null,
    };
  });

  const allOrgs = dedupeOrganizationsByRawId([...preschools, ...k12Schools, ...otherOrgs]);

  // Calculate stats
  const stats: OrganizationStats = {
    total: allOrgs.length,
    preschools: allOrgs.filter((o) => o.type === 'preschool').length,
    k12_schools: allOrgs.filter((o) => o.type === 'k12').length,
    skills_centers: allOrgs.filter(o => o.type === 'skills').length,
    other_orgs: allOrgs.filter((o) => !['preschool', 'k12', 'skills'].includes(o.type)).length,
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
