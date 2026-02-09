/**
 * Tests for lib/queryKeys/teacherDashboard.ts — React Query key factory
 */

import { teacherDashboardKeys } from '../teacherDashboard';

describe('teacherDashboardKeys', () => {
  const userId = 'user-123';
  const schoolId = 'school-456';

  it('all is a stable root key array', () => {
    const key = teacherDashboardKeys.all;
    expect(Array.isArray(key)).toBe(true);
    expect(key).toContain('teacher-dashboard');
    expect(key).toHaveLength(1);
  });

  it('profile() extends all', () => {
    const all = teacherDashboardKeys.all;
    const profile = teacherDashboardKeys.profile(userId);
    expect(profile.length).toBeGreaterThan(all.length);
    expect(profile.slice(0, all.length)).toEqual([...all]);
    expect(profile).toContain(userId);
  });

  it('school() extends all and contains schoolId', () => {
    const school = teacherDashboardKeys.school(schoolId);
    expect(school).toContain(schoolId);
    expect(school).toContain('teacher-dashboard');
  });

  it('dashboard() contains userId', () => {
    const dashboard = teacherDashboardKeys.dashboard(userId);
    expect(dashboard).toContain(userId);
    expect(dashboard).toContain('composed');
  });

  it('keys are deterministic — same input produces same output', () => {
    const a = teacherDashboardKeys.classes(userId, schoolId);
    const b = teacherDashboardKeys.classes(userId, schoolId);
    expect(a).toEqual(b);
  });

  it('different users produce different profile keys', () => {
    const a = teacherDashboardKeys.profile('user-a');
    const b = teacherDashboardKeys.profile('user-b');
    expect(a).not.toEqual(b);
  });
});
