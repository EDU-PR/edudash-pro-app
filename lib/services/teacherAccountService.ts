/**
 * Teacher Account Creation Service
 *
 * Calls the `create-teacher-account` Edge Function to create teacher accounts
 * directly (with temp password + welcome email), bypassing the invite flow.
 *
 * Used by principals to:
 * 1. Hire a teacher and create their account immediately
 * 2. Add temporary/trainee teachers with direct account creation
 */

import { assertSupabase } from '@/lib/supabase';

export type TeacherType = 'permanent' | 'temporary' | 'trainee';

export interface CreateTeacherAccountParams {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  school_id: string;
  teacher_type: TeacherType;
  subject_specialization?: string | null;
  notes?: string | null;
}

export interface CreateTeacherAccountResult {
  success: boolean;
  user_id?: string;
  is_existing_user?: boolean;
  teacher_type?: TeacherType;
  temp_password?: string | null;
  email_sent?: boolean;
  school_name?: string;
  login_method_hint?: string | null;
  provisioning_warnings?: string[];
  message?: string;
  error?: string;
  code?: string;
}

export async function createTeacherAccount(
  params: CreateTeacherAccountParams
): Promise<CreateTeacherAccountResult> {
  const supabase = assertSupabase();

  const { data, error } = await supabase.functions.invoke('create-teacher-account', {
    body: params,
  });

  if (error) {
    // Edge function invocation error
    return {
      success: false,
      error: error.message || 'Failed to create teacher account',
      code: 'INVOKE_ERROR',
    };
  }

  return data as CreateTeacherAccountResult;
}
