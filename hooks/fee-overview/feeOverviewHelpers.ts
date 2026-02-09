/**
 * Pure utility functions for fee calculations.
 * No React hooks or side effects — safe to call from anywhere.
 */

export const UNPAID_STATUSES = new Set([
  'pending', 'overdue', 'partially_paid', 'pending_verification',
]);
export const PENDING_VERIFICATION_STATUS = 'pending_verification';

export function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function getFeeAmount(fee: any): number {
  const finalAmount = toNumber(fee?.final_amount);
  if (finalAmount > 0) return finalAmount;
  return toNumber(fee?.amount);
}

export function getPaidAmount(fee: any): number {
  const paid = toNumber(fee?.amount_paid);
  if (paid > 0) return paid;
  return fee?.status === 'paid' ? getFeeAmount(fee) : 0;
}

export function getOutstandingAmount(fee: any): number {
  const outstanding = toNumber(fee?.amount_outstanding);
  if (outstanding > 0) return outstanding;
  if (UNPAID_STATUSES.has(String(fee?.status))) {
    return getFeeAmount(fee);
  }
  return 0;
}

export function getWaivedAmount(fee: any): number {
  const waived = toNumber(fee?.waived_amount);
  if (waived > 0) return waived;
  return toNumber(fee?.discount_amount);
}

export function isInMonth(
  date: Date | null | undefined,
  monthStart: Date,
  monthEnd: Date,
): boolean {
  if (!date) return false;
  if (Number.isNaN(date.getTime())) return false;
  return date >= monthStart && date < monthEnd;
}

export function getFeeMonthDate(fee: any): Date | null {
  const candidate = fee?.due_date || fee?.created_at || fee?.paid_date;
  if (!candidate) return null;
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getFeeStructure(fee: any) {
  const rel = fee?.fee_structures;
  return Array.isArray(rel) ? rel[0] : rel;
}

export function getFeeLabel(fee: any): string {
  const structure = getFeeStructure(fee);
  return structure?.name || structure?.fee_type || 'Uncategorized';
}

export function getFeeType(fee: any): string | null {
  const structure = getFeeStructure(fee);
  return structure?.fee_type || null;
}

export function isAdvancePayment(fee: any): boolean {
  const paidDateStr = fee?.paid_date;
  const dueDateStr = fee?.due_date;
  if (!paidDateStr || !dueDateStr) return false;
  const paidDate = new Date(paidDateStr);
  const dueDate = new Date(dueDateStr);
  if (Number.isNaN(paidDate.getTime()) || Number.isNaN(dueDate.getTime())) return false;
  const dueMonthStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1);
  return paidDate < dueMonthStart && getPaidAmount(fee) > 0;
}

export function isPreEnrollment(
  fee: any,
  enrollmentMonthStart?: Date | null,
): boolean {
  if (!enrollmentMonthStart || !fee?.due_date) return false;
  const due = new Date(fee.due_date);
  if (Number.isNaN(due.getTime())) return false;
  return due < enrollmentMonthStart;
}

export function formatCurrency(amount: number): string {
  return `R ${amount.toFixed(2)}`;
}
