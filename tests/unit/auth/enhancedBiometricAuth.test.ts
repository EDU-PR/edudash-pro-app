const mockCheckCapabilities = jest.fn();
const mockAuthenticate = jest.fn();

jest.mock('@/services/BiometricAuthService', () => ({
  BiometricAuthService: {
    checkCapabilities: mockCheckCapabilities,
    authenticate: mockAuthenticate,
  },
}));

const mockStorage = {
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
};

const mockGetSessionsMap = jest.fn();
const mockSetSessionsMap = jest.fn(async () => undefined);
const mockSetActiveUserId = jest.fn(async () => undefined);
const mockSetRefreshTokenForUser = jest.fn(async () => undefined);
const mockGetRefreshTokenForUser = jest.fn();
const mockGetGlobalRefreshToken = jest.fn(async () => null);
const mockSetGlobalRefreshToken = jest.fn(async () => undefined);
const mockGetBiometricSession = jest.fn(async () => null);
const mockEnsureSessionInMap = jest.fn(async () => undefined);
const mockGetBiometricAccounts = jest.fn(async () => []);
const mockRemoveBiometricSession = jest.fn(async () => undefined);
const mockClearBiometricSession = jest.fn(async () => undefined);
const mockUpdateCachedProfile = jest.fn(async () => undefined);
const mockClearRefreshTokenForUser = jest.fn(async () => undefined);
const mockClearGlobalRefreshToken = jest.fn(async () => undefined);

jest.mock('@/services/biometricStorage', () => ({
  storage: mockStorage,
  BIOMETRIC_SESSION_KEY: 'biometric_session_token',
  generateSecureToken: jest.fn(async () => 'secure-token'),
  getSessionsMap: mockGetSessionsMap,
  setSessionsMap: mockSetSessionsMap,
  setActiveUserId: mockSetActiveUserId,
  setRefreshTokenForUser: mockSetRefreshTokenForUser,
  getRefreshTokenForUser: mockGetRefreshTokenForUser,
  getGlobalRefreshToken: mockGetGlobalRefreshToken,
  setGlobalRefreshToken: mockSetGlobalRefreshToken,
  getBiometricSession: mockGetBiometricSession,
  ensureSessionInMap: mockEnsureSessionInMap,
  getBiometricAccounts: mockGetBiometricAccounts,
  removeBiometricSession: mockRemoveBiometricSession,
  clearBiometricSession: mockClearBiometricSession,
  updateCachedProfile: mockUpdateCachedProfile,
  clearRefreshTokenForUser: mockClearRefreshTokenForUser,
  clearGlobalRefreshToken: mockClearGlobalRefreshToken,
  MAX_BIOMETRIC_ACCOUNTS: 3,
}));

const mockMainSupabase = {
  auth: {
    getSession: jest.fn(),
    refreshSession: jest.fn(),
    signOut: jest.fn(),
  },
};

jest.mock('@/lib/supabase', () => ({
  assertSupabase: () => mockMainSupabase,
  supabaseUrl: 'https://test.supabase.co',
  supabaseAnonKey: 'anon-key',
}));

const mockCreateClient = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

import { EnhancedBiometricAuth } from '@/services/EnhancedBiometricAuth';

describe('EnhancedBiometricAuth account switch reliability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckCapabilities.mockResolvedValue({
      isAvailable: true,
      isEnrolled: true,
    });
    mockAuthenticate.mockResolvedValue({ success: true });

    mockGetSessionsMap.mockResolvedValue({
      'target-user': {
        userId: 'target-user',
        email: 'target@example.com',
        sessionToken: 'tok',
        expiresAt: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
        lastUsed: new Date().toISOString(),
      },
    });

    mockMainSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'current-user' } } },
    });
    mockMainSupabase.auth.refreshSession.mockReset();
    mockMainSupabase.auth.signOut.mockResolvedValue({ error: null });
  });

  it('fails with target_refresh_missing when target token is absent', async () => {
    mockGetRefreshTokenForUser.mockResolvedValue(null);

    const result = await EnhancedBiometricAuth.authenticateWithBiometricForUser(
      'target-user',
    );

    expect(result.success).toBe(false);
    expect(result.reason).toBe('target_refresh_missing');
    expect(result.requiresPassword).toBe(true);
    expect(mockSetActiveUserId).not.toHaveBeenCalled();
    expect(mockSetSessionsMap).not.toHaveBeenCalled();
  });

  it('fails with target_refresh_invalid and clears token when refresh token is invalid', async () => {
    mockGetRefreshTokenForUser.mockResolvedValue('bad-token');
    mockMainSupabase.auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid Refresh Token: Refresh Token Not Found' },
    });

    const result = await EnhancedBiometricAuth.authenticateWithBiometricForUser(
      'target-user',
    );

    expect(result.success).toBe(false);
    expect(result.reason).toBe('target_refresh_invalid');
    expect(result.requiresPassword).toBe(true);
    expect(mockClearRefreshTokenForUser).toHaveBeenCalledWith('target-user');
    expect(mockSetActiveUserId).not.toHaveBeenCalled();
  });

  it('fails with wrong_user_restored when refresh resolves to another user', async () => {
    mockGetRefreshTokenForUser.mockResolvedValue('token');
    mockMainSupabase.auth.refreshSession.mockResolvedValue({
      data: { session: { user: { id: 'other-user' }, refresh_token: 'rotated' } },
      error: null,
    });

    const result = await EnhancedBiometricAuth.authenticateWithBiometricForUser(
      'target-user',
    );

    expect(result.success).toBe(false);
    expect(result.reason).toBe('wrong_user_restored');
    expect(mockMainSupabase.auth.signOut).toHaveBeenCalledWith({
      scope: 'local',
    });
    expect(mockSetActiveUserId).not.toHaveBeenCalled();
  });

  it('succeeds only when target user is restored and then updates active user', async () => {
    mockGetRefreshTokenForUser.mockResolvedValue('token');
    mockMainSupabase.auth.refreshSession.mockResolvedValue({
      data: { session: { user: { id: 'target-user' }, refresh_token: 'rotated' } },
      error: null,
    });

    const result = await EnhancedBiometricAuth.authenticateWithBiometricForUser(
      'target-user',
    );

    expect(result.success).toBe(true);
    expect(result.reason).toBe('ok');
    expect(result.sessionRestored).toBe(true);
    expect(mockSetRefreshTokenForUser).toHaveBeenCalledWith(
      'target-user',
      'rotated',
    );
    expect(mockSetActiveUserId).toHaveBeenCalledWith('target-user');
    expect(mockSetSessionsMap).toHaveBeenCalled();
  });
});

describe('EnhancedBiometricAuth global revoke outcomes', () => {
  const mockRevokeClient = {
    auth: {
      refreshSession: jest.fn(),
      signOut: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateClient.mockReturnValue(mockRevokeClient);
    mockRevokeClient.auth.refreshSession.mockReset();
    mockRevokeClient.auth.signOut.mockReset();
    mockRevokeClient.auth.signOut.mockResolvedValue({ error: null });
  });

  it('returns token_missing when no saved token exists', async () => {
    mockGetRefreshTokenForUser.mockResolvedValue(null);
    const result = await EnhancedBiometricAuth.revokeSavedAccountSessionsGlobally(
      'target-user',
    );
    expect(result.globalRevokeStatus).toBe('token_missing');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('returns token_invalid and clears saved token for invalid refresh token', async () => {
    mockGetRefreshTokenForUser.mockResolvedValue('bad-token');
    mockRevokeClient.auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'refresh token not found' },
    });

    const result = await EnhancedBiometricAuth.revokeSavedAccountSessionsGlobally(
      'target-user',
    );

    expect(result.globalRevokeStatus).toBe('token_invalid');
    expect(mockClearRefreshTokenForUser).toHaveBeenCalledWith('target-user');
  });

  it('returns wrong_user when refresh resolves to another user', async () => {
    mockGetRefreshTokenForUser.mockResolvedValue('token');
    mockRevokeClient.auth.refreshSession.mockResolvedValue({
      data: { session: { user: { id: 'other-user' } } },
      error: null,
    });

    const result = await EnhancedBiometricAuth.revokeSavedAccountSessionsGlobally(
      'target-user',
    );

    expect(result.globalRevokeStatus).toBe('wrong_user');
    expect(mockRevokeClient.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('returns revoked_global when global sign out succeeds', async () => {
    mockGetRefreshTokenForUser.mockResolvedValue('token');
    mockRevokeClient.auth.refreshSession.mockResolvedValue({
      data: { session: { user: { id: 'target-user' } } },
      error: null,
    });
    mockRevokeClient.auth.signOut.mockResolvedValueOnce({ error: null });
    mockRevokeClient.auth.signOut.mockResolvedValueOnce({ error: null });

    const result = await EnhancedBiometricAuth.revokeSavedAccountSessionsGlobally(
      'target-user',
    );

    expect(result.globalRevokeStatus).toBe('revoked_global');
    expect(mockRevokeClient.auth.signOut).toHaveBeenNthCalledWith(1, {
      scope: 'global',
    });
  });
});
