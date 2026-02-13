/**
 * Auth Storage Keys
 *
 * Centralised list of storage keys related to auth/session.
 * Used by the SIGNED_OUT handler and unified sign-out to ensure complete cleanup.
 */

/** All storage keys that must be purged on sign-out. */
export const AUTH_STORAGE_KEYS = [
  'edudash-auth-session',      // Supabase session (storageKey config)
  'edudash_session',           // Legacy session key
  'edudash_profile',           // Cached profile
  'edudash_user_session',      // Legacy user session
  'edudash_user_profile',      // Legacy user profile
  '@edudash_active_child_id',  // Active child for parent role
  'edudash_active_child_id',   // Alternative child key
] as const;

/**
 * Clear all auth-related storage keys.
 * Swallows errors — safe to call fire-and-forget.
 */
export async function clearAuthStorage(
  storage: { removeItem: (key: string) => Promise<void> | void }
): Promise<void> {
  await Promise.allSettled(
    AUTH_STORAGE_KEYS.map((key) => Promise.resolve(storage.removeItem(key)))
  );
}
