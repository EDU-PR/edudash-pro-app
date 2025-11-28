'use client';

import { createClient } from '@/lib/supabase/client';

// VAPID key for browser push
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BLXiYIECWZGIlbDkQKKPhl3t86tGQRQDAHnNq5JHMg9btdbjiVgt3rLDeGhz5LveRarHS-9vY84aFkQrfApmNpE';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type NotificationType = 'call' | 'message' | 'announcement' | 'homework' | 'general';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    type?: NotificationType;
    [key: string]: any;
  };
  requireInteraction?: boolean;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 
    'Notification' in window && 
    'serviceWorker' in navigator && 
    'PushManager' in window;
}

/**
 * Get current push subscription status
 */
export async function getPushSubscriptionStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
}> {
  if (!isPushSupported()) {
    return { supported: false, permission: 'unsupported', subscribed: false };
  }

  const permission = Notification.permission;
  let subscribed = false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    subscribed = !!subscription;
  } catch (e) {
    console.error('Failed to check subscription:', e);
  }

  return { supported: true, permission, subscribed };
}

/**
 * Request notification permission and subscribe to push
 */
export async function subscribeToPush(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications not supported' };
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Permission denied' };
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Subscribe to push manager
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
    });

    // Save to Supabase
    const supabase = createClient();
    
    // Get user's preschool_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('preschool_id, role')
      .eq('id', userId)
      .maybeSingle();

    const subscriptionJson = subscription.toJSON();
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        preschool_id: profile?.preschool_id || null,
        endpoint: subscriptionJson.endpoint!,
        p256dh: subscriptionJson.keys!.p256dh!,
        auth: subscriptionJson.keys!.auth!,
        user_agent: navigator.userAgent,
        topics: getDefaultTopics(profile?.role),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,endpoint',
      });

    if (error) {
      console.error('Failed to save subscription:', error);
      return { success: false, error: 'Failed to save subscription' };
    }

    return { success: true };
  } catch (e: any) {
    console.error('Subscribe error:', e);
    return { success: false, error: e?.message || 'Subscription failed' };
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(userId: string): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications not supported' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();

      // Remove from database
      const supabase = createClient();
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint);
    }

    return { success: true };
  } catch (e: any) {
    console.error('Unsubscribe error:', e);
    return { success: false, error: e?.message || 'Unsubscribe failed' };
  }
}

/**
 * Show a local notification (when user is in app)
 */
export async function showLocalNotification(payload: PushPayload): Promise<void> {
  if (!isPushSupported()) return;
  if (Notification.permission !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-192.png',
      tag: payload.tag,
      data: payload.data,
      requireInteraction: payload.requireInteraction,
    });
  } catch (e) {
    console.error('Failed to show notification:', e);
  }
}

/**
 * Get default notification topics based on user role
 */
function getDefaultTopics(role?: string): string[] {
  const baseTopics = ['general', 'announcements'];
  
  switch (role) {
    case 'parent':
      return [...baseTopics, 'homework', 'messages', 'calls'];
    case 'teacher':
      return [...baseTopics, 'messages', 'calls', 'attendance'];
    case 'principal':
      return [...baseTopics, 'messages', 'calls', 'registrations', 'reports'];
    default:
      return baseTopics;
  }
}

// ============================================
// Notification Trigger Functions (client-side)
// ============================================

/**
 * Trigger notification when receiving a new message
 */
export async function notifyNewMessage(
  senderName: string,
  messagePreview: string,
  threadId: string,
  recipientRole: 'parent' | 'teacher'
): Promise<void> {
  const dashboardPath = recipientRole === 'parent' 
    ? '/dashboard/parent/messages' 
    : '/dashboard/teacher/messages';

  await showLocalNotification({
    title: `New message from ${senderName}`,
    body: messagePreview.length > 50 ? messagePreview.slice(0, 50) + '...' : messagePreview,
    tag: `message-${threadId}`,
    data: {
      url: `${dashboardPath}?thread=${threadId}`,
      type: 'message',
      threadId,
    },
    requireInteraction: false,
  });
}

/**
 * Trigger notification for incoming call
 */
export async function notifyIncomingCall(
  callerName: string,
  callType: 'voice' | 'video',
  callId: string
): Promise<void> {
  await showLocalNotification({
    title: `Incoming ${callType} call`,
    body: `${callerName} is calling...`,
    tag: `call-${callId}`,
    icon: '/icon-192.png',
    data: {
      url: '/dashboard/parent/messages',
      type: 'call',
      callId,
      callType,
    },
    requireInteraction: true, // Keep visible until dismissed
  });
}

/**
 * Trigger notification for new announcement
 */
export async function notifyNewAnnouncement(
  title: string,
  preview: string,
  announcementId: string
): Promise<void> {
  await showLocalNotification({
    title: `📢 ${title}`,
    body: preview.length > 80 ? preview.slice(0, 80) + '...' : preview,
    tag: `announcement-${announcementId}`,
    data: {
      url: '/dashboard/parent/announcements',
      type: 'announcement',
      announcementId,
    },
    requireInteraction: false,
  });
}

/**
 * Trigger notification for new homework (parent)
 */
export async function notifyNewHomework(
  studentName: string,
  subject: string,
  homeworkId: string,
  dueDate?: string
): Promise<void> {
  const duePart = dueDate ? ` - Due: ${dueDate}` : '';
  await showLocalNotification({
    title: `📚 New homework for ${studentName}`,
    body: `${subject}${duePart}`,
    tag: `homework-${homeworkId}`,
    data: {
      url: `/dashboard/parent/homework/${homeworkId}`,
      type: 'homework',
      homeworkId,
      studentName,
    },
    requireInteraction: false,
  });
}

/**
 * Trigger notification for homework due soon
 */
export async function notifyHomeworkDueSoon(
  studentName: string,
  subject: string,
  homeworkId: string,
  hoursRemaining: number
): Promise<void> {
  await showLocalNotification({
    title: `⏰ Homework due soon`,
    body: `${studentName}'s ${subject} homework is due in ${hoursRemaining} hours`,
    tag: `homework-reminder-${homeworkId}`,
    data: {
      url: `/dashboard/parent/homework/${homeworkId}`,
      type: 'homework',
      homeworkId,
    },
    requireInteraction: true,
  });
}
