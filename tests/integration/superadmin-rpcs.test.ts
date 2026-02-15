/**
 * Integration Tests: Super-Admin Organization RPCs
 *
 * Tests the `superadmin_update_entity_type` and `superadmin_update_entity_profile`
 * RPC functions defined in migration 20260221140000.
 *
 * Two tiers:
 *   1. **anon-key tests** — verify that non-superadmin callers are rejected.
 *   2. **service-role tests** — verify happy-path behavior (entity type update,
 *      profile update with COALESCE, sync-duplicates). Requires
 *      SUPABASE_SERVICE_ROLE_KEY env var.
 *
 * Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
 * Skips gracefully when missing.
 */

const { createClient } = require('@supabase/supabase-js');

// ── env guards ──────────────────────────────────────────────
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SKIP = !SUPABASE_URL || !SUPABASE_ANON_KEY;
const SKIP_SERVICE = SKIP || !SERVICE_ROLE_KEY;

const describeIfEnv = SKIP ? describe.skip : describe;
const describeIfService = SKIP_SERVICE ? describe.skip : describe;

// ── helpers ─────────────────────────────────────────────────
function makeAnonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function makeServiceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Dummy UUID for calls that should never reach the DB update. */
const FAKE_ID = '00000000-0000-0000-0000-000000000000';

// ─────────────────────────────────────────────────────────────
// 1. Permission-denied / contract tests (anon client, no auth)
// ─────────────────────────────────────────────────────────────
describeIfEnv('superadmin_update_entity_type — permission checks', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    supabase = makeAnonClient();
  });

  it('rejects unauthenticated callers with an access-denied error', async () => {
    const { error } = await supabase.rpc('superadmin_update_entity_type', {
      p_entity_type: 'organization',
      p_entity_id: FAKE_ID,
      p_next_type: 'preschool',
    });
    expect(error).toBeTruthy();
    // The RPC uses is_superadmin_safe() which raises an exception
    const msg = (error?.message || '').toLowerCase();
    expect(msg).toMatch(/denied|superadmin|permission|unauthorized/);
  });

  it('rejects with invalid entity_type', async () => {
    const { error } = await supabase.rpc('superadmin_update_entity_type', {
      p_entity_type: 'invalid_type',
      p_entity_id: FAKE_ID,
      p_next_type: 'preschool',
    });
    expect(error).toBeTruthy();
  });
});

describeIfEnv('superadmin_update_entity_profile — permission checks', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    supabase = makeAnonClient();
  });

  it('rejects unauthenticated callers with an access-denied error', async () => {
    const { error } = await supabase.rpc('superadmin_update_entity_profile', {
      p_entity_type: 'organization',
      p_entity_id: FAKE_ID,
      p_name: 'Test Org',
    });
    expect(error).toBeTruthy();
    const msg = (error?.message || '').toLowerCase();
    expect(msg).toMatch(/denied|superadmin|permission|unauthorized/);
  });

  it('rejects when name is null', async () => {
    const { error } = await supabase.rpc('superadmin_update_entity_profile', {
      p_entity_type: 'organization',
      p_entity_id: FAKE_ID,
      p_name: null,
    });
    expect(error).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Happy-path tests (service-role client bypasses auth)
//    These use real DB rows — create Org -> update -> verify -> cleanup.
// ─────────────────────────────────────────────────────────────
describeIfService('superadmin_update_entity_type — service-role happy path', () => {
  let service: ReturnType<typeof createClient>;
  let testOrgId: string | null = null;
  let testPreschoolId: string | null = null;

  beforeAll(async () => {
    service = makeServiceClient();

    // Create a pair of org + preschool with the same name for sync testing
    const orgName = `SA-RPC-Test-${Date.now()}`;

    const { data: org, error: orgErr } = await service
      .from('organizations')
      .insert({ name: orgName, organization_type: 'org', type: 'org', is_active: true })
      .select('id')
      .single();
    if (orgErr) throw orgErr;
    testOrgId = org.id;

    const { data: ps, error: psErr } = await service
      .from('preschools')
      .insert({
        name: orgName,
        organization_id: testOrgId,
        school_type: 'preschool',
        is_active: true,
      })
      .select('id')
      .single();
    if (psErr) throw psErr;
    testPreschoolId = ps.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testPreschoolId) {
      await service.from('preschools').delete().eq('id', testPreschoolId);
    }
    if (testOrgId) {
      await service.from('organizations').delete().eq('id', testOrgId);
    }
  });

  it('updates organization type and returns success', async () => {
    const { data, error } = await service.rpc('superadmin_update_entity_type', {
      p_entity_type: 'organization',
      p_entity_id: testOrgId,
      p_next_type: 'daycare',
      p_sync_duplicates: false,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({
      success: true,
      entity_type: 'organization',
      entity_id: testOrgId,
      next_type: 'daycare',
    });

    // Verify the org was updated
    const { data: org } = await service
      .from('organizations')
      .select('organization_type')
      .eq('id', testOrgId)
      .single();
    expect(org?.organization_type).toBe('daycare');
  });

  it('syncs preschool type when p_sync_duplicates=true', async () => {
    const { data, error } = await service.rpc('superadmin_update_entity_type', {
      p_entity_type: 'organization',
      p_entity_id: testOrgId,
      p_next_type: 'k12',
      p_sync_duplicates: true,
    });
    expect(error).toBeNull();
    expect(data?.success).toBe(true);

    // Verify the linked preschool was synced
    const { data: ps } = await service
      .from('preschools')
      .select('school_type')
      .eq('organization_id', testOrgId)
      .single();
    expect(ps?.school_type).toBe('k12');
  });

  it('does NOT sync preschool when p_sync_duplicates=false', async () => {
    // First set preschool back to a known value
    await service
      .from('preschools')
      .update({ school_type: 'preschool' })
      .eq('id', testPreschoolId);

    const { error } = await service.rpc('superadmin_update_entity_type', {
      p_entity_type: 'organization',
      p_entity_id: testOrgId,
      p_next_type: 'tertiary',
      p_sync_duplicates: false,
    });
    expect(error).toBeNull();

    // Preschool should still be 'preschool' — NOT synced
    const { data: ps } = await service
      .from('preschools')
      .select('school_type')
      .eq('id', testPreschoolId)
      .single();
    expect(ps?.school_type).toBe('preschool');
  });

  it('blocks school entity type updates', async () => {
    const { error } = await service.rpc('superadmin_update_entity_type', {
      p_entity_type: 'school',
      p_entity_id: FAKE_ID,
      p_next_type: 'k12',
    });
    // The RPC raises an exception for school entities
    expect(error).toBeTruthy();
    const msg = (error?.message || '').toLowerCase();
    expect(msg).toMatch(/school|not supported|unsupported/);
  });
});

describeIfService('superadmin_update_entity_profile — service-role happy path', () => {
  let service: ReturnType<typeof createClient>;
  let testOrgId: string | null = null;
  let testPreschoolId: string | null = null;
  const BASE_NAME = `ProfileTest-${Date.now()}`;

  beforeAll(async () => {
    service = makeServiceClient();

    const { data: org, error: orgErr } = await service
      .from('organizations')
      .insert({
        name: BASE_NAME,
        organization_type: 'org',
        type: 'org',
        is_active: true,
        contact_email: 'old@test.com',
        address: '123 Old St',
      })
      .select('id')
      .single();
    if (orgErr) throw orgErr;
    testOrgId = org.id;

    const { data: ps, error: psErr } = await service
      .from('preschools')
      .insert({
        name: BASE_NAME,
        organization_id: testOrgId,
        school_type: 'preschool',
        is_active: true,
      })
      .select('id')
      .single();
    if (psErr) throw psErr;
    testPreschoolId = ps.id;
  });

  afterAll(async () => {
    if (testPreschoolId) {
      await service.from('preschools').delete().eq('id', testPreschoolId);
    }
    if (testOrgId) {
      await service.from('organizations').delete().eq('id', testOrgId);
    }
  });

  it('updates name and returns success', async () => {
    const newName = `${BASE_NAME}-Updated`;
    const { data, error } = await service.rpc('superadmin_update_entity_profile', {
      p_entity_type: 'organization',
      p_entity_id: testOrgId,
      p_name: newName,
      p_sync_duplicates: false,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({
      success: true,
      entity_type: 'organization',
      entity_id: testOrgId,
    });

    const { data: org } = await service
      .from('organizations')
      .select('name')
      .eq('id', testOrgId)
      .single();
    expect(org?.name).toBe(newName);
  });

  it('uses COALESCE for optional fields — null params preserve existing values', async () => {
    // Set a known email first
    await service
      .from('organizations')
      .update({ contact_email: 'keep@test.com', address: '456 Keep Ave' })
      .eq('id', testOrgId);

    // Update name only — should keep email and address
    const { error } = await service.rpc('superadmin_update_entity_profile', {
      p_entity_type: 'organization',
      p_entity_id: testOrgId,
      p_name: 'COALESCE-Test',
      p_contact_email: null,
      p_address: null,
      p_sync_duplicates: false,
    });
    expect(error).toBeNull();

    const { data: org } = await service
      .from('organizations')
      .select('name, contact_email, address')
      .eq('id', testOrgId)
      .single();
    expect(org?.name).toBe('COALESCE-Test');
    expect(org?.contact_email).toBe('keep@test.com');
    expect(org?.address).toBe('456 Keep Ave');
  });

  it('syncs profile to linked preschool when p_sync_duplicates=true', async () => {
    const syncedName = `Synced-${Date.now()}`;
    const { error } = await service.rpc('superadmin_update_entity_profile', {
      p_entity_type: 'organization',
      p_entity_id: testOrgId,
      p_name: syncedName,
      p_contact_email: 'synced@test.com',
      p_sync_duplicates: true,
    });
    expect(error).toBeNull();

    // Verify preschool was synced
    const { data: ps } = await service
      .from('preschools')
      .select('name, contact_email')
      .eq('organization_id', testOrgId)
      .single();
    expect(ps?.name).toBe(syncedName);
    expect(ps?.contact_email).toBe('synced@test.com');
  });

  it('rejects empty name', async () => {
    const { error } = await service.rpc('superadmin_update_entity_profile', {
      p_entity_type: 'organization',
      p_entity_id: testOrgId,
      p_name: '',
    });
    expect(error).toBeTruthy();
    const msg = (error?.message || '').toLowerCase();
    expect(msg).toMatch(/name|required|empty/);
  });

  it('supports preschool entity type directly', async () => {
    const { data, error } = await service.rpc('superadmin_update_entity_profile', {
      p_entity_type: 'preschool',
      p_entity_id: testPreschoolId,
      p_name: `Direct-PS-${Date.now()}`,
      p_sync_duplicates: false,
    });
    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.entity_type).toBe('preschool');
  });
});
