/**
 * lib/messaging — shared messaging utilities
 */

export type {
  MessageThread,
  MessageParticipant,
  Message,
  MessageReaction,
  SendMessageInput,
  MessagingRoleConfig,
  ContentType,
  ThreadType,
  ParticipantRole,
  GroupType,
  ReportCategory,
  MessageReport,
} from './types';

export {
  sendMessagePushNotification,
  getSenderDisplayName,
  type PushNotificationParams,
} from './pushNotifications';

export { OfflineMessageQueue, type QueuedMessage } from './offlineQueue';
