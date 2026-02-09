/**
 * teacherApprovalHelpers — private helpers used by teacherApprovalService.
 *
 * Extracted per WARP.md ≤500-line limit for services.
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

/**
 * Ensures a row in the `teachers` table exists (or is updated) for a newly
 * approved teacher, so that downstream screens that still read `teachers`
 * continue to work.
 */
export async function ensureTeacherRecordAfterApproval(params: {
  teacherId: string;
  preschoolId: string;
}): Promise<void> {
  const supabase = assertSupabase();

  try {
    const { data: profile, error: profileLookupError } = await supabase
      .from('profiles')
      .select('id, auth_user_id, email, first_name, last_name, phone')
      .or(`id.eq.${params.teacherId},auth_user_id.eq.${params.teacherId}`)
      .maybeSingle();

    if (profileLookupError) {
      logger.warn('TeacherApproval', 'Profile lookup warning during teacher row sync', profileLookupError);
    }

    const userId = (profile as any)?.id || params.teacherId;
    const authUserId = (profile as any)?.auth_user_id || params.teacherId;
    const email = String((profile as any)?.email || '').trim().toLowerCase() || null;
    const firstName = ((profile as any)?.first_name || '').trim() || null;
    const lastName = ((profile as any)?.last_name || '').trim() || null;
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
    const phone = ((profile as any)?.phone || '').trim() || null;

    let existingTeacher: { id: string } | null = null;

    const { data: byUser, error: byUserError } = await supabase
      .from('teachers')
      .select('id')
      .or(`user_id.eq.${userId},auth_user_id.eq.${authUserId}`)
      .maybeSingle();

    if (byUserError) {
      logger.warn('TeacherApproval', 'Teacher lookup by user/auth warning', byUserError);
    } else if (byUser?.id) {
      existingTeacher = { id: byUser.id };
    }

    if (!existingTeacher && email) {
      const { data: byEmail, error: byEmailError } = await supabase
        .from('teachers')
        .select('id')
        .eq('preschool_id', params.preschoolId)
        .ilike('email', email)
        .maybeSingle();

      if (byEmailError) {
        logger.warn('TeacherApproval', 'Teacher lookup by email warning', byEmailError);
      } else if (byEmail?.id) {
        existingTeacher = { id: byEmail.id };
      }
    }

    const teacherPayload: Record<string, unknown> = {
      user_id: userId,
      auth_user_id: authUserId,
      preschool_id: params.preschoolId,
      email,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      phone,
      role: 'teacher',
      is_active: true,
    };

    if (existingTeacher?.id) {
      const { error: updateError } = await supabase
        .from('teachers')
        .update(teacherPayload)
        .eq('id', existingTeacher.id);
      if (updateError) throw updateError;
      return;
    }

    const { error: insertError } = await supabase
      .from('teachers')
      .insert(teacherPayload);
    if (insertError) throw insertError;
  } catch (syncError) {
    logger.warn('TeacherApproval', 'Teacher table sync warning after approval', syncError);
  }
}

/**
 * Dispatches a push/email notification about an approval or rejection decision.
 */
export async function notifyTeacherApprovalDecision(params: {
  eventType: 'teacher_account_approved' | 'teacher_account_rejected';
  teacherId: string;
  preschoolId: string;
  rejectionReason?: string;
}): Promise<void> {
  const supabase = assertSupabase();
  try {
    const { data: teacherProfile } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('id', params.teacherId)
      .maybeSingle();

    const teacherName =
      `${teacherProfile?.first_name || ''} ${teacherProfile?.last_name || ''}`.trim() ||
      teacherProfile?.email ||
      'Teacher';

    const payload: Record<string, unknown> = {
      event_type: params.eventType,
      preschool_id: params.preschoolId,
      user_ids: [params.teacherId],
      include_email: true,
      send_immediately: true,
      custom_payload: {
        teacher_user_id: params.teacherId,
        teacher_name: teacherName,
        teacher_email: teacherProfile?.email || undefined,
      },
    };

    if (params.rejectionReason) {
      (payload.custom_payload as Record<string, unknown>).rejection_reason = params.rejectionReason;
    }

    const { error } = await supabase.functions.invoke('notifications-dispatcher', {
      body: payload,
    });
    if (error) {
      logger.warn('TeacherApproval', 'Notification dispatch failed', error);
    }
  } catch (notifyError) {
    logger.warn('TeacherApproval', 'Failed to send approval notification', notifyError);
  }
}
