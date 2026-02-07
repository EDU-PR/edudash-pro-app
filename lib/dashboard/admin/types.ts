export type AdminOrgTypeV1 = 'preschool' | 'k12_school';

export type AdminWorkflowLane = 'hiring' | 'admissions' | 'finance_ops';

export type AdminTaskCategory =
  | 'hiring'
  | 'admissions'
  | 'finance'
  | 'operations'
  | 'communications';

export type AdminTaskPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface AdminTaskDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  category: AdminTaskCategory;
  priority?: AdminTaskPriority;
  badgeKey?: keyof AdminOperationalCounters;
}

export interface AdminTaskPack {
  version: string;
  orgType: AdminOrgTypeV1;
  title: string;
  subtitle: string;
  laneRoutes: Record<AdminWorkflowLane, string>;
  tasks: AdminTaskDefinition[];
}

export interface AdminTaskPackOverrides {
  hiddenTaskIds?: string[];
  taskOrder?: string[];
  customTaskLabels?: Record<string, string>;
  customTaskRoutes?: Record<string, string>;
  laneRouteOverrides?: Partial<Record<AdminWorkflowLane, string>>;
}

export interface AdminTaskPackResolution {
  source: 'default' | 'organization_override';
  orgType: AdminOrgTypeV1 | null;
  supported: boolean;
  pack: AdminTaskPack | null;
  overridesApplied: boolean;
}

export interface AdminOperationalCounters {
  urgent: number;
  awaiting_principal: number;
  pending_hiring: number;
  pending_admissions: number;
  pending_finance: number;
  pending_ops: number;
  total_pending: number;
}

export interface AdminInboxItem {
  id: string;
  request_id?: string;
  title: string;
  subtitle: string;
  request_type?: string;
  screening_status?: string;
  priority: AdminTaskPriority;
  urgent?: boolean;
  created_at: string;
}

export interface AdminWorkflowItem {
  id: string;
  request_id: string;
  lane: AdminWorkflowLane;
  request_type: string;
  title: string;
  subtitle: string;
  status: string;
  screening_status: string;
  principal_decision_required: boolean;
  requested_role?: string | null;
  created_at: string;
  aging_hours?: number;
  urgent?: boolean;
}

export interface AdminActivityItem {
  id: string;
  request_id?: string;
  action: 'request_created' | 'screened' | 'principal_decision' | string;
  request_type?: string;
  summary: string;
  by: string;
  timestamp: string;
}

export interface AdminDashboardBundle {
  org_id: string;
  org_name: string;
  org_type: string;
  platform: string;
  generated_at: string;
  task_pack_version?: string;
  overrides?: AdminTaskPackOverrides;
  counters: AdminOperationalCounters;
  workflows: Record<AdminWorkflowLane, AdminWorkflowItem[]>;
  inbox: AdminInboxItem[];
  escalations: AdminWorkflowItem[];
  activity: AdminActivityItem[];
}

export interface ScreeningActionPayload {
  requestId: string;
  screeningStatus: 'recommended' | 'hold' | 'reject_recommended' | 'not_screened';
  notes?: string;
  checklist?: Record<string, unknown>;
}

export const EMPTY_ADMIN_COUNTERS: AdminOperationalCounters = {
  urgent: 0,
  awaiting_principal: 0,
  pending_hiring: 0,
  pending_admissions: 0,
  pending_finance: 0,
  pending_ops: 0,
  total_pending: 0,
};
