import { createClient } from '@/lib/supabase/client';
import type { WeeklyMenuDay, WeeklyMenuDraft, WeeklyMenuParseResult } from '@/lib/services/schoolMenu.types';

interface ParseWeeklyMenuInput {
  weekStartDate: string;
  mimeType: string;
  fileName: string;
  imageDataUrl?: string;
}

type ParsedPayload = {
  week_start_date?: string;
  confidence?: number;
  days?: Array<Record<string, unknown>>;
};

const DAY_INDEX: Record<string, number> = {
  monday: 0,
  mon: 0,
  tuesday: 1,
  tue: 1,
  tues: 1,
  wednesday: 2,
  wed: 2,
  thursday: 3,
  thu: 3,
  thur: 3,
  thurs: 3,
  friday: 4,
  fri: 4,
  saturday: 5,
  sat: 5,
  sunday: 6,
  sun: 6,
};

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toMonday(dateValue: string): string {
  const d = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    now.setUTCDate(now.getUTCDate() + diff);
    return toDateOnly(now);
  }
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return toDateOnly(d);
}

function buildEmptyWeekDraft(weekStartDate: string): WeeklyMenuDraft {
  const monday = new Date(`${toMonday(weekStartDate)}T00:00:00.000Z`);
  const days: WeeklyMenuDay[] = [];
  for (let i = 0; i < 5; i += 1) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    days.push({
      date: toDateOnly(d),
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

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/[\n,;|]/g)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function extractJson(text: string): ParsedPayload | null {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] || trimmed;

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function resolveDateForDay(raw: Record<string, unknown>, weekStartDate: string): string | null {
  const explicitDate = typeof raw.date === 'string' ? raw.date.trim() : '';
  if (explicitDate) {
    const d = new Date(`${explicitDate}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) {
      return toDateOnly(d);
    }
  }

  const day = typeof raw.day === 'string' ? raw.day.trim().toLowerCase() : '';
  const idx = DAY_INDEX[day];
  if (idx === undefined) {
    return null;
  }

  const monday = new Date(`${toMonday(weekStartDate)}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() + idx);
  return toDateOnly(monday);
}

function normalizeParsedPayload(parsed: ParsedPayload | null, fallbackWeekStartDate: string): WeeklyMenuParseResult {
  const fallback = buildEmptyWeekDraft(fallbackWeekStartDate);
  const issues: string[] = [];

  if (!parsed || !Array.isArray(parsed.days)) {
    issues.push('OCR response could not be parsed into a weekly menu structure.');
    return {
      success: false,
      confidence: 0,
      lowConfidence: true,
      malformed: true,
      issues,
      draft: fallback,
    };
  }

  const weekStartDate = toMonday(parsed.week_start_date || fallback.week_start_date);
  const daysMap: Record<string, WeeklyMenuDay> = {};
  for (const day of fallback.days) {
    daysMap[day.date] = { ...day };
  }

  for (const rawDay of parsed.days) {
    if (!rawDay || typeof rawDay !== 'object') {
      continue;
    }
    const item = rawDay as Record<string, unknown>;
    const date = resolveDateForDay(item, weekStartDate);
    if (!date) {
      issues.push('One OCR row had no readable date/day mapping.');
      continue;
    }

    if (!daysMap[date]) {
      daysMap[date] = {
        date,
        breakfast: [],
        lunch: [],
        snack: [],
        notes: null,
      };
    }

    daysMap[date] = {
      date,
      breakfast: normalizeList(item.breakfast ?? item.breakfast_items),
      lunch: normalizeList(item.lunch ?? item.lunch_items),
      snack: normalizeList(item.snack ?? item.snack_items),
      notes: typeof item.notes === 'string' && item.notes.trim().length > 0 ? item.notes.trim() : null,
    };
  }

  const days = Object.values(daysMap)
    .filter((d) => {
      const dayDate = new Date(`${d.date}T00:00:00.000Z`);
      const monday = new Date(`${weekStartDate}T00:00:00.000Z`);
      const max = new Date(`${weekStartDate}T00:00:00.000Z`);
      max.setUTCDate(max.getUTCDate() + 4);
      return dayDate >= monday && dayDate <= max;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const confidence = typeof parsed.confidence === 'number'
    ? Math.max(0, Math.min(1, parsed.confidence))
    : 0.55;

  const missingDays = 5 - days.length;
  if (missingDays > 0) {
    issues.push(`OCR returned ${days.length}/5 weekday rows. Please review and complete missing days.`);
  }

  const lowConfidence = confidence < 0.6 || issues.length > 0;

  return {
    success: true,
    confidence,
    lowConfidence,
    malformed: false,
    issues,
    draft: {
      week_start_date: weekStartDate,
      days,
    },
  };
}

export class MenuParsingService {
  static buildEmptyWeekDraft(weekStartDate: string): WeeklyMenuDraft {
    return buildEmptyWeekDraft(weekStartDate);
  }

  static async parseWeeklyMenuFromUpload(input: ParseWeeklyMenuInput): Promise<WeeklyMenuParseResult> {
    const fallback = buildEmptyWeekDraft(input.weekStartDate);

    if (!input.imageDataUrl || !input.imageDataUrl.startsWith('data:')) {
      return {
        success: false,
        confidence: 0,
        lowConfidence: true,
        malformed: true,
        issues: [
          'Automatic parsing requires an image upload (JPG/PNG/WebP). Please complete the menu manually for this file.',
        ],
        draft: fallback,
      };
    }

    const base64 = input.imageDataUrl.split(',')[1] || '';
    if (!base64) {
      return {
        success: false,
        confidence: 0,
        lowConfidence: true,
        malformed: true,
        issues: ['Could not read image bytes for OCR parsing.'],
        draft: fallback,
      };
    }

    const prompt = [
      'You are parsing a preschool weekly food menu.',
      'Return STRICT JSON only with this exact schema:',
      '{"week_start_date":"YYYY-MM-DD","confidence":0.0,"days":[{"date":"YYYY-MM-DD","day":"Monday","breakfast":["item"],"lunch":["item"],"snack":["item"],"notes":"optional"}]}',
      'Rules:',
      '- Week start is Monday.',
      '- Include Monday to Friday rows when visible.',
      '- Never include markdown or prose outside JSON.',
      '- If uncertain, leave array empty and put uncertainty in notes.',
    ].join('\n');

    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: {
          scope: 'principal',
          service_type: 'image_analysis',
          payload: {
            prompt,
            images: [{ data: base64, media_type: input.mimeType || 'image/jpeg' }],
            ocr_mode: true,
            ocr_task: 'document',
            ocr_response_format: 'json',
          },
          stream: false,
          enable_tools: false,
          metadata: {
            source: 'weekly_menu_parser',
            file_name: input.fileName,
          },
        },
      });

      if (error) {
        return {
          success: false,
          confidence: 0,
          lowConfidence: true,
          malformed: true,
          issues: [error.message || 'OCR parsing failed. Please complete menu manually.'],
          draft: fallback,
        };
      }

      const payload = data as { content?: string; ocr?: { analysis?: string } } | null;
      const text = typeof payload?.content === 'string'
        ? payload.content
        : typeof payload?.ocr?.analysis === 'string'
          ? payload.ocr.analysis
          : JSON.stringify(payload || {});

      const parsed = extractJson(text);
      const normalized = normalizeParsedPayload(parsed, input.weekStartDate);
      return {
        ...normalized,
        rawResponse: text,
      };
    } catch (error: unknown) {
      return {
        success: false,
        confidence: 0,
        lowConfidence: true,
        malformed: true,
        issues: [error instanceof Error ? error.message : 'OCR parsing failed unexpectedly.'],
        draft: fallback,
      };
    }
  }
}
