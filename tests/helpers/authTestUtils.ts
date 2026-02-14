/**
 * Auth Test Utilities
 *
 * Factory functions and mock builders for auth-related tests.
 * Centralises profile/session/user creation to keep tests DRY.
 *
 * ≤300 lines per WARP.md (type definitions file)
 */

import type { User, Session } from '@supabase/supabase-js';

// ── Profile factories ─────────────────────────────────────────

export interface MockProfileOverrides {
  id?: string;
  email?: string;
  role?: string;
  organization_id?: string | null;
  organization_name?: string | null;
  preschool_id?: string | null;
  seat_status?: string;
  capabilities?: string[];
  first_name?: string;
  last_name?: string;
  full_name?: string;
  organization_membership?: {
    organization_id?: string;
    organization_name?: string;
    plan_tier?: string;
    seat_status?: string;
    member_type?: string;
    school_type?: string;
    organization_kind?: string;
    joined_at?: string;
    membership_status?: string;
  } | null;
}

export function createMockProfile(overrides: MockProfileOverrides = {}) {
  const id = overrides.id ?? 'user-test-001';
  const caps = overrides.capabilities ?? ['access_mobile_app'];

  // Use hasOwnProperty checks so explicit `null` values are preserved (not swallowed by `??`)
  const hasOrgId = 'organization_id' in overrides;
  const hasPsId = 'preschool_id' in overrides;
  const hasOrgMembership = 'organization_membership' in overrides;

  const orgId = hasOrgId ? overrides.organization_id : 'org-test-001';
  const preschoolId = hasPsId ? overrides.preschool_id : (hasOrgId ? overrides.organization_id : 'org-test-001');
  const orgMembership = hasOrgMembership
    ? overrides.organization_membership
    : {
        organization_id: orgId ?? 'org-test-001',
        organization_name: overrides.organization_name ?? 'Test School',
        plan_tier: 'school_premium',
        seat_status: 'active',
        member_type: 'admin',
        school_type: 'preschool',
        joined_at: '2025-01-01T00:00:00Z',
      };

  return {
    id,
    email: overrides.email ?? 'test@edudashpro.org.za',
    role: overrides.role ?? 'admin',
    organization_id: orgId,
    organization_name: overrides.organization_name ?? 'Test School',
    preschool_id: preschoolId,
    seat_status: overrides.seat_status ?? 'active',
    capabilities: caps,
    first_name: overrides.first_name ?? 'Test',
    last_name: overrides.last_name ?? 'User',
    full_name: overrides.full_name ?? 'Test User',
    organization_membership: orgMembership,
    hasCapability: (cap: string) => caps.includes(cap),
    hasRole: (r: string) => (overrides.role ?? 'admin') === r,
    hasRoleOrHigher: (r: string) => (overrides.role ?? 'admin') === r,
    isOrgMember: (orgId: string) => orgId === (hasOrgId ? overrides.organization_id : 'org-test-001'),
    hasActiveSeat: () => true,
  };
}

export function createMockEnhancedProfile(overrides: MockProfileOverrides = {}) {
  return createMockProfile(overrides);
}

// ── User factory ──────────────────────────────────────────────

export function createMockUser(overrides: Partial<User> & Record<string, any> = {}): User {
  return {
    id: overrides.id ?? 'user-test-001',
    aud: 'authenticated',
    role: 'authenticated',
    email: overrides.email ?? 'test@edudashpro.org.za',
    email_confirmed_at: '2025-01-01T00:00:00Z',
    phone: '',
    confirmed_at: '2025-01-01T00:00:00Z',
    last_sign_in_at: new Date().toISOString(),
    created_at: '2025-01-01T00:00:00Z',
    updated_at: new Date().toISOString(),
    app_metadata: { provider: 'email', ...overrides.app_metadata },
    user_metadata: {
      role: overrides.user_metadata?.role ?? 'admin',
      organization_id: overrides.user_metadata?.organization_id ?? 'org-test-001',
      ...overrides.user_metadata,
    },
    identities: [],
    factors: [],
    ...overrides,
  } as User;
}

// ── Session factory ───────────────────────────────────────────

export function createMockSession(
  overrides: Omit<Partial<Session>, 'user'> & { user?: Partial<User> & Record<string, any> } = {},
): Session {
  const { user: userOverrides, ...sessionOverrides } = overrides;
  const user = createMockUser(userOverrides);
  return {
    access_token: sessionOverrides.access_token ?? 'test-access-token',
    refresh_token: sessionOverrides.refresh_token ?? 'test-refresh-token',
    expires_in: sessionOverrides.expires_in ?? 3600,
    expires_at: sessionOverrides.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user,
    ...sessionOverrides,
  } as Session;
}

// ── Mock Supabase client ──────────────────────────────────────

export function mockSupabaseClient(overrides: {
  getSession?: any;
  getUser?: any;
  signOut?: any;
  onAuthStateChange?: any;
  rpc?: any;
} = {}) {
  return {
    auth: {
      getSession: jest.fn().mockResolvedValue(
        overrides.getSession ?? { data: { session: null }, error: null }
      ),
      getUser: jest.fn().mockResolvedValue(
        overrides.getUser ?? { data: { user: null }, error: null }
      ),
      signOut: jest.fn().mockResolvedValue(
        overrides.signOut ?? { error: null }
      ),
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      }),
      onAuthStateChange: jest.fn().mockReturnValue(
        overrides.onAuthStateChange ?? { data: { subscription: { unsubscribe: jest.fn() } } }
      ),
    },
    rpc: jest.fn().mockResolvedValue(
      overrides.rpc ?? { data: null, error: null }
    ),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: null, error: null }),
        createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.url' }, error: null }),
      }),
    },
  };
}

// ── Mock router ───────────────────────────────────────────────

export function createMockRouter() {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canDismiss: jest.fn(() => false),
    dismissAll: jest.fn(),
  };
}

// ── SignedInDeps factory ──────────────────────────────────────

export function createMockSignedInDeps(overrides: Record<string, any> = {}) {
  return {
    mounted: true,
    setProfile: jest.fn(),
    setPermissions: jest.fn(),
    setProfileLoading: jest.fn(),
    profileRef: { current: null },
    profileLoadingRef: { current: false },
    // In AuthContext, lastUserIdRef is set to the new user's ID
    // BEFORE handleSignedIn is called — mirror that in tests.
    lastUserIdRef: { current: overrides.lastUserIdRef?.current ?? 'user-test-001' },
    signedInGenerationRef: { current: 0 },
    orgNameRefreshTimerRef: { current: null },
    showLoadingOverlay: jest.fn(),
    hideLoadingOverlay: jest.fn(),
    ...overrides,
  };
}

// ── Assertion helpers ─────────────────────────────────────────

export function expectNavigatedTo(mockReplace: jest.Mock, path: string) {
  const calls = mockReplace.mock.calls;
  const matchingCall = calls.find((c: any[]) => {
    const arg = c[0];
    if (typeof arg === 'string') return arg === path;
    if (arg?.pathname) return arg.pathname === path;
    return false;
  });
  expect(matchingCall).toBeDefined();
}

export function expectNoNavigation(mockReplace: jest.Mock) {
  expect(mockReplace).not.toHaveBeenCalled();
}

// ── Time helpers ──────────────────────────────────────────────

export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function advanceAndFlush(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  await flushPromises();
}
