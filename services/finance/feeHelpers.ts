/**
 * Student-fee querying and calculation helpers.
 */

import { assertSupabase } from '@/lib/supabase';
import { isUniformFee, isTuitionFee } from '@/lib/utils/feeUtils';

export async function fetchStudentFees(
  preschoolId: string,
  options: { from: string; to: string; useDueDate: boolean },
) {
  const buildQuery = () => {
    let query = assertSupabase()
      .from('student_fees')
      .select(
        'id, amount, final_amount, amount_paid, amount_outstanding, status, due_date, created_at, students!inner(id, preschool_id, organization_id)',
      );

    query = query.or(
      `preschool_id.eq.${preschoolId},organization_id.eq.${preschoolId}`,
      { foreignTable: 'students' },
    );

    if (options.useDueDate) {
      query = query.gte('due_date', options.from).lt('due_date', options.to);
    } else {
      query = query
        .is('due_date', null)
        .gte('created_at', options.from)
        .lt('created_at', options.to);
    }

    return query;
  };

  const result = await buildQuery();
  const error = (result as any).error;
  const data = ((result as any).data || []) as any[];

  return { data, error };
}

export function getFeeStructure(fee: any) {
  const relation = fee?.fee_structures;
  return Array.isArray(relation) ? relation[0] : relation;
}

export function getFeeLabel(fee: any): string {
  const structure = getFeeStructure(fee);
  return structure?.name || structure?.fee_type || fee?.description || 'Fee';
}

export function getFeeCategoryLabel(fee: any): string {
  const structure = getFeeStructure(fee);
  if (isUniformFee(structure?.fee_type, structure?.name, structure?.description)) {
    return 'Uniform';
  }
  if (isTuitionFee(structure?.fee_type, structure?.name, structure?.description)) {
    return 'Tuition';
  }
  return structure?.fee_type || structure?.name || 'Fee';
}

export function getPaidAmountForFee(fee: any): number {
  const paid = Number(fee?.amount_paid || 0);
  if (paid > 0) return paid;
  const finalAmount = Number(fee?.final_amount ?? fee?.amount ?? 0);
  return String(fee?.status) === 'paid' ? finalAmount : 0;
}

export function getOutstandingAmountForFee(fee: any): number {
  const finalAmount = Number(fee?.final_amount ?? fee?.amount ?? 0);
  const paidAmount = Number(fee?.amount_paid ?? 0);
  const explicitOutstanding = Number(fee?.amount_outstanding);
  const derivedOutstanding = finalAmount - (Number.isFinite(paidAmount) ? paidAmount : 0);

  if (Number.isFinite(explicitOutstanding)) {
    return Math.max(explicitOutstanding, 0);
  }
  if (Number.isFinite(derivedOutstanding)) {
    return Math.max(derivedOutstanding, 0);
  }
  return 0;
}

export function isStudentActiveForReceivables(student: any): boolean {
  if (!student) return false;
  if (student.is_active !== true) return false;
  const status = String(student.status || '').toLowerCase().trim();
  return status === 'active';
}

export function isAdvancePayment(dueDate?: string | null, paidDate?: string | null): boolean {
  if (!dueDate || !paidDate) return false;
  const due = new Date(dueDate);
  const paid = new Date(paidDate);
  if (Number.isNaN(due.getTime()) || Number.isNaN(paid.getTime())) return false;
  const dueMonthStart = new Date(due.getFullYear(), due.getMonth(), 1);
  return paid < dueMonthStart;
}
