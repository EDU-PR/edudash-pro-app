import { assertSupabase } from '@/lib/supabase';
import { logError } from '@/lib/debug';
import type { TeacherDashboardData } from '@/types/dashboard';

function toDateOnlyUTC(value: Date): string {
  return value.toISOString().split('T')[0];
}

function getDayOfWeekMondayFirst(value: Date): number {
  const day = value.getDay();
  return day === 0 ? 7 : day;
}

function normalizeTimeValue(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseTimeToMinutes(value: unknown): number | null {
  const normalized = normalizeTimeValue(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

function getProgramStatusScore(value: unknown): number {
  const status = String(value || '').toLowerCase();
  if (status === 'published') return 50;
  if (status === 'approved') return 40;
  if (status === 'submitted') return 30;
  if (status === 'draft') return 20;
  return 10;
}

export async function fetchTodayRoutine(
  schoolId: string,
  classIds: string[]
): Promise<TeacherDashboardData['todayRoutine']> {
  const supabase = assertSupabase();
  const now = new Date();
  const today = toDateOnlyUTC(now);
  const dayOfWeek = getDayOfWeekMondayFirst(now);

  let programsQuery: any = supabase
    .from('weekly_programs')
    .select(
      'id, class_id, term_id, theme_id, title, summary, week_start_date, week_end_date, status, published_at, created_at, updated_at'
    )
    .eq('preschool_id', schoolId);

  if (typeof programsQuery?.lte === 'function' && typeof programsQuery?.gte === 'function') {
    programsQuery = programsQuery.lte('week_start_date', today).gte('week_end_date', today);
  }
  if (typeof programsQuery?.order === 'function') {
    programsQuery = programsQuery.order('published_at', { ascending: false, nullsFirst: false });
  }
  if (typeof programsQuery?.order === 'function') {
    programsQuery = programsQuery.order('updated_at', { ascending: false });
  }

  const { data: programRows, error: programsError } = await programsQuery;

  if (programsError) {
    logError('Today routine programs fetch error:', programsError);
    return null;
  }

  const candidates = (programRows || []).filter((row: Record<string, unknown>) => {
    const classId = row.class_id ? String(row.class_id) : null;
    const weekStart = String(row.week_start_date || '');
    const weekEnd = String(row.week_end_date || '');
    const inCurrentWeek = !!weekStart && !!weekEnd && weekStart <= today && weekEnd >= today;
    return inCurrentWeek && (!classId || classIds.includes(classId));
  });
  if (candidates.length === 0) return null;

  candidates.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
    const aScore = getProgramStatusScore(a.status) + (a.class_id ? 5 : 0);
    const bScore = getProgramStatusScore(b.status) + (b.class_id ? 5 : 0);
    if (aScore !== bScore) return bScore - aScore;
    const aUpdated = new Date(String(a.updated_at || a.created_at || 0)).getTime();
    const bUpdated = new Date(String(b.updated_at || b.created_at || 0)).getTime();
    return bUpdated - aUpdated;
  });

  const selected = candidates[0] as Record<string, unknown>;

  const { data: blockRows, error: blocksError } = await supabase
    .from('daily_program_blocks')
    .select('id, title, block_type, start_time, end_time, day_of_week, block_order')
    .eq('weekly_program_id', String(selected.id))
    .eq('day_of_week', dayOfWeek)
    .order('block_order', { ascending: true });

  if (blocksError) {
    logError('Today routine blocks fetch error:', blocksError);
    return null;
  }

  const blocks = (blockRows || []).map((row: Record<string, unknown>) => ({
    id: String(row.id || ''),
    title: String(row.title || 'Routine block'),
    blockType: String(row.block_type || 'learning'),
    startTime: normalizeTimeValue(row.start_time),
    endTime: normalizeTimeValue(row.end_time),
  }));

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nextBlock = blocks.find((block) => {
    const startMinutes = parseTimeToMinutes(block.startTime);
    return startMinutes !== null && startMinutes >= nowMinutes;
  }) || null;

  return {
    weeklyProgramId: String(selected.id),
    classId: selected.class_id ? String(selected.class_id) : null,
    termId: selected.term_id ? String(selected.term_id) : null,
    themeId: selected.theme_id ? String(selected.theme_id) : null,
    title: selected.title ? String(selected.title) : null,
    summary: selected.summary ? String(selected.summary) : null,
    weekStartDate: String(selected.week_start_date || today),
    weekEndDate: String(selected.week_end_date || today),
    dayOfWeek,
    blockCount: blocks.length,
    nextBlockTitle: nextBlock?.title || null,
    nextBlockStart: nextBlock?.startTime || null,
    blocks,
  };
}
