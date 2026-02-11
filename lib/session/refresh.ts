/**
 * Session Manager — Token Refresh
 * 
 * Handles session token refresh with retry logic, auto-refresh timers,
 * and concurrent refresh deduplication.
 */

import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { reportError } from '@/lib/monitoring';
import type { UserSession } from './types';
import { REFRESH_THRESHOLD } from './types';
import { storeSession, getStoredSession, clearStoredData } from './storage';

let sessionRefreshTimer: any = null;
let pendingRefresh: Promise<UserSession | null> | null = null;

/**
 * Check if session needs refresh
 */
export function needsRefresh(session: UserSession): boolean {
  const now = Date.now();
  const timeUntilExpiry = session.expires_at * 1000 - now;
  return timeUntilExpiry < REFRESH_THRESHOLD;
}

/**
 * Process refresh session result
 */
async function processRefreshResult(
  result: { data: any; error: any },
  attempt: number
): Promise<UserSession | null> {
  const { data, error } = result;

  if (error) {
    console.error('[SessionManager] Supabase refresh error:', error.message);
    throw error;
  }

  if (!data.session) {
    throw new Error('No session returned from refresh');
  }

  console.log('[INFO] Token refreshed successfully');

  const newSession: UserSession = {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at || Date.now() / 1000 + 3600,
    user_id: data.session.user.id,
    email: data.session.user.email,
  };

  await storeSession(newSession);

  track('edudash.auth.session_refreshed', {
    attempt,
    success: true,
  });

  return newSession;
}

/**
 * Refresh session using refresh token
 */
export async function refreshSession(
  refreshToken: string,
  attempt: number = 1,
  maxAttempts: number = 3
): Promise<UserSession | null> {
  if (pendingRefresh && attempt === 1) {
    console.log('[SessionManager] Refresh already in progress, waiting...');
    return pendingRefresh;
  }

  try {
    if (!refreshToken || refreshToken.trim() === '') {
      throw new Error('Invalid refresh token: empty or null');
    }

    console.log(`[SessionManager] Attempting refresh (attempt ${attempt}/${maxAttempts})`);

    const refreshPromise = assertSupabase().auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (attempt === 1) {
      pendingRefresh = (async () => {
        try {
          const result = await refreshPromise;
          return await processRefreshResult(result, attempt);
        } finally {
          pendingRefresh = null;
        }
      })();
      return pendingRefresh;
    }

    const { data, error } = await refreshPromise;
    return await processRefreshResult({ data, error }, attempt);
  } catch (error) {
    console.error(`Session refresh attempt ${attempt} failed:`, error);

    if (error instanceof Error) {
      if (error.message.includes('Already Used')) {
        if (__DEV__) console.log('[SessionManager] Refresh token already used (concurrent refresh), fetching current session');
        const currentSession = await getStoredSession();
        if (currentSession) {
          return currentSession;
        }
      }

      if (error.message.includes('Invalid Refresh Token') ||
          error.message.includes('Refresh Token Not Found') ||
          error.message.includes('refresh_token_not_found')) {
        if (__DEV__) console.log('[SessionManager] Refresh token is invalid, clearing stored session');
        await clearStoredData();

        track('edudash.auth.session_refresh_failed', {
          attempts: attempt,
          error: 'invalid_refresh_token',
          final: true,
        });

        return null;
      }
    }

    if (attempt < maxAttempts) {
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`[SessionManager] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return refreshSession(refreshToken, attempt + 1, maxAttempts);
    }

    track('edudash.auth.session_refresh_failed', {
      attempts: attempt,
      error: error instanceof Error ? error.message : 'Unknown error',
      final: true,
    });

    reportError(new Error('Session refresh failed after all attempts'), {
      attempts: attempt,
      originalError: error,
    });

    await clearStoredData();
    return null;
  }
}

/**
 * Auto-refresh session management
 */
export function setupAutoRefresh(session: UserSession): void {
  if (sessionRefreshTimer) {
    clearTimeout(sessionRefreshTimer);
  }

  if (process.env.EXPO_PUBLIC_SESSION_AUTO_REFRESH !== 'true') {
    return;
  }

  const now = Date.now();
  const timeUntilRefresh = session.expires_at * 1000 - now - REFRESH_THRESHOLD;

  if (timeUntilRefresh > 0) {
    sessionRefreshTimer = setTimeout(async () => {
      try {
        const currentSession = await getStoredSession();
        if (currentSession && needsRefresh(currentSession)) {
          const refreshedSession = await refreshSession(currentSession.refresh_token);
          if (refreshedSession) {
            setupAutoRefresh(refreshedSession);
          }
        }
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }, timeUntilRefresh);
  }
}

/**
 * Clear the auto-refresh timer
 */
export function clearAutoRefreshTimer(): void {
  if (sessionRefreshTimer) {
    clearTimeout(sessionRefreshTimer);
    sessionRefreshTimer = null;
  }
}

/**
 * Reset the pending refresh tracker
 */
export function resetPendingRefresh(): void {
  pendingRefresh = null;
}
