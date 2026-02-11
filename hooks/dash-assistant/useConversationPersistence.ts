/**
 * Conversation Persistence
 *
 * Hook for normalising, mapping, persisting, and hydrating conversation
 * snapshots to/from local storage (SQLite via conversationPersistence service).
 *
 * @module hooks/dash-assistant/useConversationPersistence
 * @max-lines 200
 */

import { useCallback } from 'react';
import type { DashMessage, DashConversation } from '@/services/dash-ai/types';
import {
  getConversationSnapshot,
  saveConversationSnapshot,
  getLastActiveConversationId,
  setLastActiveConversationId,
} from '@/services/conversationPersistence';
import { sanitizeTutorUserContent } from './assistantHelpers';
import { LOCAL_SNAPSHOT_LIMIT, LOCAL_SNAPSHOT_MAX } from './types';

export function useConversationPersistence(userId: string | undefined) {
  const normalizeConversationMessages = useCallback((items: DashMessage[]) => {
    return items.map((msg) => {
      if (msg.type !== 'user') return msg;
      const { content, sanitized } = sanitizeTutorUserContent(msg.content);
      return sanitized ? { ...msg, content } : msg;
    });
  }, []);

  const mapToPersistedMessages = useCallback((items: DashMessage[]) => {
    return items.map((msg) => {
      const meta: any = {};
      if (msg.metadata && typeof msg.metadata === 'object') {
        if ('tts' in msg.metadata) meta.tts = (msg.metadata as any).tts;
        if ('ackType' in msg.metadata) meta.ackType = (msg.metadata as any).ackType;
      }
      return {
        id: msg.id,
        type: msg.type === 'task_result' ? 'assistant' : msg.type,
        content: msg.content,
        timestamp: msg.timestamp,
        meta: Object.keys(meta).length > 0 ? meta : undefined,
      };
    });
  }, []);

  const persistConversationSnapshot = useCallback(
    async (conv?: DashConversation | null) => {
      if (!userId || !conv?.id) return;
      const messages = mapToPersistedMessages(conv.messages || []);
      await saveConversationSnapshot(userId, conv.id, messages, LOCAL_SNAPSHOT_MAX);
      await setLastActiveConversationId(userId, conv.id);
    },
    [mapToPersistedMessages, userId],
  );

  const hydrateFromSnapshot = useCallback(
    async (convId: string) => {
      if (!userId) return null;
      const snapshot = await getConversationSnapshot(userId, convId, LOCAL_SNAPSHOT_LIMIT);
      if (!snapshot?.messages?.length) return null;

      const messages: DashMessage[] = snapshot.messages.map((m) => ({
        id: m.id,
        type: m.type,
        content: m.content,
        timestamp: m.timestamp,
        ...(m.meta ? { metadata: { ...(m.meta as any) } } : {}),
      }));
      const createdAt =
        messages.length > 0 ? Math.min(...messages.map((m) => m.timestamp)) : snapshot.updatedAt;
      const updatedAt =
        snapshot.updatedAt ||
        (messages.length > 0 ? Math.max(...messages.map((m) => m.timestamp)) : Date.now());
      const conversation: DashConversation = {
        id: convId,
        title: 'Dash AI Chat',
        messages,
        created_at: createdAt,
        updated_at: updatedAt,
      };
      return { conversation, messages };
    },
    [userId],
  );

  return {
    normalizeConversationMessages,
    mapToPersistedMessages,
    persistConversationSnapshot,
    hydrateFromSnapshot,
    getLastActiveConversationId: (uid: string) => getLastActiveConversationId(uid),
  };
}
