import { track } from '@/lib/analytics';
import type { ResolvedSchoolType } from '@/lib/schoolTypeResolver';

interface DashboardRouteResolutionPayload {
  userId?: string | null;
  role?: string | null;
  resolvedSchoolType?: ResolvedSchoolType | null;
  targetDashboard: string;
  source: string;
  organizationId?: string | null;
}

interface DashboardRouteMismatchPayload extends DashboardRouteResolutionPayload {
  currentPath?: string | null;
  reason?: string | null;
}

export function trackDashboardRouteResolution(payload: DashboardRouteResolutionPayload): void {
  track('edudash.dashboard.route_resolution', {
    user_id: payload.userId || null,
    role: payload.role || null,
    resolved_school_type: payload.resolvedSchoolType || null,
    target_dashboard: payload.targetDashboard,
    source: payload.source,
    organization_id: payload.organizationId || null,
  });
}

export function trackDashboardRouteMismatch(payload: DashboardRouteMismatchPayload): void {
  track('edudash.dashboard.route_mismatch', {
    user_id: payload.userId || null,
    role: payload.role || null,
    resolved_school_type: payload.resolvedSchoolType || null,
    current_path: payload.currentPath || null,
    target_dashboard: payload.targetDashboard,
    source: payload.source,
    organization_id: payload.organizationId || null,
    reason: payload.reason || 'route_family_mismatch',
  });
}
