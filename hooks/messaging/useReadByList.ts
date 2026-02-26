/**
 * Read-By List Hook (M9)
 * Fetches the list of users who have read a specific message.
 */

import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

export interface ReadByEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  readAt: string;
}

export interface UseReadByListResult {
  readers: ReadByEntry[];
  totalReaders: number;
  loading: boolean;
}

export function useReadByList(messageId: string): UseReadByListResult {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['read-by-list', messageId],
    queryFn: async (): Promise<ReadByEntry[]> => {
      if (!messageId) return [];
      const client = assertSupabase();

      const { data: receipts, error } = await client
        .from('message_read_receipts')
        .select('user_id, read_at')
        .eq('message_id', messageId)
        .order('read_at', { ascending: true });

      if (error) {
        logger.warn('useReadByList', `Failed to fetch read receipts: ${error.message}`);
        return [];
      }

      if (!receipts || receipts.length === 0) return [];

      const userIds = receipts.map((r) => r.user_id);
      const { data: profiles, error: profileError } = await client
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);

      if (profileError) {
        logger.warn('useReadByList', `Failed to fetch profiles: ${profileError.message}`);
      }

      const profileMap = new Map(
        (profiles || []).map((p: { id: string; first_name: string; last_name: string; avatar_url?: string | null }) => [
          p.id,
          { name: `${p.first_name} ${p.last_name}`.trim(), avatarUrl: p.avatar_url ?? undefined },
        ]),
      );

      return receipts.map((r) => {
        const profile = profileMap.get(r.user_id);
        return {
          userId: r.user_id,
          userName: profile?.name || 'Unknown',
          avatarUrl: profile?.avatarUrl,
          readAt: r.read_at,
        };
      });
    },
    enabled: !!messageId && !!user?.id,
    staleTime: 1000 * 30,
  });

  return {
    readers: data ?? [],
    totalReaders: data?.length ?? 0,
    loading: isLoading,
  };
}
