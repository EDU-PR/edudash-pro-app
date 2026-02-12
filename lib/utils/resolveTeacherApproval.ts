/**
 * resolveTeacherApproval — Shared approval gate logic
 *
 * Single source of truth for checking teacher approval status.
 * Used by both teacher-dashboard.tsx and routeAfterLogin.ts (native)
 * and useTeacherApproval.ts (web).
 *
 * Rules:
 * - No org → skip (standalone mode)
 * - DB error → fail open (allow access)
 * - No record → allow (teacher didn't go through invite flow)
 * - status 'approved' → allow
 * - status 'pending' / 'rejected' / 'withdrawn' → block
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export type TeacherApprovalResult =
  | { allowed: true }
  | { allowed: false; status: 'pending' | 'rejected' | 'withdrawn' };

/**
 * Check whether a teacher is approved to access a school's dashboard.
 *
 * @param teacherId - The user's auth ID
 * @param orgId     - The school/org ID (organization_id or preschool_id)
 * @returns Approval result indicating whether access is allowed
 */
export async function resolveTeacherApproval(
  teacherId: string,
  orgId: string,
): Promise<TeacherApprovalResult> {
  try {
    const { data: approval, error } = await assertSupabase()
      .from('teacher_approvals')
      .select('status')
      .eq('teacher_id', teacherId)
      .eq('preschool_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // Fail open on DB errors — don't lock out teachers during outages
      logger.warn('resolveTeacherApproval', 'Lookup failed, allowing access:', error.message);
      return { allowed: true };
    }

    // No approval record — teacher didn't go through invite flow
    if (!approval) return { allowed: true };

    if (approval.status === 'approved') return { allowed: true };

    // Any other status blocks access
    return {
      allowed: false,
      status: approval.status as 'pending' | 'rejected' | 'withdrawn',
    };
  } catch {
    // Fail open on exceptions
    logger.warn('resolveTeacherApproval', 'Exception, allowing access');
    return { allowed: true };
  }
}
