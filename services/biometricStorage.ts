/**
 * Biometric Storage Module
 *
 * Low-level storage operations for biometric session management.
 * Handles storage adapter selection, session CRUD, refresh token management,
 * and multi-account session map persistence.
 *
 * @module biometricStorage
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Storage adapter setup
// ---------------------------------------------------------------------------

// Dynamically import SecureStore to avoid web issues
let SecureStore: any = null;
try {
  if (Platform.OS !== 'web') {
    SecureStore = require('expo-secure-store');
  }
} catch (e) {
  console.debug('SecureStore import failed (web or unsupported platform)', e);
}

// Dynamically require AsyncStorage to avoid web/test issues
let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  console.debug('AsyncStorage import failed (non-React Native env?)', e);
  // Web fallback using localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    AsyncStorage = {
      getItem: async (key: string) => {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // ignore
        }
      },
      removeItem: async (key: string) => {
        try {
          window.localStorage.removeItem(key);
        } catch {
          // ignore
        }
      },
    };
  }
}

// SecureStore adapter (preferred for iOS). Note: SecureStore has a ~2KB limit per item on Android.
const SecureStoreAdapter = SecureStore
  ? {
      getItem: (key: string) => SecureStore.getItemAsync(key),
      setItem: (key: string, value: string) =>
        SecureStore.setItemAsync(key, value, { keychainService: key }),
      removeItem: (key: string) => SecureStore.deleteItemAsync(key),
    }
  : null;

// AsyncStorage adapter (preferred for Android, no 2KB limit)
const AsyncStorageAdapter = AsyncStorage
  ? {
      getItem: (key: string) => AsyncStorage.getItem(key),
      setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: (key: string) => AsyncStorage.removeItem(key),
    }
  : null;

// In-memory fallback for tests or environments without the above storages
const MemoryStorageAdapter = {
  _map: new Map<string, string>(),
  getItem: async (key: string) =>
    MemoryStorageAdapter._map.has(key) ? MemoryStorageAdapter._map.get(key)! : null,
  setItem: async (key: string, value: string) => {
    MemoryStorageAdapter._map.set(key, value);
  },
  removeItem: async (key: string) => {
    MemoryStorageAdapter._map.delete(key);
  },
};

function chooseStorage() {
  try {
    if (Platform?.OS === 'web') {
      if (AsyncStorageAdapter) return AsyncStorageAdapter;
      return MemoryStorageAdapter;
    }
    if (Platform?.OS === 'android' && AsyncStorageAdapter) return AsyncStorageAdapter;
    if (SecureStoreAdapter) return SecureStoreAdapter;
    if (AsyncStorageAdapter) return AsyncStorageAdapter;
  } catch (e) {
    console.debug('chooseStorage unexpected error', e);
  }
  return MemoryStorageAdapter;
}

/** Primary storage backend selected for this platform */
export const storage = chooseStorage();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BIOMETRIC_SESSION_KEY = 'biometric_session_token';
export const BIOMETRIC_USER_PROFILE_KEY = 'biometric_user_profile';
export const BIOMETRIC_REFRESH_TOKEN_KEY = 'biometric_refresh_token';
export const BIOMETRIC_SESSIONS_KEY = 'biometric_sessions_v2';
export const BIOMETRIC_ACTIVE_USER_ID_KEY = 'biometric_active_user_id_v2';
export const MAX_BIOMETRIC_ACCOUNTS = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BiometricSessionData {
  userId: string;
  email: string;
  sessionToken: string;
  expiresAt: string;
  lastUsed: string;
  profileSnapshot?: any;
}

// ---------------------------------------------------------------------------
// Low-level storage helpers
// ---------------------------------------------------------------------------

export async function getSessionsMap(): Promise<Record<string, BiometricSessionData>> {
  try {
    const raw = await storage.getItem(BIOMETRIC_SESSIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed) return {};

    if (Array.isArray(parsed)) {
      const migrated: Record<string, BiometricSessionData> = {};
      parsed.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const userId = String((item as any).userId || '').trim();
        if (!userId) return;
        migrated[userId] = item as BiometricSessionData;
      });
      return migrated;
    }

    if (typeof parsed === 'object') {
      return parsed as Record<string, BiometricSessionData>;
    }

    return {};
  } catch {
    return {};
  }
}

export async function setSessionsMap(
  map: Record<string, BiometricSessionData>,
): Promise<void> {
  await storage.setItem(BIOMETRIC_SESSIONS_KEY, JSON.stringify(map));
}

export async function getActiveUserId(): Promise<string | null> {
  try {
    const raw = await storage.getItem(BIOMETRIC_ACTIVE_USER_ID_KEY);
    if (raw) return raw;
    // One-time migration: check legacy SecureStore location
    if (SecureStore) {
      const legacy = await SecureStore.getItemAsync(BIOMETRIC_ACTIVE_USER_ID_KEY).catch(
        () => null,
      );
      if (legacy) {
        await storage.setItem(BIOMETRIC_ACTIVE_USER_ID_KEY, legacy);
        await SecureStore.deleteItemAsync(BIOMETRIC_ACTIVE_USER_ID_KEY).catch(() => {
          /* Intentional */
        });
        return legacy;
      }
    }
  } catch {
    /* Intentional: non-fatal */
  }
  return null;
}

export async function setActiveUserId(userId: string): Promise<void> {
  try {
    await storage.setItem(BIOMETRIC_ACTIVE_USER_ID_KEY, userId);
  } catch {
    /* Intentional: non-fatal */
  }
}

function makeRefreshKey(userId: string): string {
  return `biometric_refresh_token_${userId}`;
}

export async function setRefreshTokenForUser(
  userId: string,
  token: string,
): Promise<void> {
  try {
    if (SecureStore) {
      await SecureStore.setItemAsync(makeRefreshKey(userId), token);
    } else if (AsyncStorage) {
      await AsyncStorage.setItem(makeRefreshKey(userId), token);
    }
  } catch {
    /* Intentional: non-fatal */
  }
}

export async function getRefreshTokenForUser(
  userId: string,
): Promise<string | null> {
  try {
    if (SecureStore) {
      return await SecureStore.getItemAsync(makeRefreshKey(userId));
    } else if (AsyncStorage) {
      return await AsyncStorage.getItem(makeRefreshKey(userId));
    }
  } catch {
    /* Intentional: non-fatal */
  }
  return null;
}

export async function clearRefreshTokenForUser(userId: string): Promise<void> {
  try {
    if (SecureStore) {
      await SecureStore.deleteItemAsync(makeRefreshKey(userId));
    } else if (AsyncStorage) {
      await AsyncStorage.removeItem(makeRefreshKey(userId));
    }
  } catch {
    /* Intentional: non-fatal */
  }
}

export async function ensureSessionInMap(
  session: BiometricSessionData,
): Promise<void> {
  try {
    const sessions = await getSessionsMap();
    if (!sessions[session.userId]) {
      sessions[session.userId] = session;
      await setSessionsMap(sessions);
    }
    await setActiveUserId(session.userId);
  } catch (e) {
    console.warn('ensureSessionInMap failed:', e);
  }
}

// ---------------------------------------------------------------------------
// Global refresh token (legacy, used as last-resort fallback)
// ---------------------------------------------------------------------------

export async function getGlobalRefreshToken(): Promise<string | null> {
  try {
    if (SecureStore) return await SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY);
    if (AsyncStorage) return await AsyncStorage.getItem(BIOMETRIC_REFRESH_TOKEN_KEY);
  } catch {
    /* Intentional: non-fatal */
  }
  return null;
}

export async function setGlobalRefreshToken(token: string): Promise<void> {
  try {
    if (SecureStore) {
      await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, token);
    } else if (AsyncStorage) {
      await AsyncStorage.setItem(BIOMETRIC_REFRESH_TOKEN_KEY, token);
    }
  } catch {
    /* Intentional: non-fatal */
  }
}

export async function clearGlobalRefreshToken(): Promise<void> {
  try {
    if (SecureStore) {
      await SecureStore.deleteItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY);
    } else if (AsyncStorage) {
      await AsyncStorage.removeItem(BIOMETRIC_REFRESH_TOKEN_KEY);
    }
  } catch {
    /* Intentional: non-fatal */
  }
}

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

/**
 * Get stored biometric session data (active user or legacy fallback)
 */
export async function getBiometricSession(): Promise<BiometricSessionData | null> {
  try {
    // Prefer v2 active user session
    const activeId = await getActiveUserId();
    if (activeId) {
      const sessions = await getSessionsMap();
      const sessionData = sessions[activeId];
      if (sessionData) {
        if (new Date(sessionData.expiresAt) < new Date()) {
          if (__DEV__) console.log('Biometric session expired for active user, clearing');
          await removeBiometricSession(activeId);
          return null;
        }
        return sessionData;
      }
    }

    // Legacy single-session fallback
    const raw = await storage.getItem(BIOMETRIC_SESSION_KEY);
    if (!raw) return null;

    const sessionData: BiometricSessionData = JSON.parse(raw);
    if (new Date(sessionData.expiresAt) < new Date()) {
      if (__DEV__) console.log('Biometric session expired, clearing data');
      await clearBiometricSession();
      return null;
    }
    return sessionData;
  } catch (error) {
    console.error('Error getting biometric session:', error);
    return null;
  }
}

/**
 * Clear all stored biometric sessions (v2 multi-account + legacy)
 */
export async function clearBiometricSession(): Promise<void> {
  try {
    await storage.removeItem(BIOMETRIC_SESSION_KEY);
    await storage.removeItem(BIOMETRIC_USER_PROFILE_KEY);

    // V2: remove all sessions and per-user refresh tokens
    try {
      const sessions = await getSessionsMap();
      for (const uid of Object.keys(sessions)) {
        await clearRefreshTokenForUser(uid);
      }
      await storage.removeItem(BIOMETRIC_SESSIONS_KEY);
      if (SecureStore) {
        await SecureStore.deleteItemAsync(BIOMETRIC_ACTIVE_USER_ID_KEY).catch(() => {
          /* Intentional */
        });
      } else if (AsyncStorage) {
        await AsyncStorage.removeItem(BIOMETRIC_ACTIVE_USER_ID_KEY).catch(() => {
          /* Intentional */
        });
      }
    } catch {
      /* Intentional: non-fatal */
    }

    await clearGlobalRefreshToken();
  } catch (error) {
    console.error('Error clearing biometric session:', error);
  }
}

/**
 * Get a list of biometric accounts stored on device (multi-account)
 */
export async function getBiometricAccounts(): Promise<
  Array<{ userId: string; email: string; lastUsed: string; expiresAt: string }>
> {
  try {
    const sessions = await getSessionsMap();
    const accountsMap: Record<
      string,
      { userId: string; email: string; lastUsed: string; expiresAt: string }
    > = {};

    Object.values(sessions).forEach((s) => {
      accountsMap[s.userId] = {
        userId: s.userId,
        email: s.email,
        lastUsed: s.lastUsed,
        expiresAt: s.expiresAt,
      };
    });

    // Also include legacy single-session if present and not already in map
    try {
      const legacy = await storage.getItem(BIOMETRIC_SESSION_KEY);
      if (legacy) {
        const s: BiometricSessionData = JSON.parse(legacy);
        if (s?.userId && !accountsMap[s.userId]) {
          accountsMap[s.userId] = {
            userId: s.userId,
            email: s.email,
            lastUsed: s.lastUsed,
            expiresAt: s.expiresAt,
          };
        }
      }
    } catch {
      /* Intentional: non-fatal */
    }

    // Include legacy BiometricAuthService payload (single-account format)
    // so users upgrading from older app versions still see their account.
    try {
      let legacyUserRaw: string | null = null;
      if (SecureStore) {
        legacyUserRaw = await SecureStore.getItemAsync('biometric_user_data').catch(
          () => null,
        );
      }
      if (!legacyUserRaw && AsyncStorage) {
        legacyUserRaw = await AsyncStorage.getItem('biometric_user_data');
      }
      if (legacyUserRaw) {
        const parsed = JSON.parse(legacyUserRaw);
        const userId = String(parsed?.userId || '').trim();
        const email = String(parsed?.email || '').trim();
        if (userId && !accountsMap[userId]) {
          const nowIso = new Date().toISOString();
          accountsMap[userId] = {
            userId,
            email,
            lastUsed: typeof parsed?.lastUsed === 'string' ? parsed.lastUsed : nowIso,
            expiresAt: typeof parsed?.enabledAt === 'string' ? parsed.enabledAt : nowIso,
          };
        }
      }
    } catch {
      /* Intentional: non-fatal */
    }

    let accounts = Object.values(accountsMap).filter((account) => !!account.userId);
    accounts.sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime(),
    );
    // Enforce max: return only the most recently used up to MAX_BIOMETRIC_ACCOUNTS
    if (accounts.length > MAX_BIOMETRIC_ACCOUNTS) {
      accounts = accounts.slice(0, MAX_BIOMETRIC_ACCOUNTS);
      // Persist trimmed sessions so storage stays in sync
      const sessions = await getSessionsMap();
      const keepIds = new Set(accounts.map((a) => a.userId));
      const pruned = Object.fromEntries(
        Object.entries(sessions).filter(([id]) => keepIds.has(id)),
      );
      await setSessionsMap(pruned);
    }
    return accounts;
  } catch {
    return [];
  }
}

/**
 * Remove a specific biometric session by user id
 */
export async function removeBiometricSession(userId: string): Promise<void> {
  try {
    const sessions = await getSessionsMap();
    if (sessions[userId]) {
      delete sessions[userId];
      await setSessionsMap(sessions);
    }
    await clearRefreshTokenForUser(userId);

    // Clear legacy single-session key if it belongs to this user.
    try {
      const legacySessionRaw = await storage.getItem(BIOMETRIC_SESSION_KEY);
      if (legacySessionRaw) {
        const parsed = JSON.parse(legacySessionRaw);
        if (parsed?.userId === userId) {
          await storage.removeItem(BIOMETRIC_SESSION_KEY);
        }
      }
    } catch {
      /* Intentional: non-fatal */
    }

    // Clear legacy biometric user payload if it belongs to this user.
    try {
      let legacyUserRaw: string | null = null;
      if (SecureStore) {
        legacyUserRaw = await SecureStore.getItemAsync('biometric_user_data').catch(
          () => null,
        );
      }
      if (!legacyUserRaw && AsyncStorage) {
        legacyUserRaw = await AsyncStorage.getItem('biometric_user_data');
      }
      if (legacyUserRaw) {
        const parsed = JSON.parse(legacyUserRaw);
        if (String(parsed?.userId || '') === userId) {
          if (SecureStore) {
            await SecureStore.deleteItemAsync('biometric_user_data').catch(() => {
              /* Intentional */
            });
          }
          if (AsyncStorage) {
            await AsyncStorage.removeItem('biometric_user_data').catch(() => {
              /* Intentional */
            });
          }
        }
      }
    } catch {
      /* Intentional: non-fatal */
    }

    const active = await getActiveUserId();
    if (active === userId) {
      await setActiveUserId('');
    }
  } catch (e) {
    console.warn('removeBiometricSession error:', e);
  }
}

/**
 * Update cached profile data for the active biometric session
 */
export async function updateCachedProfile(profile: any): Promise<void> {
  try {
    const sessionData = await getBiometricSession();
    if (sessionData) {
      sessionData.profileSnapshot = {
        role: profile.role,
        organization_id: profile.organization_id,
        seat_status: profile.seat_status,
        cached_at: new Date().toISOString(),
      };
      await storage.setItem(BIOMETRIC_SESSION_KEY, JSON.stringify(sessionData));
    }
  } catch (error) {
    console.error('Error updating cached profile:', error);
  }
}

/**
 * Generate a secure token for session management
 */
export async function generateSecureToken(): Promise<string> {
  try {
    const { generateSecureToken: genToken } = await import('@/utils/crypto');
    return await genToken(32);
  } catch (error) {
    console.error('Error generating secure token:', error);
    const timestamp = Date.now().toString(16);
    const random1 = Math.random().toString(16).substring(2);
    const random2 = Math.random().toString(16).substring(2);
    const random3 = Math.random().toString(16).substring(2);
    return (timestamp + random1 + random2 + random3).substring(0, 64);
  }
}
