import { assertSupabase } from '@/lib/supabase';

export type FeeCorrectionAuditAction =
  | 'waive'
  | 'adjust'
  | 'delete'
  | 'mark_paid'
  | 'mark_unpaid'
  | 'change_class'
  | 'tuition_sync'
  | 'registration_paid'
  | 'registration_unpaid'
  | 'recompute_balances';

export interface FeeCorrectionAuditInput {
  organizationId?: string | null;
  studentId: string;
  studentFeeId?: string | null;
  action: FeeCorrectionAuditAction;
  reason: string;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
  actorRole?: string | null;
  sourceScreen?: string;
}

export const writeFeeCorrectionAudit = async (
  input: FeeCorrectionAuditInput,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const organizationId = String(input.organizationId || '').trim();
    if (!organizationId) {
      return { ok: false, error: 'missing_organization_id' };
    }
    const reason = String(input.reason || '').trim();
    if (!reason) {
      return { ok: false, error: 'missing_reason' };
    }
    const supabase = assertSupabase();
    const { error } = await supabase.from('fee_corrections_audit').insert({
      organization_id: organizationId,
      student_id: input.studentId,
      student_fee_id: input.studentFeeId || null,
      action: input.action,
      reason,
      before_snapshot: input.beforeSnapshot || {},
      after_snapshot: input.afterSnapshot || {},
      metadata: input.metadata || {},
      created_by: input.actorId || null,
      created_by_role: input.actorRole || null,
      source_screen: input.sourceScreen || null,
    });
    if (error) {
      return { ok: false, error: error.message || 'insert_failed' };
    }
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'unknown_error' };
  }
};
