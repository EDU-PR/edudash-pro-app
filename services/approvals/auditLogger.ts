import { supabase } from '../../lib/supabase';
import type { ApprovalActionParams } from './types';

const FALLBACK_EVENT_TYPE = 'admin_action';

export async function writeApprovalAuditLog(params: ApprovalActionParams): Promise<void> {
  const actionName = `approval_${params.action}`;
  const metadata = {
    source: 'approval_workflow',
    entity_type: params.entityType,
    action: params.action,
    previous_status: params.previousStatus,
    new_status: params.newStatus,
    performer_name: params.performerName,
    performer_role: params.performerRole,
    notes: params.notes || null,
    reason: params.reason || null,
  };

  try {
    const { error: rpcError } = await supabase.rpc('create_audit_log', {
      p_event_type: FALLBACK_EVENT_TYPE as any,
      p_event_name: actionName,
      p_actor_id: params.performedBy,
      p_target_id: params.entityId,
      p_target_type: params.entityType,
      p_metadata: metadata as any,
      p_success: true,
    });

    if (!rpcError) return;

    const nowIso = new Date().toISOString();
    const { error: insertError } = await supabase.from('audit_logs').insert({
      action: actionName,
      event_type: FALLBACK_EVENT_TYPE as any,
      event_name: actionName,
      event_description: `${params.entityType} ${params.action}`,
      actor_id: params.performedBy,
      actor_role: params.performerRole || null,
      actor_organization_id: params.preschoolId || null,
      target_id: params.entityId,
      target_type: params.entityType,
      resource_id: params.entityId,
      resource_type: params.entityType,
      changes_made: {
        previous_status: params.previousStatus,
        new_status: params.newStatus,
        notes: params.notes || null,
        reason: params.reason || null,
      } as any,
      metadata: { ...metadata, fallback: 'audit_logs_insert' } as any,
      occurred_at: nowIso,
      success: true,
    });

    if (insertError) {
      console.error('Error writing approval audit log fallback:', insertError);
    }
  } catch (error) {
    console.error('Error writing approval audit log:', error);
  }
}
