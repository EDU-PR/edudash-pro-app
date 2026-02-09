/**
 * Teacher Dashboard Hook — React Query Edition
 *
 * Fetches and manages teacher dashboard data using @tanstack/react-query.
 * Replaces the previous raw useState/useEffect implementation with:
 *   - Automatic caching (staleTime + gcTime)
 *   - Background refetch on window focus (built-in)
 *   - Configurable retry with back-off
 *   - Stale-while-revalidate pattern
 *   - Offline cache integration via initialData + onSuccess side-effect
 *
 * The public return type is backward-compatible with the previous version:
 *   `{ data, loading, error, refresh, isLoadingFromCache }`
 *
 * @module hooks/useTeacherDashboard
 * @see WARP.md § "Use React Query for all async data operations"
 * @see lib/dashboard/fetchTeacherDashboard.ts — pure queryFn
 * @see lib/queryKeys/teacherDashboard.ts — query key factory
 */

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { offlineCacheService } from '@/lib/services/offlineCacheService';
import { log } from '@/lib/debug';
import { fetchTeacherDashboardData } from '@/lib/dashboard/fetchTeacherDashboard';
import { teacherDashboardKeys } from '@/lib/queryKeys/teacherDashboard';
import type { TeacherDashboardData } from '@/types/dashboard';

/**
 * Hook for fetching Teacher dashboard data (React Query).
 *
 * Consumers receive the same interface as before:
 * ```ts
 * const { data, loading, error, refresh, isLoadingFromCache } = useTeacherDashboard();
 * ```
 */
export const useTeacherDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const hasCacheSeeded = useRef(false);

  // ── Seed query cache from offline storage on mount ──────────────
  useEffect(() => {
    if (hasCacheSeeded.current || !user?.id) return;
    hasCacheSeeded.current = true;

    const seedFromCache = async () => {
      try {
        const cached = await offlineCacheService.getTeacherDashboard(
          user.id,
          user.user_metadata?.school_id || 'unknown'
        );
        if (cached) {
          log('📱 Seeding React Query cache from offline storage');
          queryClient.setQueryData(
            teacherDashboardKeys.dashboard(user.id),
            cached
          );
        }
      } catch {
        // Offline cache miss is non-fatal
      }
    };

    void seedFromCache();
  }, [user?.id, user?.user_metadata?.school_id, queryClient]);

  // ── Main query ──────────────────────────────────────────────────
  const {
    data,
    isLoading,
    isFetching,
    isPlaceholderData,
    error: queryError,
    refetch,
  } = useQuery<TeacherDashboardData>({
    queryKey: teacherDashboardKeys.dashboard(user?.id ?? '__none__'),
    queryFn: async () => {
      // Guard against dashboard-switch race condition
      if (
        typeof window !== 'undefined' &&
        (window as unknown as { dashboardSwitching?: boolean }).dashboardSwitching
      ) {
        // Wait a tick for the flag to clear, then proceed
        await new Promise((r) => setTimeout(r, 300));
        // If still switching, return stale data or empty
        if ((window as unknown as { dashboardSwitching?: boolean }).dashboardSwitching) {
          const stale = queryClient.getQueryData<TeacherDashboardData>(
            teacherDashboardKeys.dashboard(user!.id)
          );
          if (stale) return stale;
        }
      }

      const result = await fetchTeacherDashboardData(user!.id);

      // Side-effect: persist to offline cache
      try {
        const schoolId = user?.user_metadata?.school_id || 'unknown';
        await offlineCacheService.cacheTeacherDashboard(
          user!.id,
          schoolId,
          result
        );
        log('💾 Teacher dashboard data cached for offline use');
      } catch {
        // Cache write failure is non-fatal
      }

      return result;
    },
    enabled: !authLoading && !!user?.id,

    // ── Caching strategy ────────────────────────────────────────
    // Data stays "fresh" for 2 minutes — no redundant refetch
    staleTime: 2 * 60 * 1000,
    // Garbage-collected after 10 minutes of no observers
    gcTime: 10 * 60 * 1000,

    // ── Retry strategy (replaces manual retryCountRef) ──────────
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),

    // ── Refetch on window focus (replaces manual visibility handler)
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: true,

    // ── Prevent refetch on mount if data is already cached ──────
    refetchOnMount: true,
  });

  // ── Backward-compatible return interface ────────────────────────
  const loading = isLoading;
  const isLoadingFromCache = isPlaceholderData || (isLoading && !!data);
  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'Failed to load dashboard data'
    : null;

  const refresh = () => {
    void refetch();
  };

  return {
    data: data ?? null,
    loading,
    error,
    refresh,
    isLoadingFromCache,
  };
};
