/**
 * Auto-assign students without a class to appropriate classes based on DOB.
 */

import { assertSupabase } from '@/lib/supabase';
import ClassPlacementService from '@/lib/services/ClassPlacementService';
import { logger } from '@/lib/logger';
import { isTuitionFee } from '@/lib/utils/feeUtils';
import { selectFeeStructureForChild, type FeeStructureCandidate } from '@/lib/utils/feeStructureSelector';

import type { Student, ShowAlert } from './types';

interface AutoAssignResult {
  updated: number;
  skipped: number;
  failed: number;
}

export async function autoAssignStudentsByDob(
  orgId: string,
  candidates: Student[],
): Promise<AutoAssignResult> {
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const supabase = assertSupabase();

  let tuitionFeeStructures: FeeStructureCandidate[] = [];
  try {
    const { data: feeStructures, error: feeError } = await supabase
      .from('fee_structures')
      .select('id, amount, fee_type, name, description, grade_levels, effective_from, created_at')
      .eq('preschool_id', orgId)
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .order('created_at', { ascending: false });

    if (feeError) {
      logger.warn('StudentMgmt', 'Could not load fee structures for class auto-assign fee sync', feeError);
    } else {
      tuitionFeeStructures = (feeStructures || []).filter((fee) =>
        isTuitionFee((fee as any).fee_type, (fee as any).name, (fee as any).description),
      ) as FeeStructureCandidate[];
    }
  } catch (error) {
    logger.warn('StudentMgmt', 'Fee structure preload failed during auto-assign', error);
  }

  for (const student of candidates) {
    try {
      const suggestion = await ClassPlacementService.suggestClassForStudent({
        organizationId: orgId,
        dateOfBirth: student.date_of_birth,
      });

      if (!suggestion?.classId) {
        skipped += 1;
        continue;
      }

      const { error } = await supabase
        .from('students')
        .update({ class_id: suggestion.classId })
        .eq('id', student.id);

      if (error) {
        logger.warn('StudentMgmt', 'Auto-assign update failed', {
          studentId: student.id,
          error,
        });
        failed += 1;
      } else {
        updated += 1;

        if (tuitionFeeStructures.length > 0) {
          try {
            const classNeedle = suggestion.className?.trim().toLowerCase();
            const classMatch = classNeedle
              ? tuitionFeeStructures.find((fee) => {
                  const text = [
                    (fee as any).name,
                    (fee as any).description,
                    ...(((fee as any).grade_levels as string[] | null) || []),
                  ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                  return text.includes(classNeedle);
                })
              : null;

            const selectedTuitionFee = classMatch || selectFeeStructureForChild(tuitionFeeStructures, {
              dateOfBirth: student.date_of_birth,
              ageGroupLabel: suggestion.className || undefined,
              gradeLevel: suggestion.className || undefined,
            });

            if (selectedTuitionFee) {
              const { data: fees, error: feesError } = await supabase
                .from('student_fees')
                .select(`
                  id,
                  status,
                  amount_paid,
                  discount_amount,
                  category_code,
                  fee_structures!student_fees_fee_structure_id_fkey(fee_type, name, description)
                `)
                .eq('student_id', student.id)
                .in('status', ['pending', 'overdue', 'partially_paid']);

              if (feesError) {
                logger.warn('StudentMgmt', 'Failed to fetch student fees for auto-assign sync', {
                  studentId: student.id,
                  error: feesError,
                });
              } else {
                const eligibleFeeIds = (fees || [])
                  .filter((row: any) => {
                    const amountPaid = Number(row.amount_paid || 0);
                    const discountAmount = Number(row.discount_amount || 0);
                    if (amountPaid > 0.0001 || discountAmount > 0.0001) return false;
                    if (String(row.category_code || '').toLowerCase() === 'tuition') return true;
                    const structure = Array.isArray(row.fee_structures) ? row.fee_structures[0] : row.fee_structures;
                    return isTuitionFee(structure?.fee_type, structure?.name, structure?.description);
                  })
                  .map((row: any) => row.id as string);

                if (eligibleFeeIds.length > 0) {
                  const nowIso = new Date().toISOString();
                  await Promise.all(
                    eligibleFeeIds.map((feeId) =>
                      supabase
                        .from('student_fees')
                        .update({
                          fee_structure_id: selectedTuitionFee.id,
                          amount: Number(selectedTuitionFee.amount),
                          final_amount: Number(selectedTuitionFee.amount),
                          amount_outstanding: Number(selectedTuitionFee.amount),
                          updated_at: nowIso,
                        })
                        .eq('id', feeId)
                        .throwOnError(),
                    ),
                  );
                }
              }
            }
          } catch (syncError) {
            logger.warn('StudentMgmt', 'Class auto-assign fee sync failed', {
              studentId: student.id,
              error: syncError,
            });
          }
        }
      }
    } catch (error) {
      logger.warn('StudentMgmt', 'Auto-assign failed for student', {
        studentId: student.id,
        error,
      });
      failed += 1;
    }
  }

  return { updated, skipped, failed };
}

/**
 * Validates preconditions and prompts the user before running auto-assign.
 * Returns early if there's nothing to assign.
 */
export function promptAutoAssign(
  orgId: string | null,
  students: Student[],
  showAlert: ShowAlert,
  onConfirm: (candidates: Student[]) => void,
): void {
  if (!orgId) {
    showAlert(
      'No school found',
      'Please complete setup before auto-assigning students.',
      'warning',
    );
    return;
  }

  const candidates = students.filter(
    (s) => !s.class_id && Boolean(s.date_of_birth),
  );
  if (candidates.length === 0) {
    showAlert(
      'Nothing to assign',
      'No students without a class and a valid date of birth.',
      'info',
    );
    return;
  }

  showAlert(
    'Auto-assign by DOB',
    `Assign classes for ${candidates.length} student${candidates.length === 1 ? '' : 's'} based on date of birth? This will only fill missing class assignments.`,
    'info',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Assign', onPress: () => onConfirm(candidates) },
    ],
  );
}
