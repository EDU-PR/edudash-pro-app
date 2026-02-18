/**
 * Registration payment status actions.
 */

import { assertSupabase } from '@/lib/supabase';
import type { Student } from './types';
import { getSupabaseErrorMessage, type ShowAlert } from './feeActionUtils';

export async function setRegistrationPaidStatus(
  isPaid: boolean,
  student: Student,
  studentRef: React.MutableRefObject<Student | null>,
  setStudent: React.Dispatch<React.SetStateAction<Student | null>>,
  organizationId: string | undefined,
  profileId: string | undefined,
  showAlert: ShowAlert,
): Promise<void> {
  const currentStudent = studentRef.current || student;
  if (currentStudent.registration_fee_paid === isPaid && currentStudent.payment_verified === isPaid) {
    showAlert('No Change', `Registration is already marked as ${isPaid ? 'paid' : 'not paid'}.`, 'info');
    return;
  }

  const supabase = assertSupabase();
  const nowIso = new Date().toISOString();
  const paymentDate = isPaid ? nowIso.split('T')[0] : null;

  await supabase
    .from('students')
    .update({
      registration_fee_paid: isPaid,
      payment_verified: isPaid,
      payment_date: paymentDate,
      updated_at: nowIso,
    })
    .eq('id', currentStudent.id)
    .throwOnError();

  const schoolId = currentStudent.preschool_id || organizationId;
  if (schoolId) {
    const registrationPayload = {
      registration_fee_paid: isPaid,
      payment_verified: isPaid,
      payment_date: paymentDate,
      payment_method: isPaid ? 'manual_principal' : null,
      updated_at: nowIso,
    };

    const { error: reqByStudentErr } = await supabase
      .from('registration_requests')
      .update(registrationPayload)
      .eq('organization_id', schoolId)
      .in('status', ['pending', 'approved'])
      .eq('edudash_student_id', currentStudent.id);
    if (reqByStudentErr) {
      console.warn('[StudentFees] registration_requests update by student id failed', reqByStudentErr);
    }

    if (currentStudent.date_of_birth) {
      const { error: reqByNameErr } = await supabase
        .from('registration_requests')
        .update(registrationPayload)
        .eq('organization_id', schoolId)
        .in('status', ['pending', 'approved'])
        .eq('student_first_name', currentStudent.first_name)
        .eq('student_last_name', currentStudent.last_name)
        .eq('student_dob', currentStudent.date_of_birth);
      if (reqByNameErr) {
        console.warn('[StudentFees] registration_requests update by student name failed', reqByNameErr);
      }

      const { error: childReqErr } = await supabase
        .from('child_registration_requests')
        .update({
          registration_fee_paid: isPaid,
          payment_verified: isPaid,
          payment_verified_at: isPaid ? nowIso : null,
          payment_verified_by: isPaid ? profileId || null : null,
          updated_at: nowIso,
        })
        .eq('preschool_id', schoolId)
        .in('status', ['pending', 'approved'])
        .eq('child_first_name', currentStudent.first_name)
        .eq('child_last_name', currentStudent.last_name)
        .eq('child_birth_date', currentStudent.date_of_birth);
      if (childReqErr) {
        console.warn('[StudentFees] child_registration_requests update failed', childReqErr);
      }
    }
  }

  const nextStudent: Student = {
    ...currentStudent,
    registration_fee_paid: isPaid,
    payment_verified: isPaid,
    payment_date: paymentDate,
  };
  studentRef.current = nextStudent;
  setStudent(nextStudent);

  showAlert(
    'Registration Updated',
    isPaid
      ? 'Registration has been marked as paid and verified.'
      : 'Registration has been marked as not paid.',
    'success',
  );
}
