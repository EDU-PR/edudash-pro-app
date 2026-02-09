/**
 * useTeacherMessaging — Barrel re-export for backward compatibility
 *
 * All hooks have been decomposed into focused modules under hooks/messaging/.
 * This file remains as the canonical import path so existing consumers are unaffected.
 *
 * 703 lines → 6 focused files averaging ~120 lines each.
 */

export {
  useTeacherThreads,
  useTeacherThreadMessages,
  useTeacherSendMessage,
  useTeacherMarkThreadRead,
  useTeacherMessagesRealtime,
  useTeacherThreadsRealtime,
} from './messaging';

export type { MessageThread, MessageParticipant, Message } from '@/lib/messaging/types';
