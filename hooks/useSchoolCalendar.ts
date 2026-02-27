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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toCalendarEvent(value: unknown): CalendarEvent | null {
  if (!isRecord(value)) return null;
  const { id, title, start_date, end_date, event_type, description } = value;
  if (typeof id !== 'string' || typeof title !== 'string' || typeof start_date !== 'string') {
    return null;
  }
  return {
    id,
    title,
    start_date,
    ...(typeof end_date === 'string' ? { end_date } : {}),
    ...(typeof event_type === 'string' ? { event_type } : {}),
    ...(typeof description === 'string' ? { description } : {}),
  };
}

function toCalendarMeeting(value: unknown): CalendarMeeting | null {
  if (!isRecord(value)) return null;
  const { id, title, meeting_type, meeting_date, start_time, end_time, location } = value;
  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof meeting_type !== 'string' ||
    typeof meeting_date !== 'string'
  ) {
    return null;
  }
  return {
    id,
    title,
    meeting_type,
    meeting_date,
    ...(typeof start_time === 'string' ? { start_time } : {}),
    ...(typeof end_time === 'string' ? { end_time } : {}),
    ...(typeof location === 'string' ? { location } : {}),
  };
}

function toCalendarExcursion(value: unknown): CalendarExcursion | null {
  if (!isRecord(value)) return null;
  const { id, title, destination, excursion_date, status } = value;
  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof destination !== 'string' ||
    typeof excursion_date !== 'string' ||
    typeof status !== 'string'
  ) {
    return null;
  }
  return { id, title, destination, excursion_date, status };
}

function parseArray<T>(value: unknown, parser: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<T[]>((acc, item) => {
    const parsed = parser(item);
    if (parsed) acc.push(parsed);
    return acc;
  }, []);
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
      const payload = (res ?? {}) as {
        events?: unknown;
        meetings?: unknown;
        excursions?: unknown;
      };
      setData({
        events: parseArray(payload.events, toCalendarEvent),
        meetings: parseArray(payload.meetings, toCalendarMeeting),
        excursions: parseArray(payload.excursions, toCalendarExcursion),
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
