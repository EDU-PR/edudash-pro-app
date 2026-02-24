export type QuickLessonContextSource =
  | 'weekly_plan_with_theme'
  | 'weekly_plan_only'
  | 'theme_only';

export interface RoutineBlockForContext {
  day_of_week: number;
  block_type: string;
  title: string;
  objectives: string[];
  start_time?: string | null;
}

export interface QuickLessonThemeContext {
  source: QuickLessonContextSource;
  weekNumber?: number | null;
  weekStartDate?: string | null;
  weekEndDate?: string | null;
  weeklyFocus?: string | null;
  weeklyObjectives: string[];
  weeklyPlanStatus?: string | null;
  themeTitle?: string | null;
  themeDescription?: string | null;
  themeObjectives: string[];
  routineBlocks?: RoutineBlockForContext[];
}

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => any;
    eq?: (column: string, value: unknown) => any;
    in?: (column: string, values: unknown[]) => any;
  };
};

const DAY_LABELS: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

function formatRoutineBlocksForPrompt(blocks: RoutineBlockForContext[]): string {
  const byDay = new Map<number, RoutineBlockForContext[]>();
  for (const b of blocks) {
    const d = Math.min(5, Math.max(1, b.day_of_week));
    const list = byDay.get(d) || [];
    list.push(b);
    byDay.set(d, list);
  }
  const lines: string[] = [];
  for (let day = 1; day <= 5; day++) {
    const dayBlocks = (byDay.get(day) || []).sort((a, b) => (a.day_of_week === b.day_of_week ? 0 : a.day_of_week - b.day_of_week));
    const label = DAY_LABELS[day] || `Day ${day}`;
    const parts = dayBlocks.map((b) => {
      const time = b.start_time ? `${b.start_time} ` : '';
      const type = b.block_type || 'block';
      const obj = Array.isArray(b.objectives) && b.objectives.length > 0 ? ` (${b.objectives.slice(0, 2).join('; ')})` : '';
      return `${time}${type} - ${b.title}${obj}`;
    });
    if (parts.length > 0) {
      lines.push(`${label}: ${parts.join('; ')}`);
    }
  }
  return lines.join('\n');
}

const STATUS_RANK: Record<string, number> = {
  published: 4,
  approved: 3,
  submitted: 2,
  draft: 1,
};

const toStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const toObjectiveList = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\\n,;|]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeThemeRow = (row: any) => {
  if (!row) return null;
  return {
    title: typeof row.title === 'string' ? row.title : null,
    description: typeof row.description === 'string' ? row.description : null,
    objectives: toStringArray(row.learning_objectives),
  };
};

const isMissingTableError = (error: any): boolean => {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes('does not exist');
};

export async function loadQuickLessonThemeContext(input: {
  supabase: SupabaseLike;
  preschoolId: string | null | undefined;
  teacherId?: string | null;
  todayIsoDate?: string;
}): Promise<QuickLessonThemeContext | null> {
  const { supabase, preschoolId, teacherId } = input;
  if (!preschoolId) return null;

  const today = input.todayIsoDate || new Date().toISOString().slice(0, 10);

  try {
    const weeklyQuery = await supabase
      .from('weekly_plans')
      .select(
        'id, theme_id, week_number, week_start_date, week_end_date, weekly_focus, weekly_objectives, status, created_by, updated_at'
      )
      .eq('preschool_id', preschoolId)
      .lte('week_start_date', today)
      .gte('week_end_date', today)
      .in('status', ['published', 'approved', 'submitted', 'draft'])
      .order('updated_at', { ascending: false })
      .limit(20);

    if (weeklyQuery.error && !isMissingTableError(weeklyQuery.error)) {
      throw weeklyQuery.error;
    }

    const weeklyPlans: any[] = Array.isArray(weeklyQuery.data) ? weeklyQuery.data : [];
    const sortedPlans = weeklyPlans.sort((a, b) => {
      const statusDiff = (STATUS_RANK[b?.status || ''] || 0) - (STATUS_RANK[a?.status || ''] || 0);
      if (statusDiff !== 0) return statusDiff;

      const teacherPriority = Number(b?.created_by === teacherId) - Number(a?.created_by === teacherId);
      if (teacherPriority !== 0) return teacherPriority;

      const bTime = new Date(b?.updated_at || 0).getTime();
      const aTime = new Date(a?.updated_at || 0).getTime();
      return bTime - aTime;
    });

    const selectedPlan = sortedPlans[0] || null;

    const fetchLatestPublishedTheme = async () => {
      const themeQuery = await supabase
        .from('curriculum_themes')
        .select('id, title, description, learning_objectives, updated_at')
        .eq('preschool_id', preschoolId)
        .eq('is_published', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (themeQuery.error && !isMissingTableError(themeQuery.error)) {
        throw themeQuery.error;
      }

      return normalizeThemeRow(themeQuery.data);
    };

    const fetchWeeklyProgramFallback = async (): Promise<{
      program: any;
      routineBlocks: RoutineBlockForContext[];
    } | null> => {
      const programQuery = await supabase
        .from('weekly_programs')
        .select('id, title, summary, week_start_date, week_end_date, status, updated_at, created_at')
        .eq('preschool_id', preschoolId)
        .lte('week_start_date', today)
        .gte('week_end_date', today)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (programQuery.error && !isMissingTableError(programQuery.error)) {
        throw programQuery.error;
      }

      const programRows: any[] = Array.isArray(programQuery.data) ? programQuery.data : [];
      if (!programRows.length) return null;

      const sortedPrograms = programRows.sort((a, b) => {
        const statusDiff = (STATUS_RANK[b?.status || ''] || 0) - (STATUS_RANK[a?.status || ''] || 0);
        if (statusDiff !== 0) return statusDiff;
        const bTime = new Date(b?.updated_at || b?.created_at || 0).getTime();
        const aTime = new Date(a?.updated_at || a?.created_at || 0).getTime();
        return bTime - aTime;
      });

      const program = sortedPrograms[0] || null;
      if (!program?.id) return null;

      const blocksQuery = await supabase
        .from('daily_program_blocks')
        .select('day_of_week, block_type, title, objectives, start_time')
        .eq('weekly_program_id', program.id)
        .order('day_of_week', { ascending: true })
        .order('block_order', { ascending: true });

      let routineBlocks: RoutineBlockForContext[] = [];
      if (!blocksQuery.error && Array.isArray(blocksQuery.data)) {
        routineBlocks = (blocksQuery.data as any[]).map((row) => ({
          day_of_week: Math.min(5, Math.max(1, Number(row.day_of_week) || 1)),
          block_type: String(row.block_type || 'learning'),
          title: String(row.title || '').trim() || 'Block',
          objectives: toObjectiveList(row.objectives),
          start_time: row.start_time || null,
        }));
      }

      return { program, routineBlocks };
    };

    if (!selectedPlan) {
      const programFallback = await fetchWeeklyProgramFallback();
      const themeOnly = await fetchLatestPublishedTheme();

      if (programFallback) {
        const { program, routineBlocks } = programFallback;
        return {
          source: themeOnly ? 'weekly_plan_with_theme' : 'weekly_plan_only',
          weekStartDate: program.week_start_date,
          weekEndDate: program.week_end_date,
          weeklyFocus: program.title || null,
          weeklyObjectives: toObjectiveList(program.summary),
          weeklyPlanStatus: program.status || null,
          themeTitle: themeOnly?.title,
          themeDescription: themeOnly?.description,
          themeObjectives: themeOnly?.objectives || [],
          routineBlocks: routineBlocks.length > 0 ? routineBlocks : undefined,
        };
      }

      if (!themeOnly) return null;
      return {
        source: 'theme_only',
        weeklyObjectives: [],
        themeTitle: themeOnly.title,
        themeDescription: themeOnly.description,
        themeObjectives: themeOnly.objectives,
      };
    }

    let linkedTheme = null;
    if (selectedPlan.theme_id) {
      const linkedThemeQuery = await supabase
        .from('curriculum_themes')
        .select('id, title, description, learning_objectives')
        .eq('id', selectedPlan.theme_id)
        .maybeSingle();

      if (linkedThemeQuery.error && !isMissingTableError(linkedThemeQuery.error)) {
        throw linkedThemeQuery.error;
      }

      linkedTheme = normalizeThemeRow(linkedThemeQuery.data);
    }

    if (!linkedTheme) {
      linkedTheme = await fetchLatestPublishedTheme();
    }

    return {
      source: linkedTheme ? 'weekly_plan_with_theme' : 'weekly_plan_only',
      weekNumber: selectedPlan.week_number,
      weekStartDate: selectedPlan.week_start_date,
      weekEndDate: selectedPlan.week_end_date,
      weeklyFocus: selectedPlan.weekly_focus,
      weeklyObjectives: toStringArray(selectedPlan.weekly_objectives),
      weeklyPlanStatus: selectedPlan.status,
      themeTitle: linkedTheme?.title,
      themeDescription: linkedTheme?.description,
      themeObjectives: linkedTheme?.objectives || [],
    };
  } catch (error) {
    console.warn('[QuickLessonThemeContext] Failed to load alignment context:', error);
    return null;
  }
}

const limitList = (items: string[], max = 4) => {
  if (items.length <= max) return items;
  return [...items.slice(0, max), '...'];
};

export function buildQuickLessonThemeHint(context: QuickLessonThemeContext | null): string {
  if (!context) return '';

  const lines: string[] = [
    'Use this school planning context and keep the lesson aligned while staying low-prep:',
  ];

  if (context.weeklyFocus) {
    lines.push(`- Weekly focus: ${context.weeklyFocus}.`);
  }

  if (context.weeklyObjectives.length > 0) {
    lines.push(`- Weekly objectives: ${limitList(context.weeklyObjectives).join('; ')}.`);
  }

  if (context.themeTitle) {
    lines.push(`- Curriculum theme: ${context.themeTitle}${context.themeDescription ? ` (${context.themeDescription})` : ''}.`);
  }

  if (context.themeObjectives.length > 0) {
    lines.push(`- Theme objectives: ${limitList(context.themeObjectives).join('; ')}.`);
  }

  if (context.routineBlocks && context.routineBlocks.length > 0) {
    const formatted = formatRoutineBlocksForPrompt(context.routineBlocks);
    if (formatted) {
      lines.push('- Daily routine (align strictly):');
      lines.push(formatted.split('\n').map((l) => `  ${l}`).join('\n'));
    }
  }

  lines.push('- Keep instructions practical for a real classroom with minimal setup time.');

  return lines.join('\n');
}

export function summarizeQuickLessonContext(context: QuickLessonThemeContext | null): string {
  if (!context) return 'No active weekly plan or published curriculum theme found yet.';

  const parts: string[] = [];
  if (context.weekNumber) {
    parts.push(`Week ${context.weekNumber}`);
  }
  if (context.weeklyFocus) {
    parts.push(context.weeklyFocus);
  }
  if (context.themeTitle) {
    parts.push(`Theme: ${context.themeTitle}`);
  }

  return parts.join(' • ') || 'Aligned to latest school planning context.';
}
