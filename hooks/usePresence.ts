/**
 * usePresence Hook - React Native
 * Real-time presence tracking for online/offline status
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export type PresenceStatus = 'online' | 'away' | 'offline';

interface PresenceRecord {
  user_id: string;
  status: PresenceStatus;
  last_seen_at: string;
}

interface UsePresenceOptions {
  heartbeatInterval?: number; // ms, default 30000 (30s)
  awayTimeout?: number; // ms, default 300000 (5 min)
}

interface UsePresenceReturn {
  myStatus: PresenceStatus;
  getUserPresence: (userId: string) => PresenceRecord | null;
  onlineUsers: Map<string, PresenceRecord>;
  setStatus: (status: PresenceStatus) => Promise<void>;
  isUserOnline: (userId: string) => boolean;
  getLastSeenText: (userId: string) => string;
  loading: boolean;
}

export function usePresence(
  userId: string | undefined,
  options: UsePresenceOptions = {}
): UsePresenceReturn {
  const { 
    heartbeatInterval = 30000, 
    awayTimeout = 300000 
  } = options;

  const [myStatus, setMyStatus] = useState<PresenceStatus>('offline');
  const [onlineUsers, setOnlineUsers] = useState<Map<string, PresenceRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Update presence in database
  const upsertPresence = useCallback(async (status: PresenceStatus) => {
    if (!userId) return;
    
    try {
      const supabase = assertSupabase();
      const { error } = await supabase.rpc('upsert_user_presence', {
        p_user_id: userId,
        p_status: status,
      });
      
      if (error) {
        console.warn('[usePresence] Failed to update presence:', error.message);
      }
    } catch (err) {
      console.warn('[usePresence] Error updating presence:', err);
    }
  }, [userId]);

  // Set status manually
  const setStatus = useCallback(async (status: PresenceStatus) => {
    setMyStatus(status);
    await upsertPresence(status);
  }, [upsertPresence]);

  // Load all presence records
  const loadPresence = useCallback(async () => {
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('user_presence')
        .select('*');

      if (error) {
        console.warn('[usePresence] Failed to load presence:', error.message);
        return;
      }

      const presenceMap = new Map<string, PresenceRecord>();
      (data || []).forEach((record: PresenceRecord) => {
        presenceMap.set(record.user_id, record);
      });
      setOnlineUsers(presenceMap);
    } catch (err) {
      console.warn('[usePresence] Error loading presence:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if user is online (seen in last 2 minutes)
  const isUserOnline = useCallback((targetUserId: string): boolean => {
    const record = onlineUsers.get(targetUserId);
    if (!record) return false;
    if (record.status === 'offline') return false;
    
    // Consider online if last seen within 2 minutes
    const lastSeen = new Date(record.last_seen_at).getTime();
    const twoMinutesAgo = Date.now() - 120000;
    return lastSeen > twoMinutesAgo && record.status === 'online';
  }, [onlineUsers]);

  // Get presence record for a user
  const getUserPresence = useCallback((targetUserId: string): PresenceRecord | null => {
    return onlineUsers.get(targetUserId) || null;
  }, [onlineUsers]);

  // Get human-readable last seen text
  const getLastSeenText = useCallback((targetUserId: string): string => {
    const record = onlineUsers.get(targetUserId);
    if (!record) return 'Offline';
    if (isUserOnline(targetUserId)) return 'Online';
    
    const lastSeen = new Date(record.last_seen_at);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `Last seen ${diffMins} min ago`;
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;
    if (diffDays === 1) return 'Last seen yesterday';
    if (diffDays < 7) return `Last seen ${diffDays} days ago`;
    return `Last seen ${lastSeen.toLocaleDateString()}`;
  }, [onlineUsers, isUserOnline]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    if (!userId) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground - go online
        setStatus('online');
        lastActivityRef.current = Date.now();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App went to background - go away/offline
        setStatus('away');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [userId, setStatus]);

  // Setup heartbeat and real-time subscription
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const supabase = assertSupabase();

    // Initial load
    loadPresence();
    
    // Set initial online status
    setMyStatus('online');
    upsertPresence('online');

    // Heartbeat to maintain presence
    heartbeatRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;
      
      if (timeSinceActivity > awayTimeout) {
        // User has been inactive - mark as away
        if (myStatus !== 'away') {
          setMyStatus('away');
          upsertPresence('away');
        }
      } else {
        // User is active - maintain online status
        upsertPresence('online');
      }
    }, heartbeatInterval);

    // Subscribe to presence changes
    channelRef.current = supabase
      .channel('presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        (payload: { eventType: string; new: PresenceRecord }) => {
          const record = payload.new;
          if (record && record.user_id) {
            setOnlineUsers((prev) => {
              const next = new Map(prev);
              if (payload.eventType === 'DELETE') {
                next.delete(record.user_id);
              } else {
                next.set(record.user_id, record);
              }
              return next;
            });
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      // Mark as offline on unmount
      upsertPresence('offline');
    };
  }, [userId, heartbeatInterval, awayTimeout, loadPresence, upsertPresence, myStatus]);

  // Track user activity (call this on user interactions)
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  return {
    myStatus,
    getUserPresence,
    onlineUsers,
    setStatus,
    isUserOnline,
    getLastSeenText,
    loading,
  };
}

export default usePresence;
