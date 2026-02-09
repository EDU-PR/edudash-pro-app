import {
  useParentThreads,
  useThreadMessages,
  useParentMessagesRealtime,
  useSendMessage,
  useCreateThread,
  useMarkThreadRead,
  useUnreadMessageCount,
  useMarkAllDelivered,
} from './parent-messaging';
import type { MessageThread } from '@/lib/messaging/types';

export type { MessageThread, MessageParticipant, Message } from '@/lib/messaging/types';
export {
  useParentThreads,
  useThreadMessages,
  useParentMessagesRealtime,
  useSendMessage,
  useCreateThread,
  useMarkThreadRead,
  useUnreadMessageCount,
  useMarkAllDelivered,
} from './parent-messaging';

interface UseParentMessagingOptions {
  threadId?: string | null;
  enableRealtime?: boolean;
  markAllDelivered?: boolean;
}

/**
 * Composed parent messaging hook that wires together thread, message,
 * realtime, send, and read-receipt hooks.
 */
export const useParentMessaging = (options: UseParentMessagingOptions = {}) => {
  const {
    threadId = null,
    enableRealtime = true,
    markAllDelivered = false,
  } = options;

  const threadsQuery = useParentThreads();
  const messagesQuery = useThreadMessages(threadId);
  const unreadCountQuery = useUnreadMessageCount();
  const sendMessage = useSendMessage();
  const createThread = useCreateThread();
  const markThreadRead = useMarkThreadRead();

  useParentMessagesRealtime(enableRealtime ? threadId : null);
  useMarkAllDelivered(markAllDelivered ? (threadsQuery.data as MessageThread[] | undefined) : undefined);

  return {
    threadsQuery,
    messagesQuery,
    unreadCountQuery,
    sendMessage,
    createThread,
    markThreadRead,
    threads: threadsQuery.data ?? [],
    messages: messagesQuery.data ?? [],
    unreadCount: unreadCountQuery.data ?? 0,
    isThreadsLoading: threadsQuery.isLoading,
    isMessagesLoading: messagesQuery.isLoading,
  };
};
