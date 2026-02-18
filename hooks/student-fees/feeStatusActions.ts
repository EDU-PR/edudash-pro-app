/**
 * Fee status actions: mark paid, mark unpaid, receipt handling.
 */

import { assertSupabase } from '@/lib/supabase';
import type { Student, StudentFee } from './types';
import {
  upsertPaymentRecord,
  upsertFinancialTransaction,
  generateReceiptForFee,
  fetchReceiptUrlForFee,
  openReceiptUrl,
} from './feeHelpers';
import { resolvePendingLikeStatus, getSupabaseErrorMessage, type ShowAlert } from './feeActionUtils';

export async function markFeePaid(
  fee: StudentFee,
  student: Student,
  organizationId: string | undefined,
  profileId: string,
  showAlert: ShowAlert,
  loadFees: () => Promise<void>,
): Promise<void> {
  const supabase = assertSupabase();
  const nowIso = new Date().toISOString();
  const paidDate = nowIso.split('T')[0];
  const amount = fee.final_amount || fee.amount;

  await supabase
    .from('student_fees')
    .update({
      status: 'paid',
      paid_date: paidDate,
      amount_paid: amount,
      amount_outstanding: 0,
      updated_at: nowIso,
    })
    .eq('id', fee.id)
    .throwOnError();

  await upsertPaymentRecord(fee, 'completed', student, organizationId, profileId);
  await upsertFinancialTransaction(fee, 'completed', student, organizationId, profileId);
  await generateReceiptForFee(fee, amount, paidDate, student, { id: profileId } as any, organizationId);

  showAlert('Payment Updated', 'Fee marked as paid.', 'success');
  loadFees();
}

export async function markFeeUnpaid(
  fee: StudentFee,
  student: Student,
  organizationId: string | undefined,
  profileId: string,
  showAlert: ShowAlert,
  loadFees: () => Promise<void>,
): Promise<void> {
  const supabase = assertSupabase();
  const nowIso = new Date().toISOString();
  const amount = fee.final_amount || fee.amount;
  const nextStatus = resolvePendingLikeStatus(fee, amount, 0);

  await supabase
    .from('student_fees')
    .update({
      status: nextStatus,
      paid_date: null,
      amount_paid: 0,
      amount_outstanding: amount,
      updated_at: nowIso,
    })
    .eq('id', fee.id)
    .throwOnError();

  await upsertPaymentRecord(fee, 'reversed', student, organizationId, profileId);
  await upsertFinancialTransaction(fee, 'voided', student, organizationId, profileId);

  showAlert('Payment Updated', 'Fee marked as unpaid.', 'success');
  loadFees();
}

export async function handleReceiptAction(
  fee: StudentFee,
  student: Student | null,
  profile: { id: string } | null,
  organizationId: string | undefined,
  showAlert: ShowAlert,
  router: any,
): Promise<void> {
  if (fee.status !== 'paid') {
    showAlert('Receipt Unavailable', 'Only paid fees can generate receipts.', 'warning');
    return;
  }

  const existingUrl = await fetchReceiptUrlForFee(fee);
  if (existingUrl) {
    await openReceiptUrl(existingUrl, router);
    return;
  }

  showAlert('Generate Receipt?', 'No receipt exists yet for this fee. Generate one now?', 'info', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Generate',
      onPress: async () => {
        if (!student || !profile) return;
        const paidDate = fee.paid_date || new Date().toISOString().split('T')[0];
        const amount = fee.final_amount || fee.amount;
        const result = await generateReceiptForFee(fee, amount, paidDate, student, profile as any, organizationId);
        if (result?.receiptUrl) {
          await openReceiptUrl(result.receiptUrl, router);
        } else {
          showAlert('Receipt Error', 'Receipt generated but link is unavailable.', 'warning');
        }
      },
    },
  ]);
}
