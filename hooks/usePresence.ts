/**
 * usePresence Hook - React Native
 * Real-time presence tracking for online/offline status
 * Uses background tasks to maintain presence when app is backgrounded
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// Try to import background fetch (optional, may not be available)
let BackgroundFetch: any = null;
try {
  BackgroundFetch = require('react-native-background-fetch').default;
} catch {
  console.log('[usePresence] Background fetch not available');
}

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
  refreshPresence: () => Promise<void>;
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
      console.log('[usePresence] Loaded presence data:', {
        count: presenceMap.size,
        onlineCount: Array.from(presenceMap.values()).filter(r => r.status === 'online').length
      });
      setOnlineUsers(presenceMap);
    } catch (err) {
      console.warn('[usePresence] Error loading presence:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if user is online
  // Users are considered online if:
  // 1. Status is 'online' or 'away' (away means backgrounded but still available)
  // 2. Last seen within 10 minutes (generous grace period for backgrounded apps)
  const isUserOnline = useCallback((targetUserId: string): boolean => {
    const record = onlineUsers.get(targetUserId);
    if (!record) {
      console.log('[usePresence] isUserOnline: no record for', targetUserId);
      return false;
    }
    if (record.status === 'offline') {
      console.log('[usePresence] isUserOnline: user offline', targetUserId);
      return false;
    }
    
    // Consider online if last seen within 10 minutes (generous grace period for backgrounded apps)
    // This accounts for iOS/Android background execution restrictions
    const lastSeen = new Date(record.last_seen_at).getTime();
    const tenMinutesAgo = Date.now() - 600000; // 10 minutes
    const isOnline = lastSeen > tenMinutesAgo && (record.status === 'online' || record.status === 'away');
    
    console.log('[usePresence] isUserOnline check:', {
      targetUserId,
      status: record.status,
      lastSeen: new Date(record.last_seen_at).toISOString(),
      ageSeconds: Math.floor((Date.now() - lastSeen) / 1000),
      isOnline,
      threshold: '10min'
    });
    
    return isOnline;
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

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      console.log('[usePresence] App state changed to:', nextAppState);
      
      if (nextAppState === 'active') {
        // App came to foreground - go online immediately
        console.log('[usePresence] App active - setting online');
        setMyStatus('online');
        await upsertPresence('online');
        lastActivityRef.current = Date.now();
        
        // Refresh presence data
        loadPresence();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App went to background - set to away and send immediate update
        console.log('[usePresence] App backgrounded - setting away (still available)');
        setMyStatus('away');
        
        // CRITICAL: Send presence update IMMEDIATELY before app is fully suspended
        // Use Promise.all to ensure it goes through quickly
        const supabase = assertSupabase();
        try {
          await Promise.race([
            supabase.rpc('upsert_user_presence', {
              p_user_id: userId,
              p_status: 'away',
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]);
          console.log('[usePresence] Background presence update sent successfully');
        } catch (err) {
          console.warn('[usePresence] Failed to send background presence:', err);
        }
        
        lastActivityRef.current = Date.now();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [userId, upsertPresence, loadPresence]);

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
    // Note: This runs in foreground only. For background, we rely on the 'away' status
    // set during app state change and the 5-minute grace period
    heartbeatRef.current = setInterval(() => {
      // Only send heartbeat if app is in foreground
      const appState = AppState.currentState;
      if (appState !== 'active') {
        console.log('[usePresence] Skipping heartbeat - app not active:', appState);
        return;
      }
      
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;
      
      console.log('[usePresence] Heartbeat - app state:', appState, 'time since activity:', Math.floor(timeSinceActivity / 1000), 's');
      
      if (timeSinceActivity > awayTimeout) {
        // User has been inactive - mark as away
        if (myStatus !== 'away') {
          console.log('[usePresence] User inactive, marking as away');
          setMyStatus('away');
          upsertPresence('away');
        }
      } else {
        // User is active - maintain online status
        console.log('[usePresence] User active, maintaining online status');
        upsertPresence(myStatus === 'away' ? 'away' : 'online');
      }
    }, heartbeatInterval);

    // Subscribe to presence changes
    channelRef.current = supabase
      .channel('presence-changes')
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        } as any,
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
    refreshPresence: loadPresence,
    loading,
  };
}

export default usePresence;
