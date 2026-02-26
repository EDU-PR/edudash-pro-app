/**
 * useParentActivityHistory
 *
 * Fetches completed playground activities for a child.
 * Returns: activities array, loading state, and refresh function.
 */

import { useCallback, useEffect, useState } from 'react';
import { assertSupabase } from '@/lib/supabase';

export interface CompletedActivity {
  id: string;
  activityName: string;
  domain: string;
  starsEarned: number;
  completedAt: string;
  timeSpentMinutes: number | null;
}

interface UseParentActivityHistoryResult {
  activities: CompletedActivity[];
  loading: boolean;
  refresh: () => void;
}

export function useParentActivityHistory(childId: string | null): UseParentActivityHistoryResult {
  const supabase = assertSupabase();
  const [activities, setActivities] = useState<CompletedActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!childId) {
      setActivities([]);
      return;
    }

    let active = true;

    const fetchActivities = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('lesson_assignments')
          .select('id, title, domain, stars_earned, completed_at, time_spent_minutes')
          .eq('student_id', childId)
          .eq('status', 'completed')
          .eq('delivery_mode', 'playground')
          .order('completed_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        if (!active) return;

        const mapped: CompletedActivity[] = (data || []).map((row: any) => ({
          id: row.id,
          activityName: row.title || 'Activity',
          domain: row.domain || 'general',
          starsEarned: typeof row.stars_earned === 'number' ? row.stars_earned : 0,
          completedAt: row.completed_at || '',
          timeSpentMinutes: typeof row.time_spent_minutes === 'number' ? row.time_spent_minutes : null,
        }));

        setActivities(mapped);
      } catch (err) {
        console.error('[useParentActivityHistory] Failed to fetch activities:', err);
        if (active) setActivities([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchActivities();

    return () => {
      active = false;
    };
  }, [childId, supabase, refreshKey]);

  return { activities, loading, refresh };
}
