import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { isUniformLabel } from '@/lib/utils/feeUtils';
import type { UniformEntry, UniformRegisterSummary } from './types';

const TAG = 'UniformRegister';

export async function fetchUniformRegister(preschoolId: string): Promise<{
  entries: UniformEntry[];
  summary: UniformRegisterSummary;
}> {
  const supabase = assertSupabase();

  const { data: students, error: studentsErr } = await supabase
    .from('students')
    .select('id, full_name, parent_id, profiles:parent_id(id, full_name, phone, email)')
    .eq('preschool_id', preschoolId)
    .eq('status', 'active')
    .order('full_name');

  if (studentsErr) {
    logger.error(TAG, 'Failed to fetch students', studentsErr);
    throw new Error('Failed to load student list');
  }

  const { data: feeRecords, error: feeErr } = await supabase
    .from('student_fees')
    .select('*')
    .eq('preschool_id', preschoolId)
    .order('created_at', { ascending: false });

  if (feeErr) {
    logger.error(TAG, 'Failed to fetch fee records', feeErr);
    throw new Error('Failed to load fee records');
  }

  const uniformFees = (feeRecords || []).filter(
    (f: any) =>
      isUniformLabel(f.fee_type) ||
      isUniformLabel(f.description) ||
      isUniformLabel(f.label),
  );

  // Graceful fallback if uniform_orders table doesn't exist yet
  let uniformOrders: any[] = [];
  try {
    const { data, error: orderErr } = await supabase
      .from('uniform_orders')
      .select('*')
      .eq('preschool_id', preschoolId);
    if (!orderErr && data) uniformOrders = data;
  } catch {
    logger.info(TAG, 'uniform_orders table not found, using fee records only');
  }

  const entries: UniformEntry[] = (students || []).map((student: any) => {
    const parent = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
    const fees = uniformFees.filter((f: any) => f.student_id === student.id);
    const order = uniformOrders.find((o: any) => o.student_id === student.id);

    const totalAmount = fees.reduce((s: number, f: any) => s + (f.amount || 0), 0);
    const amountPaid = fees.reduce((s: number, f: any) => s + (f.amount_paid || 0), 0);

    let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'unpaid';
    if (totalAmount > 0 && amountPaid >= totalAmount) paymentStatus = 'paid';
    else if (amountPaid > 0) paymentStatus = 'partial';

    const filledOut = !!order || fees.length > 0;

    return {
      id: student.id,
      student_id: student.id,
      student_name: student.full_name || 'Unknown',
      parent_id: parent?.id || student.parent_id || null,
      parent_name: parent?.full_name || null,
      parent_phone: parent?.phone || null,
      parent_email: parent?.email || null,
      uniform_items: order?.items || [],
      total_amount: totalAmount,
      amount_paid: amountPaid,
      payment_status: paymentStatus,
      payment_date: fees.find((f: any) => f.paid_at)?.paid_at || null,
      payment_verified: fees.some((f: any) => f.payment_verified),
      proof_of_payment_url:
        fees.find((f: any) => f.proof_of_payment_url)?.proof_of_payment_url || null,
      filled_out: filledOut,
      filled_out_at: order?.created_at || (filledOut ? fees[0]?.created_at : null),
      notes: order?.notes || null,
      preschool_id: preschoolId,
    };
  });

  const summary: UniformRegisterSummary = {
    total_students: entries.length,
    forms_filled: entries.filter((e) => e.filled_out).length,
    forms_pending: entries.filter((e) => !e.filled_out).length,
    total_paid: entries.filter((e) => e.payment_status === 'paid').length,
    total_partial: entries.filter((e) => e.payment_status === 'partial').length,
    total_unpaid: entries.filter((e) => e.payment_status === 'unpaid').length,
    total_revenue: entries.reduce((s, e) => s + e.amount_paid, 0),
    total_outstanding: entries.reduce((s, e) => s + Math.max(0, e.total_amount - e.amount_paid), 0),
  };

  return { entries, summary };
}
