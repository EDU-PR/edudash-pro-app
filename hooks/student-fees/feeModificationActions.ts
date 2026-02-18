/**
 * Fee modification actions: waive and adjust fees.
 */

import { assertSupabase } from '@/lib/supabase';
import type { Student, StudentFee } from './types';
import { isRegistrationFeeEntry } from './types';
import { resolvePendingLikeStatus, getSupabaseErrorMessage, type ShowAlert } from './feeActionUtils';

export async function waiveFee(
  selectedFee: StudentFee,
  waiveType: 'full' | 'partial',
  waiveAmount: string,
  waiveReason: string,
  showAlert: ShowAlert,
  loadFees: () => Promise<void>,
): Promise<void> {
  const currentFinal = Number(selectedFee.final_amount || selectedFee.amount || 0);
  const currentDiscount = Number(selectedFee.discount_amount || selectedFee.waived_amount || 0);
  const currentPaid = Number(selectedFee.amount_paid || 0);
  const currentOutstanding = Number.isFinite(Number(selectedFee.amount_outstanding))
    ? Number(selectedFee.amount_outstanding)
    : Math.max(0, currentFinal - currentPaid);
  const amount = waiveType === 'full' ? currentOutstanding : parseFloat(waiveAmount);

  if (waiveType === 'partial' && (!amount || amount <= 0 || amount > currentOutstanding)) {
    showAlert('Invalid Amount', 'Please enter a valid waiver amount.', 'warning');
    return;
  }
  if (!waiveReason.trim()) {
    showAlert('Reason Required', 'Please provide a reason for the waiver.', 'warning');
    return;
  }

  const supabase = assertSupabase();
  const nowIso = new Date().toISOString();
  const newFinal = Math.max(0, currentFinal - amount);
  const newDiscount = Number((currentDiscount + amount).toFixed(2));
  const newOutstanding = Math.max(0, newFinal - currentPaid);
  const nextStatus =
    newFinal <= 0
      ? 'waived'
      : resolvePendingLikeStatus(selectedFee, newOutstanding, currentPaid);

  await supabase
    .from('student_fees')
    .update({
      discount_amount: newDiscount,
      final_amount: newFinal,
      status: nextStatus,
      amount_outstanding: newOutstanding,
      updated_at: nowIso,
    })
    .eq('id', selectedFee.id)
    .throwOnError();

  showAlert(
    'Fee Waived',
    waiveType === 'full'
      ? 'The fee has been fully waived.'
      : `R${amount.toFixed(2)} has been waived from this fee.`,
    'success',
  );
  loadFees();
}

export async function adjustFee(
  selectedFee: StudentFee,
  adjustAmountStr: string,
  adjustReason: string,
  student: Student | null,
  setStudent: React.Dispatch<React.SetStateAction<Student | null>>,
  showAlert: ShowAlert,
  loadFees: () => Promise<void>,
): Promise<void> {
  const amount = parseFloat(adjustAmountStr);
  if (!amount || amount <= 0) {
    showAlert('Invalid Amount', 'Please enter a valid amount.', 'warning');
    return;
  }
  if (!adjustReason.trim()) {
    showAlert('Reason Required', 'Please provide a reason for the adjustment.', 'warning');
    return;
  }

  const supabase = assertSupabase();
  const amountPaid = Number(selectedFee.amount_paid || 0);
  const amountOutstanding = Math.max(0, amount - amountPaid);
  const nextStatus = resolvePendingLikeStatus(selectedFee, amountOutstanding, amountPaid);

  await supabase
    .from('student_fees')
    .update({
      amount,
      final_amount: amount,
      discount_amount: 0,
      amount_outstanding: amountOutstanding,
      status: amount === 0 ? 'waived' : nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', selectedFee.id)
    .throwOnError();

  if (isRegistrationFeeEntry(selectedFee.fee_type, selectedFee.description)) {
    const { error: regError } = await supabase
      .from('students')
      .update({ registration_fee_amount: amount, updated_at: new Date().toISOString() })
      .eq('id', selectedFee.student_id);
    if (!regError) {
      setStudent((prev) => (prev ? { ...prev, registration_fee_amount: amount } : prev));
    }
  }

  showAlert('Fee Adjusted', `Fee amount updated to R${amount.toFixed(2)}.`, 'success');
  loadFees();
}
