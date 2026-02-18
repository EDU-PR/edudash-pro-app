/**
 * Server-only: fetch display data using a Supabase client (e.g. service role).
 * Used by GET /api/display/data so the TV can load without signing in.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DisplayData,
  DisplayTodayRoutine,
  DisplayRoutineBlock,
  DisplayScheduledLesson,
  DisplayLessonWithDetails,
  DisplayMenuDay,
  DisplayAnnouncement,
  DisplayInsight,
  LessonStepDisplay,
  LessonMediaDisplay,
} from '@/lib/display/types';
import { extractStepsFromContent, extractMediaFromContent } from '@/lib/display/parseLessonContent';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toDateOnly(value: Date): string {
  return value.toISOString().split('T')[0];
}

function getDayOfWeekMondayFirst(value: Date): number {
  return value.getDay() === 0 ? 7 : value.getDay();
}

function normalizeTime(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getProgramStatusScore(status: unknown): number {
  const s = String(status ?? '').toLowerCase();
  if (s === 'published') return 50;
  if (s === 'approved') return 40;
  if (s === 'submitted') return 30;
  if (s === 'draft') return 20;
  return 10;
}

function startOfWeekMonday(dateLike: string): string {
  const d = new Date(`${dateLike.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dateLike;
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return toDateOnly(d);
}

export async function fetchDisplayDataServer(
  supabase: SupabaseClient,
  orgId: string,
  classId: string | null
): Promise<DisplayData> {
  const now = new Date();
  const today = toDateOnly(now);
  const dayOfWeek = getDayOfWeekMondayFirst(now);
  const classIds = classId ? [classId] : [];

  let routine: DisplayTodayRoutine | null = null;
  let themeLabel: string | null = null;

  const { data: programRows, error: programsError } = await supabase
    .from('weekly_programs')
    .select(
      'id, class_id, title, summary, week_start_date, week_end_date, status, published_at, updated_at, created_at'
    )
    .eq('preschool_id', orgId)
    .lte('week_start_date', today)
    .gte('week_end_date', today)
    .order('published_at', { ascending: false })
    .order('updated_at', { ascending: false });

  if (!programsError && programRows?.length) {
    const candidates = programRows.filter((row: Record<string, unknown>) => {
      const rowClassId = row.class_id ? String(row.class_id) : null;
      const inWeek =
        row.week_start_date &&
        row.week_end_date &&
        String(row.week_start_date) <= today &&
        String(row.week_end_date) >= today;
      return inWeek && (!rowClassId || classIds.includes(rowClassId));
    });

    candidates.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      const aScore = getProgramStatusScore(a.status) + (a.class_id ? 5 : 0);
      const bScore = getProgramStatusScore(b.status) + (b.class_id ? 5 : 0);
      if (aScore !== bScore) return bScore - aScore;
      const aT = new Date(String(a.updated_at || a.created_at || 0)).getTime();
      const bT = new Date(String(b.updated_at || b.created_at || 0)).getTime();
      return bT - aT;
    });

    const selected = candidates[0] as Record<string, unknown>;

    const { data: blockRows, error: blocksError } = await supabase
      .from('daily_program_blocks')
      .select('id, title, block_type, start_time, end_time, day_of_week, block_order')
      .eq('weekly_program_id', String(selected.id))
      .eq('day_of_week', dayOfWeek)
      .order('block_order', { ascending: true });

    if (!blocksError && blockRows?.length) {
      const blocks: DisplayRoutineBlock[] = blockRows.map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ''),
        title: String(row.title ?? 'Block'),
        blockType: String(row.block_type ?? 'learning'),
        startTime: normalizeTime(row.start_time),
        endTime: normalizeTime(row.end_time),
      }));

      routine = {
        weeklyProgramId: String(selected.id),
        title: selected.title ? String(selected.title) : null,
        summary: selected.summary ? String(selected.summary) : null,
        dayOfWeek,
        blocks,
      };
      themeLabel = selected.title ? String(selected.title) : null;
    }
  }

  const dayStart = `${today}T00:00:00.000Z`;
  const dayEnd = `${today}T23:59:59.999Z`;

  let scheduledQuery = supabase
    .from('scheduled_lessons')
    .select('id, title, description, scheduled_at, duration_minutes, room_url, status')
    .eq('preschool_id', orgId)
    .gte('scheduled_at', dayStart)
    .lte('scheduled_at', dayEnd)
    .order('scheduled_at', { ascending: true });

  if (classId) scheduledQuery = scheduledQuery.eq('class_id', classId);

  const { data: scheduledRows } = await scheduledQuery;

  const scheduledLessons: DisplayScheduledLesson[] = (scheduledRows || []).map(
    (row: Record<string, unknown>) => ({
      id: String(row.id ?? ''),
      title: String(row.title ?? 'Lesson'),
      description: row.description ? String(row.description) : null,
      scheduled_at: String(row.scheduled_at ?? ''),
      duration_minutes: typeof row.duration_minutes === 'number' ? row.duration_minutes : null,
      room_url: row.room_url ? String(row.room_url) : null,
      status: String(row.status ?? 'scheduled'),
    })
  );

  let lessonIds: string[] = [];
  if (classId) {
    const { data: assignRows } = await supabase
      .from('lesson_assignments')
      .select('lesson_id')
      .eq('preschool_id', orgId)
      .eq('class_id', classId)
      .gte('due_date', dayStart)
      .lte('due_date', dayEnd);
    lessonIds = Array.from(
      new Set((assignRows || []).map((r: { lesson_id?: string }) => r.lesson_id).filter(Boolean) as string[])
    );
  }

  let lessonsWithDetails: DisplayLessonWithDetails[] = scheduledLessons.map((s) => ({ ...s }));

  if (lessonIds.length > 0) {
    const { data: lessonRows } = await supabase
      .from('lessons')
      .select('id, title, content, thumbnail_url')
      .in('id', lessonIds);

    type LessonExtra = { steps: LessonStepDisplay[]; media: LessonMediaDisplay };
    const lessonMap = new Map<string, LessonExtra>(
      (lessonRows || []).map((row: Record<string, unknown>) => [
        String(row.id),
        {
          steps: extractStepsFromContent(row.content),
          media: extractMediaFromContent(row.content, row.thumbnail_url as string | null),
        },
      ])
    );

    lessonsWithDetails = scheduledLessons.map((s, idx) => {
      const matched = (lessonRows || []).find(
        (r: Record<string, unknown>) => String(r.title) === s.title
      );
      const lessonId = matched ? String(matched.id) : lessonIds[idx];
      const extra = lessonId ? lessonMap.get(lessonId) : undefined;
      return { ...s, steps: extra?.steps, media: extra?.media };
    });
  }

  const weekStart = startOfWeekMonday(today);
  let menuToday: DisplayMenuDay | null = null;
  try {
    const { data: menuRows } = await supabase.rpc('get_school_week_menu', {
      p_preschool_id: orgId,
      p_week_start_date: weekStart,
    });
    const rows = (menuRows || []) as Array<{ menu_date: string; breakfast_items?: string[]; lunch_items?: string[]; snack_items?: string[] }>;
    const dayRow = rows.find((r) => r.menu_date === today);
    if (dayRow) {
      menuToday = {
        date: today,
        breakfast: Array.isArray(dayRow.breakfast_items) ? dayRow.breakfast_items : [],
        lunch: Array.isArray(dayRow.lunch_items) ? dayRow.lunch_items : [],
        snack: Array.isArray(dayRow.snack_items) ? dayRow.snack_items : [],
      };
    }
  } catch {
    // RPC may not exist or fail
  }

  const { data: announcementRows } = await supabase
    .from('announcements')
    .select('id, title, body, published_at')
    .eq('preschool_id', orgId)
    .order('published_at', { ascending: false })
    .limit(2);

  const announcements: DisplayAnnouncement[] = (announcementRows || []).map(
    (row: Record<string, unknown>) => ({
      id: String(row.id ?? ''),
      title: String(row.title ?? ''),
      body_preview: String((row.body ?? '')).slice(0, 200),
      published_at: row.published_at ? String(row.published_at) : null,
    })
  );

  let insights: DisplayInsight | null = null;
  try {
    const { data: insightsData } = await supabase.functions.invoke('ai-insights', {
      body: { scope: 'teacher', period_days: 7 },
    });
    if (insightsData?.bullets?.length && Array.isArray(insightsData.bullets)) {
      const bullets = insightsData.bullets
        .filter((b: string) => typeof b === 'string' && b.length < 120)
        .slice(0, 3);
      if (bullets.length) {
        insights = {
          title: insightsData.title || "This week's focus",
          bullets,
        };
      }
    }
  } catch {
    // Non-fatal
  }

  return {
    routine,
    themeLabel,
    lessons: lessonsWithDetails,
    menuToday,
    announcements,
    insights,
    dateLabel: today,
    dayName: DAY_NAMES[now.getDay()],
  };
}
