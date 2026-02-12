import { createClient } from '@/lib/supabase/client';
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

const extractJson = (value: string): WeeklyProgramAIResponse | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] || trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as WeeklyProgramAIResponse;
  } catch {
    return null;
  }
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

  return [
    'Generate a preschool weekly program from term context.',
    `Theme: ${input.theme}`,
    `Age group: ${input.ageGroup}`,
    `Week start: ${startOfWeekMonday(input.weekStartDate)}`,
    `Weekly objectives: ${objectivesText}`,
    `Constraints: ${JSON.stringify(constraints)}`,
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
    const supabase = createClient();
    const prompt = buildPrompt(input);

    const { data, error } = await supabase.functions.invoke('ai-proxy', {
      body: {
        task: 'weekly_program_copilot',
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2500,
        prompt,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to generate weekly program');
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
      throw new Error('Failed to parse weekly program response');
    }

    return normalizeAIResponse(parsed, input);
  }

  static async generate_weekly_program_from_term(
    input: GenerateWeeklyProgramFromTermInput,
  ): Promise<WeeklyProgramDraft> {
    return this.generateWeeklyProgramFromTerm(input);
  }
}
