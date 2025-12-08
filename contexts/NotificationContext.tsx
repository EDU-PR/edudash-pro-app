/**
 * NotificationContext - Unified notification management for EduDash Pro
 *
 * Centralizes all notification counts (messages, calls, announcements) with:
 * - Real-time Supabase subscriptions
 * - Focus-based refresh via useFocusEffect
 * - Proper query invalidation on mark-as-read
 * - Badge sync for native and PWA
 *
 * @fileoverview Provides NotificationProvider and useNotificationContext
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { assertSupabase } from '../lib/supabase';
import * as Notifications from 'expo-notifications';

// ============================================================================
// Types
// ============================================================================

interface NotificationCounts {
  messages: number;
  calls: number;
  announcements: number;
  total: number;
}

interface NotificationContextValue {
  /** Current notification counts */
  counts: NotificationCounts;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Mark all messages as read for a specific thread */
  markMessagesRead: (threadId: string) => Promise<void>;
  /** Mark all calls as seen */
  markCallsSeen: () => Promise<void>;
  /** Mark all announcements as seen */
  markAnnouncementsSeen: () => Promise<void>;
  /** Force refresh all notification counts */
  refresh: () => Promise<void>;
  /** Update the native/PWA badge count */
  syncBadge: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const QUERY_KEYS = {
  messages: (userId: string) => ['notifications', 'messages', userId] as const,
  calls: (userId: string) => ['notifications', 'calls', userId] as const,
  announcements: (userId: string) => ['notifications', 'announcements', userId] as const,
};

const ASYNC_STORAGE_KEYS = {
  callsLastSeen: (userId: string) => `calls_last_seen_at_${userId}`,
  announcementsLastSeen: (userId: string) => `announcements_last_seen_at_${userId}`,
};

// Stale times - how long data is considered fresh
const STALE_TIMES = {
  messages: 15 * 1000, // 15 seconds (was 1 minute - bug fix)
  calls: 30 * 1000, // 30 seconds
  announcements: 60 * 1000, // 1 minute
};

// ============================================================================
// Context
// ============================================================================

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Fetch unread message count across all threads
 */
async function fetchUnreadMessageCount(userId: string): Promise<number> {
  const client = assertSupabase();

  // Get all thread participations with last_read_at
  const { data: participantData } = await client
    .from('message_participants')
    .select('thread_id, last_read_at')
    .eq('user_id', userId);

  if (!participantData || participantData.length === 0) return 0;

  // Count unread messages across all threads
  let totalUnread = 0;

  for (const participant of participantData) {
    const { count } = await client
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('thread_id', participant.thread_id)
      .gt('created_at', participant.last_read_at)
      .neq('sender_id', userId)
      .is('deleted_at', null);

    totalUnread += count || 0;
  }

  return totalUnread;
}

/**
 * Fetch missed calls count since last seen
 */
async function fetchMissedCallsCount(userId: string): Promise<number> {
  const client = assertSupabase();
  const lastSeenKey = ASYNC_STORAGE_KEYS.callsLastSeen(userId);
  const lastSeen = await AsyncStorage.getItem(lastSeenKey);

  // Build query for missed calls (unanswered calls to this user)
  let query = client
    .from('active_calls')
    .select('id', { count: 'exact', head: true })
    .eq('callee_id', userId)
    .in('status', ['missed', 'ended'])
    .is('answered_at', null);

  // Only count calls after last seen timestamp
  if (lastSeen) {
    query = query.gt('started_at', lastSeen);
  }

  const { count } = await query;
  return count || 0;
}

/**
 * Fetch unread announcements count since last seen
 */
async function fetchUnreadAnnouncementsCount(userId: string): Promise<number> {
  const client = assertSupabase();
  const lastSeenKey = ASYNC_STORAGE_KEYS.announcementsLastSeen(userId);
  const lastSeen = await AsyncStorage.getItem(lastSeenKey);

  // Build query for announcements
  let query = client
    .from('announcements')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true);

  // Only count announcements after last seen timestamp
  if (lastSeen) {
    query = query.gt('created_at', lastSeen);
  }

  const { count } = await query;
  return count || 0;
}

// ============================================================================
// Provider Component
// ============================================================================

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const subscriptionsRef = useRef<Array<{ unsubscribe: () => void }>>([]);

  const userId = user?.id;

  // -------------------------------------------------------------------------
  // Clear old cached data on mount (cache busting for new system)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    
    // Invalidate ALL old notification-related queries to force fresh data
    // This ensures the new unified system takes over from old cached hooks
    queryClient.invalidateQueries({ queryKey: ['parent', 'unread-count'] });
    queryClient.invalidateQueries({ queryKey: ['missed-calls-count'] });
    queryClient.invalidateQueries({ queryKey: ['unread-announcements-count'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    
    console.log('[NotificationContext] Cleared old notification caches for user:', userId);
  }, [userId, queryClient]);

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const messagesQuery = useQuery({
    queryKey: userId ? QUERY_KEYS.messages(userId) : ['disabled'],
    queryFn: () => fetchUnreadMessageCount(userId!),
    enabled: !!userId,
    staleTime: STALE_TIMES.messages,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds as backup
  });

  const callsQuery = useQuery({
    queryKey: userId ? QUERY_KEYS.calls(userId) : ['disabled'],
    queryFn: () => fetchMissedCallsCount(userId!),
    enabled: !!userId,
    staleTime: STALE_TIMES.calls,
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  const announcementsQuery = useQuery({
    queryKey: userId ? QUERY_KEYS.announcements(userId) : ['disabled'],
    queryFn: () => fetchUnreadAnnouncementsCount(userId!),
    enabled: !!userId,
    staleTime: STALE_TIMES.announcements,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // -------------------------------------------------------------------------
  // Computed Values
  // -------------------------------------------------------------------------

  const counts = useMemo<NotificationCounts>(() => {
    const messages = messagesQuery.data ?? 0;
    const calls = callsQuery.data ?? 0;
    const announcements = announcementsQuery.data ?? 0;

    return {
      messages,
      calls,
      announcements,
      total: messages + calls + announcements,
    };
  }, [messagesQuery.data, callsQuery.data, announcementsQuery.data]);

  const isLoading = messagesQuery.isLoading || callsQuery.isLoading || announcementsQuery.isLoading;
  const error = messagesQuery.error || callsQuery.error || announcementsQuery.error;

  // -------------------------------------------------------------------------
  // Badge Sync
  // -------------------------------------------------------------------------

  const syncBadge = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        await Notifications.setBadgeCountAsync(counts.total);
      }
      // For PWA, we could update document.title or use the Badging API
      // when running in browser context
    } catch {
      // Silent fail - badge sync is not critical
    }
  }, [counts.total]);

  // Sync badge whenever total changes
  useEffect(() => {
    syncBadge();
  }, [syncBadge]);

  // -------------------------------------------------------------------------
  // Refresh Functions
  // -------------------------------------------------------------------------

  const refresh = useCallback(async () => {
    if (!userId) return;

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.messages(userId) }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.calls(userId) }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.announcements(userId) }),
      // Also invalidate legacy query keys for backward compatibility
      queryClient.invalidateQueries({ queryKey: ['parent', 'unread-count', userId] }),
      queryClient.invalidateQueries({ queryKey: ['missed-calls-count', userId] }),
      queryClient.invalidateQueries({ queryKey: ['unread-announcements-count', userId] }),
    ]);
  }, [queryClient, userId]);

  // -------------------------------------------------------------------------
  // Mark As Read Functions
  // -------------------------------------------------------------------------

  const markMessagesRead = useCallback(async (threadId: string) => {
    if (!userId) return;

    try {
      const client = assertSupabase();
      await client.rpc('mark_thread_messages_as_read', {
        thread_id: threadId,
        reader_id: userId,
      });

      // Immediately invalidate message count query
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.messages(userId) });
      // Also invalidate legacy key
      await queryClient.invalidateQueries({ queryKey: ['parent', 'unread-count', userId] });
    } catch {
      // Silent fail
    }
  }, [userId, queryClient]);

  const markCallsSeen = useCallback(async () => {
    if (!userId) return;

    try {
      // Update last seen timestamp in AsyncStorage
      const now = new Date().toISOString();
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.callsLastSeen(userId), now);

      // Immediately invalidate calls count query
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.calls(userId) });
      // Also invalidate legacy key
      await queryClient.invalidateQueries({ queryKey: ['missed-calls-count', userId] });
    } catch {
      // Silent fail
    }
  }, [userId, queryClient]);

  const markAnnouncementsSeen = useCallback(async () => {
    if (!userId) return;

    try {
      // Update last seen timestamp in AsyncStorage
      const now = new Date().toISOString();
      await AsyncStorage.setItem(ASYNC_STORAGE_KEYS.announcementsLastSeen(userId), now);

      // Immediately invalidate announcements count query
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.announcements(userId) });
      // Also invalidate legacy key
      await queryClient.invalidateQueries({ queryKey: ['unread-announcements-count', userId] });
    } catch {
      // Silent fail
    }
  }, [userId, queryClient]);

  // -------------------------------------------------------------------------
  // Real-time Subscriptions
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!userId) return;

    const client = assertSupabase();

    // Subscribe to new messages
    const messagesSubscription = client
      .channel(`notifications-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Invalidate messages count when new message arrives
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.messages(userId) });
        }
      )
      .subscribe();

    // Subscribe to call status changes
    const callsSubscription = client
      .channel(`notifications-calls-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_calls',
          filter: `callee_id=eq.${userId}`,
        },
        () => {
          // Invalidate calls count when call status changes
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.calls(userId) });
        }
      )
      .subscribe();

    // Subscribe to new announcements
    const announcementsSubscription = client
      .channel(`notifications-announcements-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
        },
        () => {
          // Invalidate announcements count when new announcement arrives
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.announcements(userId) });
        }
      )
      .subscribe();

    subscriptionsRef.current = [
      messagesSubscription,
      callsSubscription,
      announcementsSubscription,
    ];

    return () => {
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, [userId, queryClient]);

  // -------------------------------------------------------------------------
  // App State & Focus Handling
  // -------------------------------------------------------------------------

  // Refresh when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        refresh();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [refresh]);

  // Note: Dashboards should call refresh() in their own useFocusEffect
  // if they want to refresh counts on screen focus. The provider-level
  // refresh handles app foreground transitions.

  // -------------------------------------------------------------------------
  // Context Value
  // -------------------------------------------------------------------------

  const value = useMemo<NotificationContextValue>(
    () => ({
      counts,
      isLoading,
      error: error as Error | null,
      markMessagesRead,
      markCallsSeen,
      markAnnouncementsSeen,
      refresh,
      syncBadge,
    }),
    [
      counts,
      isLoading,
      error,
      markMessagesRead,
      markCallsSeen,
      markAnnouncementsSeen,
      refresh,
      syncBadge,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access notification context
 * Must be used within NotificationProvider
 */
export const useNotificationContext = (): NotificationContextValue => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      'useNotificationContext must be used within a NotificationProvider'
    );
  }

  return context;
};

// ============================================================================
// Convenience Hooks (for backward compatibility and simpler usage)
// ============================================================================

/**
 * Get just the notification counts
 */
export const useNotificationCounts = (): NotificationCounts => {
  const { counts } = useNotificationContext();
  return counts;
};

/**
 * Get total notification count (for badge display)
 */
export const useTotalNotificationCount = (): number => {
  const { counts } = useNotificationContext();
  return counts.total;
};

/**
 * Get unread message count
 */
export const useUnreadMessages = (): number => {
  const { counts } = useNotificationContext();
  return counts.messages;
};

/**
 * Get missed calls count
 */
export const useMissedCalls = (): number => {
  const { counts } = useNotificationContext();
  return counts.calls;
};

/**
 * Get unread announcements count
 */
export const useUnreadAnnouncements = (): number => {
  const { counts } = useNotificationContext();
  return counts.announcements;
};

export default NotificationContext;
