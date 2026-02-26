/**
 * useGlobalMessageSearch — Search messages across all threads the user participates in.
 *
 * Queries Supabase `messages` joined with `message_threads` and `profiles`
 * using ILIKE for content matching.  Results are debounced (400 ms) and
 * paginated (20 per page).
 */

import { useState, useRef, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 400;

export interface SearchResult {
  messageId: string;
  threadId: string;
  threadName: string;
  content: string;
  senderName: string;
  timestamp: string;
  matchHighlight: string;
}

export interface GlobalMessageSearchReturn {
  results: SearchResult[];
  loading: boolean;
  query: string;
  setQuery: (q: string) => void;
  search: (q: string) => Promise<void>;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

function buildHighlight(content: string, term: string): string {
  if (!term.trim()) return content.slice(0, 120);
  const lower = content.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  if (idx === -1) return content.slice(0, 120);

  const start = Math.max(0, idx - 30);
  const end = Math.min(content.length, idx + term.length + 50);
  const snippet = (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '');
  return snippet;
}

export function useGlobalMessageSearch(): GlobalMessageSearchReturn {
  const { user } = useAuth();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQueryInternal] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef(0);
  const currentQueryRef = useRef('');

  const executeSearch = useCallback(
    async (term: string, page: number): Promise<SearchResult[]> => {
      if (!user?.id || !term.trim()) return [];
      const client = assertSupabase();
      const offset = page * PAGE_SIZE;

      const { data: participantRows, error: pErr } = await client
        .from('message_thread_participants')
        .select('thread_id')
        .eq('user_id', user.id);

      if (pErr || !participantRows?.length) {
        if (pErr) logger.error('useGlobalMessageSearch', 'Failed to fetch participant threads', pErr);
        return [];
      }

      const threadIds = participantRows.map((r: { thread_id: string }) => r.thread_id);

      const { data, error } = await client
        .from('messages')
        .select(`
          id,
          thread_id,
          content,
          created_at,
          sender:profiles!messages_sender_id_fkey(first_name, last_name),
          thread:message_threads!messages_thread_id_fkey(subject, group_name)
        `)
        .in('thread_id', threadIds)
        .ilike('content', `%${term}%`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        logger.error('useGlobalMessageSearch', 'Search query failed', error);
        return [];
      }

      return (data ?? []).map((row: Record<string, unknown>) => {
        const sender = row.sender as { first_name?: string; last_name?: string } | null;
        const thread = row.thread as { subject?: string; group_name?: string } | null;
        const content = (row.content as string) || '';
        return {
          messageId: row.id as string,
          threadId: row.thread_id as string,
          threadName: thread?.group_name || thread?.subject || 'Chat',
          content,
          senderName: sender ? `${sender.first_name ?? ''} ${sender.last_name ?? ''}`.trim() : 'Unknown',
          timestamp: row.created_at as string,
          matchHighlight: buildHighlight(content, term),
        };
      });
    },
    [user?.id],
  );

  const search = useCallback(
    async (term: string) => {
      currentQueryRef.current = term;
      pageRef.current = 0;
      if (!term.trim()) {
        setResults([]);
        setHasMore(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const rows = await executeSearch(term, 0);
        if (currentQueryRef.current !== term) return;
        setResults(rows);
        setHasMore(rows.length === PAGE_SIZE);
      } finally {
        if (currentQueryRef.current === term) setLoading(false);
      }
    },
    [executeSearch],
  );

  const setQuery = useCallback(
    (q: string) => {
      setQueryInternal(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        search(q);
      }, DEBOUNCE_MS);
    },
    [search],
  );

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !currentQueryRef.current.trim()) return;
    setLoading(true);
    try {
      const nextPage = pageRef.current + 1;
      const rows = await executeSearch(currentQueryRef.current, nextPage);
      pageRef.current = nextPage;
      setResults((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, executeSearch]);

  return { results, loading, query, setQuery, search, hasMore, loadMore };
}
