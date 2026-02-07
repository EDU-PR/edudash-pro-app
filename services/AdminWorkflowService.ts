import { assertSupabase } from '@/lib/supabase';
import type {
  AdminActivityItem,
  AdminDashboardBundle,
  AdminInboxItem,
  AdminOperationalCounters,
  AdminOrgTypeV1,
  AdminWorkflowItem,
  ScreeningActionPayload,
} from '@/lib/dashboard/admin/types';
import { EMPTY_ADMIN_COUNTERS } from '@/lib/dashboard/admin/types';

type JsonRecord = Record<string, any>;

function firstObject(data: unknown): JsonRecord | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === 'object' ? (first as JsonRecord) : null;
  }
  return typeof data === 'object' ? (data as JsonRecord) : null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeCounters(value: unknown): AdminOperationalCounters {
  const raw = (value as JsonRecord) || {};
  return {
    urgent: toNumber(raw.urgent),
    awaiting_principal: toNumber(raw.awaiting_principal),
    pending_hiring: toNumber(raw.pending_hiring),
    pending_admissions: toNumber(raw.pending_admissions),
    pending_finance: toNumber(raw.pending_finance),
    pending_ops: toNumber(raw.pending_ops),
    total_pending: toNumber(raw.total_pending),
  };
}

function normalizeInbox(value: unknown): AdminInboxItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item: any) => ({
    id: String(item?.id || item?.request_id || ''),
    request_id: item?.request_id ? String(item.request_id) : undefined,
    title: String(item?.title || 'Inbox Item'),
    subtitle: String(item?.subtitle || ''),
    request_type: item?.request_type ? String(item.request_type) : undefined,
    screening_status: item?.screening_status ? String(item.screening_status) : undefined,
    priority: item?.priority || 'normal',
    urgent: !!item?.urgent,
    created_at: item?.created_at || new Date().toISOString(),
  }));
}

function normalizeWorkflowItems(value: unknown, fallbackLane: 'hiring' | 'admissions' | 'finance_ops'): AdminWorkflowItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item: any) => ({
    id: String(item?.id || item?.request_id || ''),
    request_id: String(item?.request_id || item?.id || ''),
    lane: item?.lane || fallbackLane,
    request_type: String(item?.request_type || ''),
    title: String(item?.title || 'Workflow item'),
    subtitle: String(item?.subtitle || ''),
    status: String(item?.status || 'pending'),
    screening_status: String(item?.screening_status || 'not_screened'),
    principal_decision_required: !!item?.principal_decision_required,
    requested_role: item?.requested_role ? String(item.requested_role) : null,
    created_at: item?.created_at || new Date().toISOString(),
    aging_hours: toNumber(item?.aging_hours),
    urgent: !!item?.urgent,
  }));
}

function normalizeActivity(value: unknown): AdminActivityItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item: any) => ({
    id: String(item?.id || ''),
    request_id: item?.request_id ? String(item.request_id) : undefined,
    action: String(item?.action || 'request_created'),
    request_type: item?.request_type ? String(item.request_type) : undefined,
    summary: String(item?.summary || ''),
    by: String(item?.by || 'System'),
    timestamp: item?.timestamp || new Date().toISOString(),
  }));
}

function parseBundle(raw: JsonRecord, fallbackOrg: { orgId: string; orgType: string }): AdminDashboardBundle {
  const workflows = (raw.workflows || {}) as JsonRecord;
  const now = new Date().toISOString();

  return {
    org_id: String(raw.org_id || fallbackOrg.orgId),
    org_name: String(raw.org_name || 'Organization'),
    org_type: String(raw.org_type || fallbackOrg.orgType),
    platform: String(raw.platform || 'mobile'),
    generated_at: String(raw.generated_at || now),
    task_pack_version: raw.task_pack_version ? String(raw.task_pack_version) : undefined,
    overrides: (raw.overrides || {}) as any,
    counters: normalizeCounters(raw.counters || EMPTY_ADMIN_COUNTERS),
    workflows: {
      hiring: normalizeWorkflowItems(workflows.hiring, 'hiring'),
      admissions: normalizeWorkflowItems(workflows.admissions, 'admissions'),
      finance_ops: normalizeWorkflowItems(workflows.finance_ops, 'finance_ops'),
    },
    inbox: normalizeInbox(raw.inbox),
    escalations: normalizeWorkflowItems(raw.escalations, 'hiring'),
    activity: normalizeActivity(raw.activity),
  };
}

export class AdminWorkflowService {
  static async screenRequest(payload: ScreeningActionPayload): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await assertSupabase().rpc('screen_join_request', {
        p_request_id: payload.requestId,
        p_screening_status: payload.screeningStatus,
        p_notes: payload.notes || null,
        p_checklist: payload.checklist || {},
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const response = firstObject(data);
      if (!response || response.success !== true) {
        return { success: false, error: String(response?.error || 'Screening failed') };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Screening failed' };
    }
  }

  static async getDashboardBundle(
    orgId: string,
    orgType: AdminOrgTypeV1,
    platform = 'mobile'
  ): Promise<AdminDashboardBundle> {
    const supabase = assertSupabase();

    const { data, error } = await supabase.rpc('get_admin_dashboard_bundle', {
      p_org_id: orgId,
      p_org_type: orgType,
      p_platform: platform,
    });

    if (!error) {
      const payload = firstObject(data);
      if (payload?.success === true) {
        return parseBundle(payload, { orgId, orgType });
      }
    }

    const queueFallback = await this.getWorkQueue(orgId, orgType);
    if (queueFallback.success && queueFallback.bundle) {
      return queueFallback.bundle;
    }

    throw new Error(queueFallback.error || error?.message || 'Failed to load admin dashboard bundle');
  }

  static async getWorkQueue(
    orgId: string,
    orgType: AdminOrgTypeV1
  ): Promise<{ success: boolean; bundle?: AdminDashboardBundle; error?: string }> {
    try {
      const { data, error } = await assertSupabase().rpc('list_admin_work_queue', {
        p_org_id: orgId,
        p_org_type: orgType,
      });

      if (error) return { success: false, error: error.message };

      const payload = firstObject(data);
      if (!payload || payload.success !== true) {
        return { success: false, error: String(payload?.error || 'Invalid work queue payload') };
      }

      const bundle = parseBundle(
        {
          ...payload,
          org_name: payload.org_name || 'Organization',
          platform: 'mobile',
        },
        { orgId, orgType }
      );

      return { success: true, bundle };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to load work queue' };
    }
  }
}
