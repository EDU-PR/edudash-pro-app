/**
 * Auto-assign students without a class to appropriate classes based on DOB.
 */

import { assertSupabase } from '@/lib/supabase';
import ClassPlacementService from '@/lib/services/ClassPlacementService';
import { logger } from '@/lib/logger';

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

      const { error } = await assertSupabase()
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
