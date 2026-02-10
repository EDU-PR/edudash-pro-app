import { assertSupabase } from '@/lib/supabase';

export type SchoolStaffRole = 'teacher' | 'admin' | 'principal_admin';

interface SetSchoolStaffRoleParams {
  targetProfileId: string;
  schoolId: string;
  role: SchoolStaffRole;
}

interface SetSchoolStaffRoleResult {
  success: boolean;
  profile_id: string;
  user_id: string;
  role: SchoolStaffRole;
  organization_role: string;
}

export async function setSchoolStaffRole({
  targetProfileId,
  schoolId,
  role,
}: SetSchoolStaffRoleParams): Promise<SetSchoolStaffRoleResult> {
  const client = assertSupabase() as any;
  const { data, error } = await client.rpc('set_school_staff_role', {
    p_target_profile_id: targetProfileId,
    p_school_id: schoolId,
    p_role: role,
  });

  if (error) {
    throw new Error(error.message || 'Failed to update staff role');
  }

  return (data || {}) as SetSchoolStaffRoleResult;
}

