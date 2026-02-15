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
 * Schema notes:
 *   - `organizations` and `preschools` use a **shared UUID** pattern: the same
 *     UUID is PK (`id`) in both tables. The RPCs use `WHERE id = p_entity_id`
 *     on both tables — there is no `organization_id` FK column.
 *   - `preschools` uses `email`/`phone` columns (NOT `contact_email`/`contact_phone`).
 *   - `organizations` uses `contact_email`/`contact_phone` columns.
 *   - `preschools` INSERT trigger requires a `subscription_plans` row with
 *     `tier = 'starter'`, so the test ensures one exists before setup.
 *   - Sync from org→preschool maps `k12` → `combined` school_type (not `k12`).
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

/**
 * Ensure a subscription_plans row with `tier = 'starter'` exists.
 * The preschools INSERT trigger creates a trial subscription and
 * requires this plan. Returns the plan id (for cleanup).
 */
async function ensureStarterPlan(
  service: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data: existing } = await service
    .from('subscription_plans')
    .select('id')
    .eq('tier', 'starter')
    .limit(1)
    .maybeSingle();

  if (existing) return null; // already exists — nothing to clean up

  const { data: created, error } = await service
    .from('subscription_plans')
    .insert({
      name: 'Starter (Test)',
      tier: 'starter',
      price_monthly: 0,
      price_annual: 0,
      max_teachers: 3,
      max_students: 50,
      max_schools: 1,
      features: ['test_plan'],
      is_active: true,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create starter plan: ${error.message}`);
  return created.id;
}

/**
 * Create a paired org + preschool with the **same UUID** (shared-key pattern).
 * Returns the shared id.
 */
async function createTestPair(
  service: ReturnType<typeof createClient>,
  name: string,
  opts?: { orgEmail?: string; orgAddress?: string },
): Promise<string> {
  // 1. Create org → get auto-generated UUID
  const { data: org, error: orgErr } = await service
    .from('organizations')
    .insert({
      name,
      organization_type: 'org',
      type: 'org',
      is_active: true,
      ...(opts?.orgEmail && { contact_email: opts.orgEmail }),
      ...(opts?.orgAddress && { address: opts.orgAddress }),
    })
    .select('id')
    .single();
  if (orgErr) throw new Error(`Org insert: ${orgErr.message}`);

  // 2. Create preschool with the SAME id (shared-key pattern)
  const { error: psErr } = await service
    .from('preschools')
    .insert({
      id: org.id,
      name,
      email: opts?.orgEmail || `${name.toLowerCase().replace(/\s/g, '')}@test.edudash.local`,
      school_type: 'preschool',
      subscription_tier: 'free',
      is_active: true,
    })
    .select('id')
    .single();
  if (psErr) throw new Error(`Preschool insert (id=${org.id}): ${psErr.message}`);

  return org.id;
}

/** Clean up a test pair + any associated audit log rows. */
async function cleanupTestPair(
  service: ReturnType<typeof createClient>,
  id: string | null,
): Promise<void> {
  if (!id) return;
  // Delete in correct order (no FK constraints between the two, but be safe)
  await service.from('superadmin_audit_log').delete().eq('record_id', id);
  await service.from('preschools').delete().eq('id', id);
  await service.from('organizations').delete().eq('id', id);
}

// ─────────────────────────────────────────────────────────────
// 1. Permission-denied / contract tests (anon client, no auth)
// ─────────────────────────────────────────────────────────────
describeIfEnv('superadmin_update_entity_type — permission checks', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    supabase = makeAnonClient();
  });

  it('rejects unauthenticated callers', async () => {
    const { error } = await supabase.rpc('superadmin_update_entity_type', {
      p_entity_type: 'organization',
      p_entity_id: FAKE_ID,
      p_next_type: 'preschool',
    });
    expect(error).toBeTruthy();
    // SECURITY DEFINER functions may surface "not found" or "access denied"
    // depending on execution path — either way the operation is rejected.
    const msg = (error?.message || '').toLowerCase();
    expect(msg).toMatch(/denied|superadmin|permission|unauthorized|not found/);
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

  it('rejects unauthenticated callers', async () => {
    const { error } = await supabase.rpc('superadmin_update_entity_profile', {
      p_entity_type: 'organization',
      p_entity_id: FAKE_ID,
      p_name: 'Test Org',
    });
    expect(error).toBeTruthy();
    const msg = (error?.message || '').toLowerCase();
    expect(msg).toMatch(/denied|superadmin|permission|unauthorized|not found/);
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
//    Uses real DB rows — Org + Preschool with shared UUID.
// ─────────────────────────────────────────────────────────────
describeIfService('superadmin_update_entity_type — service-role happy path', () => {
  let service: ReturnType<typeof createClient>;
  let testId: string | null = null;
  let createdPlanId: string | null = null;

  beforeAll(async () => {
    service = makeServiceClient();

    // Ensure the preschool INSERT trigger has a starter plan to reference
    createdPlanId = await ensureStarterPlan(service);

    // Create a paired org + preschool with shared UUID
    testId = await createTestPair(service, `SA-TypeRPC-Test-${Date.now()}`);
  }, 30_000);

  afterAll(async () => {
    await cleanupTestPair(service, testId);
    // Remove temp starter plan if we created one
    if (createdPlanId) {
      await service.from('subscription_plans').delete().eq('id', createdPlanId);
    }
  });

  it('updates organization type and returns success', async () => {
    const { data, error } = await service.rpc('superadmin_update_entity_type', {
      p_entity_type: 'organization',
      p_entity_id: testId,
      p_next_type: 'daycare',
      p_sync_duplicates: false,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({
      success: true,
      entity_type: 'organization',
      entity_id: testId,
      next_type: 'daycare',
    });

    // Verify the org was updated
    const { data: org } = await service
      .from('organizations')
      .select('organization_type')
      .eq('id', testId)
      .single();
    expect(org?.organization_type).toBe('daycare');
  });

  it('syncs preschool type when p_sync_duplicates=true', async () => {
    const { data, error } = await service.rpc('superadmin_update_entity_type', {
      p_entity_type: 'organization',
      p_entity_id: testId,
      p_next_type: 'k12',
      p_sync_duplicates: true,
    });
    expect(error).toBeNull();
    expect(data?.success).toBe(true);

    // RPC maps org k12 → preschool school_type 'combined' (see CASE in migration)
    const { data: ps } = await service
      .from('preschools')
      .select('school_type')
      .eq('id', testId) // shared UUID — same id in both tables
      .single();
    expect(ps?.school_type).toBe('combined');
  });

  it('does NOT sync preschool when p_sync_duplicates=false', async () => {
    // Reset preschool to a known value
    await service
      .from('preschools')
      .update({ school_type: 'preschool' })
      .eq('id', testId);

    const { error } = await service.rpc('superadmin_update_entity_type', {
      p_entity_type: 'organization',
      p_entity_id: testId,
      p_next_type: 'tertiary',
      p_sync_duplicates: false,
    });
    expect(error).toBeNull();

    // Preschool should still be 'preschool' — NOT synced
    const { data: ps } = await service
      .from('preschools')
      .select('school_type')
      .eq('id', testId)
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
  let testId: string | null = null;
  let createdPlanId: string | null = null;
  const BASE_NAME = `ProfileTest-${Date.now()}`;

  beforeAll(async () => {
    service = makeServiceClient();

    createdPlanId = await ensureStarterPlan(service);

    testId = await createTestPair(service, BASE_NAME, {
      orgEmail: 'old@test.com',
      orgAddress: '123 Old St',
    });
  }, 30_000);

  afterAll(async () => {
    await cleanupTestPair(service, testId);
    if (createdPlanId) {
      await service.from('subscription_plans').delete().eq('id', createdPlanId);
    }
  });

  it('updates name and returns success', async () => {
    const newName = `${BASE_NAME}-Updated`;
    const { data, error } = await service.rpc('superadmin_update_entity_profile', {
      p_entity_type: 'organization',
      p_entity_id: testId,
      p_name: newName,
      p_sync_duplicates: false,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({
      success: true,
      entity_type: 'organization',
      entity_id: testId,
    });

    const { data: org } = await service
      .from('organizations')
      .select('name')
      .eq('id', testId)
      .single();
    expect(org?.name).toBe(newName);
  });

  it('uses COALESCE for optional fields — null params preserve existing values', async () => {
    // Set known values
    await service
      .from('organizations')
      .update({ contact_email: 'keep@test.com', address: '456 Keep Ave' })
      .eq('id', testId);

    // Update name only — should keep email and address
    const { error } = await service.rpc('superadmin_update_entity_profile', {
      p_entity_type: 'organization',
      p_entity_id: testId,
      p_name: 'COALESCE-Test',
      p_contact_email: null,
      p_address: null,
      p_sync_duplicates: false,
    });
    expect(error).toBeNull();

    const { data: org } = await service
      .from('organizations')
      .select('name, contact_email, address')
      .eq('id', testId)
      .single();
    expect(org?.name).toBe('COALESCE-Test');
    expect(org?.contact_email).toBe('keep@test.com');
    expect(org?.address).toBe('456 Keep Ave');
  });

  it('syncs profile to linked preschool when p_sync_duplicates=true', async () => {
    const syncedName = `Synced-${Date.now()}`;
    const { error } = await service.rpc('superadmin_update_entity_profile', {
      p_entity_type: 'organization',
      p_entity_id: testId,
      p_name: syncedName,
      p_contact_email: 'synced@test.com',
      p_sync_duplicates: true,
    });
    expect(error).toBeNull();

    // Verify preschool was synced (preschools uses `email`, not `contact_email`)
    const { data: ps } = await service
      .from('preschools')
      .select('name, email')
      .eq('id', testId) // shared UUID
      .single();
    expect(ps?.name).toBe(syncedName);
    expect(ps?.email).toBe('synced@test.com');
  });

  it('rejects empty name', async () => {
    const { error } = await service.rpc('superadmin_update_entity_profile', {
      p_entity_type: 'organization',
      p_entity_id: testId,
      p_name: '',
    });
    expect(error).toBeTruthy();
    const msg = (error?.message || '').toLowerCase();
    expect(msg).toMatch(/name|required|empty/);
  });

  it('supports preschool entity type directly', async () => {
    const { data, error } = await service.rpc('superadmin_update_entity_profile', {
      p_entity_type: 'preschool',
      p_entity_id: testId, // shared UUID — same id for both tables
      p_name: `Direct-PS-${Date.now()}`,
      p_sync_duplicates: false,
    });
    expect(error).toBeNull();
    expect(data?.success).toBe(true);
    expect(data?.entity_type).toBe('preschool');
  });
});
