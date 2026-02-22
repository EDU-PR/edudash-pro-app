/**
 * Class-level fee sync: audit logging, tuition fee syncing, and prefill.
 */

import { assertSupabase } from '@/lib/supabase';
import { isTuitionFee } from '@/lib/utils/feeUtils';
import type { Student, ClassOption } from './types';
import { resolveSuggestedTuitionFee, resolveSuggestedRegistrationFee } from './feeHelpers';
import { writeFeeCorrectionAudit } from './feeCorrectionAudit';

interface FeeAssignmentPayload {
  student: Student;
  source: 'change_class' | 'manual_sync';
  previousClassName?: string | null;
  nextClassName?: string | null;
  updatedFeeRows: number;
  tuitionAmount?: number | null;
}

export async function logFeeAssignmentCorrection(
  payload: FeeAssignmentPayload,
  profileId: string,
  profileRole: string | null,
  organizationId: string | undefined,
): Promise<boolean> {
  const supabase = assertSupabase();
  const nowIso = new Date().toISOString();
  const studentName = `${payload.student.first_name} ${payload.student.last_name}`.trim();
  const metadata = {
    source: payload.source,
    updated_fee_rows: payload.updatedFeeRows,
    previous_class_name: payload.previousClassName || null,
    next_class_name: payload.nextClassName || null,
    tuition_amount: payload.tuitionAmount ?? null,
  };

  try {
    const { error } = await supabase.rpc('create_audit_log', {
      p_event_type: 'admin_action',
      p_event_name: 'correct_fee_assignment',
      p_actor_id: profileId,
      p_target_id: payload.student.id,
      p_target_type: 'student',
      p_metadata: metadata,
      p_success: true,
    });
    if (error) throw error;
  } catch (rpcError) {
    const { error: insertError } = await supabase.from('audit_logs').insert({
      action: 'correct_fee_assignment',
      event_type: 'admin_action',
      event_name: 'correct_fee_assignment',
      event_description: `Correct fee assignment for ${studentName}`,
      actor_id: profileId,
      actor_role: profileRole,
      actor_organization_id: organizationId || payload.student.preschool_id || null,
      target_id: payload.student.id,
      target_name: studentName || null,
      target_type: 'student',
      resource_id: payload.student.id,
      resource_type: 'student_fees',
      changes_made: metadata as any,
      metadata: { ...metadata, fallback: 'audit_logs_insert' } as any,
      occurred_at: nowIso,
      success: true,
    });
    if (insertError) {
      console.warn('[StudentFees] Failed to write fee assignment audit log', {
        rpcError,
        insertError,
        metadata,
      });
    }
  }

  const action = payload.source === 'change_class' ? 'change_class' : 'tuition_sync';
  const reason =
    payload.source === 'change_class'
      ? `Class changed from ${payload.previousClassName || 'unknown'} to ${payload.nextClassName || 'unknown'}, with fee reassignment.`
      : `Manual tuition sync run for ${payload.nextClassName || payload.student.class_name || 'current class'}.`;
  const correctionAuditResult = await writeFeeCorrectionAudit({
    organizationId: organizationId || payload.student.preschool_id || null,
    studentId: payload.student.id,
    action,
    reason,
    beforeSnapshot: {
      class_name: payload.previousClassName || null,
      updated_fee_rows: 0,
      tuition_amount: null,
    },
    afterSnapshot: {
      class_name: payload.nextClassName || null,
      updated_fee_rows: payload.updatedFeeRows,
      tuition_amount: payload.tuitionAmount ?? null,
    },
    metadata: {
      source: payload.source,
      previous_class_name: payload.previousClassName || null,
      next_class_name: payload.nextClassName || null,
      updated_fee_rows: payload.updatedFeeRows,
      tuition_amount: payload.tuitionAmount ?? null,
    },
    actorId: profileId,
    actorRole: profileRole || null,
    sourceScreen: 'principal-student-fees',
  });
  if (!correctionAuditResult.ok) {
    console.warn('[StudentFees] Failed to write fee correction audit row', {
      error: correctionAuditResult.error,
      action,
      studentId: payload.student.id,
    });
    return false;
  }
  return true;
}

export interface TuitionSyncResult {
  updated: number;
  amount?: number | null;
  className?: string;
}

export async function syncPendingTuitionFees(
  targetStudent: Student,
  organizationId: string | undefined,
  classes: ClassOption[],
  className?: string | null,
): Promise<TuitionSyncResult> {
  if (!organizationId) return { updated: 0 };

  const supabase = assertSupabase();
  const resolvedClassName =
    className ||
    classes.find((c) => c.id === targetStudent.class_id)?.name ||
    targetStudent.class_name ||
    '';

  if (!resolvedClassName) {
    return { updated: 0 };
  }

  const selectedTuitionFee = await resolveSuggestedTuitionFee(
    organizationId,
    targetStudent,
    resolvedClassName,
  );
  if (!selectedTuitionFee) {
    return { updated: 0, className: resolvedClassName };
  }

  const { data: feeRows, error: feesError } = await supabase
    .from('student_fees')
    .select(`
      id,
      status,
      amount_paid,
      discount_amount,
      amount_outstanding,
      category_code,
      fee_structures!student_fees_fee_structure_id_fkey(fee_type, name, description)
    `)
    .eq('student_id', targetStudent.id)
    .in('status', ['pending', 'overdue', 'partially_paid']);

  if (feesError) {
    throw feesError;
  }

  const eligibleFeeIds = (feeRows || [])
    .filter((row: any) => {
      const amountPaid = Number(row.amount_paid || 0);
      const discountAmount = Number(row.discount_amount || 0);
      if (amountPaid > 0.0001 || discountAmount > 0.0001) return false;

      if (String(row.category_code || '').toLowerCase() === 'tuition') {
        return true;
      }

      const structure = Array.isArray(row.fee_structures)
        ? row.fee_structures[0]
        : row.fee_structures;
      return isTuitionFee(structure?.fee_type, structure?.name, structure?.description);
    })
    .map((row: any) => row.id as string);

  if (!eligibleFeeIds.length) {
    return { updated: 0, className: resolvedClassName, amount: Number(selectedTuitionFee.amount) };
  }

  const nowIso = new Date().toISOString();
  const normalizedAmount = Number(selectedTuitionFee.amount);
  await Promise.all(
    eligibleFeeIds.map((feeId) =>
      supabase
        .from('student_fees')
        .update({
          fee_structure_id: selectedTuitionFee.id,
          amount: normalizedAmount,
          final_amount: normalizedAmount,
          amount_outstanding: normalizedAmount,
          updated_at: nowIso,
        })
        .eq('id', feeId)
        .throwOnError(),
    ),
  );

  return {
    updated: eligibleFeeIds.length,
    amount: normalizedAmount,
    className: resolvedClassName,
  };
}

export async function prefillRegistrationFeeForClass(
  classId: string,
  classes: ClassOption[],
  organizationId: string | undefined,
  studentRef: React.MutableRefObject<Student | null>,
  setClassRegistrationFee: (v: string) => void,
  setClassFeeHint: (v: string) => void,
): Promise<void> {
  const selectedClass = classes.find((c) => c.id === classId);
  if (!selectedClass || !organizationId) return;

  const suggested = await resolveSuggestedRegistrationFee(
    organizationId,
    studentRef.current,
    selectedClass.name,
  );
  if (suggested != null && Number.isFinite(suggested)) {
    setClassRegistrationFee(suggested.toFixed(2));
    setClassFeeHint(
      `Suggested fee for ${selectedClass.name} loaded from active registration fee setup.`,
    );
  } else {
    setClassFeeHint(
      `No class-linked registration fee found for ${selectedClass.name}. Enter the correct amount manually.`,
    );
  }
}
