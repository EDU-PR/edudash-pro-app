/**
 * useParentTypingIndicator Hook
 * Real-time typing indicator using Supabase broadcast channels (no DB writes)
 * Implements throttling and auto-timeout like WhatsApp
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

interface TypingUser {
  userId: string;
  userName: string;
  timestamp: number;
}

interface UseTypingIndicatorOptions {
  throttleMs?: number; // Min time between typing broadcasts (default: 2000ms)
  timeoutMs?: number;  // Auto-clear typing after this (default: 3000ms)
}

interface UseTypingIndicatorReturn {
  /** Users currently typing (excluding self) */
  typingUsers: TypingUser[];
  /** Formatted text like "John is typing..." or "John, Jane are typing..." */
  typingText: string | null;
  /** Call this when user starts typing (throttled) */
  startTyping: () => void;
  /** Call this when user stops typing (e.g., on blur or send) */
  stopTyping: () => void;
  /** Whether anyone is typing */
  isTyping: boolean;
}

export function useParentTypingIndicator(
  threadId: string | null,
  options: UseTypingIndicatorOptions = {}
): UseTypingIndicatorReturn {
  const { throttleMs = 2000, timeoutMs = 3000 } = options;
  
  const { user, profile } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastBroadcastRef = useRef<number>(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get user's display name
  const userName = profile 
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User'
    : 'User';

  // Broadcast typing status
  const broadcastTyping = useCallback((isTyping: boolean) => {
    if (!threadId || !user?.id || !channelRef.current) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: user.id,
        userName,
        isTyping,
        timestamp: Date.now(),
      },
    });
  }, [threadId, user?.id, userName]);

  // Start typing (throttled)
  const startTyping = useCallback(() => {
    const now = Date.now();
    
    // Throttle broadcasts
    if (now - lastBroadcastRef.current < throttleMs) {
      // Reset timeout even if throttled
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        broadcastTyping(false);
      }, timeoutMs);
      return;
    }

    lastBroadcastRef.current = now;
    broadcastTyping(true);

    // Auto-stop after timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      broadcastTyping(false);
    }, timeoutMs);
  }, [broadcastTyping, throttleMs, timeoutMs]);

  // Stop typing immediately
  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    broadcastTyping(false);
    lastBroadcastRef.current = 0;
  }, [broadcastTyping]);

  // Setup channel subscription
  // Cache for looked up user names
  const userNameCacheRef = useRef<Record<string, string>>({});
  
  // Look up user name from Supabase if not provided
  const lookupUserName = useCallback(async (userId: string): Promise<string> => {
    // Check cache first
    if (userNameCacheRef.current[userId]) {
      return userNameCacheRef.current[userId];
    }
    
    try {
      const supabase = assertSupabase();
      const { data } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('user_id', userId)
        .single();
      
      if (data) {
        const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Teacher';
        userNameCacheRef.current[userId] = name;
        return name;
      }
    } catch (e) {
      console.log('Failed to lookup user name:', e);
    }
    
    return 'Teacher';
  }, []);

  useEffect(() => {
    if (!threadId) {
      setTypingUsers([]);
      return;
    }

    const supabase = assertSupabase();
    const channelName = `typing-${threadId}`;

    // Create and subscribe to channel
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, async ({ payload }: { payload: { userId?: string; userName?: string; isTyping?: boolean; timestamp?: number } }) => {
        if (!payload || !payload.userId || payload.userId === user?.id) return;

        const userId = payload.userId; // Now guaranteed to be string
        const timestamp = payload.timestamp || Date.now();
        
        // Get user name - use provided name, cache, or look up from DB
        let resolvedUserName = payload.userName;
        if (!resolvedUserName || resolvedUserName === 'User' || resolvedUserName === 'Someone') {
          resolvedUserName = await lookupUserName(userId);
        }
        
        setTypingUsers((prev) => {
          if (payload.isTyping) {
            // Add or update typing user
            const exists = prev.find((u) => u.userId === userId);
            if (exists) {
              return prev.map((u) =>
                u.userId === userId
                  ? { ...u, timestamp, userName: resolvedUserName }
                  : u
              );
            }
            return [
              ...prev,
              {
                userId,
                userName: resolvedUserName,
                timestamp,
              },
            ];
          } else {
            // Remove typing user
            return prev.filter((u) => u.userId !== userId);
          }
        });
      })
      .subscribe();

    // Cleanup stale typing indicators every 2 seconds
    cleanupIntervalRef.current = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) =>
        prev.filter((u) => now - u.timestamp < timeoutMs + 1000)
      );
    }, 2000);

    return () => {
      // Stop typing on unmount
      if (channelRef.current) {
        broadcastTyping(false);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [threadId, user?.id, timeoutMs, broadcastTyping]);

  // Format typing text
  const typingText = useMemo(() => {
    if (typingUsers.length === 0) return null;
    
    if (typingUsers.length === 1) {
      return `${typingUsers[0].userName} is typing...`;
    }
    
    if (typingUsers.length === 2) {
      return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`;
    }
    
    return `${typingUsers.length} people are typing...`;
  }, [typingUsers]);

  const isTyping = typingUsers.length > 0;

  return {
    typingUsers,
    typingText,
    startTyping,
    stopTyping,
    isTyping,
  };
}

export default useParentTypingIndicator;
