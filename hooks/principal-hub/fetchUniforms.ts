/**
 * Principal Hub — Uniform Payment Summary
 *
 * Queries school_fee_structures (with legacy fee_structures fallback),
 * student_fees, payments, and pop_uploads
 * to build a UniformPaymentSummary for the principal dashboard.
 *
 * @module hooks/principal-hub/fetchUniforms
 */

import { logger } from '@/lib/logger';
import { assertSupabase } from '@/lib/supabase';
import { isUniformLabel } from '@/lib/utils/feeUtils';
import type { UniformPaymentSummary } from './types';

/** Derive how much was actually paid for a single fee row. */
const getPaidAmount = (fee: any): number => {
  const paid = Number(fee?.amount_paid || 0);
  if (paid > 0) return paid;
  const total = Number(fee?.final_amount || fee?.amount || 0);
  return String(fee?.status) === 'paid' ? total : 0;
};

/** Derive fee total even when only legacy columns are populated. */
const getFeeTotal = (fee: any): number => {
  return Number(fee?.final_amount || fee?.amount || 0);
};

/** Derive outstanding amount with a safe fallback when `amount_outstanding` is stale/missing. */
const getOutstandingAmount = (fee: any): number => {
  const explicitOutstanding = Number(fee?.amount_outstanding);
  if (Number.isFinite(explicitOutstanding) && explicitOutstanding > 0) {
    return explicitOutstanding;
  }
  return Math.max(getFeeTotal(fee) - getPaidAmount(fee), 0);
};

export interface UniformResult {
  summary: UniformPaymentSummary;
  structureIds: string[];
}

/**
 * Fetch and compute uniform payment data for a school.
 *
 * Returns both the summary object and the list of uniform fee-structure IDs
 * (needed to exclude them from tuition revenue calculations).
 */
export async function fetchUniformPayments(preschoolId: string): Promise<UniformResult> {
  const supabase = assertSupabase();

  const summary: UniformPaymentSummary = {
    totalPaid: 0,
    totalOutstanding: 0,
    paidCount: 0,
    pendingCount: 0,
    pendingUploads: 0,
    pendingUploadAmount: 0,
    totalStudents: 0,
    submittedOrders: 0,
    noOrderCount: 0,
    paidStudentCount: 0,
    pendingStudentCount: 0,
    unpaidStudentCount: 0,
    recentPayments: [],
  };

  let structureIds: string[] = [];
  let legacyStructureIds: string[] = [];

  try {
    // 1. Identify uniform fee structures (canonical table first, legacy fallback second)
    const { data: canonicalStructures, error: canonicalStructuresError } = await supabase
      .from('school_fee_structures')
      .select('id, fee_category, name, description')
      .eq('preschool_id', preschoolId)
      .eq('is_active', true);

    if (canonicalStructuresError) {
      logger.warn('[PrincipalHub] school_fee_structures query failed; falling back to fee_structures', canonicalStructuresError);
    }

    const canonicalStructureIds = (canonicalStructures || [])
      .filter(
        (row: any) =>
          isUniformLabel(row?.fee_category) ||
          isUniformLabel(row?.name) ||
          isUniformLabel(row?.description),
      )
      .map((row: any) => row.id)
      .filter(Boolean);

    const { data: legacyStructures, error: legacyStructuresError } = await supabase
      .from('fee_structures')
      .select('id, fee_type, name, description')
      .eq('preschool_id', preschoolId);

    if (legacyStructuresError && canonicalStructureIds.length === 0) {
      throw legacyStructuresError;
    }
    if (legacyStructuresError) {
      logger.warn('[PrincipalHub] fee_structures legacy fallback query failed', legacyStructuresError);
    }

    legacyStructureIds = (legacyStructures || [])
      .filter(
        (row: any) =>
          isUniformLabel(row?.fee_type) ||
          isUniformLabel(row?.name) ||
          isUniformLabel(row?.description),
      )
      .map((row: any) => row.id)
      .filter(Boolean);

    structureIds = Array.from(new Set([...legacyStructureIds, ...canonicalStructureIds]));

    const paidFeeIds = new Set<string>();

    // 2. Fetch uniform student_fees (legacy student_fees points at fee_structures IDs)
    const studentFeeStructureIds = legacyStructureIds.length > 0 ? legacyStructureIds : structureIds;
    if (studentFeeStructureIds.length > 0) {
      const { data: uniformFees } = await supabase
        .from('student_fees')
        .select(
          'id, amount, final_amount, amount_paid, amount_outstanding, status, due_date, paid_date, updated_at, student:students!student_fees_student_id_fkey(first_name, last_name, student_id, preschool_id, organization_id)',
        )
        .in('fee_structure_id', studentFeeStructureIds)
        .or(`preschool_id.eq.${preschoolId},organization_id.eq.${preschoolId}`, {
          foreignTable: 'students',
        });

      const fees = (uniformFees || []) as any[];
      const paidFees = fees.filter((f) => getPaidAmount(f) > 0 || String(f?.status) === 'paid');
      paidFees.map((f) => f.id).filter(Boolean).forEach((id: string) => paidFeeIds.add(id));

      summary.totalPaid = paidFees.reduce((s, f) => s + getPaidAmount(f), 0);
      summary.totalOutstanding = fees.reduce((s, f) => {
        return s + (String(f?.status) === 'paid' ? 0 : getOutstandingAmount(f));
      }, 0);
      summary.paidCount = paidFees.length;
      summary.pendingCount = Math.max(fees.length - paidFees.length, 0);

      summary.recentPayments = [...paidFees]
        .sort((a, b) => {
          const aD = new Date(a.paid_date || a.updated_at || a.due_date || 0).getTime();
          const bD = new Date(b.paid_date || b.updated_at || b.due_date || 0).getTime();
          return bD - aD;
        })
        .slice(0, 5)
        .map((f) => ({
          id: f.id,
          studentName:
            `${f?.student?.first_name || ''} ${f?.student?.last_name || ''}`.trim() || 'Student',
          amount: getPaidAmount(f),
          paidDate: f.paid_date || f.updated_at || f.due_date || null,
          status: f.status || null,
        }));

    }

    // 3. Cross-reference payments table for uniform payments even if fee structures are not configured.
    try {
      const { data: paymentRows } = await supabase
        .from('payments')
        .select('id, amount, status, description, metadata, created_at, fee_ids')
        .eq('preschool_id', preschoolId)
        .in('status', ['completed', 'approved']);

      const extras = (paymentRows || []).filter((p: any) => {
        const md = p?.metadata || {};
        const labels = [p?.description, md?.payment_purpose, md?.payment_context, md?.fee_type];
        if (!labels.some((v) => isUniformLabel(v))) return false;
        const feeIds: string[] = Array.isArray(p?.fee_ids) ? p.fee_ids : [];
        return !feeIds.some((id: string) => paidFeeIds.has(id));
      });

      if (extras.length > 0) {
        summary.totalPaid += extras.reduce((s: number, p: any) => s + (Number(p?.amount) || 0), 0);
        summary.paidCount += extras.length;

        const extraRecent = extras
          .map((p: any) => ({
            id: p.id,
            studentName: 'Student',
            amount: Number(p?.amount) || 0,
            paidDate: p?.metadata?.payment_date || p?.created_at || null,
            status: p?.status || null,
          }))
          .sort((a, b) => new Date(b.paidDate || 0).getTime() - new Date(a.paidDate || 0).getTime())
          .slice(0, 5);

        summary.recentPayments = [...summary.recentPayments, ...extraRecent]
          .sort((a, b) => new Date(b.paidDate || 0).getTime() - new Date(a.paidDate || 0).getTime())
          .slice(0, 5);
      }
    } catch (e) {
      logger.warn('[PrincipalHub] Uniform payments cross-ref failed:', e);
    }

    // 4. Pending POP uploads for uniforms
    const { data: uploads } = await supabase
      .from('pop_uploads')
      .select('id, status, payment_amount, payment_reference, title, description')
      .eq('preschool_id', preschoolId)
      .eq('upload_type', 'proof_of_payment');

    const uniformUploads = (uploads || []).filter(
      (u: any) =>
        isUniformLabel(u?.description) ||
        isUniformLabel(u?.title) ||
        isUniformLabel(u?.payment_reference),
    );

    const pending = uniformUploads.filter((u: any) => {
      const status = String(u?.status || 'pending').toLowerCase();
      return !['approved', 'rejected'].includes(status);
    });
    summary.pendingUploads = pending.length;
    summary.pendingUploadAmount = pending.reduce(
      (s: number, u: any) => s + (Number(u?.payment_amount) || 0),
      0,
    );

    // If no fee rows are configured yet, use pending POP value as fallback visibility for collections.
    if (summary.totalOutstanding <= 0 && summary.pendingUploadAmount > 0) {
      summary.totalOutstanding = summary.pendingUploadAmount;
    }

    // 5. Student-level status breakdown for dashboard visibility and CTAs.
    try {
      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('preschool_id', preschoolId)
        .or('is_active.eq.true,is_active.is.null');

      const studentIds = (students || [])
        .map((student: any) => student?.id as string)
        .filter(Boolean);

      summary.totalStudents = studentIds.length;
      if (studentIds.length === 0) {
        return { summary, structureIds };
      }

      const { data: requests } = await supabase
        .from('uniform_requests')
        .select('student_id')
        .eq('preschool_id', preschoolId)
        .in('student_id', studentIds);

      const submittedStudentIds = [...new Set((requests || [])
        .map((request: any) => request?.student_id as string)
        .filter(Boolean))];
      summary.submittedOrders = submittedStudentIds.length;
      summary.noOrderCount = Math.max(studentIds.length - submittedStudentIds.length, 0);

      if (submittedStudentIds.length === 0) {
        summary.unpaidStudentCount = 0;
        summary.pendingStudentCount = 0;
        summary.paidStudentCount = 0;
        return { summary, structureIds };
      }

      const statusByStudent = new Map<string, 'paid' | 'pending' | 'unpaid'>(
        submittedStudentIds.map((studentId) => [studentId, 'unpaid'])
      );

      const [popRowsRes, paymentsRowsRes] = await Promise.all([
        supabase
          .from('pop_uploads')
          .select('student_id, status, title, description, payment_reference')
          .eq('preschool_id', preschoolId)
          .eq('upload_type', 'proof_of_payment')
          .in('student_id', submittedStudentIds),
        supabase
          .from('payments')
          .select('student_id, status, description, metadata')
          .eq('preschool_id', preschoolId)
          .in('student_id', submittedStudentIds),
      ]);

      (popRowsRes.data || [])
        .filter((row: any) =>
          isUniformLabel(row?.description) ||
          isUniformLabel(row?.title) ||
          isUniformLabel(row?.payment_reference),
        )
        .forEach((row: any) => {
          const studentId = row?.student_id as string | undefined;
          if (!studentId || !statusByStudent.has(studentId)) return;
          const status = String(row?.status || '').toLowerCase();
          if (status === 'approved') {
            statusByStudent.set(studentId, 'paid');
            return;
          }
          if (['pending', 'submitted'].includes(status) && statusByStudent.get(studentId) !== 'paid') {
            statusByStudent.set(studentId, 'pending');
          }
        });

      (paymentsRowsRes.data || []).forEach((row: any) => {
        const studentId = row?.student_id as string | undefined;
        if (!studentId || !statusByStudent.has(studentId)) return;
        const labels = [
          row?.description,
          row?.metadata?.payment_purpose,
          row?.metadata?.payment_context,
          row?.metadata?.fee_type,
        ];
        if (!labels.some((label) => isUniformLabel(label))) return;
        const status = String(row?.status || '').toLowerCase();
        if (['completed', 'approved'].includes(status)) {
          statusByStudent.set(studentId, 'paid');
          return;
        }
        if (status === 'pending' && statusByStudent.get(studentId) !== 'paid') {
          statusByStudent.set(studentId, 'pending');
        }
      });

      const statuses = [...statusByStudent.values()];
      summary.paidStudentCount = statuses.filter((status) => status === 'paid').length;
      summary.pendingStudentCount = statuses.filter((status) => status === 'pending').length;
      summary.unpaidStudentCount = statuses.filter((status) => status === 'unpaid').length;
    } catch (breakdownError) {
      logger.warn('[PrincipalHub] Uniform student breakdown failed:', breakdownError);
    }
  } catch (e) {
    logger.warn('[PrincipalHub] Uniform payment summary failed:', e);
  }

  return { summary, structureIds };
}
