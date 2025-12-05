/**
 * Hook for tracking total notification count
 * 
 * Combines unread messages, missed calls, and announcement counts
 * for the notification bell badge in the header.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadMessageCount } from '@/hooks/useParentMessaging';
import { useMissedCallsCount } from '@/hooks/useMissedCalls';

interface NotificationCounts {
  messages: number;
  calls: number;
  announcements: number;
  total: number;
}

/**
 * Hook to get unread announcement count for the current user
 */
export const useUnreadAnnouncementsCount = () => {
  const { user, profile } = useAuth();
  
  return useQuery({
    queryKey: ['unread-announcements-count', user?.id],
    queryFn: async (): Promise<number> => {
      if (!user?.id) return 0;
      
      const client = assertSupabase();
      const preschoolId = (profile as any)?.preschool_id;
      
      if (!preschoolId) return 0;
      
      try {
        // Get announcements from the last 30 days that haven't been read
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { count, error } = await client
          .from('announcements')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .eq('status', 'published')
          .gte('created_at', thirtyDaysAgo.toISOString());
        
        if (error) {
          // Table might not exist
          if (error.code === '42P01' || error.message?.includes('does not exist')) {
            return 0;
          }
          console.error('[useUnreadAnnouncementsCount] Error:', error);
          return 0;
        }
        
        return count ?? 0;
      } catch (error) {
        console.error('[useUnreadAnnouncementsCount] Exception:', error);
        return 0;
      }
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to get total notification count (messages + calls + announcements)
 * Used by the notification bell badge in the header.
 */
export const useTotalNotificationCount = (): NotificationCounts => {
  const { data: messagesCount = 0 } = useUnreadMessageCount();
  const { data: callsCount = 0 } = useMissedCallsCount();
  const { data: announcementsCount = 0 } = useUnreadAnnouncementsCount();
  
  return useMemo(() => ({
    messages: messagesCount,
    calls: callsCount,
    announcements: announcementsCount,
    total: messagesCount + callsCount + announcementsCount,
  }), [messagesCount, callsCount, announcementsCount]);
};

/**
 * Simple hook that just returns the total count number
 * For simpler use cases where only the total is needed.
 */
export const useNotificationBadgeCount = (): number => {
  const counts = useTotalNotificationCount();
  return counts.total;
};

export default useTotalNotificationCount;
