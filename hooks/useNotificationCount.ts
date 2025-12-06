/**
 * Hook for tracking total notification count
 * 
 * Combines unread messages, missed calls, and announcement counts
 * for the notification bell badge in the header.
 * 
 * Uses "last seen" timestamps to only count NEW notifications since
 * user last viewed each category.
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadMessageCount } from '@/hooks/useParentMessaging';
import { useMissedCallsCount } from '@/hooks/useMissedCalls';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANNOUNCEMENTS_LAST_SEEN_KEY = 'announcements_last_seen_at';

interface NotificationCounts {
  messages: number;
  calls: number;
  announcements: number;
  total: number;
}

/**
 * Get the last time user viewed announcements
 */
const getLastSeenAnnouncements = async (userId: string): Promise<string | null> => {
  try {
    const key = `${ANNOUNCEMENTS_LAST_SEEN_KEY}_${userId}`;
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * Save the current time as last seen announcements
 */
const setLastSeenAnnouncements = async (userId: string): Promise<void> => {
  try {
    const key = `${ANNOUNCEMENTS_LAST_SEEN_KEY}_${userId}`;
    await AsyncStorage.setItem(key, new Date().toISOString());
  } catch (error) {
    console.error('[setLastSeenAnnouncements] Error:', error);
  }
};

/**
 * Hook to get unread (unseen) announcement count for the current user
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
        // Get last seen timestamp
        const lastSeen = await getLastSeenAnnouncements(user.id);
        
        // Build query for announcements
        let query = client
          .from('announcements')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', preschoolId)
          .eq('status', 'published');
        
        // Only count announcements after last seen (or last 30 days if never seen)
        if (lastSeen) {
          query = query.gt('created_at', lastSeen);
        } else {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          query = query.gte('created_at', thirtyDaysAgo.toISOString());
        }
        
        const { count, error } = await query;
        
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
 * Hook to mark announcements as seen
 */
export const useMarkAnnouncementsSeen = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await setLastSeenAnnouncements(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unread-announcements-count'] });
    },
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
