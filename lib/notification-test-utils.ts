/**
 * Notification Test Utility
 * 
 * Dev tool to test push notifications in development builds
 * - Local notifications (immediate, scheduled)
 * - Status bar pop-ups
 * - Badge updates
 * - System notifications
 */

import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';

export interface TestNotificationOptions {
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: boolean;
  sticky?: boolean;
  subtitle?: string;
  categoryId?: string;
}

/**
 * Send an immediate local notification
 * This will show in the status bar and notification drawer
 */
export async function sendTestNotification(options: TestNotificationOptions): Promise<string> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: options.title,
        body: options.body,
        data: options.data || {},
        badge: options.badge,
        sound: options.sound !== false, // default true
        sticky: options.sticky,
        subtitle: options.subtitle,
        categoryIdentifier: options.categoryId,
        // Android specific
        ...(Platform.OS === 'android' && {
          color: '#06b6d4', // Cyan accent
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        }),
      },
      trigger: null, // Fire immediately
    });
    
    console.log('[Test Notification] Sent:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('[Test Notification] Error:', error);
    throw error;
  }
}

/**
 * Send a scheduled notification (fires after delay)
 */
export async function sendScheduledNotification(
  options: TestNotificationOptions,
  delaySeconds: number
): Promise<string> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: options.title,
        body: options.body,
        data: options.data || {},
        badge: options.badge,
        sound: options.sound !== false,
        ...(Platform.OS === 'android' && {
          color: '#06b6d4',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        }),
      },
      trigger: {
        seconds: delaySeconds,
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      },
    });
    
    console.log(`[Test Notification] Scheduled for ${delaySeconds}s:`, notificationId);
    return notificationId;
  } catch (error) {
    console.error('[Test Notification] Schedule error:', error);
    throw error;
  }
}

/**
 * Update the app badge count
 */
export async function setBadgeCount(count: number): Promise<boolean> {
  try {
    await Notifications.setBadgeCountAsync(count);
    console.log('[Badge] Set to:', count);
    return true;
  } catch (error) {
    console.error('[Badge] Error:', error);
    return false;
  }
}

/**
 * Clear all notifications from the notification center
 */
export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
  console.log('[Notifications] All cleared');
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduled(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log('[Notifications] All scheduled cancelled');
}

/**
 * Get pending scheduled notifications
 */
export async function getPendingNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Preset test notifications for quick testing
 */
export const NotificationPresets = {
  // Message notification
  newMessage: () => sendTestNotification({
    title: '💬 New Message',
    body: 'Marion Makunyane sent you a message',
    data: { type: 'message', threadId: 'test-123' },
    badge: 1,
  }),

  // Homework notification
  homeworkAssigned: () => sendTestNotification({
    title: '📚 New Homework',
    body: 'Math worksheet has been assigned to Grade 1',
    data: { type: 'homework', homeworkId: 'hw-456' },
    badge: 1,
  }),

  // Grade notification  
  homeworkGraded: () => sendTestNotification({
    title: '✅ Homework Graded',
    body: 'Your child\'s homework has been graded. Score: 85%',
    data: { type: 'grade', submissionId: 'sub-789' },
  }),

  // Report notification
  reportReady: () => sendTestNotification({
    title: '📊 Progress Report Ready',
    body: 'Your child\'s term progress report is now available',
    data: { type: 'report', reportId: 'rpt-101' },
    badge: 1,
  }),

  // Announcement
  announcement: () => sendTestNotification({
    title: '📢 School Announcement',
    body: 'School will be closed tomorrow for Teacher\'s Day',
    data: { type: 'announcement', announcementId: 'ann-202' },
  }),

  // Reminder
  reminder: () => sendTestNotification({
    title: '⏰ Reminder',
    body: 'Don\'t forget: Parent meeting at 2PM today',
    data: { type: 'reminder' },
  }),

  // Payment
  paymentReminder: () => sendTestNotification({
    title: '💳 Payment Due',
    body: 'School fees payment due in 3 days',
    data: { type: 'payment' },
    badge: 1,
  }),

  // Attendance
  attendanceAlert: () => sendTestNotification({
    title: '🏫 Attendance Alert',
    body: 'Your child has been marked present today',
    data: { type: 'attendance' },
  }),

  // Event
  upcomingEvent: () => sendTestNotification({
    title: '🎉 Upcoming Event',
    body: 'Sports Day is in 2 days. Don\'t forget the permission slip!',
    data: { type: 'event', eventId: 'evt-303' },
  }),

  // System
  systemUpdate: () => sendTestNotification({
    title: '🔄 App Update Available',
    body: 'A new version of EduDash Pro is available',
    data: { type: 'system', action: 'update' },
  }),
};

/**
 * Run a full notification test suite
 */
export async function runNotificationTestSuite(): Promise<void> {
  Alert.alert(
    'Notification Test Suite',
    'This will send several test notifications. Continue?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Run Tests',
        onPress: async () => {
          try {
            // Clear existing
            await clearAllNotifications();
            await setBadgeCount(0);

            // Send immediate notification
            await NotificationPresets.newMessage();

            // Schedule delayed notifications
            await sendScheduledNotification(
              { title: '⏱️ Scheduled Test', body: 'This notification was scheduled 5 seconds ago' },
              5
            );

            await sendScheduledNotification(
              { title: '⏱️ Scheduled Test 2', body: 'This one was scheduled 10 seconds ago' },
              10
            );

            // Set badge
            await setBadgeCount(3);

            Alert.alert(
              'Tests Started!',
              'Immediate notification sent.\nScheduled notifications: 5s and 10s from now.\nBadge set to 3.'
            );
          } catch (error: any) {
            Alert.alert('Test Failed', error?.message || 'Unknown error');
          }
        },
      },
    ]
  );
}

/**
 * Check notification permissions status
 */
export async function checkNotificationPermissions(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}> {
  const settings = await Notifications.getPermissionsAsync();
  return {
    granted: settings.status === 'granted',
    canAskAgain: settings.canAskAgain,
    status: settings.status,
  };
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export default {
  sendTestNotification,
  sendScheduledNotification,
  setBadgeCount,
  clearAllNotifications,
  cancelAllScheduled,
  getPendingNotifications,
  NotificationPresets,
  runNotificationTestSuite,
  checkNotificationPermissions,
  requestNotificationPermissions,
};
