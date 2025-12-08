/**
 * useNotifications - Clean notification hook for EduDash Pro
 *
 * This hook provides a simple API for consuming notification data
 * throughout the app. It wraps the NotificationContext for convenience.
 *
 * @example
 * ```tsx
 * import { useNotifications, useNotificationsWithFocus } from '@/hooks/useNotifications';
 *
 * function Dashboard() {
 *   // Basic usage - just get counts
 *   const { total, messages, markMessagesRead, refresh } = useNotifications();
 *
 *   // Or with automatic refresh on screen focus
 *   const { total } = useNotificationsWithFocus();
 *
 *   return (
 *     <View>
 *       <Badge count={total} />
 *       <Text>Unread messages: {messages}</Text>
 *       <Button onPress={() => markMessagesRead(threadId)}>Mark Read</Button>
 *     </View>
 *   );
 * }
 * ```
 */

import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useNotificationContext } from '../contexts/NotificationContext';

export interface UseNotificationsResult {
  // Individual counts
  messages: number;
  calls: number;
  announcements: number;
  total: number;

  // Loading/error state
  isLoading: boolean;
  error: Error | null;

  // Actions
  markMessagesRead: (threadId: string) => Promise<void>;
  markCallsSeen: () => Promise<void>;
  markAnnouncementsSeen: () => Promise<void>;
  refresh: () => Promise<void>;

  // Badge sync
  syncBadge: () => Promise<void>;
}

/**
 * Main notification hook for dashboards and components
 *
 * Provides counts for messages, calls, and announcements,
 * plus actions to mark them as read/seen.
 */
export function useNotifications(): UseNotificationsResult {
  const context = useNotificationContext();

  return {
    // Spread counts for convenience
    messages: context.counts.messages,
    calls: context.counts.calls,
    announcements: context.counts.announcements,
    total: context.counts.total,

    // State
    isLoading: context.isLoading,
    error: context.error,

    // Actions
    markMessagesRead: context.markMessagesRead,
    markCallsSeen: context.markCallsSeen,
    markAnnouncementsSeen: context.markAnnouncementsSeen,
    refresh: context.refresh,
    syncBadge: context.syncBadge,
  };
}

/**
 * Notification hook with automatic refresh on screen focus
 *
 * Use this in dashboard screens to ensure counts are fresh
 * when user navigates to the screen.
 */
export function useNotificationsWithFocus(): UseNotificationsResult {
  const result = useNotifications();

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      result.refresh();
    }, [result.refresh])
  );

  return result;
}

/**
 * Get just the total notification count (for badges)
 */
export function useNotificationBadge(): number {
  const { counts } = useNotificationContext();
  return counts.total;
}

/**
 * Get notification counts object
 */
export function useNotificationCounts() {
  const { counts } = useNotificationContext();
  return counts;
}

export default useNotifications;
