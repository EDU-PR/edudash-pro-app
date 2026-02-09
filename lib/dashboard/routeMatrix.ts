import type { ResolvedSchoolType } from '@/lib/schoolTypeResolver';

export type DashboardRole =
  | 'parent'
  | 'teacher'
  | 'principal'
  | 'principal_admin'
  | 'student'
  | 'learner';

export type DashboardFamilyRoute =
  | '/screens/parent-dashboard'
  | '/(k12)/parent/dashboard'
  | '/screens/teacher-dashboard'
  | '/screens/principal-dashboard'
  | '/screens/learner-dashboard'
  | '/(k12)/student/dashboard'
  | '/screens/student-dashboard'
  | '/screens/super-admin-dashboard'
  | '/screens/org-admin-dashboard';

interface ResolveDashboardRouteOptions {
  role: string | null | undefined;
  resolvedSchoolType: ResolvedSchoolType;
  hasOrganization?: boolean;
}

function normalizeDashboardRole(role: string | null | undefined): DashboardRole | null {
  const normalized = String(role || '').toLowerCase().trim();
  if (!normalized) return null;
  if (normalized === 'parent') return 'parent';
  if (normalized === 'teacher') return 'teacher';
  if (normalized === 'principal' || normalized === 'principal_admin') return 'principal_admin';
  if (normalized === 'student' || normalized === 'learner') return 'student';
  return null;
}

export function getDashboardRouteForRole(options: ResolveDashboardRouteOptions): DashboardFamilyRoute | null {
  const role = normalizeDashboardRole(options.role);
  if (!role) return null;

  const isK12School = options.resolvedSchoolType === 'k12_school';
  const hasOrganization = options.hasOrganization !== false;

  if (role === 'parent') {
    return isK12School ? '/(k12)/parent/dashboard' : '/screens/parent-dashboard';
  }

  if (role === 'teacher') {
    return '/screens/teacher-dashboard';
  }

  if (role === 'principal' || role === 'principal_admin') {
    return '/screens/principal-dashboard';
  }

  if (role === 'student' || role === 'learner') {
    if (!hasOrganization) return '/screens/student-dashboard';
    return isK12School ? '/(k12)/student/dashboard' : '/screens/learner-dashboard';
  }

  return null;
}

export function isDashboardRouteMismatch(
  currentPath: string | null | undefined,
  expectedPath: string | null | undefined
): boolean {
  if (!currentPath || !expectedPath) return false;
  if (currentPath === expectedPath) return false;
  return !currentPath.startsWith(`${expectedPath}/`);
}
