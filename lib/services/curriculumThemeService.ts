/**
 * Curriculum Theme Service
 * Fetches themes from the annual/term plan for alignment with Daily Routine and lesson generation.
 */

import { assertSupabase } from '@/lib/supabase';

export interface ThemeForWeek {
  id: string;
  title: string;
  description?: string | null;
  learning_objectives: string[];
}

function toObjectiveArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,;|]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Fetch the curriculum theme whose start_date/end_date overlaps the given week.
 * Week is expected as Monday (YYYY-MM-DD). Overlap: theme.start_date <= weekFriday AND theme.end_date >= weekMonday.
 */
export async function fetchThemeForWeek(
  preschoolId: string,
  weekStartDate: string,
): Promise<ThemeForWeek | null> {
  const supabase = assertSupabase();
  const weekStart = String(weekStartDate).slice(0, 10);
  const weekEnd = new Date(`${weekStart}T00:00:00.000Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 4);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('curriculum_themes')
    .select('id, title, description, learning_objectives, updated_at')
    .eq('preschool_id', preschoolId)
    .lte('start_date', weekEndStr)
    .gte('end_date', weekStart)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[CurriculumThemeService] fetchThemeForWeek failed:', error);
    return null;
  }

  if (!data) return null;

  const row = data as Record<string, unknown>;
  return {
    id: String(row.id || ''),
    title: String(row.title || '').trim(),
    description: typeof row.description === 'string' ? row.description : null,
    learning_objectives: toObjectiveArray(row.learning_objectives),
  };
}
