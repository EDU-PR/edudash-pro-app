/**
 * useSchoolCalendar - fetches school calendar via RPC for parents or teachers
 */
import { useCallback, useEffect, useState } from 'react';
import { assertSupabase } from '@/lib/supabase';

export interface CalendarEvent {
  id: string;
  title: string;
  start_date: string;
  end_date?: string;
  event_type?: string;
  description?: string;
}

export interface CalendarMeeting {
  id: string;
  title: string;
  meeting_type: string;
  meeting_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
}

export interface CalendarExcursion {
  id: string;
  title: string;
  destination: string;
  excursion_date: string;
  status: string;
}

export interface SchoolCalendarData {
  events: CalendarEvent[];
  meetings: CalendarMeeting[];
  excursions: CalendarExcursion[];
}

interface UseSchoolCalendarReturn {
  data: SchoolCalendarData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSchoolCalendarForParent(): UseSchoolCalendarReturn {
  return useSchoolCalendar('parent');
}

export function useSchoolCalendarForTeacher(): UseSchoolCalendarReturn {
  return useSchoolCalendar('teacher');
}

function useSchoolCalendar(role: 'parent' | 'teacher'): UseSchoolCalendarReturn {
  const [data, setData] = useState<SchoolCalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = assertSupabase();
      const rpc = role === 'parent' ? 'get_school_calendar_for_parent' : 'get_school_calendar_for_teacher';
      const { data: res, error: rpcError } = await supabase.rpc(rpc);
      if (rpcError) throw rpcError;
      const payload = (res ?? {}) as { events?: unknown[]; meetings?: unknown[]; excursions?: unknown[] };
      setData({
        events: Array.isArray(payload.events) ? payload.events : [],
        meetings: Array.isArray(payload.meetings) ? payload.meetings : [],
        excursions: Array.isArray(payload.excursions) ? payload.excursions : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
