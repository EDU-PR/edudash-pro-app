import { assertSupabase } from '@/lib/supabase';
import type {
  DailyProgramBlock,
  DailyProgramBlockType,
  WeeklyProgramDraft,
  WeeklyProgramGenerationConstraints,
} from '@/types/ecd-planning';

export interface GenerateWeeklyProgramFromTermInput {
  preschoolId: string;
  createdBy: string;
  weekStartDate: string;
  theme: string;
  ageGroup: string;
  weeklyObjectives?: string[];
  constraints?: WeeklyProgramGenerationConstraints;
}

type WeeklyProgramAIResponse = {
  title?: string;
  summary?: string;
  blocks?: unknown[];
  days?: Array<{
    day_of_week?: number | string;
    blocks?: unknown[];
  }>;
};

const VALID_BLOCK_TYPES: DailyProgramBlockType[] = [
  'circle_time',
  'learning',
  'movement',
  'outdoor',
  'meal',
  'nap',
  'assessment',
  'transition',
  'other',
];

const toDateOnly = (value: Date) => value.toISOString().slice(0, 10);

const startOfWeekMonday = (dateLike: string): string => {
  const date = new Date(`${dateLike}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid week start date');
  }
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return toDateOnly(date);
};

const addDays = (dateLike: string, days: number): string => {
  const date = new Date(`${dateLike}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnly(date);
};

const clampDayOfWeek = (value: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 => {
  const rounded = Math.min(7, Math.max(1, Math.trunc(value)));
  return rounded as 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,;|]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const toBlockType = (value: unknown): DailyProgramBlockType => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (VALID_BLOCK_TYPES.includes(normalized as DailyProgramBlockType)) {
    return normalized as DailyProgramBlockType;
  }
  return 'learning';
};

const WEEKLY_PROGRAM_CONTAINER_KEYS = ['weekly_program', 'program', 'data', 'result', 'response', 'content'] as const;

const looksLikeWeeklyProgramResponse = (value: unknown): value is WeeklyProgramAIResponse => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.days) ||
    Array.isArray(record.blocks) ||
    typeof record.title === 'string' ||
    typeof record.summary === 'string'
  );
};

const sanitizeJsonCandidate = (value: string): string =>
  value
    .replace(/^\uFEFF/, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim();

const tryParseJsonCandidate = (value: string): unknown | null => {
  const normalized = sanitizeJsonCandidate(value);
  if (!normalized) return null;

  const attempts = [
    normalized,
    // Common AI formatting mistake: trailing commas in objects/arrays.
    normalized.replace(/,\s*([}\]])/g, '$1'),
  ];

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next strategy
    }
  }
  return null;
};

const findBalancedJsonObjects = (value: string, limit = 8): string[] => {
  const matches: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }

    if (ch === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        matches.push(value.slice(start, i + 1));
        start = -1;
        if (matches.length >= limit) break;
      }
    }
  }

  return matches;
};

const parseWeeklyProgramFromUnknown = (value: unknown, depth = 0): WeeklyProgramAIResponse | null => {
  if (depth > 4 || value == null) return null;

  if (looksLikeWeeklyProgramResponse(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    const looksLikeDays = value.every((item) => item && typeof item === 'object' && !Array.isArray(item));
    if (looksLikeDays) {
      return { days: value as WeeklyProgramAIResponse['days'] };
    }
    return null;
  }

  if (typeof value === 'string') {
    return parseWeeklyProgramFromText(value, depth + 1);
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of WEEKLY_PROGRAM_CONTAINER_KEYS) {
      if (!(key in record)) continue;
      const parsed = parseWeeklyProgramFromUnknown(record[key], depth + 1);
      if (parsed) return parsed;
    }
  }

  return null;
};

const parseWeeklyProgramFromText = (value: string, depth = 0): WeeklyProgramAIResponse | null => {
  if (depth > 4) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidates = [fenced?.[1], trimmed].filter(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0,
  );

  for (const candidate of candidates) {
    const direct = tryParseJsonCandidate(candidate);
    if (direct != null) {
      const parsed = parseWeeklyProgramFromUnknown(direct, depth + 1);
      if (parsed) return parsed;
    }

    const jsonObjects = findBalancedJsonObjects(candidate);
    for (const jsonObject of jsonObjects) {
      const parsedObject = tryParseJsonCandidate(jsonObject);
      if (parsedObject == null) continue;
      const parsed = parseWeeklyProgramFromUnknown(parsedObject, depth + 1);
      if (parsed) return parsed;
    }
  }

  return null;
};

const extractJson = (value: string): WeeklyProgramAIResponse | null => parseWeeklyProgramFromText(value);

const extractFunctionErrorMessage = async (error: unknown): Promise<string | null> => {
  const maybeError = error as { context?: unknown; message?: string };
  const context = maybeError?.context as
    | {
        status?: number;
        clone?: () => {
          json?: () => Promise<unknown>;
          text?: () => Promise<string>;
        };
        json?: () => Promise<unknown>;
        text?: () => Promise<string>;
      }
    | undefined;

  if (!context) {
    return maybeError?.message || null;
  }

  const status = typeof context.status === 'number' ? context.status : null;
  const response = typeof context.clone === 'function' ? context.clone() : context;

  try {
    if (typeof response.json === 'function') {
      const payload = await response.json();
      if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;
        const message =
          typeof record.message === 'string'
            ? record.message
            : typeof record.error === 'string'
              ? record.error
              : null;
        if (message) {
          return status ? `${message} (HTTP ${status})` : message;
        }
      }
    }
  } catch {
    // ignore JSON parsing issues and try plain text fallback
  }

  try {
    if (typeof response.text === 'function') {
      const text = (await response.text()).trim();
      if (text) {
        return status ? `${text} (HTTP ${status})` : text;
      }
    }
  } catch {
    // ignore fallback parsing errors
  }

  return maybeError?.message || null;
};

const toBlocksFromFlat = (blocks: unknown[]): DailyProgramBlock[] =>
  blocks
    .map((item, index) => {
      const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const day = clampDayOfWeek(Number(raw.day_of_week || raw.day || 1));
      return {
        day_of_week: day,
        block_order: Math.max(1, Number(raw.block_order) || index + 1),
        block_type: toBlockType(raw.block_type || raw.type),
        title: String(raw.title || raw.name || '').trim() || `Learning Block ${index + 1}`,
        start_time: typeof raw.start_time === 'string' ? raw.start_time : null,
        end_time: typeof raw.end_time === 'string' ? raw.end_time : null,
        objectives: toStringArray(raw.objectives),
        materials: toStringArray(raw.materials),
        transition_cue: typeof raw.transition_cue === 'string' ? raw.transition_cue : null,
        notes: typeof raw.notes === 'string' ? raw.notes : null,
        parent_tip: typeof raw.parent_tip === 'string' ? raw.parent_tip : null,
      } as DailyProgramBlock;
    })
    .sort((a, b) => (a.day_of_week === b.day_of_week ? a.block_order - b.block_order : a.day_of_week - b.day_of_week));

const toBlocksFromDays = (days: WeeklyProgramAIResponse['days']): DailyProgramBlock[] => {
  if (!Array.isArray(days)) return [];

  const blocks: DailyProgramBlock[] = [];
  for (const dayEntry of days) {
    const day = clampDayOfWeek(Number(dayEntry?.day_of_week || 1));
    const dayBlocks = Array.isArray(dayEntry?.blocks) ? dayEntry.blocks : [];
    dayBlocks.forEach((item, index) => {
      const raw = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      blocks.push({
        day_of_week: day,
        block_order: Math.max(1, Number(raw.block_order) || index + 1),
        block_type: toBlockType(raw.block_type || raw.type),
        title: String(raw.title || raw.name || '').trim() || `Learning Block ${index + 1}`,
        start_time: typeof raw.start_time === 'string' ? raw.start_time : null,
        end_time: typeof raw.end_time === 'string' ? raw.end_time : null,
        objectives: toStringArray(raw.objectives),
        materials: toStringArray(raw.materials),
        transition_cue: typeof raw.transition_cue === 'string' ? raw.transition_cue : null,
        notes: typeof raw.notes === 'string' ? raw.notes : null,
        parent_tip: typeof raw.parent_tip === 'string' ? raw.parent_tip : null,
      });
    });
  }

  return blocks.sort((a, b) => (a.day_of_week === b.day_of_week ? a.block_order - b.block_order : a.day_of_week - b.day_of_week));
};

const normalizeAIResponse = (
  response: WeeklyProgramAIResponse,
  input: GenerateWeeklyProgramFromTermInput,
): WeeklyProgramDraft => {
  const weekStart = startOfWeekMonday(input.weekStartDate);
  const weekEnd = addDays(weekStart, 4);
  const flatBlocks = Array.isArray(response.blocks) ? toBlocksFromFlat(response.blocks) : [];
  const dayBlocks = toBlocksFromDays(response.days);
  const blocks = flatBlocks.length > 0 ? flatBlocks : dayBlocks;

  if (blocks.length === 0) {
    throw new Error('AI response did not include any daily program blocks');
  }

  return {
    preschool_id: input.preschoolId,
    created_by: input.createdBy,
    week_start_date: weekStart,
    week_end_date: weekEnd,
    age_group: input.ageGroup,
    title: (response.title || `${input.theme} Weekly Program`).trim(),
    summary: (response.summary || `Weekly program for ${input.theme}`).trim(),
    generated_by_ai: true,
    source: 'ai',
    status: 'draft',
    blocks,
  };
};

const buildPrompt = (input: GenerateWeeklyProgramFromTermInput): string => {
  const constraints = input.constraints || {};
  const objectivesText = (input.weeklyObjectives || []).join('; ') || 'Age-appropriate learning outcomes';
  const routineRequirements: string[] = [];

  if (constraints.includeToiletRoutine) {
    routineRequirements.push('Include a toilet or bathroom routine support moment each day.');
  }
  if (constraints.includeNapTime) {
    routineRequirements.push('Include a nap or quiet-rest block suitable for the age group.');
  }
  if (constraints.includeMealBlocks) {
    routineRequirements.push('Include practical meal/snack windows every day.');
  }
  if (constraints.includeOutdoorPlay) {
    routineRequirements.push('Include an outdoor gross-motor play block each day.');
  }
  if (constraints.includeStoryCircle) {
    routineRequirements.push('Include at least one story, read-aloud, or circle-time literacy block per day.');
  }
  if (constraints.includeTransitionCues) {
    routineRequirements.push('Provide explicit transition cues between blocks.');
  }
  if (constraints.includeHygieneChecks) {
    routineRequirements.push('Include hygiene routines (e.g., handwashing or cleanup) as part of the daily flow.');
  }

  return [
    'Generate a preschool weekly program from term context.',
    `Theme: ${input.theme}`,
    `Age group: ${input.ageGroup}`,
    `Week start: ${startOfWeekMonday(input.weekStartDate)}`,
    `Weekly objectives: ${objectivesText}`,
    `Constraints: ${JSON.stringify(constraints)}`,
    ...(routineRequirements.length > 0
      ? [`Routine essentials to enforce: ${routineRequirements.join(' ')}`]
      : []),
    'Do not include markdown fences, comments, or any text before/after the JSON object.',
    'Return STRICT JSON only with shape:',
    '{',
    '  "title": "string",',
    '  "summary": "string",',
    '  "days": [',
    '    {',
    '      "day_of_week": 1,',
    '      "blocks": [',
    '        {',
    '          "block_order": 1,',
    '          "block_type": "circle_time|learning|movement|outdoor|meal|nap|assessment|transition|other",',
    '          "title": "string",',
    '          "start_time": "HH:MM",',
    '          "end_time": "HH:MM",',
    '          "objectives": ["string"],',
    '          "materials": ["string"],',
    '          "transition_cue": "string",',
    '          "notes": "string",',
    '          "parent_tip": "string"',
    '        }',
    '      ]',
    '    }',
    '  ]',
    '}',
    'Cover Monday-Friday with practical preschool activities and smooth transitions.',
  ].join('\n');
};

export class WeeklyProgramCopilotService {
  static async generateWeeklyProgramFromTerm(
    input: GenerateWeeklyProgramFromTermInput,
  ): Promise<WeeklyProgramDraft> {
    const supabase = assertSupabase();
    const prompt = buildPrompt(input);

    const { data, error } = await supabase.functions.invoke('ai-proxy', {
      body: {
        service_type: 'lesson_generation',
        payload: {
          prompt,
        },
        stream: false,
        enable_tools: false,
        metadata: {
          source: 'weekly_program_copilot',
        },
      },
    });

    if (error) {
      const detailedMessage = await extractFunctionErrorMessage(error);
      throw new Error(detailedMessage || error.message || 'Failed to generate weekly program');
    }

    const content =
      typeof data?.content === 'string'
        ? data.content
        : typeof data?.response === 'string'
          ? data.response
          : typeof data?.result === 'string'
            ? data.result
            : JSON.stringify(data || {});

    const parsed = extractJson(content);
    if (!parsed) {
      throw new Error('Failed to parse weekly program response (AI returned non-JSON output).');
    }

    return normalizeAIResponse(parsed, input);
  }

  // Compatibility alias for previous snake_case naming used in docs/plans.
  static async generate_weekly_program_from_term(
    input: GenerateWeeklyProgramFromTermInput,
  ): Promise<WeeklyProgramDraft> {
    return this.generateWeeklyProgramFromTerm(input);
  }
}
