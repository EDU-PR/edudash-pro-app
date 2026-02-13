import { assertSupabase } from '@/lib/supabase';

/**
 * Remove a teacher from a school via Edge Function.
 *
 * Uses the server-side `remove-teacher` Edge Function which runs
 * with service_role privileges to bypass RLS policies that block
 * principals from deleting organization_members or updating other
 * users' profiles.
 *
 * For teachers without an auth account (directly-added), use
 * `removeTeacherDirect()` instead which deactivates the teacher
 * record without requiring an Edge Function call.
 */
export async function removeTeacherFromSchool(params: {
  teacherUserId: string;
  organizationId: string;
  teacherRecordId?: string | null;
}): Promise<void> {
  const { teacherUserId, organizationId, teacherRecordId } = params;
  if (!teacherUserId || !organizationId) {
    throw new Error('Missing teacher or organization');
  }

  const supabase = assertSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('You must be signed in to remove a teacher');
  }

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/remove-teacher`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify({
      teacher_user_id: teacherUserId,
      organization_id: organizationId,
      teacher_record_id: teacherRecordId || null,
    }),
  });

  const result = await response.json();

  if (!response.ok || result.error) {
    throw new Error(result.error || `Failed to remove teacher (${response.status})`);
  }
}

/**
 * Remove a directly-added teacher who has no auth account.
 * Since there's no user profile or org membership to clean up,
 * we delete the teacher record entirely.
 */
export async function removeTeacherDirect(params: {
  teacherRecordId: string;
  organizationId: string;
}): Promise<void> {
  const { teacherRecordId, organizationId } = params;
  if (!teacherRecordId || !organizationId) {
    throw new Error('Missing teacher record or organization');
  }

  const supabase = assertSupabase();
  const { error } = await supabase
    .from('teachers')
    .delete()
    .eq('id', teacherRecordId)
    .eq('preschool_id', organizationId);

  if (error) {
    throw new Error(error.message || 'Failed to deactivate teacher record');
  }
}
