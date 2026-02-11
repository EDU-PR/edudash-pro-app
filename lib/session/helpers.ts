/**
 * Session Manager — Helper Utilities
 * 
 * Timeout wrappers and async helpers used across the session module.
 */

import { assertSupabase } from '@/lib/supabase';
import type { Session } from './types';

/**
 * Helper to wrap a promise with a timeout
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallback), ms)
    ),
  ]);
}

/**
 * Helper to wrap a promise with a timeout and detect timeout vs result
 */
export async function withTimeoutMarker<T>(
  promise: Promise<T>,
  ms: number
): Promise<{ result: T | null; timedOut: boolean }> {
  const timeoutMarker = Symbol('timeout');
  const timeoutPromise = new Promise<symbol>((resolve) =>
    setTimeout(() => resolve(timeoutMarker), ms)
  );

  const result = await Promise.race([promise, timeoutPromise]);
  const timedOut = result === timeoutMarker;

  return {
    result: timedOut ? null : (result as T),
    timedOut,
  };
}

/**
 * Wait for a session to appear (or a SIGNED_IN auth event) within a timeout window.
 * Useful for cases where auth state changes before signInWithPassword resolves.
 */
export async function waitForSessionOrAuth(timeoutMs: number): Promise<Session | null> {
  try {
    const { data } = await assertSupabase().auth.getSession();
    if (data?.session?.user) {
      return data.session;
    }
  } catch {
    // Non-fatal; fall through to auth listener.
  }
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let listener: { subscription?: { unsubscribe: () => void } } | null = null;
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      try { listener?.subscription?.unsubscribe(); } catch { /* non-fatal */ }
    };

    const client = assertSupabase();
    const { data: listenerData } = client.auth.onAuthStateChange((event, session) => {
      if (!settled && event === 'SIGNED_IN' && session?.user) {
        settled = true;
        cleanup();
        resolve(session);
      }
    });
    listener = listenerData;

    timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(null);
      }
    }, timeoutMs);
  });
}
