/**
 * tutorSessionStore.ts
 *
 * Persists and restores TutorSession state to AsyncStorage so sessions survive
 * navigation away from the tutor screen and app restarts.
 *
 * Storage key pattern: `@dash_tutor_session_{userId}`
 * Only ONE active session per user is persisted (the latest).
 *
 * Stale sessions (older than MAX_SESSION_AGE_MS) are silently discarded on load.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TutorSession } from '@/hooks/dash-assistant/tutorTypes';
import { logger } from '@/lib/logger';

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_PREFIX = '@dash_tutor_session_';
const MAX_SESSION_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours — after that, force fresh
const DEBOUNCE_MS = 500;

// ─── Types ───────────────────────────────────────────────────────────────────

interface PersistedTutorSession {
  session: TutorSession;
  /** Epoch ms when last saved */
  savedAt: number;
  /** Conversation ID the session was part of */
  conversationId?: string | null;
}

// ─── Debounce bookkeeping ────────────────────────────────────────────────────

let _pendingTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingPayload: { userId: string; data: PersistedTutorSession } | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function isExpired(savedAt: number): boolean {
  return Date.now() - savedAt > MAX_SESSION_AGE_MS;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Save the active tutor session. Calls are debounced — rapid `setTutorSession`
 * updates (e.g. during evaluation loops) only flush the latest value.
 */
export function saveTutorSession(
  userId: string,
  session: TutorSession | null,
  conversationId?: string | null,
): void {
  // Clear any pending write
  if (_pendingTimer) {
    clearTimeout(_pendingTimer);
    _pendingTimer = null;
  }

  if (!userId) return;

  if (!session) {
    // Session ended — delete immediately, no debounce
    AsyncStorage.removeItem(storageKey(userId)).catch((err) =>
      logger.warn('[tutorSessionStore] remove failed', err),
    );
    _pendingPayload = null;
    return;
  }

  _pendingPayload = {
    userId,
    data: { session, savedAt: Date.now(), conversationId: conversationId ?? null },
  };

  _pendingTimer = setTimeout(() => {
    const payload = _pendingPayload;
    _pendingTimer = null;
    _pendingPayload = null;
    if (!payload) return;

    const json = JSON.stringify(payload.data);
    AsyncStorage.setItem(storageKey(payload.userId), json).catch((err) =>
      logger.warn('[tutorSessionStore] save failed', err),
    );
  }, DEBOUNCE_MS);
}

/**
 * Force-flush any pending debounced write. Call before navigation or unmount.
 */
export async function flushTutorSession(): Promise<void> {
  if (_pendingTimer) {
    clearTimeout(_pendingTimer);
    _pendingTimer = null;
  }
  const payload = _pendingPayload;
  _pendingPayload = null;
  if (!payload) return;

  try {
    const json = JSON.stringify(payload.data);
    await AsyncStorage.setItem(storageKey(payload.userId), json);
  } catch (err) {
    logger.warn('[tutorSessionStore] flush failed', err);
  }
}

/**
 * Load the persisted tutor session for a user. Returns `null` if none exists
 * or if the stored session is stale (> MAX_SESSION_AGE_MS).
 */
export async function loadTutorSession(
  userId: string,
): Promise<{ session: TutorSession; conversationId: string | null } | null> {
  if (!userId) return null;

  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return null;

    const parsed: PersistedTutorSession = JSON.parse(raw);

    if (!parsed?.session?.id) {
      // Corrupted payload — clean up
      await AsyncStorage.removeItem(storageKey(userId));
      return null;
    }

    if (isExpired(parsed.savedAt)) {
      // Stale — discard silently
      await AsyncStorage.removeItem(storageKey(userId));
      return null;
    }

    return {
      session: parsed.session,
      conversationId: parsed.conversationId ?? null,
    };
  } catch (err) {
    logger.warn('[tutorSessionStore] load failed', err);
    return null;
  }
}

/**
 * Explicitly clear the persisted tutor session for a user.
 */
export async function clearTutorSession(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(storageKey(userId));
  } catch (err) {
    logger.warn('[tutorSessionStore] clear failed', err);
  }
}
