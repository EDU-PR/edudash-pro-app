/**
 * Thread Pinning Hook (M3)
 * Manages pinned state for message threads per user.
 */

import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

export interface UseThreadPinningResult {
  pinnedThreadIds: Set<string>;
  togglePin: (threadId: string) => Promise<void>;
  isPinned: (threadId: string) => boolean;
}

export function useThreadPinning(userId?: string): UseThreadPinningResult {
  const { user } = useAuth();
  const effectiveUserId = userId ?? user?.id;
  const queryClient = useQueryClient();

  const { data: pinnedIds } = useQuery({
    queryKey: ['thread-pinning', effectiveUserId],
    queryFn: async (): Promise<string[]> => {
      if (!effectiveUserId) return [];
      const client = assertSupabase();
      const { data, error } = await client
        .from('message_participants')
        .select('thread_id')
        .eq('user_id', effectiveUserId)
        .eq('is_pinned', true);

      if (error) {
        logger.warn('useThreadPinning', `Failed to fetch pinned threads: ${error.message}`);
        return [];
      }
      return (data || []).map((row) => row.thread_id);
    },
    enabled: !!effectiveUserId,
    staleTime: 1000 * 60 * 5,
  });

  const pinnedThreadIds = new Set(pinnedIds ?? []);

  const isPinned = useCallback(
    (threadId: string) => pinnedThreadIds.has(threadId),
    [pinnedIds],
  );

  const mutation = useMutation({
    mutationFn: async (threadId: string) => {
      if (!effectiveUserId) throw new Error('User not authenticated');
      const client = assertSupabase();
      const currentlyPinned = pinnedThreadIds.has(threadId);

      const { error } = await client
        .from('message_participants')
        .update({
          is_pinned: !currentlyPinned,
          pinned_at: !currentlyPinned ? new Date().toISOString() : null,
        })
        .eq('thread_id', threadId)
        .eq('user_id', effectiveUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thread-pinning', effectiveUserId] });
      queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'threads'] });
    },
    onError: (err) => {
      logger.error('useThreadPinning', 'Toggle pin failed:', err);
    },
  });

  const togglePin = useCallback(
    async (threadId: string) => {
      await mutation.mutateAsync(threadId);
    },
    [mutation],
  );

  return { pinnedThreadIds, togglePin, isPinned };
}
