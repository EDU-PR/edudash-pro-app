/**
 * SOA Messaging Hooks
 * Custom hooks for Soil of Africa messaging functionality
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import * as SOAMessagingService from '@/services/SOAMessagingService';
import type {
  SOAThreadListItem,
  SOAMessageThread,
  SOAMessage,
  SOAThreadFilters,
  SOAWing,
  SOAThreadType,
  SendSOAMessageParams,
  CreateSOAThreadParams,
} from '@/components/soa-messaging/types';

// ============================================================================
// Thread List Hook
// ============================================================================

interface UseSOAThreadsOptions {
  organizationId: string;
  regionId?: string;
  wing?: SOAWing;
  threadType?: SOAThreadType;
  search?: string;
  enabled?: boolean;
}

export function useSOAThreads(options: UseSOAThreadsOptions) {
  const { organizationId, regionId, wing, threadType, search, enabled = true } = options;
  const queryClient = useQueryClient();

  const filters: SOAThreadFilters = useMemo(() => ({
    organization_id: organizationId,
    region_id: regionId,
    wing,
    thread_type: threadType,
    search,
    is_archived: false,
  }), [organizationId, regionId, wing, threadType, search]);

  const {
    data: threads,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['soa-threads', filters],
    queryFn: () => SOAMessagingService.getSOAThreads(filters),
    enabled: enabled && !!organizationId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Subscribe to thread updates
  useEffect(() => {
    if (!organizationId || !enabled) return;

    const unsubscribe = SOAMessagingService.subscribeToSOAThread(
      organizationId,
      (payload) => {
        // Invalidate threads query on any change
        queryClient.invalidateQueries({ queryKey: ['soa-threads'] });
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, [organizationId, enabled, queryClient]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!threads) return { totalThreads: 0, unreadThreads: 0, totalUnread: 0 };
    
    const unreadThreads = threads.filter(t => t.unread_count > 0).length;
    const totalUnread = threads.reduce((sum, t) => sum + t.unread_count, 0);
    
    return {
      totalThreads: threads.length,
      unreadThreads,
      totalUnread,
    };
  }, [threads]);

  return {
    threads: threads || [],
    isLoading,
    error,
    refetch,
    stats,
  };
}

// ============================================================================
// Single Thread Hook
// ============================================================================

export function useSOAThread(threadId: string | null) {
  const {
    data: thread,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['soa-thread', threadId],
    queryFn: () => threadId ? SOAMessagingService.getSOAThread(threadId) : null,
    enabled: !!threadId,
    staleTime: 30000,
  });

  return {
    thread,
    isLoading,
    error,
    refetch,
  };
}

// ============================================================================
// Messages Hook
// ============================================================================

interface UseSOAMessagesOptions {
  threadId: string | null;
  limit?: number;
  enabled?: boolean;
}

export function useSOAMessages(options: UseSOAMessagesOptions) {
  const { threadId, limit = 50, enabled = true } = options;
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [realtimeMessages, setRealtimeMessages] = useState<SOAMessage[]>([]);

  const {
    data: messages,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['soa-messages', threadId, limit],
    queryFn: () => threadId 
      ? SOAMessagingService.getSOAMessages({ thread_id: threadId, limit })
      : [],
    enabled: enabled && !!threadId,
    staleTime: 10000, // 10 seconds
  });

  // Subscribe to new messages
  useEffect(() => {
    if (!threadId || !enabled) return;

    const unsubscribe = SOAMessagingService.subscribeToSOAMessages(
      threadId,
      (newMessage) => {
        // Add to realtime messages (avoid duplicates)
        setRealtimeMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
        
        // Invalidate query for full refresh
        queryClient.invalidateQueries({ queryKey: ['soa-messages', threadId] });
      }
    );

    return () => {
      unsubscribe?.();
      setRealtimeMessages([]);
    };
  }, [threadId, enabled, queryClient]);

  // Mark thread as read when viewing
  useEffect(() => {
    if (!threadId || !profile?.id) return;
    
    const markRead = async () => {
      try {
        await SOAMessagingService.markSOAThreadRead(threadId);
        queryClient.invalidateQueries({ queryKey: ['soa-threads'] });
      } catch (err) {
        console.error('Error marking thread as read:', err);
      }
    };

    // Mark read after a short delay (user is viewing)
    const timer = setTimeout(markRead, 1000);
    return () => clearTimeout(timer);
  }, [threadId, profile?.id, queryClient]);

  // Combine fetched and realtime messages
  const allMessages = useMemo(() => {
    const fetched = messages || [];
    // Filter out realtime messages that are already in fetched
    const uniqueRealtime = realtimeMessages.filter(
      rm => !fetched.some(fm => fm.id === rm.id)
    );
    return [...fetched, ...uniqueRealtime].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages, realtimeMessages]);

  return {
    messages: allMessages,
    isLoading,
    error,
    refetch,
  };
}

// ============================================================================
// Send Message Hook
// ============================================================================

export function useSOASendMessage(threadId: string | null) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [sending, setSending] = useState(false);

  const sendMutation = useMutation({
    mutationFn: async (params: Omit<SendSOAMessageParams, 'thread_id'>) => {
      if (!threadId) throw new Error('No thread ID');
      return SOAMessagingService.sendSOAMessage({
        thread_id: threadId,
        ...params,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soa-messages', threadId] });
      queryClient.invalidateQueries({ queryKey: ['soa-threads'] });
    },
  });

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      await sendMutation.mutateAsync({ content, content_type: 'text' });
    } finally {
      setSending(false);
    }
  }, [sendMutation, sending]);

  const sendVoiceMessage = useCallback(async (
    attachmentUrl: string, 
    duration: number
  ) => {
    if (sending) return;
    setSending(true);
    try {
      await sendMutation.mutateAsync({
        content: '🎤 Voice message',
        content_type: 'voice',
        attachment_url: attachmentUrl,
        voice_duration: duration,
      });
    } finally {
      setSending(false);
    }
  }, [sendMutation, sending]);

  const sendImageMessage = useCallback(async (
    attachmentUrl: string,
    caption?: string
  ) => {
    if (sending) return;
    setSending(true);
    try {
      await sendMutation.mutateAsync({
        content: caption || '📷 Image',
        content_type: 'image',
        attachment_url: attachmentUrl,
      });
    } finally {
      setSending(false);
    }
  }, [sendMutation, sending]);

  return {
    sendMessage,
    sendVoiceMessage,
    sendImageMessage,
    sending,
    error: sendMutation.error,
  };
}

// ============================================================================
// Create Thread Hook
// ============================================================================

export function useSOACreateThread() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const createMutation = useMutation({
    mutationFn: async (params: CreateSOAThreadParams) => {
      return SOAMessagingService.createSOAThread(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['soa-threads'] });
    },
  });

  const createThread = useCallback(async (params: CreateSOAThreadParams) => {
    return createMutation.mutateAsync(params);
  }, [createMutation]);

  return {
    createThread,
    creating: createMutation.isPending,
    error: createMutation.error,
  };
}

// ============================================================================
// Reactions Hook
// ============================================================================

export function useSOAReactions(threadId: string | null) {
  const queryClient = useQueryClient();

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await SOAMessagingService.addSOAReaction(messageId, emoji);
      queryClient.invalidateQueries({ queryKey: ['soa-messages', threadId] });
    } catch (err) {
      console.error('Error adding reaction:', err);
      throw err;
    }
  }, [threadId, queryClient]);

  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      await SOAMessagingService.removeSOAReaction(messageId, emoji);
      queryClient.invalidateQueries({ queryKey: ['soa-messages', threadId] });
    } catch (err) {
      console.error('Error removing reaction:', err);
      throw err;
    }
  }, [threadId, queryClient]);

  return {
    addReaction,
    removeReaction,
  };
}

// ============================================================================
// Thread Actions Hook
// ============================================================================

export function useSOAThreadActions() {
  const queryClient = useQueryClient();

  const archiveThread = useCallback(async (threadId: string) => {
    try {
      await SOAMessagingService.archiveSOAThread(threadId);
      queryClient.invalidateQueries({ queryKey: ['soa-threads'] });
    } catch (err) {
      console.error('Error archiving thread:', err);
      throw err;
    }
  }, [queryClient]);

  const pinThread = useCallback(async (threadId: string, isPinned: boolean) => {
    try {
      await SOAMessagingService.pinSOAThread(threadId, isPinned);
      queryClient.invalidateQueries({ queryKey: ['soa-threads'] });
    } catch (err) {
      console.error('Error pinning thread:', err);
      throw err;
    }
  }, [queryClient]);

  const muteThread = useCallback(async (threadId: string, isMuted: boolean) => {
    try {
      await SOAMessagingService.updateSOAParticipantPreferences(threadId, { is_muted: isMuted });
      queryClient.invalidateQueries({ queryKey: ['soa-threads'] });
    } catch (err) {
      console.error('Error muting thread:', err);
      throw err;
    }
  }, [queryClient]);

  return {
    archiveThread,
    pinThread,
    muteThread,
  };
}
