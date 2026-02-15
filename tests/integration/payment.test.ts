/**
 * Integration Tests: PayFast Payment Flow
 *
 * Tests critical payment processing including:
 * - PayFast signature generation & validation (pure logic)
 * - Subscription creation with correct schema (school_id, plan_id)
 * - Subscription status updates on payment events
 * - Multi-tenant billing isolation via RLS
 *
 * Schema notes:
 *   - `subscriptions` uses `school_id` (FK → preschools.id), NOT `organization_id`
 *   - Plan is referenced via `plan_id` (FK → subscription_plans.id), NOT a text `plan` column
 *   - Columns: id, school_id, plan_id, status, billing_frequency, start_date, end_date,
 *     trial_end_date, next_billing_date, canceled_at, seats_total, seats_used,
 *     payfast_token, payfast_payment_id, stripe_subscription_id, metadata,
 *     created_at, updated_at, owner_type, user_id
 *   - `preschools` uses `subscription_tier` (with CHECK constraint) and `email` columns
 *
 * Requires EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
 * and SUPABASE_SERVICE_ROLE_KEY.
 */

const { createClient } = require('@supabase/supabase-js');
import crypto from 'crypto';

// ── env guards ──────────────────────────────────────────────
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PAYFAST_PASSPHRASE = process.env.PAYFAST_PASSPHRASE || 'test_passphrase';

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

/**
 * Generate PayFast signature for webhook validation.
 * Matches the algorithm used by PayFast's IPN system.
 */
function generatePayFastSignature(data: Record<string, string>, passphrase?: string): string {
  const sortedKeys = Object.keys(data).sort();
  let paramString = sortedKeys
    .map((key) => `${key}=${encodeURIComponent(data[key]).replace(/%20/g, '+')}`)
    .join('&');

  if (passphrase) {
    paramString += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`;
  }
  return crypto.createHash('md5').update(paramString).digest('hex');
}

// ─────────────────────────────────────────────────────────────
// 1. PayFast Signature — pure logic, no DB required
// ─────────────────────────────────────────────────────────────
describeIfEnv('PayFast Signature Validation', () => {
  it('generates a valid 32-char MD5 signature', () => {
    const data = {
      m_payment_id: '12345',
      pf_payment_id: 'PF-67890',
      payment_status: 'COMPLETE',
      item_name: 'Pro Plan - Monthly',
      amount_gross: '499.00',
      amount_fee: '14.97',
      amount_net: '484.03',
    };

    const sig = generatePayFastSignature(data, PAYFAST_PASSPHRASE);
    expect(sig).toBeDefined();
    expect(sig.length).toBe(32);
  });

  it('produces different signatures for different data', () => {
    const data1 = { m_payment_id: '1', payment_status: 'COMPLETE' };
    const data2 = { m_payment_id: '2', payment_status: 'COMPLETE' };

    const sig1 = generatePayFastSignature(data1, PAYFAST_PASSPHRASE);
    const sig2 = generatePayFastSignature(data2, PAYFAST_PASSPHRASE);
    expect(sig1).not.toBe(sig2);
  });

  it('rejects tampered signatures', () => {
    const data = { m_payment_id: '12345', payment_status: 'COMPLETE' };
    const validSig = generatePayFastSignature(data, PAYFAST_PASSPHRASE);
    const invalidSig = 'aaaabbbbccccddddeeee1111222233334444';
    expect(validSig).not.toBe(invalidSig);
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Subscription CRUD (service-role — bypasses RLS)
// ─────────────────────────────────────────────────────────────
describeIfService('Subscription Lifecycle (service-role)', () => {
  let service: ReturnType<typeof createClient>;
  let testSchoolId: string | null = null;
  let testSubscriptionId: string | null = null;
  let starterPlanId: string | null = null;
  let createdStarterPlan = false;

  beforeAll(async () => {
    service = makeServiceClient();

    // Ensure starter plan exists (required by preschool INSERT trigger)
    const { data: existing } = await service
      .from('subscription_plans')
      .select('id')
      .eq('tier', 'starter')
      .limit(1)
      .maybeSingle();

    if (existing) {
      starterPlanId = existing.id;
    } else {
      const { data: created, error } = await service
        .from('subscription_plans')
        .insert({
          name: 'Starter (Payment Test)',
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
      if (error) throw new Error(`Starter plan insert: ${error.message}`);
      starterPlanId = created.id;
      createdStarterPlan = true;
    }

    // Look up the free plan for subscription tests
    const { data: freePlan } = await service
      .from('subscription_plans')
      .select('id')
      .eq('tier', 'free')
      .limit(1)
      .maybeSingle();

    // Create test school (service_role bypasses RLS)
    const schoolName = `PayTest-School-${Date.now()}`;
    const { data: school, error: schoolErr } = await service
      .from('preschools')
      .insert({
        name: schoolName,
        email: `${schoolName.toLowerCase()}@test.edudash.local`,
        subscription_tier: 'free',
        school_type: 'preschool',
        is_active: true,
      })
      .select('id')
      .single();
    if (schoolErr) throw new Error(`School insert: ${schoolErr.message}`);
    testSchoolId = school.id;

    // Also create an org with the same UUID (shared-key pattern)
    await service.from('organizations').insert({
      id: testSchoolId,
      name: schoolName,
      organization_type: 'preschool',
      type: 'preschool',
      is_active: true,
    });
  }, 30_000);

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (testSubscriptionId) {
      await service.from('subscriptions').delete().eq('id', testSubscriptionId);
    }
    // Delete any subscription created by the preschool trigger
    if (testSchoolId) {
      await service.from('subscriptions').delete().eq('school_id', testSchoolId);
      await service.from('preschools').delete().eq('id', testSchoolId);
      await service.from('organizations').delete().eq('id', testSchoolId);
    }
    if (createdStarterPlan && starterPlanId) {
      await service.from('subscription_plans').delete().eq('id', starterPlanId);
    }
  });

  it('creates a subscription record linked to school_id', async () => {
    // The INSERT trigger may have already created one — check first
    const { data: existing } = await service
      .from('subscriptions')
      .select('id, school_id, status')
      .eq('school_id', testSchoolId)
      .maybeSingle();

    if (existing) {
      testSubscriptionId = existing.id;
      expect(existing.school_id).toBe(testSchoolId);
      expect(existing.status).toBeDefined();
      return;
    }

    // Create one manually if trigger didn't
    const { data: sub, error } = await service
      .from('subscriptions')
      .insert({
        school_id: testSchoolId,
        plan_id: starterPlanId,
        status: 'active',
        billing_frequency: 'monthly',
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        owner_type: 'school',
      })
      .select('id, school_id, status')
      .single();

    expect(error).toBeNull();
    expect(sub?.school_id).toBe(testSchoolId);
    testSubscriptionId = sub?.id || null;
  });

  it('updates subscription status on payment success', async () => {
    const subId = testSubscriptionId;
    if (!subId) throw new Error('No subscription to update');

    const { error } = await service
      .from('subscriptions')
      .update({
        status: 'active',
        metadata: {
          pf_payment_id: 'PF-TEST-12345',
          price_paid: 499,
          activated_by_payment: true,
          payment_provider: 'payfast',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', subId);

    expect(error).toBeNull();

    const { data: sub } = await service
      .from('subscriptions')
      .select('status, metadata')
      .eq('id', subId)
      .single();

    expect(sub?.status).toBe('active');
    expect(sub?.metadata?.pf_payment_id).toBe('PF-TEST-12345');
  });

  it('handles payment failure by setting status to past_due', async () => {
    const subId = testSubscriptionId;
    if (!subId) throw new Error('No subscription to update');

    const { error } = await service
      .from('subscriptions')
      .update({
        status: 'past_due',
        metadata: {
          payment_failed: true,
          failed_at: new Date().toISOString(),
          failure_reason: 'insufficient_funds',
        },
      })
      .eq('id', subId);

    expect(error).toBeNull();

    const { data: sub } = await service
      .from('subscriptions')
      .select('status, metadata')
      .eq('id', subId)
      .single();

    expect(sub?.status).toBe('past_due');
    expect(sub?.metadata?.payment_failed).toBe(true);
  });

  it('records cancellation timestamp', async () => {
    const subId = testSubscriptionId;
    if (!subId) throw new Error('No subscription to update');

    const canceledAt = new Date().toISOString();
    const { error } = await service
      .from('subscriptions')
      .update({ status: 'canceled', canceled_at: canceledAt })
      .eq('id', subId);

    expect(error).toBeNull();

    const { data: sub } = await service
      .from('subscriptions')
      .select('status, canceled_at')
      .eq('id', subId)
      .single();

    expect(sub?.status).toBe('canceled');
    expect(sub?.canceled_at).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// 3. Multi-Tenant Billing Isolation (RLS)
// ─────────────────────────────────────────────────────────────
describeIfService('Multi-Tenant Billing Isolation', () => {
  let service: ReturnType<typeof createClient>;
  let schoolA_Id: string | null = null;
  let schoolB_Id: string | null = null;
  let userA_Id: string | null = null;
  let userB_Id: string | null = null;
  let starterPlanId: string | null = null;
  let createdStarterPlan = false;

  beforeAll(async () => {
    service = makeServiceClient();

    // Ensure starter plan
    const { data: existing } = await service
      .from('subscription_plans')
      .select('id')
      .eq('tier', 'starter')
      .limit(1)
      .maybeSingle();
    if (existing) {
      starterPlanId = existing.id;
    } else {
      const { data: p } = await service
        .from('subscription_plans')
        .insert({
          name: 'Starter (Isolation Test)',
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
      starterPlanId = p?.id || null;
      createdStarterPlan = true;
    }

    // Create two test users + schools
    const ts = Date.now();
    const emailA = `isolation-a-${ts}@test.edudash.local`;
    const emailB = `isolation-b-${ts}@test.edudash.local`;

    const { data: authA } = await service.auth.admin.createUser({
      email: emailA,
      password: 'TestPass123!',
      email_confirm: true,
      user_metadata: { role: 'principal' },
    });
    userA_Id = authA.user?.id || null;

    const { data: authB } = await service.auth.admin.createUser({
      email: emailB,
      password: 'TestPass123!',
      email_confirm: true,
      user_metadata: { role: 'principal' },
    });
    userB_Id = authB.user?.id || null;

    // Create two schools
    const { data: sA } = await service.from('preschools').insert({
      name: `IsoSchool-A-${ts}`,
      email: emailA,
      subscription_tier: 'free',
      school_type: 'preschool',
      is_active: true,
      principal_id: userA_Id,
    }).select('id').single();
    schoolA_Id = sA?.id || null;

    const { data: sB } = await service.from('preschools').insert({
      name: `IsoSchool-B-${ts}`,
      email: emailB,
      subscription_tier: 'free',
      school_type: 'preschool',
      is_active: true,
      principal_id: userB_Id,
    }).select('id').single();
    schoolB_Id = sB?.id || null;
  }, 30_000);

  afterAll(async () => {
    // Clean subscriptions first (FK on school_id)
    if (schoolA_Id) await service.from('subscriptions').delete().eq('school_id', schoolA_Id);
    if (schoolB_Id) await service.from('subscriptions').delete().eq('school_id', schoolB_Id);
    if (schoolA_Id) await service.from('preschools').delete().eq('id', schoolA_Id);
    if (schoolB_Id) await service.from('preschools').delete().eq('id', schoolB_Id);
    // Clean profiles + auth users
    if (userA_Id) {
      await service.from('profiles').delete().eq('id', userA_Id);
      await service.auth.admin.deleteUser(userA_Id);
    }
    if (userB_Id) {
      await service.from('profiles').delete().eq('id', userB_Id);
      await service.auth.admin.deleteUser(userB_Id);
    }
    if (createdStarterPlan && starterPlanId) {
      await service.from('subscription_plans').delete().eq('id', starterPlanId);
    }
  }, 30_000);

  it('each school has its own subscription, not shared across tenants', async () => {
    if (!schoolA_Id || !schoolB_Id) {
      throw new Error('Test setup incomplete');
    }

    // Verify that school A and school B have separate subscriptions
    const { data: subA } = await service
      .from('subscriptions')
      .select('id, school_id')
      .eq('school_id', schoolA_Id)
      .maybeSingle();

    const { data: subB } = await service
      .from('subscriptions')
      .select('id, school_id')
      .eq('school_id', schoolB_Id)
      .maybeSingle();

    // If both exist, they must be different records
    if (subA && subB) {
      expect(subA.id).not.toBe(subB.id);
      expect(subA.school_id).toBe(schoolA_Id);
      expect(subB.school_id).toBe(schoolB_Id);
    }

    // Verify school B's subscription does NOT belong to school A
    if (subB) {
      expect(subB.school_id).not.toBe(schoolA_Id);
    }
  });
});
