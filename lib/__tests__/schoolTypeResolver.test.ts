import {
  normalizeResolvedSchoolType,
  resolveOrganizationId,
  resolveSchoolTypeFromProfile,
} from '@/lib/schoolTypeResolver';

describe('schoolTypeResolver', () => {
  it('normalizes known aliases into preschool/k12 buckets', () => {
    expect(normalizeResolvedSchoolType('combined')).toBe('k12_school');
    expect(normalizeResolvedSchoolType('community_school')).toBe('k12_school');
    expect(normalizeResolvedSchoolType('ecd')).toBe('preschool');
    expect(normalizeResolvedSchoolType('nursery')).toBe('preschool');
  });

  it('resolves school type from profile membership first', () => {
    expect(
      resolveSchoolTypeFromProfile({
        organization_membership: { school_type: 'secondary' },
      })
    ).toBe('k12_school');

    expect(
      resolveSchoolTypeFromProfile({
        organization_membership: { school_type: 'preschool' },
      })
    ).toBe('preschool');
  });

  it('falls back to preschool when profile has no recognizable school type', () => {
    expect(resolveSchoolTypeFromProfile({})).toBe('preschool');
    expect(resolveSchoolTypeFromProfile(null)).toBe('preschool');
  });

  it('resolves organization id with organization-first fallback chain', () => {
    expect(resolveOrganizationId({ organization_id: 'org-1', preschool_id: 'pre-1' })).toBe('org-1');
    expect(resolveOrganizationId({ preschool_id: 'pre-1' })).toBe('pre-1');
    expect(resolveOrganizationId({ organizationId: 'org-2' })).toBe('org-2');
    expect(resolveOrganizationId(undefined)).toBeNull();
  });
});
