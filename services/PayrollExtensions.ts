/**
 * PayrollExtensions — Payment history, edit/void, and advance operations.
 *
 * Extracted from PayrollService to keep it under 500 lines (WARP).
 */

import { assertSupabase } from '@/lib/supabase';
import type { PayrollPaymentRecord, PayrollAdvanceRecord } from '@/types/finance';

const normalizeMonthIso = (value?: string): string => {
  const base = value ? new Date(value) : new Date();
  const date = Number.isNaN(base.getTime()) ? new Date() : base;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
};

const nextMonthIso = (monthIso: string): string => {
  const base = new Date(monthIso);
  const date = Number.isNaN(base.getTime()) ? new Date() : base;
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
};

const normalizeDateOnly = (value?: string): string => {
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const base = value ? new Date(value) : new Date();
  const date = Number.isNaN(base.getTime()) ? new Date() : base;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const coerceMoney = (value: number): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
};

// ── Payment History ─────────────────────────────────────────

export async function getPaymentHistory(
  recipientId: string,
  monthIso?: string,
): Promise<PayrollPaymentRecord[]> {
  const supabase = assertSupabase();
  let query = supabase
    .from('payroll_payments')
    .select('*')
    .eq('payroll_recipient_id', recipientId)
    .order('created_at', { ascending: false });

  if (monthIso) {
    const month = normalizeMonthIso(monthIso);
    query = query.gte('payment_month', month).lt('payment_month', nextMonthIso(month));
  }

  const { data, error } = await query.limit(50);
  if (error) {
    console.error('[PayrollService] getPaymentHistory failed:', error);
    throw new Error(error.message || 'Failed to load payment history');
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    payroll_recipient_id: row.payroll_recipient_id,
    organization_id: row.organization_id,
    amount: Number(row.amount || 0),
    payment_month: row.payment_month,
    payment_method: row.payment_method || 'bank_transfer',
    payment_reference: row.payment_reference || null,
    notes: row.notes || null,
    status: row.status || 'completed',
    original_amount: row.original_amount != null ? Number(row.original_amount) : null,
    edit_reason: row.edit_reason || null,
    edited_at: row.edited_at || null,
    voided_at: row.voided_at || null,
    void_reason: row.void_reason || null,
    recorded_by: row.recorded_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

// ── Edit Payment ────────────────────────────────────────────

export async function editPayment(params: {
  paymentId: string;
  newAmount: number;
  reason: string;
}): Promise<{ paymentId: string; originalAmount: number; newAmount: number }> {
  const supabase = assertSupabase();
  const { data, error } = await supabase.rpc('edit_payroll_payment', {
    p_payment_id: params.paymentId,
    p_new_amount: params.newAmount,
    p_reason: params.reason,
  });

  if (error) {
    console.error('[PayrollService] edit_payroll_payment failed:', error);
    throw new Error(error.message || 'Failed to edit payment');
  }
  if (!data?.success) throw new Error(data?.error || 'Failed to edit payment');

  return {
    paymentId: data.payment_id,
    originalAmount: Number(data.original_amount || 0),
    newAmount: Number(data.new_amount || 0),
  };
}

// ── Void Payment ───────────────────────────────────────────

export async function voidPayment(params: {
  paymentId: string;
  reason: string;
}): Promise<{ paymentId: string; voidedAmount: number }> {
  const supabase = assertSupabase();
  const { data, error } = await supabase.rpc('void_payroll_payment', {
    p_payment_id: params.paymentId,
    p_reason: params.reason,
  });

  if (error) {
    console.error('[PayrollService] void_payroll_payment failed:', error);
    throw new Error(error.message || 'Failed to void payment');
  }
  if (!data?.success) throw new Error(data?.error || 'Failed to void payment');

  return {
    paymentId: data.payment_id,
    voidedAmount: Number(data.voided_amount || 0),
  };
}

// ── Advances ───────────────────────────────────────────────

export async function getAdvances(
  recipientId: string,
  orgId: string,
): Promise<PayrollAdvanceRecord[]> {
  const supabase = assertSupabase();
  const { data, error } = await supabase
    .from('payroll_advances')
    .select('*')
    .eq('payroll_recipient_id', recipientId)
    .eq('organization_id', orgId)
    .order('advance_date', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[PayrollService] getAdvances failed:', error);
    throw new Error(error.message || 'Failed to load advances');
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    payroll_recipient_id: row.payroll_recipient_id,
    organization_id: row.organization_id,
    amount: Number(row.amount || 0),
    advance_date: row.advance_date,
    reason: row.reason || null,
    repayment_month: row.repayment_month || null,
    repaid: Boolean(row.repaid),
    repaid_at: row.repaid_at || null,
    repaid_amount: row.repaid_amount != null ? Number(row.repaid_amount) : null,
    recorded_by: row.recorded_by || null,
    notes: row.notes || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function recordAdvance(params: {
  payrollRecipientId: string;
  organizationId: string;
  amount: number;
  reason: string;
  repaymentMonth?: string;
  notes?: string;
}): Promise<{ id: string }> {
  const supabase = assertSupabase();
  if (coerceMoney(params.amount) <= 0) {
    throw new Error('Advance amount must be greater than zero');
  }

  const { data, error } = await supabase
    .from('payroll_advances')
    .insert({
      payroll_recipient_id: params.payrollRecipientId,
      organization_id: params.organizationId,
      amount: coerceMoney(params.amount),
      advance_date: normalizeDateOnly(),
      reason: params.reason.trim() || null,
      repayment_month: params.repaymentMonth ? normalizeMonthIso(params.repaymentMonth) : null,
      notes: params.notes?.trim() || null,
      recorded_by: (await supabase.auth.getUser()).data?.user?.id || null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[PayrollService] recordAdvance failed:', error);
    throw new Error(error.message || 'Failed to record advance');
  }

  return { id: String(data?.id || '') };
}

export async function markAdvanceRepaid(advanceId: string, amount?: number): Promise<void> {
  const supabase = assertSupabase();
  const updatePayload: Record<string, any> = {
    repaid: true,
    repaid_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (amount != null && Number.isFinite(amount)) {
    updatePayload.repaid_amount = coerceMoney(amount);
  }

  const { error } = await supabase.from('payroll_advances').update(updatePayload).eq('id', advanceId);
  if (error) {
    console.error('[PayrollService] markAdvanceRepaid failed:', error);
    throw new Error(error.message || 'Failed to mark advance as repaid');
  }
}
