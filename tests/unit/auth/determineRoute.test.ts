/**
 * Tests for lib/auth/determineRoute.ts
 *
 * Validates every routing branch:
 *   - Pending membership
 *   - SOA member types (CEO, youth wing, women's wing, veterans, regional)
 *   - School admin bypass
 *   - Null role → /profiles-gate
 *   - Independent users
 *   - Role-based routing (super_admin, admin, principal_admin, teacher, parent, student)
 *   - Default fallback
 */

// Mock dependencies before any imports
jest.mock('@/lib/schoolTypeResolver', () => ({
  resolveSchoolTypeFromProfile: jest.fn(() => 'preschool'),
}));
jest.mock('@/lib/dashboard/routeMatrix', () => ({
  getDashboardRouteForRole: jest.fn(({ role }: { role: string }) => {
    const map: Record<string, string> = {
      principal_admin: '/screens/principal-dashboard',
      teacher: '/screens/teacher-dashboard',
      parent: '/screens/parent-dashboard',
      student: '/screens/learner-dashboard',
    };
    return map[role] ?? null;
  }),
}));
jest.mock('@/lib/auth/roleResolution', () => ({
  normalizeRole: jest.fn((r: string | null) => r),
  resolveAdminSchoolType: jest.fn(() => null),
}));

import { determineUserRoute, validateUserAccess, getRouteForRole } from '@/lib/auth/determineRoute';
import { resolveAdminSchoolType } from '@/lib/auth/roleResolution';
import { getDashboardRouteForRole } from '@/lib/dashboard/routeMatrix';
import { createMockEnhancedProfile } from '../../helpers/authTestUtils';

// ── Helpers ─────────────────────────────────────────

function profileWithMembership(overrides: Record<string, any> = {}) {
  const orgMembership = {
    organization_id: 'org-1',
    organization_name: 'Test School',
    plan_tier: 'school_premium',
    seat_status: 'active',
    member_type: overrides.member_type ?? 'admin',
    school_type: 'preschool',
    organization_kind: overrides.organization_kind ?? 'school',
    joined_at: '2025-01-01T00:00:00Z',
    membership_status: overrides.membership_status ?? 'active',
    ...(overrides.orgMembershipExtra ?? {}),
  };

  return createMockEnhancedProfile({
    role: overrides.role ?? 'admin',
    organization_id: overrides.organization_id ?? 'org-1',
    organization_membership: orgMembership as any,
    ...overrides,
  });
}

// ──────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────

describe('determineUserRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Pending membership ─────────────────────────────

  describe('pending membership', () => {
    it('routes pending member (non-executive) to membership-pending', () => {
      const profile = profileWithMembership({
        member_type: 'member',
        membership_status: 'pending',
        role: 'parent',
      });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/membership/membership-pending');
    });

    it('routes pending_verification member to membership-pending', () => {
      const profile = profileWithMembership({
        member_type: 'volunteer',
        membership_status: 'pending_verification',
        role: 'parent',
      });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/membership/membership-pending');
    });

    it('does NOT block pending executive (ceo)', () => {
      const profile = profileWithMembership({
        member_type: 'ceo',
        membership_status: 'pending',
        role: 'admin',
      });
      const route = determineUserRoute(profile as any);
      expect(route.path).not.toBe('/screens/membership/membership-pending');
    });

    it('does NOT block pending super_admin', () => {
      const profile = profileWithMembership({
        membership_status: 'pending',
        role: 'super_admin',
      });
      const route = determineUserRoute(profile as any);
      expect(route.path).not.toBe('/screens/membership/membership-pending');
    });
  });

  // ── NULL role guard (RC-7 fix) ─────────────────────

  describe('null role', () => {
    it('routes null role to /profiles-gate (not sign-in)', () => {
      const profile = createMockEnhancedProfile({
        role: null as any,
        organization_id: null,
        organization_membership: null,
      });
      const { normalizeRole } = require('@/lib/auth/roleResolution');
      (normalizeRole as jest.Mock).mockReturnValueOnce(null);

      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/profiles-gate');
    });
  });

  // ── SOA member-type routing ────────────────────────

  describe('SOA member types', () => {
    it.each([
      ['ceo', '/screens/membership/ceo-dashboard'],
      ['president', '/screens/membership/ceo-dashboard'],
      ['national_admin', '/screens/membership/ceo-dashboard'],
      ['secretary_general', '/screens/membership/ceo-dashboard'],
      ['treasurer', '/screens/membership/ceo-dashboard'],
      ['deputy_president', '/screens/membership/ceo-dashboard'],
      ['national_coordinator', '/screens/membership/ceo-dashboard'],
      ['executive', '/screens/membership/ceo-dashboard'],
      ['board_member', '/screens/membership/ceo-dashboard'],
    ])('routes %s to %s', (memberType, expectedPath) => {
      const profile = profileWithMembership({ member_type: memberType, role: 'parent' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe(expectedPath);
    });

    it.each([
      ['youth_president', '/screens/membership/youth-president-dashboard'],
      ['youth_deputy', '/screens/membership/youth-president-dashboard'],
      ['youth_treasurer', '/screens/membership/youth-president-dashboard'],
      ['youth_coordinator', '/screens/membership/youth-president-dashboard'],
      ['youth_facilitator', '/screens/membership/youth-president-dashboard'],
      ['youth_mentor', '/screens/membership/youth-president-dashboard'],
    ])('routes %s to youth-president-dashboard', (memberType, expectedPath) => {
      const profile = profileWithMembership({ member_type: memberType, role: 'parent' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe(expectedPath);
    });

    it('routes youth_secretary to youth-secretary-dashboard', () => {
      const profile = profileWithMembership({ member_type: 'youth_secretary', role: 'parent' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/membership/youth-secretary-dashboard');
    });

    it('routes youth_member to learner-dashboard', () => {
      const profile = profileWithMembership({ member_type: 'youth_member', role: 'parent' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/learner-dashboard');
    });

    it.each([
      'women_president', 'women_deputy', 'women_secretary',
      'women_treasurer', 'women_coordinator', 'women_member',
    ])('routes %s to women-dashboard', (memberType) => {
      const profile = profileWithMembership({ member_type: memberType, role: 'parent' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/membership/women-dashboard');
    });

    it.each([
      'veterans_president', 'veterans_coordinator', 'veterans_member',
    ])('routes %s to veterans-dashboard', (memberType) => {
      const profile = profileWithMembership({ member_type: memberType, role: 'parent' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/membership/veterans-dashboard');
    });

    it.each([
      'regional_coordinator', 'provincial_coordinator',
      'regional_manager', 'provincial_manager', 'branch_manager',
    ])('routes %s to membership/dashboard', (memberType) => {
      const profile = profileWithMembership({ member_type: memberType, role: 'parent' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/membership/dashboard');
    });
  });

  // ── Generic member types ───────────────────────────

  describe('generic member types (non-school-admin)', () => {
    it('routes staff member to ceo-dashboard', () => {
      const profile = profileWithMembership({ member_type: 'staff', role: 'parent' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/membership/ceo-dashboard');
    });

    it('routes admin member to ceo-dashboard', () => {
      // This tests that member_type='admin' for a non-school-admin role goes to ceo-dashboard
      const profile = profileWithMembership({ member_type: 'admin', role: 'parent' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/membership/ceo-dashboard');
    });

    it.each(['learner', 'facilitator', 'mentor', 'volunteer', 'member'])(
      'routes %s member to learner-dashboard',
      (memberType) => {
        const profile = profileWithMembership({ member_type: memberType, role: 'parent' });
        const route = determineUserRoute(profile as any);
        expect(route.path).toBe('/screens/learner-dashboard');
      },
    );
  });

  // ── Independent users ──────────────────────────────

  describe('independent users (no org)', () => {
    it('routes independent super_admin to super-admin-dashboard', () => {
      const profile = createMockEnhancedProfile({
        role: 'super_admin',
        organization_id: null,
        organization_membership: null,
      });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/super-admin-dashboard');
    });

    it('routes independent admin to org-onboarding', () => {
      const profile = createMockEnhancedProfile({
        role: 'admin',
        organization_id: null,
        organization_membership: null,
      });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/org-onboarding');
    });

    it('routes independent teacher with standalone param', () => {
      const profile = createMockEnhancedProfile({
        role: 'teacher',
        organization_id: null,
        organization_membership: null,
      });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/teacher-dashboard');
      expect(route.params?.standalone).toBe('true');
    });

    it('routes independent parent with standalone param', () => {
      const profile = createMockEnhancedProfile({
        role: 'parent',
        organization_id: null,
        organization_membership: null,
      });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/parent-dashboard');
      expect(route.params?.standalone).toBe('true');
    });

    it('routes independent student with standalone param', () => {
      const profile = createMockEnhancedProfile({
        role: 'student',
        organization_id: null,
        organization_membership: null,
      });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/learner-dashboard');
      expect(route.params?.standalone).toBe('true');
    });
  });

  // ── Org-member role-based routing ──────────────────

  describe('org member role-based routing', () => {
    it('routes super_admin to super-admin-dashboard', () => {
      const profile = profileWithMembership({ role: 'super_admin', member_type: 'none' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/super-admin-dashboard');
    });

    it('routes admin with school org to admin-dashboard (preschool fallback)', () => {
      // resolveAdminSchoolType is called twice: once for bypass check, once in the switch
      (resolveAdminSchoolType as jest.Mock)
        .mockReturnValueOnce('preschool')  // bypass check
        .mockReturnValueOnce('preschool'); // switch case
      const profile = profileWithMembership({ role: 'admin', member_type: 'none' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/admin-dashboard');
    });

    it('routes admin with non-school org to org-admin-dashboard', () => {
      (resolveAdminSchoolType as jest.Mock).mockReturnValueOnce(null);
      const profile = profileWithMembership({ role: 'admin', member_type: 'none' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/org-admin-dashboard');
    });

    it('routes teacher to teacher-dashboard', () => {
      const profile = profileWithMembership({ role: 'teacher', member_type: 'none' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/teacher-dashboard');
    });

    it('routes parent to parent-dashboard', () => {
      const profile = profileWithMembership({ role: 'parent', member_type: 'none' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/parent-dashboard');
    });

    it('routes student to learner-dashboard', () => {
      const profile = profileWithMembership({ role: 'student', member_type: 'none' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/learner-dashboard');
    });

    it('routes skills-like principal_admin to org-admin-dashboard', () => {
      const profile = profileWithMembership({
        role: 'principal_admin',
        member_type: 'none',
        organization_kind: 'skills',
      });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/screens/org-admin-dashboard');
    });
  });

  // ── Default fallback ───────────────────────────────

  describe('default fallback', () => {
    it('returns "/" for unknown role', () => {
      const { normalizeRole } = require('@/lib/auth/roleResolution');
      (normalizeRole as jest.Mock).mockReturnValueOnce('unknown_role_xyz');
      const profile = profileWithMembership({ role: 'unknown_role_xyz', member_type: 'none' });
      const route = determineUserRoute(profile as any);
      expect(route.path).toBe('/');
    });
  });
});

// ──────────────────────────────────────────────────────
// validateUserAccess
// ──────────────────────────────────────────────────────

describe('validateUserAccess', () => {
  it('returns no access for null profile', () => {
    const result = validateUserAccess(null);
    expect(result.hasAccess).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('returns access for valid role', () => {
    const { normalizeRole } = require('@/lib/auth/roleResolution');
    (normalizeRole as jest.Mock).mockReturnValueOnce('teacher');
    const profile = createMockEnhancedProfile({ role: 'teacher' });
    const result = validateUserAccess(profile as any);
    expect(result.hasAccess).toBe(true);
  });
});

// ──────────────────────────────────────────────────────
// getRouteForRole
// ──────────────────────────────────────────────────────

describe('getRouteForRole', () => {
  const { normalizeRole } = require('@/lib/auth/roleResolution');

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['super_admin', '/screens/super-admin-dashboard'],
    ['admin', '/screens/org-admin-dashboard'],
    ['principal_admin', '/screens/principal-dashboard'],
    ['teacher', '/screens/teacher-dashboard'],
    ['parent', '/screens/parent-dashboard'],
    ['student', '/screens/learner-dashboard'],
  ])('returns correct route for %s', (role, expected) => {
    (normalizeRole as jest.Mock).mockReturnValueOnce(role);
    expect(getRouteForRole(role)).toBe(expected);
  });

  it('returns /landing for unknown role', () => {
    (normalizeRole as jest.Mock).mockReturnValueOnce('unknown');
    expect(getRouteForRole('unknown')).toBe('/landing');
  });
});
