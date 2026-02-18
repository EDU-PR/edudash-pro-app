/**
 * Unit tests for resolveDashboardFallback
 *
 * Validates that the shared Dash fallback resolver returns the correct
 * dashboard route for every role × school-type combination, preventing
 * drift between the BottomTabBar and Dash AI close buttons.
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { resolveDashboardFallback } from '@/lib/dashboard/resolveDashboardFallback';

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    role: 'parent',
    school_type: null,
    preschool_id: null,
    organization_id: null,
    ...overrides,
  };
}

describe('resolveDashboardFallback', () => {
  it('returns K12 parent dashboard for a K12 parent', () => {
    const profile = makeProfile({ role: 'parent', school_type: 'k12_school' });
    expect(resolveDashboardFallback(profile)).toBe('/(k12)/parent/dashboard');
  });

  it('returns standard parent dashboard for a preschool parent', () => {
    const profile = makeProfile({ role: 'parent', school_type: 'preschool' });
    expect(resolveDashboardFallback(profile)).toBe('/screens/parent-dashboard');
  });

  it('returns standard parent dashboard when school_type is null', () => {
    const profile = makeProfile({ role: 'parent', school_type: null });
    expect(resolveDashboardFallback(profile)).toBe('/screens/parent-dashboard');
  });

  it('returns teacher dashboard for teachers', () => {
    const profile = makeProfile({ role: 'teacher' });
    expect(resolveDashboardFallback(profile)).toBe('/screens/teacher-dashboard');
  });

  it('returns principal dashboard for principals', () => {
    const profile = makeProfile({ role: 'principal' });
    expect(resolveDashboardFallback(profile)).toBe('/screens/principal-dashboard');
  });

  it('returns super-admin dashboard for super_admin', () => {
    const profile = makeProfile({ role: 'super_admin' });
    expect(resolveDashboardFallback(profile)).toBe('/screens/super-admin-dashboard');
  });

  it('returns K12 student dashboard for K12 students with org', () => {
    const profile = makeProfile({
      role: 'student',
      school_type: 'k12_school',
      organization_id: 'org-123',
    });
    expect(resolveDashboardFallback(profile)).toBe('/(k12)/student/dashboard');
  });

  it('returns fallback "/" when role is empty', () => {
    const profile = makeProfile({ role: '' });
    expect(resolveDashboardFallback(profile)).toBe('/');
  });

  it('returns fallback "/" when profile is null', () => {
    expect(resolveDashboardFallback(null)).toBe('/');
  });

  it('never returns a hardcoded /screens/parent-dashboard for K12 parents', () => {
    const profile = makeProfile({ role: 'parent', school_type: 'k12_school' });
    const result = resolveDashboardFallback(profile);
    expect(result).not.toBe('/screens/parent-dashboard');
  });
});
