/**
 * Dashboard Resolution Helper
 *
 * Determines the correct dashboard route for an authenticated user
 * based on their role, school type, and organisation membership.
 * Extracted from useRouteGuard to keep the hook under WARP limits.
 */

import {
  resolveExplicitSchoolTypeFromProfile,
  resolveOrganizationId,
  resolveSchoolTypeFromProfile,
} from '@/lib/schoolTypeResolver';
import { getDashboardRouteForRole, isDashboardRouteMismatch } from '@/lib/dashboard/routeMatrix';
import {
  trackDashboardRouteMismatch,
  trackDashboardRouteResolution,
} from '@/lib/dashboard/dashboardRoutingTelemetry';

import type { MutableRefObject } from 'react';
import type { User } from '@supabase/supabase-js';
import type { EnhancedUserProfile } from '@/lib/rbac/profile-utils';

import type { ResolvedSchoolType } from '@/lib/schoolTypeResolver';

interface DashboardInfo {
  targetDashboard: string;
  role: string | null;
  resolvedSchoolType: ResolvedSchoolType | null;
  hasOrganization: boolean;
}

/**
 * Resolve the target dashboard for an authenticated user.
 */
export function resolveDashboard(user: User, profile: EnhancedUserProfile | null): DashboardInfo {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const source = profile ?? meta;
  const role = (profile?.role || (meta.role as string) || null) as string | null;
  const resolvedSchoolType = resolveSchoolTypeFromProfile(source as any);
  const hasOrganization = Boolean(resolveOrganizationId(source as any));
  const normalizedRole = String(role || '').toLowerCase();

  let targetDashboard = getDashboardRouteForRole({
    role,
    resolvedSchoolType,
    hasOrganization,
  });

  if (!targetDashboard) {
    if (normalizedRole === 'super_admin' || normalizedRole === 'superadmin') {
      targetDashboard = '/screens/super-admin-dashboard';
    } else if (normalizedRole === 'admin') {
      const explicitSchoolType = resolveExplicitSchoolTypeFromProfile(source as any);
      targetDashboard = explicitSchoolType
        ? '/screens/admin-dashboard'
        : '/screens/org-admin-dashboard';
    } else {
      targetDashboard = '/screens/parent-dashboard';
    }
  }

  return { targetDashboard: String(targetDashboard), role, resolvedSchoolType, hasOrganization };
}

/**
 * Track dashboard route resolution for telemetry.
 */
export function trackResolution(
  user: User,
  info: DashboardInfo,
  source: string
): void {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const profile = meta; // fallback when profile unavailable
  trackDashboardRouteResolution({
    userId: user.id,
    role: info.role,
    resolvedSchoolType: info.resolvedSchoolType,
    targetDashboard: info.targetDashboard,
    source,
    organizationId: resolveOrganizationId(profile as any),
  });
}

/**
 * Check for dashboard family mismatches and report telemetry.
 */
export function checkDashboardMismatch(
  user: User,
  profile: EnhancedUserProfile,
  pathname: string,
  lastMismatchKey: MutableRefObject<string | null>
): void {
  const role = profile.role || ((user.user_metadata as any)?.role as string) || null;
  const resolvedSchoolType = resolveSchoolTypeFromProfile(profile);
  const expectedDashboard = getDashboardRouteForRole({
    role,
    resolvedSchoolType,
    hasOrganization: Boolean(resolveOrganizationId(profile)),
  });

  const isDashboardPath = pathname.includes('dashboard');
  if (isDashboardPath && expectedDashboard && isDashboardRouteMismatch(pathname, expectedDashboard)) {
    const mismatchKey = `${user.id}:${pathname}:${expectedDashboard}`;
    if (lastMismatchKey.current !== mismatchKey) {
      lastMismatchKey.current = mismatchKey;
      trackDashboardRouteMismatch({
        userId: user.id,
        role,
        resolvedSchoolType,
        currentPath: pathname,
        targetDashboard: expectedDashboard,
        source: 'useAuthGuard.passive-check',
        organizationId: resolveOrganizationId(profile),
        reason: 'dashboard_family_mismatch',
      });
    }
  } else if (!isDashboardRouteMismatch(pathname, expectedDashboard || pathname)) {
    lastMismatchKey.current = null;
  }
}

/**
 * Redirect school tenants away from org-admin route family.
 */
export function resolveSchoolGuardDashboard(
  profile: EnhancedUserProfile,
  user: User
): string | null {
  const explicitSchoolType = resolveExplicitSchoolTypeFromProfile(profile);
  if (!explicitSchoolType) return null;

  const role = profile.role || ((user.user_metadata as any)?.role as string) || null;
  const normalizedRole = String(role || '').toLowerCase().trim();
  const hasOrganization = Boolean(resolveOrganizationId(profile));

  if (normalizedRole === 'admin') {
    return '/screens/admin-dashboard';
  }

  return String(
    getDashboardRouteForRole({
      role,
      resolvedSchoolType: explicitSchoolType,
      hasOrganization,
    }) || '/screens/principal-dashboard'
  );
}
