/**
 * Per-Thread Notification Preferences Hook (M10)
 * Manages notification mode per thread for the current user.
 *
 * Server-side enforcement: The notifications-dispatcher edge function
 * queries message_participants.notification_mode when resolving
 * new_message push recipients.
 *   - 'all'      → notify normally
 *   - 'mentions' → only notify when the message contains an @mention
 *   - 'muted'    → no push notification sent
 */

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

export type NotificationMode = 'all' | 'mentions' | 'muted';

export interface UseThreadNotificationPrefsResult {
  mode: NotificationMode;
  setMode: (mode: NotificationMode) => Promise<void>;
  isMuted: boolean;
}

export function useThreadNotificationPrefs(
  threadId: string,
  userId?: string,
): UseThreadNotificationPrefsResult {
  const { user } = useAuth();
  const effectiveUserId = userId ?? user?.id;
  const queryClient = useQueryClient();

  const { data: currentMode } = useQuery({
    queryKey: ['thread-notification-prefs', threadId, effectiveUserId],
    queryFn: async (): Promise<NotificationMode> => {
      if (!effectiveUserId || !threadId) return 'all';
      const client = assertSupabase();
      const { data, error } = await client
        .from('message_participants')
        .select('notification_mode')
        .eq('thread_id', threadId)
        .eq('user_id', effectiveUserId)
        .single();

      if (error) {
        logger.warn('useThreadNotificationPrefs', `Failed to fetch prefs: ${error.message}`);
        return 'all';
      }
      return (data?.notification_mode as NotificationMode) ?? 'all';
    },
    enabled: !!effectiveUserId && !!threadId,
    staleTime: 1000 * 60 * 5,
  });

  const mode: NotificationMode = currentMode ?? 'all';

  const mutation = useMutation({
    mutationFn: async (newMode: NotificationMode) => {
      if (!effectiveUserId) throw new Error('User not authenticated');
      const client = assertSupabase();
      const { error } = await client
        .from('message_participants')
        .update({ notification_mode: newMode })
        .eq('thread_id', threadId)
        .eq('user_id', effectiveUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['thread-notification-prefs', threadId, effectiveUserId],
      });
    },
    onError: (err) => {
      logger.error('useThreadNotificationPrefs', 'Set mode failed:', err);
    },
  });

  const setMode = useCallback(
    async (newMode: NotificationMode) => {
      await mutation.mutateAsync(newMode);
    },
    [mutation],
  );

  return { mode, setMode, isMuted: mode === 'muted' };
}
