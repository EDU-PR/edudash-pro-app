// API utilities for seat management

import { assertSupabase } from '@/lib/supabase';
import type { Teacher } from '@/components/principal/seats/types';

/**
 * Load subscription ID for a school
 */
export async function loadSubscriptionForSchool(schoolId: string): Promise<string | null> {
  const { data, error } = await assertSupabase()
    .from('subscriptions')
    .select('id')
    .eq('owner_type', 'school')
    .eq('school_id', schoolId)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !data) return null;
  return (data as any).id;
}

/**
 * Load school label (tenant_slug or name)
 */
export async function loadSchoolLabel(schoolId: string): Promise<string> {
  try {
    const { data } = await assertSupabase()
      .from('preschools')
      .select('tenant_slug, name')
      .eq('id', schoolId)
      .maybeSingle();
    return (data as any)?.tenant_slug ?? (data as any)?.name ?? schoolId;
  } catch {
    return schoolId;
  }
}

/**
 * Load teachers for a school with seat status
 */
export async function loadTeachersForSchool(
  schoolId: string,
  subscriptionId: string | null
): Promise<Teacher[]> {
  // Fetch teachers from profiles
  const { data: profs } = await assertSupabase()
    .from('profiles')
    .select('id,email,role,preschool_id')
    .eq('preschool_id', schoolId)
    .eq('role', 'teacher');

  let teacherList: Teacher[] = (profs || []).map((p: any) => ({
    id: p.id,
    email: p.email,
    hasSeat: false,
  }));

  // Fallback query if no teachers found
  if (teacherList.length === 0) {
    const { data: profileUsers } = await assertSupabase()
      .from('profiles')
      .select('id, email, role, preschool_id, organization_id')
      .or(`preschool_id.eq.${schoolId},organization_id.eq.${schoolId}`)
      .eq('role', 'teacher');
    teacherList = (profileUsers || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      hasSeat: false,
    }));
  }

  // Load seat assignments
  let seatSet = new Set<string>();
  if (subscriptionId) {
    const { data: seatsData } = await assertSupabase().rpc('rpc_list_teacher_seats');
    if (seatsData) {
      seatSet = new Set(
        seatsData
          .filter((seat: any) => seat.revoked_at === null)
          .map((seat: any) => seat.user_id)
          .filter(Boolean)
      );
    }
  }

  return teacherList.map(t => ({ ...t, hasSeat: seatSet.has(t.id) }));
}

/**
 * Find teacher ID by email
 */
export async function findTeacherIdByEmail(email: string): Promise<string | null> {
  try {
    const { data } = await assertSupabase()
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    return (data as any)?.id || null;
  } catch {
    return null;
  }
}

/**
 * Start free trial for a school
 */
export async function startSchoolFreeTrial(schoolId: string): Promise<string | null> {
  const { data, error } = await assertSupabase().rpc('ensure_school_free_subscription', {
    p_school_id: schoolId,
    p_seats: 3,
  });
  if (error) throw error;
  return data ? String(data) : null;
}

/**
 * Bulk assign all teachers to subscription
 */
export async function bulkAssignTeachers(
  subscriptionId: string,
  schoolId: string
): Promise<{ assigned: number; skipped: number }> {
  const { data, error } = await assertSupabase().rpc('assign_all_teachers_to_subscription', {
    p_subscription_id: subscriptionId,
    p_school_id: schoolId,
  });
  if (error) throw error;
  const assigned = Array.isArray(data) ? data.filter((r: any) => r.assigned).length : 0;
  const skipped = Array.isArray(data) ? data.filter((r: any) => !r.assigned).length : 0;
  return { assigned, skipped };
}
