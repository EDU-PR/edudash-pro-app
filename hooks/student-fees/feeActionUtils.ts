/**
 * Pure utility functions for student fee actions.
 * No React dependencies — used by action modules.
 */

import type { StudentFee } from './types';

export const STUDENT_DELETE_RETENTION_DAYS = 30;

export type ShowAlert = (
  title: string,
  message: string,
  type?: 'info' | 'warning' | 'success' | 'error',
  buttons?: any[],
) => void;

export function toDayStart(dateValue?: string | null): Date | null {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function resolvePendingLikeStatus(
  fee: StudentFee,
  nextOutstanding: number,
  amountPaid: number,
): StudentFee['status'] {
  if (nextOutstanding <= 0) return nextOutstanding === 0 ? 'paid' : 'waived';
  if (amountPaid > 0) return 'partially_paid';
  const dueStart = toDayStart(fee.due_date);
  if (!dueStart) return 'pending';
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return dueStart < todayStart ? 'overdue' : 'pending';
}

export function getSupabaseErrorMessage(error: any, fallback: string): string {
  if (!error) return fallback;
  const normalizedMessage = String(error?.message || '').toLowerCase();
  if (normalizedMessage.includes('fee_corrections_audit is append-only')) {
    return 'Audit-log schema conflict blocked this action. Apply the latest finance migration and retry.';
  }
  if (normalizedMessage.includes('missing_organization_id')) {
    return 'Organization context is missing for this user. Refresh the screen and try again.';
  }
  if (normalizedMessage.includes('audit_log_failed')) {
    return 'Audit logging failed, so the change was blocked for safety.';
  }
  const message = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' | ');
  return message || fallback;
}
