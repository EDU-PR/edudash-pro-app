// Year Plan Persistence — Supabase database operations
// Extracted from useAIYearPlannerImpl.ts for modularity

import { assertSupabase } from '@/lib/supabase';
import type {
  YearPlanConfig,
  GeneratedYearPlan,
  GeneratedTerm,
} from '@/components/principal/ai-planner/types';
import {
  addDays,
  parseCurrency,
  normalizeMeetingType,
  inferMonthlySubtype,
  type MeetingType,
} from './normalizers';

export const GENERATED_MARKER = '[AI_YEAR_PLANNER]';
const DEFAULT_MEETING_START_TIME = '09:00';
const DEFAULT_MEETING_END_TIME = '10:00';

// ── RPC payload mapper ─────────────────────────────────────────────────────

export function mapPlanToRpcPayload(
  plan: GeneratedYearPlan,
  config: YearPlanConfig,
): Record<string, unknown> {
  return {
    academic_year: plan.academicYear,
    school_vision: plan.schoolVision,
    annual_goals: plan.annualGoals,
    budget_estimate: plan.budgetEstimate,
    operational_highlights: plan.operationalHighlights || [],
    config: {
      number_of_terms: config.numberOfTerms,
      age_groups: config.ageGroups,
      focus_areas: config.focusAreas,
      planning_framework: config.planningFramework,
      strict_template_mode: config.strictTemplateMode,
      separate_age_group_tracks: config.separateAgeGroupTracks,
      include_excursions: config.includeExcursions,
      include_meetings: config.includeMeetings,
      include_assessment_guidance: config.includeAssessmentGuidance,
      include_inclusion_adaptations: config.includeInclusionAdaptations,
      include_home_link_extensions: config.includeHomeLinkExtensions,
      budget_level: config.budgetLevel,
      principal_rules: config.principalRules,
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
    monthly_entries: (plan.monthlyEntries || []).map((entry) => ({
      month_index: entry.monthIndex,
      bucket: entry.bucket,
      subtype: entry.subtype || inferMonthlySubtype(entry.bucket, entry.title || ''),
      title: entry.title,
      details: entry.details || null,
      start_date: entry.startDate || null,
      end_date: entry.endDate || null,
      source: entry.source || 'ai',
      is_published: Boolean(entry.isPublished),
      published_to_calendar: Boolean(entry.publishedToCalendar),
    })),
  };
}

// ── Fallback: save terms & themes row-by-row ───────────────────────────────

export async function persistTermsAndThemesFallback(params: {
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

// ── Load term IDs for a given academic year ────────────────────────────────

export async function loadTermIdMap(params: {
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

// ── Distribute special-event dates evenly across a term ────────────────────

export function distributeSpecialEventDate(
  term: GeneratedTerm,
  eventIndex: number,
  totalEvents: number,
): string {
  const start = new Date(`${term.startDate}T00:00:00.000Z`);
  const end = new Date(`${term.endDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return term.startDate;
  }

  const spanDays = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
  );
  const offset = Math.floor(((eventIndex + 1) / (totalEvents + 1)) * spanDays);
  return addDays(term.startDate, offset);
}

// ── Persist excursions, meetings, and special events ───────────────────────

export async function persistExcursionsMeetingsAndEvents(params: {
  organizationId: string;
  userId: string;
  plan: GeneratedYearPlan;
  config: YearPlanConfig;
  termIdMap: Map<number, string>;
}): Promise<{
  excursionsSaved: number;
  meetingsSaved: number;
  specialEventsSaved: number;
}> {
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

      const { error: excursionError } = await supabase
        .from('school_excursions')
        .insert(excursionRows);
      if (excursionError) {
        throw new Error(
          excursionError.message || `Failed to save excursions for Term ${term.termNumber}`,
        );
      }
      excursionsSaved += excursionRows.length;
    }

    if (config.includeMeetings && term.meetings.length > 0) {
      const meetingRows = term.meetings.map((meeting) => ({
        preschool_id: organizationId,
        created_by: userId,
        title: meeting.title,
        description: `${GENERATED_MARKER}:${plan.academicYear}:term-${term.termNumber}`,
        meeting_type: normalizeMeetingType(meeting.type) as MeetingType,
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

      const { error: meetingError } = await supabase
        .from('school_meetings')
        .insert(meetingRows);
      if (meetingError) {
        throw new Error(
          meetingError.message || `Failed to save meetings for Term ${term.termNumber}`,
        );
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
        throw new Error(
          eventError.message || `Failed to save special events for Term ${term.termNumber}`,
        );
      }
      specialEventsSaved += eventRows.length;
    }
  }

  return { excursionsSaved, meetingsSaved, specialEventsSaved };
}
