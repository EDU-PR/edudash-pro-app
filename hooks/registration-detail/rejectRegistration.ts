/** Rejection logic for registration-detail */
import { assertSupabase } from '@/lib/supabase';
import { notifyRegistrationRejected } from '@/lib/notify';
import { logger } from '@/lib/logger';
import type { Registration } from './types';

const TAG = 'RegistrationReject';

async function fetchSchoolName(
  supabase: ReturnType<typeof assertSupabase>,
  orgId: string,
  fallback: string,
): Promise<string> {
  try {
    const { data: school } = await supabase
      .from('preschools')
      .select('name')
      .eq('id', orgId)
      .single();
    return school?.name || fallback;
  } catch { return fallback; }
}

export async function processRejection(
  registration: Registration,
  reason: string,
  userId: string | undefined,
  userEmail: string | undefined,
): Promise<void> {
  const supabase = assertSupabase();

  const isInApp = registration.source === 'in-app';
  const tableName = isInApp ? 'child_registration_requests' : 'registration_requests';

  const updateData: Record<string, any> = {
    status: 'rejected',
    rejection_reason: reason,
  };

  if (isInApp) {
    updateData.reviewed_by = userId;
    updateData.reviewed_at = new Date().toISOString();
  } else {
    updateData.reviewed_by = userEmail;
    updateData.reviewed_date = new Date().toISOString();
  }

  const { error } = await supabase.from(tableName).update(updateData).eq('id', registration.id);
  if (error) throw error;

  // Notify guardian
  try {
    const childName = `${registration.student_first_name} ${registration.student_last_name}`.trim();
    const schoolName = await fetchSchoolName(
      supabase,
      registration.organization_id,
      registration.organization_name || 'your school',
    );

    if (registration.guardian_email) {
      await notifyRegistrationRejected({
        parentId: registration.parent_id,
        guardianEmail: registration.guardian_email,
        guardianName: registration.guardian_name,
        childName,
        schoolName,
        registrationId: registration.id,
        rejectionReason: reason,
        preschoolId: registration.organization_id,
      });
    }
  } catch (e) {
    logger.warn(TAG, 'Failed to send rejection notification', e);
  }
}
