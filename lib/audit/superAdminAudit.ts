import { logger } from '@/lib/logger';
import { assertSupabase } from '@/lib/supabase';

type SuperAdminAuditEvent = {
  actorProfileId?: string | null;
  action: string;
  targetId?: string | null;
  targetType?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  success?: boolean;
  errorMessage?: string | null;
};

function humanizeAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function writeSuperAdminAudit(event: SuperAdminAuditEvent): Promise<void> {
  try {
    const occurredAt = new Date().toISOString();
    const targetId = event.targetId || null;
    const targetType = event.targetType || (targetId ? 'user' : null);

    const { error } = await assertSupabase().from('audit_logs').insert({
      action: event.action,
      event_type: 'admin_action' as any,
      event_name: event.action,
      event_description: event.description || humanizeAction(event.action),
      actor_id: event.actorProfileId || null,
      actor_role: 'super_admin',
      target_id: targetId,
      target_type: targetType,
      resource_id: targetId,
      resource_type: targetType,
      metadata: event.metadata || {},
      success: event.success ?? true,
      error_message: event.errorMessage || null,
      occurred_at: occurredAt,
    } as any);

    if (error) {
      logger.error('[SuperAdminAudit] Failed to write audit log:', error);
    }
  } catch (error) {
    logger.error('[SuperAdminAudit] Unexpected audit logging error:', error);
  }
}

