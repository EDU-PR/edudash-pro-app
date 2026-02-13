import { assertSupabase } from '@/lib/supabase';
import type { AttendanceLifecyclePolicy } from '@/lib/services/SchoolSettingsService';
import { DEFAULT_SCHOOL_SETTINGS } from '@/lib/services/SchoolSettingsService';

export type StudentInactivityCaseState = 'at_risk' | 'resolved' | 'inactive' | 'dismissed';
export type StudentInactivityAction = 'contacted' | 'extend_grace' | 'keep_active' | 'dismiss' | 'force_inactivate';

export interface StudentInactivityCase {
  id: string;
  preschool_id: string;
  student_id: string;
  case_state: StudentInactivityCaseState;
  trigger_absence_days: number;
  trigger_absence_streak: number;
  streak_started_on: string | null;
  last_absent_date: string | null;
  last_present_date: string | null;
  warning_sent_at: string | null;
  warning_deadline_at: string | null;
  auto_inactivated_at: string | null;
  principal_action: string;
  principal_action_at: string | null;
  principal_action_notes: string | null;
  parent_response: string;
  parent_response_at: string | null;
  parent_response_notes: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  closed_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  student?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    class_id: string | null;
    parent_id: string | null;
    guardian_id: string | null;
    status: string | null;
    is_active: boolean | null;
    class_name?: string | null;
  };
}

export interface LearnerLifecycleSummary {
  atRiskCases: StudentInactivityCase[];
  dueTodayCases: StudentInactivityCase[];
  recentlyInactivatedCases: StudentInactivityCase[];
  mismatchCount: number;
  duplicateGroupCount: number;
  lastReportDate: string | null;
}

const DEFAULT_POLICY: AttendanceLifecyclePolicy = DEFAULT_SCHOOL_SETTINGS.attendanceLifecycle;

function mergePolicy(input: Partial<AttendanceLifecyclePolicy> | null | undefined): AttendanceLifecyclePolicy {
  const notify = (input?.notify_channels || {}) as Partial<AttendanceLifecyclePolicy['notify_channels']>;
  return {
    enabled: input?.enabled ?? DEFAULT_POLICY.enabled,
    trigger_absent_days: Math.max(1, Number(input?.trigger_absent_days ?? DEFAULT_POLICY.trigger_absent_days)),
    grace_days: Math.max(1, Number(input?.grace_days ?? DEFAULT_POLICY.grace_days)),
    require_principal_approval:
      input?.require_principal_approval ?? DEFAULT_POLICY.require_principal_approval,
    billing_behavior: input?.billing_behavior || DEFAULT_POLICY.billing_behavior,
    auto_unassign_class_on_inactive:
      input?.auto_unassign_class_on_inactive ?? DEFAULT_POLICY.auto_unassign_class_on_inactive,
    notify_channels: {
      push: notify.push ?? DEFAULT_POLICY.notify_channels.push,
      email: notify.email ?? DEFAULT_POLICY.notify_channels.email,
      sms: notify.sms ?? DEFAULT_POLICY.notify_channels.sms,
      whatsapp: notify.whatsapp ?? DEFAULT_POLICY.notify_channels.whatsapp,
    },
  };
}

function toIsoDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function mapCase(row: any): StudentInactivityCase {
  const student = row?.students || null;
  return {
    id: row.id,
    preschool_id: row.preschool_id,
    student_id: row.student_id,
    case_state: row.case_state,
    trigger_absence_days: Number(row.trigger_absence_days || 0),
    trigger_absence_streak: Number(row.trigger_absence_streak || 0),
    streak_started_on: row.streak_started_on || null,
    last_absent_date: row.last_absent_date || null,
    last_present_date: row.last_present_date || null,
    warning_sent_at: row.warning_sent_at || null,
    warning_deadline_at: row.warning_deadline_at || null,
    auto_inactivated_at: row.auto_inactivated_at || null,
    principal_action: row.principal_action || 'none',
    principal_action_at: row.principal_action_at || null,
    principal_action_notes: row.principal_action_notes || null,
    parent_response: row.parent_response || 'none',
    parent_response_at: row.parent_response_at || null,
    parent_response_notes: row.parent_response_notes || null,
    resolved_at: row.resolved_at || null,
    closed_at: row.closed_at || null,
    closed_reason: row.closed_reason || null,
    metadata: row.metadata || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
    student: student
      ? {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          class_id: student.class_id,
          parent_id: student.parent_id,
          guardian_id: student.guardian_id,
          status: student.status,
          is_active: student.is_active,
          class_name: student.classes?.name || null,
        }
      : undefined,
  };
}

export class LearnerLifecycleService {
  static async getPolicy(schoolId: string): Promise<AttendanceLifecyclePolicy> {
    const supabase = assertSupabase() as any;

    const { data, error } = await supabase.rpc('get_attendance_lifecycle_policy', {
      p_preschool_id: schoolId,
    });

    if (error) {
      throw error;
    }

    return mergePolicy(data as Partial<AttendanceLifecyclePolicy>);
  }

  static async updatePolicy(
    schoolId: string,
    patch: Partial<AttendanceLifecyclePolicy>
  ): Promise<AttendanceLifecyclePolicy> {
    const current = await this.getPolicy(schoolId);
    const next = mergePolicy({ ...current, ...patch, notify_channels: { ...current.notify_channels, ...(patch.notify_channels || {}) } });

    const supabase = assertSupabase() as any;
    const { error } = await supabase.rpc('update_school_settings', {
      p_preschool_id: schoolId,
      p_patch: {
        attendanceLifecycle: next,
      },
    });

    if (error) {
      throw error;
    }

    return next;
  }

  static async listCases(
    schoolId: string,
    params?: { states?: StudentInactivityCaseState[]; limit?: number }
  ): Promise<StudentInactivityCase[]> {
    const supabase = assertSupabase() as any;
    let query = supabase
      .from('student_inactivity_cases')
      .select(`
        id,
        preschool_id,
        student_id,
        case_state,
        trigger_absence_days,
        trigger_absence_streak,
        streak_started_on,
        last_absent_date,
        last_present_date,
        warning_sent_at,
        warning_deadline_at,
        auto_inactivated_at,
        principal_action,
        principal_action_at,
        principal_action_notes,
        parent_response,
        parent_response_at,
        parent_response_notes,
        resolved_at,
        closed_at,
        closed_reason,
        metadata,
        created_at,
        updated_at,
        students:student_id(
          id,
          first_name,
          last_name,
          class_id,
          parent_id,
          guardian_id,
          status,
          is_active,
          classes(name)
        )
      `)
      .eq('preschool_id', schoolId)
      .order('updated_at', { ascending: false })
      .limit(params?.limit ?? 150);

    if (params?.states?.length) {
      query = query.in('case_state', params.states);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return ((data || []) as any[]).map(mapCase);
  }

  static async getSummary(schoolId: string): Promise<LearnerLifecycleSummary> {
    const supabase = assertSupabase() as any;
    const cases = await this.listCases(schoolId, { limit: 200 });

    const today = new Date().toISOString().slice(0, 10);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const atRiskCases = cases.filter((item) => item.case_state === 'at_risk');
    const dueTodayCases = atRiskCases.filter((item) => {
      const deadline = toIsoDate(item.warning_deadline_at);
      return Boolean(deadline && deadline <= today);
    });
    const recentlyInactivatedCases = cases.filter((item) => {
      if (item.case_state !== 'inactive') return false;
      const eventAt = item.auto_inactivated_at || item.closed_at;
      if (!eventAt) return false;
      const parsed = new Date(eventAt);
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed.toISOString() >= fourteenDaysAgo;
    });

    const { data: report } = await supabase
      .from('student_data_quality_daily_reports')
      .select('report_date, mismatch_count, duplicate_group_count')
      .eq('preschool_id', schoolId)
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      atRiskCases,
      dueTodayCases,
      recentlyInactivatedCases,
      mismatchCount: Number(report?.mismatch_count || 0),
      duplicateGroupCount: Number(report?.duplicate_group_count || 0),
      lastReportDate: report?.report_date || null,
    };
  }

  static async applyAction(
    caseId: string,
    action: StudentInactivityAction,
    opts?: { notes?: string; extendDays?: number }
  ): Promise<StudentInactivityCase> {
    const supabase = assertSupabase() as any;
    const { data, error } = await supabase.rpc('apply_student_inactivity_action', {
      p_case_id: caseId,
      p_action: action,
      p_notes: opts?.notes || null,
      p_extend_days: opts?.extendDays || null,
    });

    if (error) {
      throw error;
    }

    return mapCase(data);
  }

  static async runMonitorNow(schoolId?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const supabase = assertSupabase();
    const { data, error } = await supabase.functions.invoke('student-activity-monitor', {
      body: {
        ...(schoolId ? { preschool_id: schoolId } : {}),
        source: 'manual',
        run_now: true,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  }

  static async notifyAtRiskParents(
    schoolId: string,
    cases: StudentInactivityCase[]
  ): Promise<{ sentTo: number }> {
    const userIds = Array.from(
      new Set(
        cases
          .map((item) => item.student?.parent_id || item.student?.guardian_id)
          .filter(Boolean) as string[]
      )
    );

    if (userIds.length === 0) {
      return { sentTo: 0 };
    }

    const supabase = assertSupabase();
    const { error } = await supabase.functions.invoke('notifications-dispatcher', {
      body: {
        event_type: 'student_inactivity_warning',
        preschool_id: schoolId,
        user_ids: userIds,
        context: {
          student_name: 'Learner',
          absence_streak: null,
          trigger_absence_days: null,
          grace_days: null,
          source: 'bulk_at_risk_broadcast',
        },
        send_immediately: true,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to notify at-risk parents');
    }

    return { sentTo: userIds.length };
  }
}

export default LearnerLifecycleService;
