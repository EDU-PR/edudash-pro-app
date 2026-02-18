/**
 * Student lifecycle actions: enrollment date update, deactivate student.
 */

import { assertSupabase } from '@/lib/supabase';
import type { Student } from './types';
import { STUDENT_DELETE_RETENTION_DAYS, getSupabaseErrorMessage, type ShowAlert } from './feeActionUtils';

export async function updateEnrollmentDate(
  date: Date,
  student: Student,
  studentRef: React.MutableRefObject<Student | null>,
  setStudent: React.Dispatch<React.SetStateAction<Student | null>>,
  showAlert: ShowAlert,
  loadFees: (s?: Student | null) => Promise<void>,
): Promise<void> {
  const supabase = assertSupabase();
  const formatted = date.toISOString().split('T')[0];
  await supabase
    .from('students')
    .update({ enrollment_date: formatted, updated_at: new Date().toISOString() })
    .eq('id', student.id)
    .throwOnError();

  const updated = { ...student, enrollment_date: formatted };
  setStudent(updated);
  studentRef.current = updated;
  showAlert('Start Date Updated', `Enrollment start set to ${formatted}.`, 'success');
  await loadFees(updated);
}

export function deactivateStudent(
  student: Student,
  studentRef: React.MutableRefObject<Student | null>,
  setStudent: React.Dispatch<React.SetStateAction<Student | null>>,
  showAlert: ShowAlert,
  loadStudent: () => Promise<Student | null>,
  loadFees: (s?: Student | null) => Promise<void>,
): void {
  const studentName = `${student.first_name} ${student.last_name}`.trim();
  showAlert(
    'Mark Student Inactive',
    `Are you sure you want to mark ${studentName} as inactive?\n\nThis will:\n- remove the learner from unpaid-fees follow-up\n- keep records for ${STUDENT_DELETE_RETENTION_DAYS} days before permanent deletion\n- allow reactivation during the retention window`,
    'warning',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Inactive',
        style: 'destructive',
        onPress: async () => {
          const currentStudent = studentRef.current || student;
          if (!currentStudent) return;

          const supabase = assertSupabase();
          const nowIso = new Date().toISOString();
          const retentionDate = new Date();
          retentionDate.setDate(retentionDate.getDate() + STUDENT_DELETE_RETENTION_DAYS);
          const retentionIso = retentionDate.toISOString();
          const retentionLabel = retentionDate.toLocaleDateString('en-ZA', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          const reason = `Removed by principal - left school (retention ${STUDENT_DELETE_RETENTION_DAYS} days)`;

          try {
            const { error: rpcError } = await supabase.rpc('deactivate_student', {
              student_uuid: currentStudent.id,
              reason,
            });

            if (rpcError) {
              let { error: fallbackError } = await supabase
                .from('students')
                .update({
                  is_active: false,
                  status: 'inactive',
                  class_id: null,
                  deleted_at: nowIso,
                  delete_reason: reason,
                  permanent_delete_after: retentionIso,
                  updated_at: nowIso,
                } as any)
                .eq('id', currentStudent.id);

              if (
                fallbackError &&
                /column .* does not exist|schema cache/i.test(fallbackError.message || '')
              ) {
                const { error: minimalError } = await supabase
                  .from('students')
                  .update({
                    is_active: false,
                    status: 'inactive',
                    class_id: null,
                    updated_at: nowIso,
                  })
                  .eq('id', currentStudent.id);
                fallbackError = minimalError;
              }

              if (fallbackError) {
                throw fallbackError;
              }
            }

            setStudent((prev) =>
              prev
                ? {
                    ...prev,
                    is_active: false,
                    status: 'inactive',
                    class_id: null,
                    deleted_at: nowIso,
                    permanent_delete_after: retentionIso,
                  }
                : prev,
            );

            const refreshed = await loadStudent();
            await loadFees(refreshed);

            showAlert(
              'Student Inactive',
              `${studentName} is now inactive and excluded from unpaid fee follow-up. Permanent deletion is scheduled after ${retentionLabel}.`,
              'success',
            );
          } catch (error: any) {
            showAlert('Error', getSupabaseErrorMessage(error, 'Failed to mark student inactive.'), 'error');
          }
        },
      },
    ],
  );
}
