import { assertSupabase } from '@/lib/supabase';
import type {
  AnnouncementAttachmentMenuStructured,
  SchoolDailyMenuRow,
  WeeklyMenuDay,
  WeeklyMenuDraft,
} from '@/lib/services/schoolMenu.types';
import { isWeeklyMenuDedicatedEnabled } from '@/lib/services/schoolMenuFeatureFlags';

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfWeekMonday(dateLike: string | Date): string {
  const d = typeof dateLike === 'string'
    ? new Date(`${dateLike.slice(0, 10)}T00:00:00.000Z`)
    : new Date(dateLike);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const day = now.getUTCDay();
    now.setUTCDate(now.getUTCDate() + (day === 0 ? -6 : 1 - day));
    return toDateOnly(now);
  }

  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return toDateOnly(d);
}

function emptyWeekDraft(weekStartDate: string): WeeklyMenuDraft {
  const monday = new Date(`${startOfWeekMonday(weekStartDate)}T00:00:00.000Z`);
  const days: WeeklyMenuDay[] = [];
  for (let i = 0; i < 5; i += 1) {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + i);
    days.push({
      date: toDateOnly(date),
      breakfast: [],
      lunch: [],
      snack: [],
      notes: null,
    });
  }

  return {
    week_start_date: toDateOnly(monday),
    days,
  };
}

function normalizeRowsToDraft(weekStartDate: string, rows: SchoolDailyMenuRow[]): WeeklyMenuDraft {
  const base = emptyWeekDraft(weekStartDate);
  const map = new Map(base.days.map((day) => [day.date, day]));

  for (const row of rows) {
    map.set(row.menu_date, {
      date: row.menu_date,
      breakfast: Array.isArray(row.breakfast_items) ? row.breakfast_items : [],
      lunch: Array.isArray(row.lunch_items) ? row.lunch_items : [],
      snack: Array.isArray(row.snack_items) ? row.snack_items : [],
      notes: row.notes || null,
    });
  }

  return {
    week_start_date: startOfWeekMonday(weekStartDate),
    days: Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

function parseStructuredAttachment(attachments: unknown): AnnouncementAttachmentMenuStructured | null {
  if (!Array.isArray(attachments)) return null;

  const found = attachments.find((item) => {
    if (!item || typeof item !== 'object') return false;
    const maybe = item as Record<string, unknown>;
    return maybe.kind === 'menu_week_structured' && Array.isArray(maybe.days);
  });

  return (found || null) as AnnouncementAttachmentMenuStructured | null;
}

export class SchoolMenuService {
  static startOfWeekMonday = startOfWeekMonday;

  static buildEmptyWeekDraft(weekStartDate: string): WeeklyMenuDraft {
    return emptyWeekDraft(weekStartDate);
  }

  static async getWeekMenu(preschoolId: string, weekStartDate: string): Promise<WeeklyMenuDraft | null> {
    const supabase = assertSupabase();
    const normalizedWeek = startOfWeekMonday(weekStartDate);

    const { data, error } = await supabase.rpc('get_school_week_menu', {
      p_preschool_id: preschoolId,
      p_week_start_date: normalizedWeek,
    });

    if (error) {
      throw new Error(error.message || 'Failed to load school menu');
    }

    const rows = (data || []) as SchoolDailyMenuRow[];
    if (rows.length === 0) {
      return null;
    }

    return normalizeRowsToDraft(normalizedWeek, rows);
  }

  static async upsertWeekMenu(params: {
    preschoolId: string;
    weekStartDate: string;
    days: WeeklyMenuDay[];
    sourceUploadPath?: string | null;
    sourceAnnouncementId?: string | null;
  }): Promise<WeeklyMenuDraft> {
    const supabase = assertSupabase();
    const normalizedWeek = startOfWeekMonday(params.weekStartDate);

    const payloadDays = params.days.map((day) => ({
      date: day.date,
      breakfast: day.breakfast || [],
      lunch: day.lunch || [],
      snack: day.snack || [],
      notes: day.notes || null,
    }));

    const { data, error } = await supabase.rpc('upsert_school_week_menu', {
      p_preschool_id: params.preschoolId,
      p_week_start_date: normalizedWeek,
      p_days: payloadDays,
      p_source_upload_path: params.sourceUploadPath || null,
      p_source_announcement_id: params.sourceAnnouncementId || null,
    });

    if (error) {
      throw new Error(error.message || 'Failed to publish school menu');
    }

    return normalizeRowsToDraft(normalizedWeek, (data || []) as SchoolDailyMenuRow[]);
  }

  static async getAvailableWeeks(preschoolId: string): Promise<string[]> {
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('school_daily_menus')
      .select('week_start_date')
      .eq('preschool_id', preschoolId)
      .order('week_start_date', { ascending: false })
      .limit(52);

    if (error) {
      throw new Error(error.message || 'Failed to load available menu weeks');
    }

    const unique = Array.from(new Set((data || []).map((row: any) => String(row.week_start_date).slice(0, 10))));
    return unique;
  }

  /**
   * Delete all daily menu rows for a specific week.
   * Only principals/admins with manager permissions should call this.
   */
  static async deleteWeekMenu(preschoolId: string, weekStartDate: string): Promise<void> {
    const supabase = assertSupabase();
    const normalizedWeek = startOfWeekMonday(weekStartDate);

    const { error } = await supabase
      .from('school_daily_menus')
      .delete()
      .eq('preschool_id', preschoolId)
      .eq('week_start_date', normalizedWeek);

    if (error) {
      throw new Error(error.message || 'Failed to delete school menu');
    }
  }

  static async getWeekMenuWithFallback(preschoolId: string, weekStartDate: string): Promise<WeeklyMenuDraft | null> {
    const normalizedWeek = startOfWeekMonday(weekStartDate);

    if (isWeeklyMenuDedicatedEnabled()) {
      try {
        const dedicated = await this.getWeekMenu(preschoolId, normalizedWeek);
        if (dedicated) {
          return dedicated;
        }
      } catch {
        // Dedicated source unavailable; continue with announcement fallback.
      }
    }

    const supabase = assertSupabase();
    const { data, error } = await supabase
      .from('announcements')
      .select('id, attachments, published_at, created_at')
      .eq('preschool_id', preschoolId)
      .eq('target_audience', 'parents')
      .not('attachments', 'is', null)
      .order('published_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(error.message || 'Failed to load menu fallback data');
    }

    const candidates = (data || [])
      .map((row: any) => ({
        structured: parseStructuredAttachment(row.attachments),
        publishedAt: row.published_at || row.created_at,
      }))
      .filter((item) => item.structured)
      .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));

    const match = candidates.find((item) => item.structured?.week_start_date === normalizedWeek);
    const structured = match?.structured || null;

    if (!structured) {
      return null;
    }

    return {
      week_start_date: startOfWeekMonday(structured.week_start_date),
      days: (structured.days || [])
        .map((day) => ({
          date: day.date,
          breakfast: Array.isArray(day.breakfast) ? day.breakfast : [],
          lunch: Array.isArray(day.lunch) ? day.lunch : [],
          snack: Array.isArray(day.snack) ? day.snack : [],
          notes: day.notes || null,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }
}
