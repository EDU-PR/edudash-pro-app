/**
 * Teacher Messaging — Barrel re-export
 *
 * All hooks split into focused modules for maintainability.
 * Import from here OR from '@/hooks/useTeacherMessaging' (backward compat).
 */

export { useTeacherThreads } from './useTeacherThreads';
export { useTeacherThreadMessages } from './useTeacherThreadMessages';
export { useTeacherSendMessage } from './useTeacherSendMessage';
export { useTeacherMarkThreadRead } from './useTeacherMarkThreadRead';
export { useTeacherMessagesRealtime } from './useTeacherMessagesRealtime';
export { useTeacherThreadsRealtime } from './useTeacherThreadsRealtime';

export { useRealtimeConnectionState } from './useRealtimeConnectionState';
export type { ConnectionState, RealtimeConnectionInfo } from './useRealtimeConnectionState';
export { useMessageRetry } from './useMessageRetry';
export type { FailedMessage, UseMessageRetryReturn } from './useMessageRetry';
export { useOfflineQueueSync } from './useOfflineQueueSync';
export type { UseOfflineQueueSyncReturn } from './useOfflineQueueSync';

// Re-export types
export type { MessageThread, MessageParticipant, Message } from '@/lib/messaging/types';
