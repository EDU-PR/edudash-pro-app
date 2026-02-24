/**
 * usePublishedRoutineStatus
 *
 * Checks whether the school has a published weekly program for the current week.
 * Used to show a notification badge / glow on the Daily Routine card in the parent dashboard.
 */

import { useEffect, useState, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';

interface PublishedRoutineStatus {
  hasPublished: boolean;
  publishedAt: string | null;
  weekLabel: string | null;
  isLoading: boolean;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getFridayOfWeek(date: Date): Date {
  const monday = getMondayOfWeek(date);
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  return friday;
}

export function usePublishedRoutineStatus(organizationId: string | undefined): PublishedRoutineStatus {
  const [hasPublished, setHasPublished] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [weekLabel, setWeekLabel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const check = useCallback(async () => {
    if (!organizationId) {
      setHasPublished(false);
      setPublishedAt(null);
      setWeekLabel(null);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = assertSupabase();
      const today = new Date();
      // Wider window: show published routines within ±7 days so parents see
      // next week's routine published on a weekend and last week's as fallback.
      const windowStart = new Date(today);
      windowStart.setDate(windowStart.getDate() - 7);
      const windowEnd = new Date(today);
      windowEnd.setDate(windowEnd.getDate() + 7);

      const { data, error } = await supabase
        .from('weekly_programs')
        .select('id, published_at, week_start_date, week_end_date')
        .eq('preschool_id', organizationId)
        .eq('status', 'published')
        .gte('week_end_date', toDateOnly(windowStart))
        .lte('week_start_date', toDateOnly(windowEnd))
        .order('week_start_date', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setHasPublished(false);
        setPublishedAt(null);
        setWeekLabel(null);
        return;
      }

      setHasPublished(true);
      setPublishedAt(data.published_at || null);

      const start = new Date(`${data.week_start_date}T00:00:00`);
      const end = new Date(`${data.week_end_date}T00:00:00`);
      const fmt = (d: Date) =>
        d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
      setWeekLabel(`${fmt(start)} – ${fmt(end)}`);
    } catch {
      setHasPublished(false);
      setPublishedAt(null);
      setWeekLabel(null);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void check();
  }, [check]);

  return { hasPublished, publishedAt, weekLabel, isLoading };
}
