import {
  getDashboardRouteForRole,
  isDashboardRouteMismatch,
} from '@/lib/dashboard/routeMatrix';

describe('routeMatrix', () => {
  it('routes parent dashboard by school type', () => {
    expect(
      getDashboardRouteForRole({
        role: 'parent',
        resolvedSchoolType: 'preschool',
        hasOrganization: true,
      })
    ).toBe('/screens/parent-dashboard');

    expect(
      getDashboardRouteForRole({
        role: 'parent',
        resolvedSchoolType: 'k12_school',
        hasOrganization: true,
      })
    ).toBe('/(k12)/parent/dashboard');
  });

  it('keeps teacher and principal routes stable across school types', () => {
    expect(
      getDashboardRouteForRole({
        role: 'teacher',
        resolvedSchoolType: 'preschool',
        hasOrganization: true,
      })
    ).toBe('/screens/teacher-dashboard');
    expect(
      getDashboardRouteForRole({
        role: 'teacher',
        resolvedSchoolType: 'k12_school',
        hasOrganization: true,
      })
    ).toBe('/screens/teacher-dashboard');

    expect(
      getDashboardRouteForRole({
        role: 'principal_admin',
        resolvedSchoolType: 'preschool',
        hasOrganization: true,
      })
    ).toBe('/screens/principal-dashboard');
    expect(
      getDashboardRouteForRole({
        role: 'principal_admin',
        resolvedSchoolType: 'k12_school',
        hasOrganization: true,
      })
    ).toBe('/screens/principal-dashboard');
  });

  it('routes students to learner or k12 dashboards when linked to a school', () => {
    expect(
      getDashboardRouteForRole({
        role: 'student',
        resolvedSchoolType: 'preschool',
        hasOrganization: true,
      })
    ).toBe('/screens/learner-dashboard');
    expect(
      getDashboardRouteForRole({
        role: 'student',
        resolvedSchoolType: 'k12_school',
        hasOrganization: true,
      })
    ).toBe('/(k12)/student/dashboard');
  });

  it('routes standalone students to student dashboard', () => {
    expect(
      getDashboardRouteForRole({
        role: 'student',
        resolvedSchoolType: 'preschool',
        hasOrganization: false,
      })
    ).toBe('/screens/student-dashboard');
  });

  it('routes admins to school admin dashboard only when school type is explicit', () => {
    expect(
      getDashboardRouteForRole({
        role: 'admin',
        resolvedSchoolType: 'preschool',
        hasOrganization: true,
      })
    ).toBe('/screens/admin-dashboard');

    expect(
      getDashboardRouteForRole({
        role: 'admin',
        resolvedSchoolType: 'k12_school',
        hasOrganization: true,
      })
    ).toBe('/screens/admin-dashboard');

    expect(
      getDashboardRouteForRole({
        role: 'admin',
        resolvedSchoolType: null,
        hasOrganization: true,
      })
    ).toBe('/screens/org-admin-dashboard');
  });

  it('detects mismatches between current and expected dashboard families', () => {
    expect(isDashboardRouteMismatch('/screens/parent-dashboard', '/(k12)/parent/dashboard')).toBe(true);
    expect(isDashboardRouteMismatch('/screens/parent-dashboard', '/screens/parent-dashboard')).toBe(false);
    expect(isDashboardRouteMismatch('/screens/parent-dashboard/sub', '/screens/parent-dashboard')).toBe(false);
  });
});
