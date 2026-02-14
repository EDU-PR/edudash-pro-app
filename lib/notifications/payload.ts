export type NotificationData = Record<string, unknown> | null | undefined;

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

export const extractThreadId = (data: NotificationData): string | null => {
  if (!data) return null;
  return (
    readString(data.thread_id) ||
    readString(data.threadId) ||
    readString(data.conversation_id) ||
    readString(data.conversationId) ||
    null
  );
};

export const extractCallId = (data: NotificationData): string | null => {
  if (!data) return null;
  return readString(data.call_id) || readString(data.callId) || null;
};

export const extractCallType = (data: NotificationData): 'voice' | 'video' | null => {
  if (!data) return null;
  const raw = (readString(data.call_type) || readString(data.callType) || '').toLowerCase();
  if (raw === 'video') return 'video';
  if (raw === 'voice') return 'voice';
  return null;
};
