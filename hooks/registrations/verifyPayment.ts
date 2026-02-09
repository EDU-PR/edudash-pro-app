/**
 * Verify / un-verify a registration payment.
 *
 * Updates both the registration table and the students table so the
 * parent dashboard reflects the correct payment status.
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

import type { Registration, ShowAlert } from './types';
import { hasValidPopUrl } from './helpers';

export function handleVerifyPayment(
  registration: Registration,
  verify: boolean,
  userId: string | undefined,
  showAlert: ShowAlert,
  fetchRegistrations: () => void,
  setProcessing: (id: string | null) => void,
): void {
  const isInApp = registration.source === 'in-app';
  const hasPop = hasValidPopUrl(registration.proof_of_payment_url);

  const title = verify
    ? hasPop
      ? 'Verify Payment'
      : 'Confirm Payment (No POP)'
    : 'Remove Payment Verification';
  const message = verify
    ? hasPop
      ? `Verify payment for ${registration.student_first_name}?`
      : `No proof of payment has been uploaded. Confirm that payment was received for ${registration.student_first_name}?`
    : `Remove verification for payment for ${registration.student_first_name}?`;

  showAlert({
    title,
    message,
    type: verify ? 'warning' : 'info',
    buttons: [
      { text: 'Cancel', style: 'cancel' },
      {
        text: verify ? 'Verify' : 'Remove',
        style: verify ? 'default' : 'destructive',
        onPress: async () => {
          setProcessing(registration.id);
          try {
            const supabase = assertSupabase();

            const updateData: Record<string, unknown> = {
              payment_verified: verify,
              payment_verified_by: verify ? userId : null,
              payment_verified_at: verify ? new Date().toISOString() : null,
            };
            if (verify) {
              updateData.registration_fee_paid = true;
            }

            const tableName = isInApp ? 'child_registration_requests' : 'registration_requests';
            const { error } = await supabase
              .from(tableName)
              .update(updateData)
              .eq('id', registration.id);
            if (error) throw error;

            // Also update students table so parent dashboard reflects status
            const studentUpdateData: Record<string, unknown> = {
              payment_verified: verify,
              payment_date: verify ? new Date().toISOString() : null,
            };
            if (verify) {
              studentUpdateData.registration_fee_paid = true;
            }

            logger.debug('VerifyPayment', 'Updating students table', {
              preschool_id: registration.organization_id,
              first_name: registration.student_first_name,
              last_name: registration.student_last_name,
            });

            const { data: studentData, error: studentError } = await supabase
              .from('students')
              .update(studentUpdateData)
              .eq('preschool_id', registration.organization_id)
              .ilike('first_name', registration.student_first_name)
              .ilike('last_name', registration.student_last_name)
              .select();

            if (studentError) {
              logger.error('VerifyPayment', 'Error updating students table', studentError);
            } else if (!studentData || studentData.length === 0) {
              logger.warn('VerifyPayment', 'No matching student found in students table');
              showAlert({
                title: 'Partial Success',
                message: `Payment ${verify ? 'verified' : 'verification removed'} in registration records.\n\nNote: No matching student record found. The parent's dashboard may not reflect this change until the student is synced.`,
                type: 'warning',
              });
              fetchRegistrations();
              return;
            } else {
              logger.debug('VerifyPayment', `Updated ${studentData.length} student(s)`);
            }

            showAlert({
              title: 'Success',
              message: `Payment ${verify ? 'verified' : 'verification removed'}`,
              type: 'success',
            });
            fetchRegistrations();
          } catch (err: unknown) {
            const error = err as { message?: string };
            showAlert({
              title: 'Error',
              message: error.message || 'Failed to update payment status',
              type: 'error',
            });
          } finally {
            setProcessing(null);
          }
        },
      },
    ],
  });
}
