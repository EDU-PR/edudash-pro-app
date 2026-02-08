/**
 * useActivityFeed — React Query hooks for the Daily Activity Feed
 *
 * Provides queries and mutations for:
 * - Fetching activities for a parent's children
 * - Adding reactions (emoji) to activities
 * - Adding / removing comments
 * - Real-time subscription for live updates
 */

import { useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ActivityReaction {
  id: string;
  activity_id: string;
  parent_id: string;
  emoji: string;
  created_at: string;
  profiles?: { first_name: string; last_name: string } | null;
}

export interface ActivityComment {
  id: string;
  activity_id: string;
  parent_id: string;
  comment_text: string;
  is_approved: boolean;
  created_at: string;
  profiles?: { first_name: string; last_name: string } | null;
}

export interface ActivityItem {
  id: string;
  preschool_id: string;
  class_id: string | null;
  student_id: string | null;
  teacher_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  media_urls: string[] | null;
  visibility: string | null;
  activity_at: string;
  duration_minutes: number | null;
  reactions: Record<string, unknown> | null; // inline JSONB — legacy
  is_published: boolean;
  created_at: string;
  updated_at: string | null;
  // Joined
  teacher?: { first_name: string; last_name: string } | null;
  student?: { first_name: string; last_name: string } | null;
  class?: { name: string } | null;
  activity_reactions?: ActivityReaction[];
  activity_comments?: ActivityComment[];
}

// ── Query keys ──────────────────────────────────────────────────────────────

export const activityFeedKeys = {
  all: ['activityFeed'] as const,
  byChild: (studentId: string) => [...activityFeedKeys.all, 'child', studentId] as const,
  byClass: (classId: string) => [...activityFeedKeys.all, 'class', classId] as const,
  byDate: (studentId: string, date: string) => [...activityFeedKeys.all, 'child', studentId, date] as const,
};

// ── Fetch activities for a child ────────────────────────────────────────────

export function useChildActivityFeed(
  studentId: string | undefined,
  options?: { limit?: number; date?: string },
): UseQueryResult<ActivityItem[]> {
  const limit = options?.limit ?? 30;
  const date = options?.date;

  return useQuery({
    queryKey: date
      ? activityFeedKeys.byDate(studentId || '', date)
      : activityFeedKeys.byChild(studentId || ''),
    queryFn: async () => {
      if (!studentId) return [];

      const supabase = assertSupabase();

      let query = supabase
        .from('student_activity_feed')
        .select(`
          *,
          teacher:profiles!student_activity_feed_teacher_id_fkey(first_name, last_name),
          student:students!student_activity_feed_student_id_fkey(first_name, last_name),
          class:classes!student_activity_feed_class_id_fkey(name),
          activity_reactions(id, activity_id, parent_id, emoji, created_at, profiles:parent_id(first_name, last_name)),
          activity_comments(id, activity_id, parent_id, comment_text, is_approved, created_at, profiles:parent_id(first_name, last_name))
        `)
        .eq('student_id', studentId)
        .eq('is_published', true)
        .order('activity_at', { ascending: false })
        .limit(limit);

      if (date) {
        // Filter to a specific day
        const dayStart = `${date}T00:00:00.000Z`;
        const dayEnd = `${date}T23:59:59.999Z`;
        query = query.gte('activity_at', dayStart).lte('activity_at', dayEnd);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useActivityFeed] Error:', error);
        throw new Error(error.message);
      }

      return (data || []) as unknown as ActivityItem[];
    },
    enabled: !!studentId,
    staleTime: 1000 * 30, // 30s
    refetchOnWindowFocus: true,
  });
}

// ── Real-time subscription hook ─────────────────────────────────────────────

export function useActivityFeedRealtime(studentId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!studentId) return;

    const supabase = assertSupabase();

    const channel = supabase
      .channel(`activity_feed_${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_activity_feed',
          filter: `student_id=eq.${studentId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: activityFeedKeys.byChild(studentId),
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_reactions',
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: activityFeedKeys.byChild(studentId),
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_comments',
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: activityFeedKeys.byChild(studentId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, queryClient]);
}

// ── Toggle reaction (add or remove) ────────────────────────────────────────

export function useToggleActivityReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activityId,
      emoji,
      parentId,
    }: {
      activityId: string;
      emoji: string;
      parentId: string;
    }) => {
      const supabase = assertSupabase();

      // Check if reaction already exists
      const { data: existing } = await supabase
        .from('activity_reactions')
        .select('id')
        .eq('activity_id', activityId)
        .eq('parent_id', parentId)
        .eq('emoji', emoji)
        .maybeSingle();

      if (existing) {
        // Remove
        const { error } = await supabase
          .from('activity_reactions')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        return { action: 'removed' as const };
      } else {
        // Add
        const { error } = await supabase
          .from('activity_reactions')
          .insert({ activity_id: activityId, parent_id: parentId, emoji });
        if (error) throw error;
        return { action: 'added' as const };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityFeedKeys.all });
    },
  });
}

// ── Add comment ──────────────────────────────────────────────────────────────

export function useAddActivityComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activityId,
      parentId,
      text,
    }: {
      activityId: string;
      parentId: string;
      text: string;
    }) => {
      const supabase = assertSupabase();

      const { data, error } = await supabase
        .from('activity_comments')
        .insert({
          activity_id: activityId,
          parent_id: parentId,
          comment_text: text,
          is_approved: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityFeedKeys.all });
    },
  });
}

// ── Delete comment ───────────────────────────────────────────────────────────

export function useDeleteActivityComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId }: { commentId: string }) => {
      const supabase = assertSupabase();
      const { error } = await supabase
        .from('activity_comments')
        .delete()
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activityFeedKeys.all });
    },
  });
}
