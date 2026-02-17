import { assertSupabase } from '@/lib/supabase';
import type { WeeklyMenuDay, WeeklyMenuDraft, WeeklyMenuParseResult } from '@/lib/services/schoolMenu.types';

interface ParseWeeklyMenuInput {
  weekStartDate: string;
  mimeType: string;
  fileName: string;
  imageDataUrl?: string;
  fileBase64?: string;
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
      .flatMap((item) => {
        const s = String(item ?? '').trim();
        if (!s) return [];
        return s.split(/\s+and\s+|\s*;\s*|[\n,|]/g).map((x) => x.trim()).filter(Boolean);
      })
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/\s+and\s+|\s*;\s*|[\n,|]/g)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function toConfidence(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function coerceParsedPayload(value: unknown, depth = 0): ParsedPayload | null {
  if (depth > 4 || value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    return {
      days: value.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>,
    };
  }

  if (typeof value !== 'object') return null;

  const raw = value as Record<string, unknown>;
  if (Array.isArray(raw.days)) {
    return {
      week_start_date: typeof raw.week_start_date === 'string' ? raw.week_start_date : undefined,
      confidence: toConfidence(raw.confidence),
      days: raw.days as Array<Record<string, unknown>>,
    };
  }

  // Handle common wrappers returned by AI/OCR services.
  const nestedObjects = [raw.menu, raw.result, raw.payload, raw.data, raw.response, raw.ocr];
  for (const candidate of nestedObjects) {
    const nested = coerceParsedPayload(candidate, depth + 1);
    if (nested) return nested;
  }

  // Handle text wrappers where JSON is embedded in `analysis` or `extracted_text`.
  const nestedText = [raw.analysis, raw.extracted_text, raw.text, raw.content];
  for (const candidate of nestedText) {
    if (typeof candidate !== 'string' || candidate.trim().length === 0) continue;
    const nested = extractJson(candidate, depth + 1);
    if (nested) return nested;
  }

  return null;
}

function extractJson(text: string, depth = 0): ParsedPayload | null {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  const candidates: string[] = [];
  const pushCandidate = (value: string | undefined) => {
    const normalized = String(value || '').trim();
    if (!normalized || candidates.includes(normalized)) return;
    candidates.push(normalized);
  };

  pushCandidate(trimmed);

  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let fenceMatch: RegExpExecArray | null = fenceRegex.exec(trimmed);
  while (fenceMatch) {
    pushCandidate(fenceMatch[1]);
    fenceMatch = fenceRegex.exec(trimmed);
  }

  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    pushCandidate(trimmed.slice(objectStart, objectEnd + 1));
  }

  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    pushCandidate(trimmed.slice(arrayStart, arrayEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const normalized = coerceParsedPayload(parsed, depth + 1);
      if (normalized) return normalized;
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function resolveDateForDay(raw: Record<string, unknown>, weekStartDate: string): string | null {
  const explicitDate = typeof raw.date === 'string' ? raw.date.trim() : '';
  if (explicitDate) {
    const d = new Date(`${explicitDate}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) {
      return toDateOnly(d);
    }
  }

  const dayIndex = typeof raw.day_index === 'number' && raw.day_index >= 0 && raw.day_index <= 6
    ? raw.day_index
    : typeof raw.day_index === 'string'
      ? parseInt(String(raw.day_index), 10)
      : NaN;
  if (Number.isFinite(dayIndex) && dayIndex >= 0 && dayIndex <= 4) {
    const monday = new Date(`${toMonday(weekStartDate)}T00:00:00.000Z`);
    monday.setUTCDate(monday.getUTCDate() + dayIndex);
    return toDateOnly(monday);
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
    const normalizedMime = String(input.mimeType || '').toLowerCase();
    const supportedUpload = normalizedMime.startsWith('image/') || normalizedMime === 'application/pdf';
    if (!supportedUpload) {
      return {
        success: false,
        confidence: 0,
        lowConfidence: true,
        malformed: true,
        issues: [
          'Automatic parsing supports image (JPG/PNG/WebP) or PDF uploads. Please complete the menu manually for this file type.',
        ],
        draft: fallback,
      };
    }

    const base64 = input.fileBase64 || (input.imageDataUrl?.split(',')[1] || '');
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
      'CONTEXT: You are extracting a school or preschool weekly meal menu from an image or PDF. The document shows meals for Monday through Friday (weekdays only).',
      '',
      'OUTPUT: Return ONLY valid JSON. No markdown, no code fences, no explanation before or after. Use this exact schema:',
      '{"week_start_date":"YYYY-MM-DD","confidence":0.0-1.0,"days":[{"date":"YYYY-MM-DD","day":"Monday","breakfast":["item1","item2"],"lunch":["item1"],"snack":["item1"],"notes":null}]}',
      '',
      'RULES:',
      '- week_start_date: the Monday of the week (YYYY-MM-DD). Infer from the document or use the week containing the first day shown.',
      '- days: array of exactly 5 objects, one per weekday Monday–Friday. Use keys: date (YYYY-MM-DD), day ("Monday"|"Tuesday"|"Wednesday"|"Thursday"|"Friday"), breakfast, lunch, snack (each an array of strings), notes (string or null).',
      '- Alternate keys accepted: breakfast_items, lunch_items, snack_items instead of breakfast, lunch, snack.',
      '- Each meal array: one food item per element. Split comma- or newline-separated items into separate array elements. Preserve exact wording (e.g. "Oats porridge", "Chicken stew").',
      '- If a day or meal is missing or unreadable, use an empty array [] and put a brief reason in notes.',
      '- confidence: number 0–1 indicating how confident the extraction is overall.',
      '- If the file is a PDF, treat each page or table as the same weekly menu and extract the same JSON structure.',
    ].join('\n');

    try {
      const supabase = assertSupabase();
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

      const payload = data as {
        content?: string;
        analysis?: string;
        extracted_text?: string;
        ocr?: { analysis?: string; extracted_text?: string };
      } | null;

      const textCandidates = [
        typeof payload?.content === 'string' ? payload.content : null,
        typeof payload?.ocr?.analysis === 'string' ? payload.ocr.analysis : null,
        typeof payload?.ocr?.extracted_text === 'string' ? payload.ocr.extracted_text : null,
        typeof payload?.analysis === 'string' ? payload.analysis : null,
        typeof payload?.extracted_text === 'string' ? payload.extracted_text : null,
        payload?.ocr ? JSON.stringify(payload.ocr) : null,
        JSON.stringify(data || {}),
      ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

      let parsed: ParsedPayload | null = null;
      let rawResponse = textCandidates[0] || '';
      for (const candidate of textCandidates) {
        const result = extractJson(candidate);
        if (!result) continue;
        parsed = result;
        rawResponse = candidate;
        break;
      }

      const normalized = normalizeParsedPayload(parsed, input.weekStartDate);
      return {
        ...normalized,
        rawResponse,
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
