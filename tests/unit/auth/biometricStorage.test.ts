import AsyncStorageModule from '@react-native-async-storage/async-storage';
import {
  BIOMETRIC_SESSION_KEY,
  getActiveUserId,
  getSessionsMap,
  removeBiometricSession,
  setActiveUserId,
  setRefreshTokenForUser,
  setSessionsMap,
  storage,
  type BiometricSessionData,
} from '@/services/biometricStorage';

describe('biometricStorage.removeBiometricSession', () => {
  const AsyncStorage = AsyncStorageModule as any;
  let memory: Map<string, string>;

  beforeEach(() => {
    memory = new Map<string, string>();

    AsyncStorage.getItem.mockImplementation(async (key: string) =>
      memory.has(key) ? memory.get(key)! : null,
    );
    AsyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
      memory.set(key, value);
    });
    AsyncStorage.removeItem.mockImplementation(async (key: string) => {
      memory.delete(key);
    });
    AsyncStorage.clear.mockImplementation(async () => {
      memory.clear();
    });
  });

  const makeSession = (userId: string, email: string): BiometricSessionData => ({
    userId,
    email,
    sessionToken: `${userId}-token`,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    lastUsed: new Date().toISOString(),
  });

  it('removes session map entry, active marker, and matching legacy keys', async () => {
    await setSessionsMap({
      'user-1': makeSession('user-1', 'u1@example.com'),
      'user-2': makeSession('user-2', 'u2@example.com'),
    });
    await setActiveUserId('user-1');
    await setRefreshTokenForUser('user-1', 'refresh-user-1');
    await storage.setItem(
      BIOMETRIC_SESSION_KEY,
      JSON.stringify(makeSession('user-1', 'u1@example.com')),
    );
    await AsyncStorage.setItem(
      'biometric_user_data',
      JSON.stringify({ userId: 'user-1', email: 'u1@example.com' }),
    );

    await removeBiometricSession('user-1');

    const sessions = await getSessionsMap();
    expect(Object.keys(sessions)).toEqual(['user-2']);
    expect(await getActiveUserId()).toBeNull();
    expect(await storage.getItem(BIOMETRIC_SESSION_KEY)).toBeNull();
    expect(await AsyncStorage.getItem('biometric_user_data')).toBeNull();
  });

  it('keeps non-matching legacy user payload intact', async () => {
    await setSessionsMap({
      'user-1': makeSession('user-1', 'u1@example.com'),
      'user-2': makeSession('user-2', 'u2@example.com'),
    });
    await AsyncStorage.setItem(
      'biometric_user_data',
      JSON.stringify({ userId: 'user-2', email: 'u2@example.com' }),
    );

    await removeBiometricSession('user-1');

    const raw = await AsyncStorage.getItem('biometric_user_data');
    expect(raw).toContain('user-2');
  });
});
