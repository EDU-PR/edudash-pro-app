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

// Engagement features (M3, M6, M9, M10, M13)
export { useThreadPinning } from './useThreadPinning';
export { useThreadNotificationPrefs } from './useThreadNotificationPrefs';
export { useReadByList } from './useReadByList';
export { useAnnouncementAnalytics } from './useAnnouncementAnalytics';
export { useMessageTranslation } from './useMessageTranslation';

// Global search (M2)
export { useGlobalMessageSearch } from './useGlobalMessageSearch';
export type { SearchResult, GlobalMessageSearchReturn } from './useGlobalMessageSearch';

// AI messaging features (M11, M12, M14)
export { useDashMessageAssistant } from './useDashMessageAssistant';
export type { AssistAction } from './useDashMessageAssistant';
export { useSmartReplies } from './useSmartReplies';
export { useVoiceTranscription } from './useVoiceTranscription';

// Re-export types
export type { MessageThread, MessageParticipant, Message } from '@/lib/messaging/types';
export type { NotificationMode } from './useThreadNotificationPrefs';
export type { ReadByEntry } from './useReadByList';
export type { AnnouncementReadStats, NonReader } from './useAnnouncementAnalytics';
export type { SupportedLanguage } from './useMessageTranslation';
