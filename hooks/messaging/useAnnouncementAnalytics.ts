/**
 * Announcement Analytics Hook (M13)
 * Provides read/unread stats for announcement threads.
 * Principals can see who hasn't read and trigger reminder notifications.
 */

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

export interface NonReader {
  userId: string;
  userName: string;
  avatarUrl?: string;
}

export interface AnnouncementReadStats {
  total: number;
  read: number;
  unread: number;
  readPercentage: number;
  nonReaders: NonReader[];
}

export interface UseAnnouncementAnalyticsResult {
  stats: AnnouncementReadStats | null;
  loading: boolean;
  getAnnouncementReadStats: () => void;
  resendToUnread: (threadId: string) => Promise<void>;
}

export function useAnnouncementAnalytics(threadId: string): UseAnnouncementAnalyticsResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['announcement-analytics', threadId],
    queryFn: async (): Promise<AnnouncementReadStats> => {
      if (!threadId) return { total: 0, read: 0, unread: 0, readPercentage: 0, nonReaders: [] };
      const client = assertSupabase();

      const { data: participants, error: partError } = await client
        .from('message_participants')
        .select('user_id')
        .eq('thread_id', threadId);

      if (partError) {
        logger.warn('useAnnouncementAnalytics', `Failed to fetch participants: ${partError.message}`);
        return { total: 0, read: 0, unread: 0, readPercentage: 0, nonReaders: [] };
      }

      const allUserIds = (participants || []).map((p) => p.user_id);
      const total = allUserIds.length;

      const { data: lastMessage, error: msgError } = await client
        .from('messages')
        .select('id')
        .eq('thread_id', threadId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (msgError || !lastMessage) {
        return { total, read: 0, unread: total, readPercentage: 0, nonReaders: [] };
      }

      const { data: receipts, error: receiptError } = await client
        .from('message_read_receipts')
        .select('user_id')
        .eq('message_id', lastMessage.id);

      if (receiptError) {
        logger.warn('useAnnouncementAnalytics', `Failed to fetch receipts: ${receiptError.message}`);
      }

      const readUserIds = new Set((receipts || []).map((r) => r.user_id));
      const nonReaderIds = allUserIds.filter((id) => !readUserIds.has(id));
      const read = readUserIds.size;

      let nonReaders: NonReader[] = [];
      if (nonReaderIds.length > 0) {
        const { data: profiles } = await client
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', nonReaderIds);

        nonReaders = (profiles || []).map((p: { id: string; first_name: string; last_name: string; avatar_url?: string | null }) => ({
          userId: p.id,
          userName: `${p.first_name} ${p.last_name}`.trim(),
          avatarUrl: p.avatar_url ?? undefined,
        }));
      }

      return {
        total,
        read,
        unread: total - read,
        readPercentage: total > 0 ? Math.round((read / total) * 100) : 0,
        nonReaders,
      };
    },
    enabled: !!threadId && !!user?.id,
    staleTime: 1000 * 60,
  });

  const resendMutation = useMutation({
    mutationFn: async (targetThreadId: string) => {
      const client = assertSupabase();
      const { error } = await client.functions.invoke('send-email', {
        body: {
          action: 'announcement_reminder',
          thread_id: targetThreadId,
          non_reader_ids: stats?.nonReaders.map((nr) => nr.userId) ?? [],
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcement-analytics', threadId] });
    },
    onError: (err) => {
      logger.error('useAnnouncementAnalytics', 'Resend to unread failed:', err);
    },
  });

  const resendToUnread = useCallback(
    async (targetThreadId: string) => {
      await resendMutation.mutateAsync(targetThreadId);
    },
    [resendMutation],
  );

  return {
    stats: stats ?? null,
    loading: isLoading,
    getAnnouncementReadStats: () => refetch(),
    resendToUnread,
  };
}
