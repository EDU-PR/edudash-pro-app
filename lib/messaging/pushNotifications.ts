/**
 * Shared push notification sender for messaging.
 * Extracted from the duplicated helper in useParentMessaging.ts / useTeacherMessaging.ts.
 */

import Constants from 'expo-constants';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const SUPABASE_URL =
  Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;

export interface PushNotificationParams {
  threadId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  messageContent: string;
  recipientIds: string[];
}

/**
 * Sends a push notification to message recipients via the notifications-dispatcher Edge Function.
 * Skips the sender and silently handles errors so the message send itself never fails.
 */
export async function sendMessagePushNotification(params: PushNotificationParams): Promise<void> {
  const { threadId, messageId, senderId, senderName, messageContent, recipientIds } = params;

  // Don't send notification to yourself
  const targetIds = recipientIds.filter((id) => id !== senderId);
  if (targetIds.length === 0) return;

  try {
    const client = assertSupabase();
    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session?.access_token) {
      logger.warn('sendMessagePushNotification', 'No session, skipping push notification');
      return;
    }

    // Truncate message for notification preview
    const truncatedBody =
      messageContent.length > 100 ? messageContent.substring(0, 97) + '...' : messageContent;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/notifications-dispatcher`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'new_message',
        user_ids: targetIds,
        thread_id: threadId,
        message_id: messageId,
        send_immediately: true,
        custom_payload: {
          dedupe_by_user: true,
        },
        template_override: {
          title: `💬 ${senderName}`,
          body: truncatedBody,
          data: {
            type: 'message',
            thread_id: threadId,
            message_id: messageId,
            sender_id: senderId,
            sender_name: senderName,
            screen: 'messages',
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(
        'sendMessagePushNotification',
        'Edge function error:',
        response.status,
        errorText
      );
      return;
    }

    const result = await response.json();
    logger.debug('sendMessagePushNotification', '✅ Push notification sent:', result);
  } catch (error) {
    // Don't fail message send if notification fails
    logger.warn('sendMessagePushNotification', 'Failed to send push notification:', error);
  }
}

/**
 * Fetches the current user's display name from their profile.
 * Returns a role-specific fallback if the profile lookup fails.
 */
export async function getSenderDisplayName(
  userId: string,
  fallback = 'Someone'
): Promise<string> {
  try {
    const client = assertSupabase();
    const { data: profile } = await client
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .single();

    if (profile) {
      const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
      return name || fallback;
    }
  } catch {
    // silent
  }
  return fallback;
}
