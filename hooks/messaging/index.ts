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

// Re-export types
export type { MessageThread, MessageParticipant, Message } from '@/lib/messaging/types';
