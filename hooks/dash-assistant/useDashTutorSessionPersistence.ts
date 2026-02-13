import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TutorSession } from '@/hooks/dash-assistant/tutorTypes';
import {
  saveTutorSession,
  loadTutorSession,
  flushTutorSession,
} from '@/lib/dash-ai/tutorSessionStore';
import {
  completeTutorSessionRecord,
  createTutorSessionId,
  isUuid,
  loadLatestActiveTutorSessionRecord,
  mapRecordToTutorSessionEnvelope,
  upsertTutorSessionRecord,
} from '@/lib/dash-ai/tutorSessionService';

interface UseDashTutorSessionPersistenceParams {
  userId?: string | null;
  profileRole?: string | null;
  organizationId?: string | null;
  preschoolId?: string | null;
  activeChildId?: string | null;
  conversationId?: string | null;
  tutorSession: TutorSession | null;
  setTutorSession: React.Dispatch<React.SetStateAction<TutorSession | null>>;
  remoteSyncEnabled?: boolean;
}

interface UseDashTutorSessionPersistenceResult {
  tutorSessionRef: React.MutableRefObject<TutorSession | null>;
}

export function useDashTutorSessionPersistence(
  params: UseDashTutorSessionPersistenceParams,
): UseDashTutorSessionPersistenceResult {
  const {
    userId,
    profileRole,
    organizationId,
    preschoolId,
    activeChildId,
    conversationId,
    tutorSession,
    setTutorSession,
    remoteSyncEnabled = false,
  } = params;

  const tutorSessionRef = useRef<TutorSession | null>(null);
  const previousTutorSessionRef = useRef<TutorSession | null>(null);
  const remoteSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    tutorSessionRef.current = tutorSession;
  }, [tutorSession]);

  // Persist tutor session to AsyncStorage on every change (debounced inside store)
  useEffect(() => {
    if (!userId) return;
    const convId = conversationId ?? null;
    saveTutorSession(userId, tutorSession, convId);
  }, [conversationId, tutorSession, userId]);

  // Restore persisted tutor session on mount
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const restoredLocal = await loadTutorSession(userId);
      let restoredEnvelope: { session: TutorSession; conversationId: string | null } | null =
        restoredLocal;

      if (!restoredEnvelope && remoteSyncEnabled) {
        const remoteRecord = await loadLatestActiveTutorSessionRecord(userId);
        if (remoteRecord) {
          restoredEnvelope = mapRecordToTutorSessionEnvelope(remoteRecord);
        }
      }

      if (cancelled || !restoredEnvelope) return;
      if (tutorSessionRef.current) return;

      const restoredSession =
        remoteSyncEnabled && !isUuid(restoredEnvelope.session.id)
          ? { ...restoredEnvelope.session, id: createTutorSessionId() }
          : restoredEnvelope.session;

      if (restoredEnvelope.conversationId) {
        AsyncStorage.setItem('@dash_ai_current_conversation_id', restoredEnvelope.conversationId).catch(() => {});
      }

      setTutorSession(restoredSession);
    })().catch((error) => {
      console.warn('[useDashTutorSessionPersistence] Failed to restore tutor session:', error);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteSyncEnabled, setTutorSession, userId]);

  // Flush pending writes on unmount
  useEffect(() => {
    return () => {
      if (remoteSyncTimerRef.current) {
        clearTimeout(remoteSyncTimerRef.current);
        remoteSyncTimerRef.current = null;
      }
      flushTutorSession().catch(() => {});
    };
  }, []);

  // Persist tutor sessions to Supabase (flagged) for cross-device resume and analytics.
  useEffect(() => {
    if (!remoteSyncEnabled || !userId) {
      previousTutorSessionRef.current = tutorSession;
      return;
    }

    const previousSession = previousTutorSessionRef.current;
    const normalizedRole = String(profileRole || '').toLowerCase();
    const studentId = normalizedRole === 'parent' ? activeChildId : null;
    const schoolId = String(organizationId || preschoolId || '').trim() || null;
    const conversationIdForState = conversationId || null;

    if (remoteSyncTimerRef.current) {
      clearTimeout(remoteSyncTimerRef.current);
      remoteSyncTimerRef.current = null;
    }

    const sessionForSync =
      tutorSession && !isUuid(tutorSession.id)
        ? { ...tutorSession, id: createTutorSessionId() }
        : tutorSession;

    if (sessionForSync && sessionForSync.id !== tutorSession?.id) {
      setTutorSession(sessionForSync);
      previousTutorSessionRef.current = sessionForSync;
      return;
    }

    remoteSyncTimerRef.current = setTimeout(() => {
      if (sessionForSync) {
        upsertTutorSessionRecord({
          userId,
          session: sessionForSync,
          conversationId: conversationIdForState,
          preschoolId: schoolId,
          studentId,
        }).catch((error) => {
          console.warn('[useDashTutorSessionPersistence] Failed to upsert tutor session record:', error);
        });
      } else if (previousSession) {
        completeTutorSessionRecord({
          userId,
          session: previousSession,
          conversationId: conversationIdForState,
          preschoolId: schoolId,
          studentId,
        }).catch((error) => {
          console.warn('[useDashTutorSessionPersistence] Failed to complete tutor session record:', error);
        });
      }
    }, 450);

    previousTutorSessionRef.current = sessionForSync || null;

    return () => {
      if (remoteSyncTimerRef.current) {
        clearTimeout(remoteSyncTimerRef.current);
        remoteSyncTimerRef.current = null;
      }
    };
  }, [
    remoteSyncEnabled,
    userId,
    tutorSession,
    conversationId,
    profileRole,
    organizationId,
    preschoolId,
    activeChildId,
    setTutorSession,
  ]);

  return {
    tutorSessionRef,
  };
}
