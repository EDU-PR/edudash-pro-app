/**
 * Reject a registration (in-app or EduSite).
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

import type { Registration, ShowAlert } from './types';

export async function rejectRegistration(
  registration: Registration,
  reason: string,
  userId: string | undefined,
  showAlert: ShowAlert,
  fetchRegistrations: () => void,
): Promise<void> {
  const isInApp = registration.source === 'in-app';
  const supabase = assertSupabase();

  if (isInApp) {
    const { error } = await supabase
      .from('child_registration_requests')
      .update({
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', registration.id);

    if (error) throw error;

    // Send notification to parent
    try {
      await supabase.functions.invoke('notifications-dispatcher', {
        body: {
          event_type: 'child_registration_rejected',
          user_ids: registration.parent_id ? [registration.parent_id] : [],
          parent_id: registration.parent_id,
          registration_id: registration.id,
          preschool_id: registration.organization_id,
          child_name: `${registration.student_first_name} ${registration.student_last_name}`,
          rejection_reason: reason,
        },
      });
    } catch (notifErr) {
      logger.warn('Registrations', 'Failed to send rejection notification', notifErr);
    }
  } else {
    // EduSite flow
    const { error } = await supabase
      .from('registration_requests')
      .update({
        status: 'rejected',
        reviewed_by: userId,
        reviewed_date: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', registration.id);

    if (error) throw error;
  }

  showAlert({
    title: 'Rejected',
    message: 'Registration has been rejected.',
    type: 'success',
  });
  fetchRegistrations();
}
