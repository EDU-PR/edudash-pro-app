import {
  dedupeOrganizationsByRawId,
  getOrganizationBucketType,
} from '@/hooks/super-admin-organizations/fetchOrganizations';
import type { Organization } from '@/lib/screen-styles/super-admin-organizations.styles';

const buildOrg = (overrides: Partial<Organization>): Organization => ({
  id: 'org_00000000-0000-0000-0000-000000000001',
  name: 'Example Org',
  type: 'org',
  status: 'inactive',
  contact_email: '',
  student_count: 0,
  teacher_count: 0,
  active_student_count: 0,
  active_teacher_count: 0,
  created_at: '2026-02-01T00:00:00.000Z',
  is_verified: false,
  ...overrides,
});

describe('super-admin organizations aggregation', () => {
  it('maps raw types to UI buckets', () => {
    expect(getOrganizationBucketType('combined', 'preschool')).toBe('k12');
    expect(getOrganizationBucketType('community_school', 'preschool')).toBe('k12');
    expect(getOrganizationBucketType('skills_development', 'organization')).toBe('skills');
    expect(getOrganizationBucketType('preschool', 'organization')).toBe('preschool');
    expect(getOrganizationBucketType(null, 'school')).toBe('k12');
  });

  it('dedupes source rows by raw id and merges counts/status/type', () => {
    const rawId = '11111111-1111-1111-1111-111111111111';
    const records: Organization[] = [
      buildOrg({
        id: `preschool_${rawId}`,
        name: 'Community School',
        type: 'preschool',
        organization_type_raw: 'preschool',
        status: 'inactive',
        student_count: 24,
        teacher_count: 4,
        active_student_count: 20,
        active_teacher_count: 3,
      }),
      buildOrg({
        id: `org_${rawId}`,
        name: 'Community School',
        type: 'k12',
        organization_type_raw: 'k12_school',
        status: 'active',
        student_count: 12,
        teacher_count: 2,
        active_student_count: 10,
        active_teacher_count: 2,
      }),
    ];

    const deduped = dedupeOrganizationsByRawId(records);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe(`preschool_${rawId}`);
    expect(deduped[0].type).toBe('k12');
    expect(deduped[0].status).toBe('active');
    expect(deduped[0].student_count).toBe(36);
    expect(deduped[0].teacher_count).toBe(6);
    expect(deduped[0].active_student_count).toBe(30);
    expect(deduped[0].active_teacher_count).toBe(5);
    expect(deduped[0].metadata?.source_count).toBe(2);
  });

  it('prefers school records as canonical source when available', () => {
    const rawId = '22222222-2222-2222-2222-222222222222';
    const deduped = dedupeOrganizationsByRawId([
      buildOrg({
        id: `org_${rawId}`,
        type: 'org',
        status: 'active',
      }),
      buildOrg({
        id: `school_${rawId}`,
        type: 'k12',
        status: 'active',
      }),
      buildOrg({
        id: `preschool_${rawId}`,
        type: 'preschool',
        status: 'active',
      }),
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe(`school_${rawId}`);
    expect(deduped[0].type).toBe('k12');
    expect(deduped[0].metadata?.source_count).toBe(3);
  });
});
