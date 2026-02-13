/**
 * Tests for lib/auth/authStorageKeys.ts
 *
 * Verifies AUTH_STORAGE_KEYS list and clearAuthStorage behaviour.
 */

import { AUTH_STORAGE_KEYS, clearAuthStorage } from '@/lib/auth/authStorageKeys';

describe('AUTH_STORAGE_KEYS', () => {
  it('contains expected key count', () => {
    expect(AUTH_STORAGE_KEYS.length).toBeGreaterThanOrEqual(5);
  });

  it('includes auth session key', () => {
    const hasAuthKey = AUTH_STORAGE_KEYS.some(
      (k) => k.includes('auth') || k.includes('session'),
    );
    expect(hasAuthKey).toBe(true);
  });
});

describe('clearAuthStorage', () => {
  it('calls removeItem for every key', async () => {
    const removed: string[] = [];
    const mockStorage = {
      removeItem: jest.fn(async (key: string) => {
        removed.push(key);
      }),
    };

    await clearAuthStorage(mockStorage as any);

    expect(removed.length).toBe(AUTH_STORAGE_KEYS.length);
    AUTH_STORAGE_KEYS.forEach((key) => {
      expect(removed).toContain(key);
    });
  });

  it('does not throw if removeItem rejects', async () => {
    const failingStorage = {
      removeItem: jest.fn(async () => {
        throw new Error('storage unavailable');
      }),
    };

    // Should not throw
    await expect(
      clearAuthStorage(failingStorage as any),
    ).resolves.not.toThrow();
  });
});
