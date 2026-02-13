/**
 * Enhanced Biometric Authentication Service
 *
 * High-level biometric authentication flows: store sessions, authenticate,
 * switch accounts, and setup biometric for new users.
 *
 * Low-level storage is delegated to ./biometricStorage.
 */

import { BiometricAuthService } from './BiometricAuthService';
import {
  type BiometricSessionData,
  storage,
  BIOMETRIC_SESSION_KEY,
  generateSecureToken,
  getSessionsMap,
  setSessionsMap,
  setActiveUserId,
  setRefreshTokenForUser,
  getRefreshTokenForUser,
  getGlobalRefreshToken,
  setGlobalRefreshToken,
  getBiometricSession,
  ensureSessionInMap,
  getBiometricAccounts,
  removeBiometricSession,
  clearBiometricSession,
  updateCachedProfile,
} from './biometricStorage';

// Re-export for consumers that import from this module
export type { BiometricSessionData };
export {
  getBiometricAccounts,
  removeBiometricSession,
  clearBiometricSession,
  updateCachedProfile,
};

export class EnhancedBiometricAuth {
  /** Set the active biometric user id */
  public static setActiveUserId = setActiveUserId;

  // Delegate storage operations — kept on class for backward compatibility
  static getBiometricSession = getBiometricSession;
  static clearBiometricSession = clearBiometricSession;
  static getBiometricAccounts = getBiometricAccounts;
  static removeBiometricSession = removeBiometricSession;
  static updateCachedProfile = updateCachedProfile;

  /**
   * Store secure session data for biometric users (supports multi-account)
   */
  static async storeBiometricSession(
    userId: string,
    email: string,
    profile?: any,
    refreshToken?: string,
  ): Promise<boolean> {
    try {
      const expirationTime = new Date();
      expirationTime.setDate(expirationTime.getDate() + 30);

      const sessionData: BiometricSessionData = {
        userId,
        email,
        sessionToken: await generateSecureToken(),
        expiresAt: expirationTime.toISOString(),
        lastUsed: new Date().toISOString(),
        profileSnapshot: profile
          ? {
              role: profile.role,
              organization_id: profile.organization_id,
              seat_status: profile.seat_status,
              cached_at: new Date().toISOString(),
            }
          : undefined,
      };

      await storage.setItem(BIOMETRIC_SESSION_KEY, JSON.stringify(sessionData));

      // Persist refresh token separately
      try {
        let tokenToStore = refreshToken;
        if (!tokenToStore) {
          const { getCurrentSession } = await import('@/lib/sessionManager');
          const current = await getCurrentSession();
          tokenToStore = current?.refresh_token;
        }
        if (tokenToStore) {
          await setGlobalRefreshToken(tokenToStore);
          await setRefreshTokenForUser(userId, tokenToStore);
        }
      } catch (storeTokenErr) {
        console.warn('Could not store biometric refresh token:', storeTokenErr);
      }

      // V2 multi-account: store in sessions map and set active user
      try {
        const sessions = await getSessionsMap();
        sessions[userId] = sessionData;
        await setSessionsMap(sessions);
        await setActiveUserId(userId);
      } catch (e) {
        console.warn('Could not persist v2 biometric sessions map:', e);
      }

      if (__DEV__) console.log('Stored biometric session data for user:', email);
      return true;
    } catch (error) {
      console.error('Error storing biometric session:', error);
      return false;
    }
  }

  /**
   * Perform enhanced biometric authentication with session management
   */
  static async authenticateWithBiometric(): Promise<{
    success: boolean;
    userData?: BiometricSessionData;
    sessionRestored?: boolean;
    error?: string;
  }> {
    try {
      const capabilities = await BiometricAuthService.checkCapabilities();
      if (!capabilities.isAvailable || !capabilities.isEnrolled) {
        return {
          success: false,
          error:
            'Biometric authentication is not available or not enrolled on this device',
        };
      }

      const sessionData = await getBiometricSession();
      if (!sessionData) {
        return {
          success: false,
          error: 'No biometric session found. Please sign in with password first.',
        };
      }

      const authResult = await BiometricAuthService.authenticate(
        'Use biometric authentication to sign in',
      );
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error || 'Biometric authentication failed',
        };
      }

      // Try to restore Supabase session
      const sessionRestored = await this.restoreSupabaseSession(sessionData);

      if (!sessionRestored) {
        if (__DEV__)
          console.log(
            'Failed to restore Supabase session, biometric login cannot proceed',
          );
        return {
          success: false,
          error:
            'Your session has expired. Please sign in with your email and password to refresh your saved account.',
          sessionRestored: false,
        };
      }

      // Update last used time
      sessionData.lastUsed = new Date().toISOString();
      await storage.setItem(BIOMETRIC_SESSION_KEY, JSON.stringify(sessionData));
      await ensureSessionInMap(sessionData);

      if (__DEV__)
        console.log(
          'Enhanced biometric authentication successful for:',
          sessionData.email,
        );

      // Persist updated session after token refresh
      try {
        const { getCurrentSession } = await import('@/lib/sessionManager');
        const current = await getCurrentSession();
        if (current) {
          await storage.setItem(
            BIOMETRIC_SESSION_KEY,
            JSON.stringify({ ...sessionData, lastUsed: new Date().toISOString() }),
          );
        }
      } catch (persistErr) {
        console.warn('Could not persist biometric session after restore:', persistErr);
      }

      return { success: true, userData: sessionData, sessionRestored };
    } catch (error) {
      console.error('Enhanced biometric authentication error:', error);
      return { success: false, error: 'Authentication failed due to an error' };
    }
  }

  /**
   * Attempt to restore a Supabase session via multiple refresh-token sources.
   * Returns true if a valid session is established.
   */
  private static async restoreSupabaseSession(
    sessionData: BiometricSessionData,
  ): Promise<boolean> {
    try {
      const { assertSupabase } = await import('@/lib/supabase');
      const { data } = await assertSupabase().auth.getSession();

      if (data.session?.user) {
        if (__DEV__) console.log('Valid Supabase session already exists');
        return true;
      }

      if (__DEV__) console.log('No active Supabase session, attempting to restore');

      // 1) Per-user biometric refresh token
      const perUserRefresh = await getRefreshTokenForUser(sessionData.userId);
      if (perUserRefresh) {
        const { data: refreshed, error } =
          await assertSupabase().auth.refreshSession({
            refresh_token: perUserRefresh,
          });
        if (!error && refreshed?.session?.user) {
          if (__DEV__)
            console.log('Restored via per-user biometric refresh token');
          return true;
        }
      }

      // 2) sessionManager stored session
      const { getCurrentSession } = await import('@/lib/sessionManager');
      const storedSession = await getCurrentSession();
      if (storedSession) {
        const { data: refreshed, error } =
          await assertSupabase().auth.refreshSession({
            refresh_token: storedSession.refresh_token,
          });
        if (!error && refreshed?.session?.user) {
          if (__DEV__)
            console.log('Restored via stored session refresh token');
          return true;
        }
      }

      // 3) Global biometric refresh token (last resort)
      const globalRefresh = await getGlobalRefreshToken();
      if (globalRefresh) {
        const { data: refreshed, error } =
          await assertSupabase().auth.refreshSession({
            refresh_token: globalRefresh,
          });
        if (!error && refreshed?.session?.user) {
          if (__DEV__)
            console.log('Restored via global biometric refresh token');
          return true;
        }
      }

      return false;
    } catch (sessionError) {
      console.error('Error during session restoration:', sessionError);
      return false;
    }
  }

  /**
   * Authenticate and restore session for a specific user (switch account)
   */
  static async authenticateWithBiometricForUser(userId: string): Promise<{
    success: boolean;
    userData?: BiometricSessionData;
    sessionRestored?: boolean;
    error?: string;
  }> {
    try {
      const capabilities = await BiometricAuthService.checkCapabilities();
      if (!capabilities.isAvailable || !capabilities.isEnrolled) {
        return { success: false, error: 'Biometric not available or not enrolled' };
      }

      const sessions = await getSessionsMap();
      const sessionData = sessions[userId];
      if (!sessionData) {
        return {
          success: false,
          error: 'No biometric session found for selected account',
        };
      }

      const authResult = await BiometricAuthService.authenticate(
        'Confirm to switch account',
      );
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error || 'Authentication failed',
        };
      }

      // Restore Supabase session using per-user refresh token
      let sessionRestored = false;
      try {
        const { assertSupabase } = await import('@/lib/supabase');
        const { data: existingSession } = await assertSupabase().auth.getSession();

        if (existingSession?.session?.user?.id === userId) {
          sessionRestored = true;
        }

        if (!sessionRestored) {
          // Sign out current user FIRST to avoid overlapping sessions.
          if (existingSession?.session) {
            try {
              await assertSupabase().auth.signOut({ scope: 'local' } as any);
            } catch {
              /* best-effort */
            }
          }

          const refresh = await getRefreshTokenForUser(userId);
          if (refresh) {
            const { data: refreshed, error: refreshErr } =
              await assertSupabase().auth.refreshSession({
                refresh_token: refresh,
              });
            if (!refreshErr && refreshed?.session?.user) {
              sessionRestored = true;
              // Store the rotated refresh token
              if (
                refreshed.session.refresh_token &&
                refreshed.session.refresh_token !== refresh
              ) {
                await setRefreshTokenForUser(
                  userId,
                  refreshed.session.refresh_token,
                );
              }
            }
          }
        }

        // Fallback: try global biometric refresh token
        if (!sessionRestored) {
          const globalRefresh = await getGlobalRefreshToken();
          if (globalRefresh) {
            const { data: refreshed, error: refreshErr } =
              await assertSupabase().auth.refreshSession({
                refresh_token: globalRefresh,
              });
            if (!refreshErr && refreshed?.session?.user?.id === userId) {
              sessionRestored = true;
              if (refreshed.session.refresh_token) {
                await setRefreshTokenForUser(
                  userId,
                  refreshed.session.refresh_token,
                );
              }
            }
          }
        }
      } catch (e) {
        console.warn('Switch account session restore error:', e);
      }

      // Update active user and last used — NEVER delete the account on failure.
      sessionData.lastUsed = new Date().toISOString();
      const newMap = await getSessionsMap();
      newMap[userId] = sessionData;
      await setSessionsMap(newMap);
      await setActiveUserId(userId);

      return { success: true, userData: sessionData, sessionRestored };
    } catch (error) {
      console.error('authenticateWithBiometricForUser error:', error);
      return {
        success: false,
        error: 'Authentication failed due to an error',
      };
    }
  }

  /**
   * Setup biometric authentication for a user after successful password login.
   * Returns { success, reason? } — callers should display alerts to the user.
   */
  static async setupBiometricForUser(
    user: any,
    profile?: any,
  ): Promise<{ success: boolean; reason?: string; message?: string }> {
    try {
      const capabilities = await BiometricAuthService.checkCapabilities();
      if (!capabilities.isAvailable || !capabilities.isEnrolled) {
        return {
          success: false,
          reason: 'not_available',
          message: 'Biometric authentication is not available or not set up on this device.',
        };
      }

      const authResult = await BiometricAuthService.authenticate(
        'Enable biometric sign-in for faster access',
      );
      if (!authResult.success) {
        return {
          success: false,
          reason: 'auth_failed',
          message: authResult.error || 'Could not verify biometric authentication',
        };
      }

      const enableResult = await BiometricAuthService.enableBiometric(
        user.id,
        user.email,
      );
      if (!enableResult) return { success: false, reason: 'enable_failed', message: 'Could not enable biometric.' };

      const sessionStored = await this.storeBiometricSession(
        user.id,
        user.email,
        profile,
      );
      if (!sessionStored) {
        await BiometricAuthService.disableBiometric();
        return {
          success: false,
          reason: 'session_failed',
          message: 'Could not complete biometric setup',
        };
      }

      return {
        success: true,
        message: 'You can now use biometric authentication to sign in quickly and securely.',
      };
    } catch (error) {
      console.error('Error setting up biometric authentication:', error);
      return {
        success: false,
        reason: 'error',
        message: 'Failed to set up biometric authentication',
      };
    }
  }
}
