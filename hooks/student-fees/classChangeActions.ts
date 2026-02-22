/**
 * Class change actions: change student class with fee syncing.
 */

import { assertSupabase } from '@/lib/supabase';
import type { Student, ClassOption } from './types';
import { type ShowAlert, getSupabaseErrorMessage } from './feeActionUtils';
import { syncPendingTuitionFees, logFeeAssignmentCorrection } from './classFeeSync';

export async function changeStudentClass(
  student: Student,
  studentRef: React.MutableRefObject<Student | null>,
  newClassId: string,
  classRegistrationFee: string,
  classes: ClassOption[],
  organizationId: string | undefined,
  profileId: string,
  profileRole: string | null,
  showAlert: ShowAlert,
  loadStudent: () => Promise<Student | null>,
  loadFees: (s?: Student | null) => Promise<void>,
): Promise<void> {
  const parsedFee = Number.parseFloat(classRegistrationFee);
  if (Number.isNaN(parsedFee) || parsedFee < 0) {
    showAlert('Invalid Amount', 'Please enter a valid registration fee amount.', 'warning');
    return;
  }

  const normalizedFee = Number(parsedFee.toFixed(2));
  const currentFee = Number(student.registration_fee_amount || 0);
  if (newClassId === student.class_id && Math.abs(normalizedFee - currentFee) < 0.01) {
    showAlert('No Changes', 'Class and registration fee are unchanged.', 'info');
    return;
  }

  const supabase = assertSupabase();
  const nowIso = new Date().toISOString();
  await supabase
    .from('students')
    .update({ class_id: newClassId, registration_fee_amount: normalizedFee, updated_at: nowIso })
    .eq('id', student.id)
    .throwOnError();

  const newClass = classes.find((c) => c.id === newClassId);
  const tempStudent: Student = {
    ...(studentRef.current || student),
    class_id: newClassId,
    class_name: newClass?.name || student.class_name,
    registration_fee_amount: normalizedFee,
  };

  const tuitionSync = await syncPendingTuitionFees(tempStudent, organizationId, classes, newClass?.name || null);
  const auditLogged = await logFeeAssignmentCorrection(
    {
      student: tempStudent,
      source: 'change_class',
      previousClassName:
        student.class_name || classes.find((c) => c.id === student.class_id)?.name || null,
      nextClassName: newClass?.name || null,
      updatedFeeRows: tuitionSync.updated,
      tuitionAmount: tuitionSync.amount ?? null,
    },
    profileId,
    profileRole,
    organizationId,
  );

  const tuitionSyncMessage =
    tuitionSync.updated > 0
      ? ` Updated ${tuitionSync.updated} unpaid tuition fee entr${tuitionSync.updated === 1 ? 'y' : 'ies'} to match ${tuitionSync.className || 'the class'} pricing.`
      : ' No unpaid tuition fees needed syncing.';

  showAlert(
    'Student Updated',
    `Class set to ${newClass?.name || 'new class'} and registration fee updated to R${normalizedFee.toFixed(2)}.${tuitionSyncMessage}`,
    'success',
  );
  if (!auditLogged) {
    showAlert(
      'Audit Warning',
      'Class change was applied, but correction audit logging failed. Please refresh and retry if needed.',
      'warning',
    );
  }

  const refreshed = await loadStudent();
  await loadFees(refreshed);
}

export async function syncTuitionFeesToClass(
  student: Student,
  studentRef: React.MutableRefObject<Student | null>,
  classes: ClassOption[],
  organizationId: string | undefined,
  profileId: string,
  profileRole: string | null,
  showAlert: ShowAlert,
  loadStudent: () => Promise<Student | null>,
  loadFees: (s?: Student | null) => Promise<void>,
): Promise<void> {
  const currentStudent = studentRef.current || student;
  if (!currentStudent.class_id && !currentStudent.class_name) {
    showAlert('Class Required', 'Assign a class first, then sync tuition fees.', 'warning');
    return;
  }

  const syncResult = await syncPendingTuitionFees(currentStudent, organizationId, classes);
  const auditLogged = await logFeeAssignmentCorrection(
    {
      student: currentStudent,
      source: 'manual_sync',
      previousClassName:
        currentStudent.class_name ||
        classes.find((c) => c.id === currentStudent.class_id)?.name ||
        null,
      nextClassName:
        currentStudent.class_name ||
        classes.find((c) => c.id === currentStudent.class_id)?.name ||
        null,
      updatedFeeRows: syncResult.updated,
      tuitionAmount: syncResult.amount ?? null,
    },
    profileId,
    profileRole,
    organizationId,
  );

  if (syncResult.updated > 0) {
    showAlert(
      'Tuition Synced',
      `Updated ${syncResult.updated} unpaid tuition fee entr${syncResult.updated === 1 ? 'y' : 'ies'} to ${syncResult.className || 'class'} pricing.`,
      'success',
    );
  } else {
    showAlert('No Updates Needed', 'No unpaid tuition fees were eligible for automatic correction.', 'info');
  }
  if (!auditLogged) {
    showAlert(
      'Audit Warning',
      'Tuition sync finished, but correction audit logging failed. Please refresh and retry if needed.',
      'warning',
    );
  }

  const refreshed = await loadStudent();
  await loadFees(refreshed);
}
