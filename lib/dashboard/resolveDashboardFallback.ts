/**
 * Shared dashboard fallback resolver for Dash AI screens.
 *
 * When the Dash assistant / tutor closes and there is no back-stack,
 * this helper returns the correct dashboard route for the current user
 * using the same `getDashboardRouteForRole` function that the bottom-tab
 * bar relies on — eliminating hardcoded role→route switches.
 */

import { normalizeRole } from '@/lib/rbac';
import {
  resolveSchoolTypeFromProfile,
  resolveOrganizationId,
} from '@/lib/schoolTypeResolver';
import { getDashboardRouteForRole } from '@/lib/dashboard/routeMatrix';

/**
 * Resolves the correct dashboard fallback path for the given profile.
 *
 * Falls back to `'/'` only when the role is completely unrecognised.
 */
export function resolveDashboardFallback(profile: any): string {
  const role = normalizeRole(String(profile?.role || ''));

  // Super-admin is not handled by routeMatrix — handle explicitly.
  if (role === 'super_admin') return '/screens/super-admin-dashboard';

  const resolvedSchoolType = resolveSchoolTypeFromProfile(profile);
  const hasOrganization = Boolean(resolveOrganizationId(profile));

  const route = getDashboardRouteForRole({
    role,
    resolvedSchoolType,
    hasOrganization,
    traceContext: 'resolveDashboardFallback',
  });

  return route ?? '/';
}
