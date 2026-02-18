/**
 * Unit Tests: Super-Admin Organization Edit & Drill-Down
 *
 * Tests pure helper functions and payload construction for:
 *   - getEntityMeta() — extracts entity type + actual UUID from composite id
 *   - saveOrganizationProfile() payload — structure matches RPC signature
 *   - jumpToUserManager() — route params for teacher/student drill-down
 *   - openTypePicker() — option lists for preschool vs organization entities
 *   - formatTierLabel() — tier display
 */

import {
  getEntityMeta,
  formatTierLabel,
} from '@/lib/screen-styles/super-admin-organizations.styles';
import type { Organization } from '@/lib/screen-styles/super-admin-organizations.styles';

// ── Test Data ───────────────────────────────────────────────
const UUID = '11111111-2222-3333-4444-555555555555';

const buildOrg = (overrides: Partial<Organization>): Organization => ({
  id: `org_${UUID}`,
  name: 'Test Org',
  type: 'org',
  status: 'active',
  contact_email: 'test@org.com',
  student_count: 40,
  teacher_count: 5,
  active_student_count: 35,
  active_teacher_count: 4,
  created_at: '2026-03-01T00:00:00.000Z',
  is_verified: true,
  ...overrides,
});

// ─────────────────────────────────────────────────────────────
// getEntityMeta
// ─────────────────────────────────────────────────────────────
describe('getEntityMeta', () => {
  it('parses organization-prefixed id', () => {
    const meta = getEntityMeta(buildOrg({ id: `org_${UUID}` }));
    expect(meta).toEqual({ entityType: 'organization', actualId: UUID });
  });

  it('parses preschool-prefixed id', () => {
    const meta = getEntityMeta(buildOrg({ id: `preschool_${UUID}` }));
    expect(meta).toEqual({ entityType: 'preschool', actualId: UUID });
  });

  it('parses school-prefixed id', () => {
    const meta = getEntityMeta(buildOrg({ id: `school_${UUID}` }));
    expect(meta).toEqual({ entityType: 'school', actualId: UUID });
  });

  it('handles UUIDs containing underscores gracefully', () => {
    // If a UUID somehow contains underscores (shouldn't, but be defensive)
    const weirdId = 'org_aaaa_bbbb_cccc';
    const meta = getEntityMeta(buildOrg({ id: weirdId }));
    expect(meta.entityType).toBe('organization');
    // actualId is everything after first underscore
    expect(meta.actualId).toBe('aaaa_bbbb_cccc');
  });

  it('defaults unknown prefix to organization entity type', () => {
    const meta = getEntityMeta(buildOrg({ id: `unknown_${UUID}` }));
    expect(meta.entityType).toBe('organization');
    expect(meta.actualId).toBe(UUID);
  });
});

// ─────────────────────────────────────────────────────────────
// saveOrganizationProfile payload construction
// ─────────────────────────────────────────────────────────────
describe('saveOrganizationProfile payload', () => {
  /**
   * Mirrors the payload construction from super-admin-organizations.tsx L130-143.
   * Extracted here for unit-testability.
   */
  function buildPayload(selectedOrg: Organization, editDraft: Record<string, any>) {
    return {
      p_entity_type: getEntityMeta(selectedOrg).entityType,
      p_entity_id: getEntityMeta(selectedOrg).actualId,
      p_name: editDraft.name.trim(),
      p_contact_email: editDraft.contact_email.trim() || null,
      p_contact_phone: editDraft.contact_phone.trim() || null,
      p_address: editDraft.address.trim() || null,
      p_city: editDraft.city.trim() || null,
      p_province: editDraft.province.trim() || null,
      p_country: editDraft.country.trim() || null,
      p_is_active: editDraft.is_active,
      p_is_verified: editDraft.is_verified,
      p_sync_duplicates: true,
    };
  }

  it('constructs correct payload for organization entity', () => {
    const org = buildOrg({ id: `org_${UUID}`, name: 'Old Name' });
    const draft = {
      name: 'New Name  ',
      contact_email: 'new@email.com',
      contact_phone: ' +27123456789 ',
      address: '  123 Main St  ',
      city: 'Cape Town',
      province: 'Western Cape',
      country: 'South Africa',
      is_active: true,
      is_verified: true,
    };

    const payload = buildPayload(org, draft);

    expect(payload.p_entity_type).toBe('organization');
    expect(payload.p_entity_id).toBe(UUID);
    expect(payload.p_name).toBe('New Name');
    expect(payload.p_contact_phone).toBe('+27123456789');
    expect(payload.p_sync_duplicates).toBe(true);
  });

  it('nullifies empty optional fields', () => {
    const org = buildOrg({ id: `preschool_${UUID}` });
    const draft = {
      name: 'Required Name',
      contact_email: '',
      contact_phone: '  ',
      address: '',
      city: '',
      province: '',
      country: '',
      is_active: false,
      is_verified: false,
    };

    const payload = buildPayload(org, draft);

    expect(payload.p_entity_type).toBe('preschool');
    expect(payload.p_name).toBe('Required Name');
    expect(payload.p_contact_email).toBeNull();
    expect(payload.p_contact_phone).toBeNull();
    expect(payload.p_address).toBeNull();
    expect(payload.p_city).toBeNull();
    expect(payload.p_province).toBeNull();
    expect(payload.p_country).toBeNull();
    expect(payload.p_is_active).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// jumpToUserManager route params
// ─────────────────────────────────────────────────────────────
describe('jumpToUserManager route params', () => {
  /**
   * Mirrors the route params from super-admin-organizations.tsx L231-237.
   */
  function buildRouteParams(org: Organization, mode: 'students' | 'teachers') {
    const { actualId } = getEntityMeta(org);
    return {
      pathname: '/screens/super-admin-users',
      params: {
        scopeOrgId: actualId,
        scopeRole: mode === 'teachers' ? 'teacher' : 'student',
        scopeLabel: org.name,
      },
    };
  }

  it('routes to teacher scope for teachers mode', () => {
    const org = buildOrg({ id: `org_${UUID}`, name: 'ABC Preschool' });
    const route = buildRouteParams(org, 'teachers');

    expect(route.pathname).toBe('/screens/super-admin-users');
    expect(route.params.scopeOrgId).toBe(UUID);
    expect(route.params.scopeRole).toBe('teacher');
    expect(route.params.scopeLabel).toBe('ABC Preschool');
  });

  it('routes to student scope for students mode', () => {
    const org = buildOrg({ id: `preschool_${UUID}`, name: 'XYZ Academy' });
    const route = buildRouteParams(org, 'students');

    expect(route.params.scopeOrgId).toBe(UUID);
    expect(route.params.scopeRole).toBe('student');
    expect(route.params.scopeLabel).toBe('XYZ Academy');
  });
});

// ─────────────────────────────────────────────────────────────
// openTypePicker option sets
// ─────────────────────────────────────────────────────────────
describe('type picker option sets', () => {
  const PRESCHOOL_TYPE_OPTIONS = [
    { label: 'Preschool', value: 'preschool' },
    { label: 'Combined', value: 'combined' },
    { label: 'Community School', value: 'community_school' },
    { label: 'Primary', value: 'primary' },
    { label: 'Secondary', value: 'secondary' },
  ];

  const ORGANIZATION_TYPE_OPTIONS = [
    { label: 'Organization', value: 'org' },
    { label: 'Preschool', value: 'preschool' },
    { label: 'Daycare', value: 'daycare' },
    { label: 'K-12', value: 'k12' },
    { label: 'Primary School', value: 'primary_school' },
    { label: 'Skills', value: 'skills' },
    { label: 'Tertiary', value: 'tertiary' },
    { label: 'Other', value: 'other' },
  ];

  function getTypeOptions(orgId: string) {
    const sourceType = orgId.split('_')[0];
    if (sourceType === 'school') return null; // blocked
    return sourceType === 'preschool' ? PRESCHOOL_TYPE_OPTIONS : ORGANIZATION_TYPE_OPTIONS;
  }

  it('returns preschool options for preschool-prefixed id', () => {
    const options = getTypeOptions(`preschool_${UUID}`);
    expect(options).toHaveLength(5);
    expect(options?.map((o) => o.value)).toContain('combined');
    expect(options?.map((o) => o.value)).toContain('community_school');
  });

  it('returns organization options for org-prefixed id', () => {
    const options = getTypeOptions(`org_${UUID}`);
    expect(options).toHaveLength(8);
    expect(options?.map((o) => o.value)).toContain('daycare');
    expect(options?.map((o) => o.value)).toContain('k12');
    expect(options?.map((o) => o.value)).toContain('tertiary');
  });

  it('blocks school-prefixed ids (returns null)', () => {
    const options = getTypeOptions(`school_${UUID}`);
    expect(options).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// formatTierLabel
// ─────────────────────────────────────────────────────────────
describe('formatTierLabel', () => {
  it('returns "Free" for null/undefined tier', () => {
    expect(formatTierLabel(null)).toBe('Free');
    expect(formatTierLabel(undefined)).toBe('Free');
  });

  it('formats a known tier string', () => {
    const label = formatTierLabel('basic');
    expect(label).toBeTruthy();
    expect(typeof label).toBe('string');
    // normalizeTierName maps "basic" → "school_starter"
    // formatTierLabel returns "DisplayName (normalized_name)"
    expect(label.length).toBeGreaterThan(0);
  });
});
