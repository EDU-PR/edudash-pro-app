/**
 * Hook for tracking total notification count
 * 
 * DEPRECATED: This file now re-exports from NotificationContext.
 * Please import from '@/hooks/useNotifications' or '@/contexts/NotificationContext' directly.
 * 
 * Combines unread messages, missed calls, and announcement counts
 * for the notification bell badge in the header.
 */

import { useCallback } from 'react';
import {
  useNotificationContext,
  useTotalNotificationCount as useNewTotalCount,
  useNotificationCounts as useNewNotificationCounts,
} from '../contexts/NotificationContext';

interface NotificationCounts {
  messages: number;
  calls: number;
  announcements: number;
  total: number;
}

/**
 * Hook to get unread (unseen) announcement count for the current user
 * @deprecated Use useNotifications() from '@/hooks/useNotifications'
 */
export const useUnreadAnnouncementsCount = () => {
  const { counts, isLoading, error } = useNotificationContext();
  
  return {
    data: counts.announcements,
    isLoading,
    error,
  };
};

/**
 * Hook to mark announcements as seen
 * @deprecated Use useNotifications() from '@/hooks/useNotifications'
 */
export const useMarkAnnouncementsSeen = () => {
  const { markAnnouncementsSeen } = useNotificationContext();
  
  return {
    mutate: markAnnouncementsSeen,
    mutateAsync: markAnnouncementsSeen,
  };
};

/**
 * Hook to get total notification count (messages + calls + announcements)
 * Used by the notification bell badge in the header.
 * @deprecated Use useNotifications() from '@/hooks/useNotifications'
 */
export const useTotalNotificationCount = (): NotificationCounts => {
  const counts = useNewNotificationCounts();
  return counts;
};

/**
 * Simple hook that just returns the total count number
 * For simpler use cases where only the total is needed.
 * @deprecated Use useNotificationBadge() from '@/hooks/useNotifications'
 */
export const useNotificationBadgeCount = (): number => {
  return useNewTotalCount();
};

export default useTotalNotificationCount;
