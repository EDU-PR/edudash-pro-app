import { assertSupabase } from '@/lib/supabase';

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

  // Unassign from classes
  const { error: classError } = await supabase
    .from('classes')
    .update({ teacher_id: null })
    .eq('teacher_id', teacherUserId)
    .eq('preschool_id', organizationId);
  if (classError) throw classError;

  // Deactivate teacher record
  if (teacherRecordId) {
    const { error: teacherError } = await supabase
      .from('teachers')
      .update({ is_active: false })
      .or(`user_id.eq.${teacherUserId},id.eq.${teacherRecordId}`);
    if (teacherError) throw teacherError;
  } else {
    const { error: teacherError } = await supabase
      .from('teachers')
      .update({ is_active: false })
      .eq('user_id', teacherUserId);
    if (teacherError) throw teacherError;
  }

  // Remove organization membership (revokes seat)
  const { error: memberError } = await supabase
    .from('organization_members')
    .delete()
    .eq('user_id', teacherUserId)
    .eq('organization_id', organizationId);
  if (memberError) throw memberError;

  // Clear profile org linkage + downgrade role
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      organization_id: null,
      preschool_id: null,
      seat_status: 'inactive',
      role: 'parent',
    })
    .eq('id', teacherUserId);
  if (profileError) throw profileError;
}
