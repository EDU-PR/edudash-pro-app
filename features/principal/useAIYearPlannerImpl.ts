// Hook for Principal AI Year Planner - Refactored for WARP.md compliance
// Manages AI-assisted year plan generation and database persistence

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { assertSupabase } from '@/lib/supabase';
import { generateMockYearPlan } from '@/lib/utils/mock-year-plan';
import { YEAR_PLAN_SYSTEM_PROMPT, buildYearPlanUserPrompt } from '@/lib/utils/ai-year-plan-prompts';
import type {
  YearPlanConfig,
  GeneratedYearPlan,
  GeneratedTerm,
  WeeklyTheme,
  PlannedExcursion,
  PlannedMeeting,
} from '@/components/principal/ai-planner/types';

interface UseAIYearPlannerOptions {
  organizationId?: string;
  userId?: string;
  onShowAlert?: (config: {
    title: string;
    message?: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>;
  }) => void;
}

interface UseAIYearPlannerReturn {
  generatedPlan: GeneratedYearPlan | null;
  isGenerating: boolean;
  isSaving: boolean;
  expandedTerm: number | null;
  setExpandedTerm: (termNumber: number | null) => void;
  generateYearPlan: (config: YearPlanConfig) => Promise<void>;
  savePlanToDatabase: () => Promise<void>;
}

type MeetingType =
  | 'staff'
  | 'parent'
  | 'curriculum'
  | 'safety'
  | 'budget'
  | 'training'
  | 'one_on_one'
  | 'other';

const GENERATED_MARKER = '[AI_YEAR_PLANNER]';
const DEFAULT_MEETING_START_TIME = '09:00';
const DEFAULT_MEETING_END_TIME = '10:00';
const DEFAULT_WEEKLY_THEMES_PER_TERM = 10;

function toStringArray(value: unknown): string[] {
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
}

function parseCurrency(value: string): number | null {
  const cleaned = String(value || '').replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number): string {
  const parsed = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return dateString;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toDateOnly(parsed);
}

function getDefaultTermRange(academicYear: number, termIndex: number, numberOfTerms: number): {
  startDate: string;
  endDate: string;
} {
  if (numberOfTerms === 3) {
    const ranges = [
      { start: `${academicYear}-01-15`, end: `${academicYear}-04-30` },
      { start: `${academicYear}-05-01`, end: `${academicYear}-08-31` },
      { start: `${academicYear}-09-01`, end: `${academicYear}-12-10` },
    ];
    return {
      startDate: ranges[termIndex]?.start || `${academicYear}-01-15`,
      endDate: ranges[termIndex]?.end || `${academicYear}-03-31`,
    };
  }

  const ranges = [
    { start: `${academicYear}-01-15`, end: `${academicYear}-03-31` },
    { start: `${academicYear}-04-01`, end: `${academicYear}-06-30` },
    { start: `${academicYear}-07-01`, end: `${academicYear}-09-30` },
    { start: `${academicYear}-10-01`, end: `${academicYear}-12-10` },
  ];

  return {
    startDate: ranges[termIndex]?.start || `${academicYear}-01-15`,
    endDate: ranges[termIndex]?.end || `${academicYear}-03-31`,
  };
}

function normalizeWeeklyTheme(raw: unknown, index: number): WeeklyTheme {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const weekNumber = Math.max(1, Number(item.week) || index + 1);
  const theme = String(item.theme || item.title || `Week ${weekNumber} Theme`).trim();
  const description = String(item.description || '').trim();
  const activities = toStringArray(item.activities);

  return {
    week: weekNumber,
    theme: theme || `Week ${weekNumber} Theme`,
    description: description || 'Focus area and learning outcomes for this week.',
    activities,
  };
}

function normalizeExcursion(raw: unknown, fallbackDate: string): PlannedExcursion {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const suggestedDate = String(item.suggestedDate || item.date || '').trim();

  return {
    title: String(item.title || 'Educational Excursion').trim() || 'Educational Excursion',
    destination: String(item.destination || 'Local community venue').trim() || 'Local community venue',
    suggestedDate: isValidDate(suggestedDate) ? suggestedDate : fallbackDate,
    learningObjectives: toStringArray(item.learningObjectives || item.objectives),
    estimatedCost: String(item.estimatedCost || 'TBD').trim() || 'TBD',
  };
}

function normalizeMeetingType(value: unknown): MeetingType {
  const normalized = String(value || 'other').trim().toLowerCase();
  const allowed: MeetingType[] = [
    'staff',
    'parent',
    'curriculum',
    'safety',
    'budget',
    'training',
    'one_on_one',
    'other',
  ];
  return allowed.includes(normalized as MeetingType) ? (normalized as MeetingType) : 'other';
}

function normalizeMeeting(raw: unknown, fallbackDate: string): PlannedMeeting {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const suggestedDate = String(item.suggestedDate || item.date || '').trim();

  return {
    title: String(item.title || 'Planning Meeting').trim() || 'Planning Meeting',
    type: normalizeMeetingType(item.type),
    suggestedDate: isValidDate(suggestedDate) ? suggestedDate : fallbackDate,
    agenda: toStringArray(item.agenda),
  };
}

function buildFallbackWeeklyThemes(): WeeklyTheme[] {
  return Array.from({ length: DEFAULT_WEEKLY_THEMES_PER_TERM }, (_, index) => ({
    week: index + 1,
    theme: `Week ${index + 1} Focus`,
    description: 'Theme and activities to be finalized with your team.',
    activities: [],
  }));
}

function normalizeGeneratedPlan(raw: unknown, config: YearPlanConfig): GeneratedYearPlan {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawTerms = Array.isArray(source.terms) ? source.terms : [];

  const orderedTerms = rawTerms
    .map((term, index) => {
      const termObj = (term && typeof term === 'object' ? term : {}) as Record<string, unknown>;
      const termNumber = Number(termObj.termNumber ?? termObj.term_number) || index + 1;
      return { term: termObj, termNumber };
    })
    .sort((a, b) => a.termNumber - b.termNumber)
    .map((entry) => entry.term);

  const terms: GeneratedTerm[] = [];

  for (let i = 0; i < config.numberOfTerms; i += 1) {
    const rawTerm = (orderedTerms[i] || {}) as Record<string, unknown>;
    const fallbackRange = getDefaultTermRange(config.academicYear, i, config.numberOfTerms);

    const startDateCandidate = String(rawTerm.startDate || rawTerm.start_date || '').trim();
    const endDateCandidate = String(rawTerm.endDate || rawTerm.end_date || '').trim();
    const startDate = isValidDate(startDateCandidate) ? startDateCandidate : fallbackRange.startDate;
    const endDate = isValidDate(endDateCandidate) ? endDateCandidate : fallbackRange.endDate;

    const weeklyThemesRaw = Array.isArray(rawTerm.weeklyThemes) ? rawTerm.weeklyThemes : [];
    const weeklyThemes = weeklyThemesRaw.length > 0
      ? weeklyThemesRaw.map((theme, index) => normalizeWeeklyTheme(theme, index))
      : buildFallbackWeeklyThemes();

    const excursionsRaw = Array.isArray(rawTerm.excursions) ? rawTerm.excursions : [];
    const meetingsRaw = Array.isArray(rawTerm.meetings) ? rawTerm.meetings : [];

    const fallbackMidDate = addDays(startDate, 14);

    terms.push({
      termNumber: i + 1,
      name: String(rawTerm.name || `Term ${i + 1}`).trim() || `Term ${i + 1}`,
      startDate,
      endDate,
      weeklyThemes,
      excursions: config.includeExcursions
        ? excursionsRaw.map((excursion) => normalizeExcursion(excursion, fallbackMidDate))
        : [],
      meetings: config.includeMeetings
        ? meetingsRaw.map((meeting) => normalizeMeeting(meeting, fallbackMidDate))
        : [],
      specialEvents: toStringArray(rawTerm.specialEvents),
    });
  }

  return {
    academicYear: Number(source.academicYear) || config.academicYear,
    schoolVision:
      String(source.schoolVision || '').trim() ||
      'To nurture confident, curious, and kind learners through purposeful play.',
    terms,
    annualGoals: toStringArray(source.annualGoals),
    budgetEstimate: String(source.budgetEstimate || 'TBD').trim() || 'TBD',
  };
}

/**
 * Find the index of the closing brace matching the first `{` in `str` starting at `start`,
 * ignoring braces inside double-quoted strings.
 */
function findMatchingBrace(str: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  let quote = '"';
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (!inString) {
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return i;
      } else if (c === '"' || c === "'") {
        inString = true;
        quote = c;
      }
      continue;
    }
    if (c === quote) inString = false;
  }
  return -1;
}

function extractJsonObject(content: string): Record<string, unknown> | null {
  const text = String(content || '').trim();
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] ?? text).trim();

  const start = candidate.indexOf('{');
  if (start < 0) {
    __DEV__ && console.warn('[AI Year Planner] No JSON object found in response; sample:', text.slice(0, 400));
    return null;
  }

  const end = findMatchingBrace(candidate, start);
  const slice = end >= 0 ? candidate.slice(start, end + 1) : candidate.slice(start);

  try {
    return JSON.parse(slice) as Record<string, unknown>;
  } catch (e) {
    if (__DEV__) {
      console.warn('[AI Year Planner] Failed to parse AI response as JSON:', e);
      console.warn('[AI Year Planner] Response sample (first 800 chars):', text.slice(0, 800));
    }
    return null;
  }
}

function mapPlanToRpcPayload(plan: GeneratedYearPlan, config: YearPlanConfig): Record<string, unknown> {
  return {
    academic_year: plan.academicYear,
    school_vision: plan.schoolVision,
    annual_goals: plan.annualGoals,
    budget_estimate: plan.budgetEstimate,
    config: {
      number_of_terms: config.numberOfTerms,
      age_groups: config.ageGroups,
      focus_areas: config.focusAreas,
      include_excursions: config.includeExcursions,
      include_meetings: config.includeMeetings,
      budget_level: config.budgetLevel,
      special_considerations: config.specialConsiderations,
    },
    terms: plan.terms.map((term) => ({
      term_number: term.termNumber,
      name: term.name,
      start_date: term.startDate,
      end_date: term.endDate,
      weekly_themes: term.weeklyThemes.map((week) => ({
        week: week.week,
        theme: week.theme,
        description: week.description,
        key_activities: week.activities,
        developmental_goals: week.activities,
        focus_area: config.focusAreas[0] || 'General Development',
      })),
    })),
  };
}

async function persistTermsAndThemesFallback(params: {
  organizationId: string;
  userId: string;
  plan: GeneratedYearPlan;
  config: YearPlanConfig;
}): Promise<{ termsSaved: number; themesSaved: number }> {
  const { organizationId, userId, plan, config } = params;
  const supabase = assertSupabase();
  let termsSaved = 0;
  let themesSaved = 0;

  for (const term of plan.terms) {
    const termPayload = {
      preschool_id: organizationId,
      created_by: userId,
      name: term.name,
      academic_year: plan.academicYear,
      term_number: term.termNumber,
      start_date: term.startDate,
      end_date: term.endDate,
      notes: `${GENERATED_MARKER}:${plan.academicYear}:term-${term.termNumber}`,
      is_published: false,
      is_active: false,
    };

    const { data: savedTerm, error: termError } = await supabase
      .from('academic_terms')
      .upsert(termPayload, { onConflict: 'preschool_id,academic_year,term_number' })
      .select('id')
      .single();

    if (termError || !savedTerm?.id) {
      throw new Error(termError?.message || `Failed to save Term ${term.termNumber}`);
    }

    termsSaved += 1;

    // Remove previously generated weekly themes for this term/user to avoid duplicates.
    await supabase
      .from('curriculum_themes')
      .delete()
      .eq('preschool_id', organizationId)
      .eq('created_by', userId)
      .eq('term_id', savedTerm.id)
      .ilike('description', `%${GENERATED_MARKER}%`);

    const themeRows = term.weeklyThemes.map((week) => {
      const startDate = addDays(term.startDate, (week.week - 1) * 7);
      const endDate = addDays(startDate, 6);
      return {
        preschool_id: organizationId,
        created_by: userId,
        term_id: savedTerm.id,
        title: week.theme,
        description: `${GENERATED_MARKER} ${week.description}`,
        week_number: week.week,
        start_date: startDate,
        end_date: endDate,
        learning_objectives: week.activities,
        key_concepts: [],
        vocabulary_words: [],
        suggested_activities: week.activities,
        materials_needed: [],
        developmental_domains: config.focusAreas,
        age_groups: config.ageGroups,
        is_published: false,
        is_template: false,
      };
    });

    if (themeRows.length > 0) {
      const { error: themeError } = await supabase.from('curriculum_themes').insert(themeRows);
      if (themeError) {
        throw new Error(themeError.message || `Failed to save themes for Term ${term.termNumber}`);
      }
      themesSaved += themeRows.length;
    }
  }

  return { termsSaved, themesSaved };
}

async function loadTermIdMap(params: {
  organizationId: string;
  academicYear: number;
  termNumbers: number[];
}): Promise<Map<number, string>> {
  const supabase = assertSupabase();
  const { organizationId, academicYear, termNumbers } = params;

  if (termNumbers.length === 0) return new Map<number, string>();

  const { data, error } = await supabase
    .from('academic_terms')
    .select('id, term_number')
    .eq('preschool_id', organizationId)
    .eq('academic_year', academicYear)
    .in('term_number', termNumbers);

  if (error) {
    throw new Error(error.message || 'Failed to resolve saved terms');
  }

  const map = new Map<number, string>();
  for (const row of data || []) {
    const termNumber = Number((row as any).term_number);
    const id = String((row as any).id || '');
    if (termNumber > 0 && id) {
      map.set(termNumber, id);
    }
  }

  return map;
}

function distributeSpecialEventDate(term: GeneratedTerm, eventIndex: number, totalEvents: number): string {
  const start = new Date(`${term.startDate}T00:00:00.000Z`);
  const end = new Date(`${term.endDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return term.startDate;
  }

  const spanDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  const offset = Math.floor(((eventIndex + 1) / (totalEvents + 1)) * spanDays);
  return addDays(term.startDate, offset);
}

async function persistExcursionsMeetingsAndEvents(params: {
  organizationId: string;
  userId: string;
  plan: GeneratedYearPlan;
  config: YearPlanConfig;
  termIdMap: Map<number, string>;
}): Promise<{ excursionsSaved: number; meetingsSaved: number; specialEventsSaved: number }> {
  const { organizationId, userId, plan, config, termIdMap } = params;
  const supabase = assertSupabase();

  let excursionsSaved = 0;
  let meetingsSaved = 0;
  let specialEventsSaved = 0;

  const termIds = Array.from(termIdMap.values());

  if (config.includeExcursions && termIds.length > 0) {
    await supabase
      .from('school_excursions')
      .delete()
      .eq('preschool_id', organizationId)
      .eq('created_by', userId)
      .in('term_id', termIds)
      .ilike('notes', `%${GENERATED_MARKER}%`);
  }

  // Clear previously generated AI meetings/events for this year.
  await supabase
    .from('school_meetings')
    .delete()
    .eq('preschool_id', organizationId)
    .eq('created_by', userId)
    .ilike('description', `%${GENERATED_MARKER}:${plan.academicYear}%`);

  for (const term of plan.terms) {
    const termId = termIdMap.get(term.termNumber) || null;

    if (config.includeExcursions && termId && term.excursions.length > 0) {
      const excursionRows = term.excursions.map((excursion) => {
        const estimatedCost = parseCurrency(excursion.estimatedCost);

        return {
          preschool_id: organizationId,
          created_by: userId,
          term_id: termId,
          title: excursion.title,
          description: `${GENERATED_MARKER}:${plan.academicYear}:term-${term.termNumber}`,
          destination: excursion.destination,
          excursion_date: excursion.suggestedDate,
          learning_objectives: excursion.learningObjectives,
          status: 'draft',
          estimated_cost_per_child: estimatedCost ?? 0,
          notes: `${GENERATED_MARKER}:${plan.academicYear}:term-${term.termNumber}`,
        };
      });

      const { error: excursionError } = await supabase.from('school_excursions').insert(excursionRows);
      if (excursionError) {
        throw new Error(excursionError.message || `Failed to save excursions for Term ${term.termNumber}`);
      }
      excursionsSaved += excursionRows.length;
    }

    if (config.includeMeetings && term.meetings.length > 0) {
      const meetingRows = term.meetings.map((meeting) => ({
        preschool_id: organizationId,
        created_by: userId,
        title: meeting.title,
        description: `${GENERATED_MARKER}:${plan.academicYear}:term-${term.termNumber}`,
        meeting_type: normalizeMeetingType(meeting.type),
        meeting_date: meeting.suggestedDate,
        start_time: DEFAULT_MEETING_START_TIME,
        end_time: DEFAULT_MEETING_END_TIME,
        agenda_items: meeting.agenda.map((item, index) => ({
          title: item,
          order: index + 1,
          duration_minutes: 15,
        })),
        invited_roles: ['teacher', 'parent'],
        status: 'draft',
      }));

      const { error: meetingError } = await supabase.from('school_meetings').insert(meetingRows);
      if (meetingError) {
        throw new Error(meetingError.message || `Failed to save meetings for Term ${term.termNumber}`);
      }
      meetingsSaved += meetingRows.length;
    }

    if (term.specialEvents.length > 0) {
      const eventRows = term.specialEvents.map((eventName, eventIndex) => ({
        preschool_id: organizationId,
        created_by: userId,
        title: `Special Event: ${eventName}`,
        description: `${GENERATED_MARKER}:${plan.academicYear}:term-${term.termNumber}:special-event`,
        meeting_type: 'other' as MeetingType,
        meeting_date: distributeSpecialEventDate(term, eventIndex, term.specialEvents.length),
        start_time: '10:00',
        end_time: '12:00',
        agenda_items: [{ title: eventName, order: 1, duration_minutes: 90 }],
        invited_roles: ['teacher', 'parent'],
        status: 'draft',
      }));

      const { error: eventError } = await supabase.from('school_meetings').insert(eventRows);
      if (eventError) {
        throw new Error(eventError.message || `Failed to save special events for Term ${term.termNumber}`);
      }
      specialEventsSaved += eventRows.length;
    }
  }

  return { excursionsSaved, meetingsSaved, specialEventsSaved };
}

export function useAIYearPlanner({
  organizationId,
  userId,
  onShowAlert,
}: UseAIYearPlannerOptions): UseAIYearPlannerReturn {
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedYearPlan | null>(null);
  const [generationConfig, setGenerationConfig] = useState<YearPlanConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedTerm, setExpandedTerm] = useState<number | null>(null);

  const showPlannerAlert = useCallback((config: {
    title: string;
    message?: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>;
  }) => {
    if (onShowAlert) {
      onShowAlert(config);
      return;
    }
    Alert.alert(config.title, config.message || '', config.buttons as any);
  }, [onShowAlert]);

  const generateYearPlan = useCallback(async (config: YearPlanConfig) => {
    if (config.ageGroups.length === 0) {
      showPlannerAlert({ title: 'Validation Error', message: 'Please select at least one age group', type: 'warning' });
      return;
    }

    if (config.focusAreas.length === 0) {
      showPlannerAlert({ title: 'Validation Error', message: 'Please select at least one focus area', type: 'warning' });
      return;
    }

    setIsGenerating(true);

    try {
      const supabase = assertSupabase();
      const prompt = [
        buildYearPlanUserPrompt(config),
        '',
        `CRITICAL OUTPUT RULES:`,
        `- Return ONLY a single JSON object. No markdown code fences, no explanation before or after.`,
        `- Return exactly ${config.numberOfTerms} terms in the \"terms\" array.`,
        `- Term numbers must be 1..${config.numberOfTerms} with no gaps.`,
        `- Use only valid YYYY-MM-DD dates.`,
      ].join('\n');

      const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: {
          scope: 'principal',
          // Use lesson_generation token budget (larger than chat_message) to reduce JSON truncation.
          service_type: 'lesson_generation',
          payload: {
            prompt,
            context: YEAR_PLAN_SYSTEM_PROMPT,
          },
          stream: false,
          enable_tools: false,
          metadata: {
            source: 'principal_ai_year_planner',
            planner_version: 'native_v2',
            strict_json: true,
            response_format: 'json',
            requested_terms: config.numberOfTerms,
            organization_id: organizationId || null,
          },
        },
      });

      if (error) {
        if (__DEV__) {
          console.warn('[AI Year Planner] ai-proxy invoke error:', {
            message: error.message || null,
            name: (error as any)?.name || null,
            context: (error as any)?.context || null,
          });
        }
        throw new Error(error.message || 'Failed to generate plan');
      }

      const content =
        typeof data?.content === 'string'
          ? data.content
          : typeof data?.response === 'string'
            ? data.response
            : JSON.stringify(data || {});

      const parsed = extractJsonObject(content);
      if (!parsed) {
        if (__DEV__) {
          console.warn('[AI Year Planner] Raw response length:', content.length, 'chars');
        }
        throw new Error('Could not parse AI response. The plan may be in an unexpected format—please try again.');
      }

      const normalized = normalizeGeneratedPlan(parsed, config);
      setGeneratedPlan(normalized);
      setGenerationConfig(config);
      setExpandedTerm(normalized.terms[0]?.termNumber ?? null);

      const aiTerms = Array.isArray((parsed as any).terms) ? (parsed as any).terms.length : 0;
      if (aiTerms !== config.numberOfTerms) {
        showPlannerAlert({
          title: 'Plan normalized',
          message: `Dash returned ${aiTerms || 0} term(s). The planner normalized this to ${config.numberOfTerms} term(s) so all quarters are fully wired.`,
          type: 'info',
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
      console.error('AI generation error:', error);
      if (__DEV__) {
        console.warn('[AI Year Planner] Falling back to demo plan due to generation error:', errorMessage);
      }
      const mockPlan = normalizeGeneratedPlan(generateMockYearPlan(config), config);
      setGeneratedPlan(mockPlan);
      setGenerationConfig(config);
      setExpandedTerm(mockPlan.terms[0]?.termNumber ?? null);
      showPlannerAlert({
        title: 'Using Demo Plan',
        message: 'AI service unavailable. Showing a sample plan instead.',
        type: 'warning',
        buttons: [{ text: 'OK' }],
      });
    } finally {
      setIsGenerating(false);
    }
  }, [organizationId, showPlannerAlert]);

  const savePlanToDatabase = useCallback(async () => {
    if (!generatedPlan || !organizationId || !userId) {
      showPlannerAlert({ title: 'Missing details', message: 'Please generate a plan and ensure your profile is loaded.', type: 'warning' });
      return;
    }

    const config = generationConfig || {
      academicYear: generatedPlan.academicYear,
      numberOfTerms: generatedPlan.terms.length || 4,
      ageGroups: ['3-4', '4-5', '5-6'],
      focusAreas: ['Language Development', 'Numeracy & Math', 'Physical Development'],
      includeExcursions: true,
      includeMeetings: true,
      budgetLevel: 'medium' as const,
      specialConsiderations: '',
    };

    const normalizedPlan = normalizeGeneratedPlan(generatedPlan, config);
    setGeneratedPlan(normalizedPlan);

    setIsSaving(true);

    try {
      const supabase = assertSupabase();

      let termsSaved = 0;
      let themesSaved = 0;
      let usedRpc = false;

      try {
        const { data, error } = await supabase.rpc('save_ai_year_plan', {
          p_preschool_id: organizationId,
          p_created_by: userId,
          p_plan: mapPlanToRpcPayload(normalizedPlan, config),
        });

        if (error) {
          throw error;
        }

        usedRpc = true;
        termsSaved = Number((data as any)?.terms_saved) || normalizedPlan.terms.length;
        themesSaved = Number((data as any)?.themes_saved) || 0;
      } catch (rpcError) {
        console.warn('save_ai_year_plan RPC unavailable, using fallback persistence:', rpcError);
        const fallbackSaved = await persistTermsAndThemesFallback({
          organizationId,
          userId,
          plan: normalizedPlan,
          config,
        });
        termsSaved = fallbackSaved.termsSaved;
        themesSaved = fallbackSaved.themesSaved;
      }

      const termIdMap = await loadTermIdMap({
        organizationId,
        academicYear: normalizedPlan.academicYear,
        termNumbers: normalizedPlan.terms.map((term) => term.termNumber),
      });

      const extraSaved = await persistExcursionsMeetingsAndEvents({
        organizationId,
        userId,
        plan: normalizedPlan,
        config,
        termIdMap,
      });

      showPlannerAlert({
        title: 'Success',
        message: [
          `Year plan saved successfully (${usedRpc ? 'transactional' : 'fallback'} mode).`,
          `Terms: ${termsSaved}`,
          `Weekly themes: ${themesSaved}`,
          `Excursions: ${extraSaved.excursionsSaved}`,
          `Meetings: ${extraSaved.meetingsSaved}`,
          `Special events: ${extraSaved.specialEventsSaved}`,
        ].join('\n'),
        type: 'success',
        buttons: [
          { text: 'View Terms', onPress: () => router.push('/screens/principal-year-planner') },
          { text: 'OK' },
        ],
      });
    } catch (error: unknown) {
      console.error('Error saving plan:', error);
      showPlannerAlert({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save plan. Please try again.',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [generatedPlan, generationConfig, organizationId, userId, showPlannerAlert]);

  return {
    generatedPlan,
    isGenerating,
    isSaving,
    expandedTerm,
    setExpandedTerm,
    generateYearPlan,
    savePlanToDatabase,
  };
}
