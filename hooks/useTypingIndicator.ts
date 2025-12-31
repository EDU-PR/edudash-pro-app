/**
 * useTypingIndicator - Mobile typing indicator hook
 * Uses Supabase broadcast channels for real-time typing status (WhatsApp-style)
 * 
 * Features:
 * - Broadcasts typing status when user is typing
 * - Listens for other users' typing status
 * - Auto-timeout after 3 seconds of inactivity
 * - Throttled broadcasts to reduce network overhead
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface TypingUser {
  userId: string;
  userName: string;
  timestamp: number;
}

interface UseTypingIndicatorOptions {
  threadId: string | null;
  userId: string | null;
  userName?: string;
}

interface UseTypingIndicatorReturn {
  /** List of users currently typing */
  typingUsers: TypingUser[];
  /** Call this when user starts/continues typing */
  setTyping: () => void;
  /** Call this when user stops typing (e.g., sends message) */
  clearTyping: () => void;
  /** Whether any other user is typing */
  isOtherTyping: boolean;
  /** Display text like "John is typing..." or "John, Jane are typing..." */
  typingText: string | null;
}

// Throttle typing broadcasts to every 2 seconds
const TYPING_THROTTLE_MS = 2000;
// Auto-clear typing status after 3 seconds of no updates
const TYPING_TIMEOUT_MS = 3000;

export function useTypingIndicator({
  threadId,
  userId,
  userName = 'Someone',
}: UseTypingIndicatorOptions): UseTypingIndicatorReturn {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const lastBroadcastRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  // Broadcast typing status
  const broadcastTyping = useCallback(async (isTyping: boolean) => {
    if (!threadId || !userId) return;

    const now = Date.now();
    
    // Throttle: only broadcast if enough time has passed (for typing=true)
    if (isTyping && now - lastBroadcastRef.current < TYPING_THROTTLE_MS) {
      return;
    }
    
    lastBroadcastRef.current = now;

    try {
      const channel = assertSupabase().channel(`typing:${threadId}`);
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId,
          userName,
          isTyping,
          timestamp: now,
        },
      });
      logger.debug('useTypingIndicator', `Broadcast typing: ${isTyping}`);
    } catch (err) {
      logger.warn('useTypingIndicator', 'Failed to broadcast typing:', err);
    }
  }, [threadId, userId, userName]);

  // Set typing status (call when user types)
  const setTyping = useCallback(() => {
    broadcastTyping(true);
    
    // Auto-clear after timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      broadcastTyping(false);
    }, TYPING_TIMEOUT_MS);
  }, [broadcastTyping]);

  // Clear typing status (call when user sends message)
  const clearTyping = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    broadcastTyping(false);
  }, [broadcastTyping]);

  // Subscribe to typing events
  useEffect(() => {
    if (!threadId || !userId) return;

    const channel = assertSupabase()
      .channel(`typing:${threadId}`)
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        const { userId: typingUserId, userName: typingUserName, isTyping, timestamp } = payload.payload;
        
        // Ignore own typing events
        if (typingUserId === userId) return;
        
        setTypingUsers(prev => {
          if (isTyping) {
            // Add or update typing user
            const existing = prev.find(u => u.userId === typingUserId);
            if (existing) {
              return prev.map(u => 
                u.userId === typingUserId 
                  ? { ...u, timestamp } 
                  : u
              );
            }
            return [...prev, { userId: typingUserId, userName: typingUserName, timestamp }];
          } else {
            // Remove typing user
            return prev.filter(u => u.userId !== typingUserId);
          }
        });
      })
      .subscribe();

    channelRef.current = channel;
    logger.debug('useTypingIndicator', `Subscribed to typing channel: ${threadId}`);

    // Cleanup stale typing indicators every second
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => 
        prev.filter(u => now - u.timestamp < TYPING_TIMEOUT_MS + 1000)
      );
    }, 1000);

    return () => {
      if (channelRef.current) {
        assertSupabase().removeChannel(channelRef.current);
        channelRef.current = null;
      }
      clearInterval(cleanupInterval);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      logger.debug('useTypingIndicator', 'Unsubscribed from typing channel');
    };
  }, [threadId, userId]);

  // Computed values
  const isOtherTyping = typingUsers.length > 0;
  
  const typingText = isOtherTyping
    ? typingUsers.length === 1
      ? `${typingUsers[0].userName} is typing...`
      : typingUsers.length === 2
        ? `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`
        : `${typingUsers.length} people are typing...`
    : null;

  return {
    typingUsers,
    setTyping,
    clearTyping,
    isOtherTyping,
    typingText,
  };
}
