/**
 * Notification Storage Helpers
 * 
 * Manages persistent notification state in AsyncStorage:
 * - Read/unread status
 * - Cleared notifications
 * - Last seen timestamps
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { assertSupabase } from '@/lib/supabase';

// Storage keys
const NOTIFICATIONS_LAST_SEEN_KEY = 'notifications_last_seen_at';
const READ_NOTIFICATIONS_KEY = 'read_notifications';
const CLEARED_NOTIFICATIONS_KEY = 'cleared_notifications';
const CLEARED_BEFORE_DATE_KEY = 'cleared_before_date';

/**
 * Get the "cleared before" date - notifications before this date are hidden
 */
export const getClearedBeforeDate = async (userId: string): Promise<Date | null> => {
  try {
    const key = `${CLEARED_BEFORE_DATE_KEY}_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      return new Date(stored);
    }
  } catch (e) {
    console.error('[getClearedBeforeDate] Error:', e);
  }
  return null;
};

/**
 * Set "cleared before" date - all notifications before this are hidden
 */
export const setClearedBeforeDate = async (userId: string, date: Date): Promise<void> => {
  try {
    const key = `${CLEARED_BEFORE_DATE_KEY}_${userId}`;
    await AsyncStorage.setItem(key, date.toISOString());
  } catch (e) {
    console.error('[setClearedBeforeDate] Error:', e);
  }
};

/**
 * Get set of individually cleared notification IDs
 */
export const getClearedNotificationIds = async (userId: string): Promise<Set<string>> => {
  try {
    const key = `${CLEARED_NOTIFICATIONS_KEY}_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Set(parsed);
    }
  } catch (e) {
    console.error('[getClearedNotificationIds] Error:', e);
  }
  return new Set();
};

/**
 * Add notification IDs to cleared set
 */
export const addToClearedNotifications = async (userId: string, notificationIds: string[]): Promise<void> => {
  try {
    const key = `${CLEARED_NOTIFICATIONS_KEY}_${userId}`;
    const existing = await getClearedNotificationIds(userId);
    notificationIds.forEach(id => existing.add(id));
    // Keep only last 1000 entries to prevent infinite growth
    const arr = Array.from(existing).slice(-1000);
    await AsyncStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    console.error('[addToClearedNotifications] Error:', e);
  }
};

/**
 * Get set of read notification IDs
 */
export const getReadNotificationIds = async (userId: string): Promise<Set<string>> => {
  try {
    const key = `${READ_NOTIFICATIONS_KEY}_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Set(parsed);
    }
  } catch (e) {
    console.error('[getReadNotificationIds] Error:', e);
  }
  return new Set();
};

/**
 * Mark a notification as read (syncs with server for in-app notifications)
 */
export const markNotificationRead = async (userId: string, notificationId: string): Promise<void> => {
  try {
    // Update local storage
    const key = `${READ_NOTIFICATIONS_KEY}_${userId}`;
    const existing = await getReadNotificationIds(userId);
    existing.add(notificationId);
    const arr = Array.from(existing).slice(-500);
    await AsyncStorage.setItem(key, JSON.stringify(arr));
    
    // Sync with server - update in_app_notifications table if it's an in-app notification
    if (notificationId.startsWith('in-app-')) {
      const actualId = notificationId.replace('in-app-', '');
      try {
        await assertSupabase()
          .from('in_app_notifications')
          .update({ read: true, read_at: new Date().toISOString() })
          .eq('id', actualId)
          .eq('user_id', userId);
      } catch (serverError) {
        console.warn('[markNotificationRead] Server sync failed (non-critical):', serverError);
      }
    }
  } catch (e) {
    console.error('[markNotificationRead] Error:', e);
  }
};

/**
 * Mark all notifications as read (syncs with server)
 */
export const markAllNotificationsRead = async (userId: string, notificationIds: string[]): Promise<void> => {
  try {
    // Update local storage
    const key = `${READ_NOTIFICATIONS_KEY}_${userId}`;
    const existing = await getReadNotificationIds(userId);
    notificationIds.forEach(id => existing.add(id));
    const arr = Array.from(existing).slice(-500);
    await AsyncStorage.setItem(key, JSON.stringify(arr));
    
    // Sync with server - update all in-app notifications for this user
    try {
      const inAppIds = notificationIds
        .filter(id => id.startsWith('in-app-'))
        .map(id => id.replace('in-app-', ''));
      
      if (inAppIds.length > 0) {
        await assertSupabase()
          .from('in_app_notifications')
          .update({ read: true, read_at: new Date().toISOString() })
          .in('id', inAppIds)
          .eq('user_id', userId);
      }
      
      // Also mark all unread in_app_notifications as read
      await assertSupabase()
        .from('in_app_notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('read', false);
    } catch (serverError) {
      console.warn('[markAllNotificationsRead] Server sync failed (non-critical):', serverError);
    }
  } catch (e) {
    console.error('[markAllNotificationsRead] Error:', e);
  }
};

/**
 * Check if a notification should be hidden (cleared)
 */
export const isNotificationCleared = (
  id: string,
  createdAt: string,
  clearedIds: Set<string>,
  clearedBeforeDate: Date | null
): boolean => {
  // Check if individually cleared
  if (clearedIds.has(id)) return true;
  // Check if created before the "clear all" date
  if (clearedBeforeDate && new Date(createdAt) <= clearedBeforeDate) return true;
  return false;
};
