// Year Plan Normalizers — pure transformation & validation functions
// Extracted from useAIYearPlannerImpl.ts for modularity

import type {
  YearPlanConfig,
  GeneratedYearPlan,
  GeneratedTerm,
  WeeklyTheme,
  PlannedExcursion,
  PlannedMeeting,
  YearPlanMonthlyEntry,
  YearPlanMonthlyBucket,
  YearPlanOperationalHighlight,
} from '@/components/principal/ai-planner/types';

export type MeetingType =
  | 'staff'
  | 'parent'
  | 'curriculum'
  | 'safety'
  | 'budget'
  | 'training'
  | 'one_on_one'
  | 'other';

export const MONTH_NAMES = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export const MONTHLY_BUCKETS: YearPlanMonthlyBucket[] = [
  'holidays_closures',
  'meetings_admin',
  'excursions_extras',
  'donations_fundraisers',
];

const TARGET_WEEKS_PER_YEAR = 52;

/**
 * Target number of weekly themes per term to reach ~52 weeks for the year.
 */
export function getWeeklyThemesPerTerm(numberOfTerms: number): number {
  if (numberOfTerms < 1) return 13;
  return Math.ceil(TARGET_WEEKS_PER_YEAR / numberOfTerms);
}

// ── Primitive helpers ──────────────────────────────────────────────────────

export function toStringArray(value: unknown): string[] {
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

export function parseCurrency(value: string): number | null {
  const cleaned = String(value || '').replace(/[^0-9.]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

export function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDays(dateString: string, days: number): string {
  const parsed = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return dateString;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toDateOnly(parsed);
}

// ── Term range defaults ────────────────────────────────────────────────────

function getDefaultTermRange(
  academicYear: number,
  termIndex: number,
  numberOfTerms: number,
): { startDate: string; endDate: string } {
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

// ── Weekly theme normalizer ────────────────────────────────────────────────

export function normalizeWeeklyTheme(raw: unknown, index: number): WeeklyTheme {
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

// ── Excursion normalizer ───────────────────────────────────────────────────

export function normalizeExcursion(raw: unknown, fallbackDate: string): PlannedExcursion {
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

// ── Meeting normalizers ────────────────────────────────────────────────────

export function normalizeMeetingType(value: unknown): MeetingType {
  const normalized = String(value || 'other').trim().toLowerCase();
  const allowed: MeetingType[] = [
    'staff', 'parent', 'curriculum', 'safety',
    'budget', 'training', 'one_on_one', 'other',
  ];
  return allowed.includes(normalized as MeetingType)
    ? (normalized as MeetingType)
    : 'other';
}

export function normalizeMeeting(raw: unknown, fallbackDate: string): PlannedMeeting {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const suggestedDate = String(item.suggestedDate || item.date || '').trim();

  return {
    title: String(item.title || 'Planning Meeting').trim() || 'Planning Meeting',
    type: normalizeMeetingType(item.type),
    suggestedDate: isValidDate(suggestedDate) ? suggestedDate : fallbackDate,
    agenda: toStringArray(item.agenda),
  };
}

// ── Month helpers ──────────────────────────────────────────────────────────

export function parseMonthIndex(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = Math.trunc(value);
    if (parsed >= 1 && parsed <= 12) return parsed;
  }

  const text = String(value || '').trim();
  if (!text) return fallback;

  const asNum = Number(text);
  if (Number.isFinite(asNum)) {
    const parsed = Math.trunc(asNum);
    if (parsed >= 1 && parsed <= 12) return parsed;
  }

  const upper = text.toUpperCase().slice(0, 3);
  const monthIndex = MONTH_NAMES.indexOf(upper);
  if (monthIndex >= 0) return monthIndex + 1;

  return fallback;
}

export function inferMonthlySubtype(bucket: YearPlanMonthlyBucket, title: string): string {
  const haystack = title.toLowerCase();
  if (bucket === 'holidays_closures') {
    if (haystack.includes('holiday')) return 'holiday';
    if (haystack.includes('close') || haystack.includes('break')) return 'closure';
    return 'other';
  }
  if (bucket === 'meetings_admin') {
    if (haystack.includes('staff')) return 'staff_meeting';
    if (haystack.includes('parent')) return 'parent_meeting';
    if (haystack.includes('train')) return 'training';
    return 'other';
  }
  if (bucket === 'excursions_extras') {
    if (haystack.includes('excursion') || haystack.includes('visit') || haystack.includes('trip'))
      return 'excursion';
    if (haystack.includes('extra') || haystack.includes('sports') || haystack.includes('ballet'))
      return 'extra_mural';
    return 'other';
  }
  if (haystack.includes('donation') || haystack.includes('drive')) return 'donation_drive';
  if (
    haystack.includes('fundraiser') ||
    haystack.includes('raffle') ||
    haystack.includes('sale') ||
    haystack.includes('market')
  ) {
    return 'fundraiser';
  }
  return 'other';
}

export function normalizeMonthlyBucket(value: unknown): YearPlanMonthlyBucket {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'holidays_closures';
  if (MONTHLY_BUCKETS.includes(raw as YearPlanMonthlyBucket)) {
    return raw as YearPlanMonthlyBucket;
  }
  if (raw.includes('holiday') || raw.includes('closure')) return 'holidays_closures';
  if (raw.includes('meeting') || raw.includes('admin') || raw.includes('staff'))
    return 'meetings_admin';
  if (raw.includes('excursion') || raw.includes('extra')) return 'excursions_extras';
  if (raw.includes('donation') || raw.includes('fundraiser')) return 'donations_fundraisers';
  return 'holidays_closures';
}

// ── Monthly entry normalizer ───────────────────────────────────────────────

function normalizeMonthlyEntry(raw: unknown, index: number): YearPlanMonthlyEntry {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const fallbackMonth = (index % 12) + 1;
  const monthIndex = parseMonthIndex(
    item.monthIndex ?? item.month_index ?? item.month ?? item.monthName ?? item.month_name,
    fallbackMonth,
  );
  const bucket = normalizeMonthlyBucket(item.bucket ?? item.category ?? item.column ?? item.type);
  const title =
    String(item.title || item.name || '').trim() || `${MONTH_NAMES[monthIndex - 1]} item`;
  const subtypeRaw = item.subtype ?? item.eventType ?? item.event_type ?? item.kind;
  const subtype = String(subtypeRaw || '').trim() || inferMonthlySubtype(bucket, title);

  const startDate = String(item.startDate || item.start_date || '').trim();
  const endDate = String(item.endDate || item.end_date || '').trim();

  return {
    monthIndex,
    bucket,
    subtype,
    title,
    details: String(item.details || item.description || '').trim() || null,
    startDate: isValidDate(startDate) ? startDate : null,
    endDate: isValidDate(endDate) ? endDate : null,
    source: 'ai',
    isPublished: false,
    publishedToCalendar: false,
  };
}

// ── Aggregate monthly entries ──────────────────────────────────────────────

export function normalizeMonthlyEntries(
  source: Record<string, unknown>,
  terms: GeneratedTerm[],
): YearPlanMonthlyEntry[] {
  const monthlyFromPayload = Array.isArray(source.monthlyEntries)
    ? source.monthlyEntries
    : Array.isArray(source.monthly_entries)
      ? source.monthly_entries
      : [];

  const normalized = monthlyFromPayload
    .map((entry: unknown, index: number) => normalizeMonthlyEntry(entry, index))
    .filter((entry: YearPlanMonthlyEntry) => entry.title.trim().length > 0);

  if (normalized.length > 0) {
    return normalized.sort(
      (a: YearPlanMonthlyEntry, b: YearPlanMonthlyEntry) =>
        a.monthIndex - b.monthIndex || a.bucket.localeCompare(b.bucket),
    );
  }

  const derived: YearPlanMonthlyEntry[] = [];

  terms.forEach((term) => {
    const termMonth = parseMonthIndex(term.startDate.slice(5, 7), 1);
    derived.push({
      monthIndex: termMonth,
      bucket: 'holidays_closures',
      subtype: 'closure',
      title: `${term.name} starts`,
      details: `${term.startDate} to ${term.endDate}`,
      startDate: term.startDate,
      endDate: term.endDate,
      source: 'ai',
      isPublished: false,
      publishedToCalendar: false,
    });

    term.meetings.forEach((meeting) => {
      const monthIdx = parseMonthIndex(meeting.suggestedDate.slice(5, 7), termMonth);
      derived.push({
        monthIndex: monthIdx,
        bucket: 'meetings_admin',
        subtype: normalizeMeetingType(meeting.type),
        title: meeting.title,
        details: meeting.agenda.join('; ') || null,
        startDate: meeting.suggestedDate,
        endDate: meeting.suggestedDate,
        source: 'ai',
        isPublished: false,
        publishedToCalendar: false,
      });
    });

    term.excursions.forEach((excursion) => {
      const monthIdx = parseMonthIndex(excursion.suggestedDate.slice(5, 7), termMonth);
      derived.push({
        monthIndex: monthIdx,
        bucket: 'excursions_extras',
        subtype: 'excursion',
        title: excursion.title,
        details: excursion.destination || null,
        startDate: excursion.suggestedDate,
        endDate: excursion.suggestedDate,
        source: 'ai',
        isPublished: false,
        publishedToCalendar: false,
      });
    });
  });

  return derived
    .filter((entry) => entry.title.trim().length > 0)
    .sort((a, b) => a.monthIndex - b.monthIndex || a.bucket.localeCompare(b.bucket));
}

// ── Operational highlights ─────────────────────────────────────────────────

export function normalizeOperationalHighlights(
  source: Record<string, unknown>,
  monthlyEntries: YearPlanMonthlyEntry[],
): YearPlanOperationalHighlight[] {
  const candidate = Array.isArray(source.operationalHighlights)
    ? source.operationalHighlights
    : Array.isArray(source.operational_highlights)
      ? source.operational_highlights
      : [];

  const explicit = candidate
    .map((item: unknown) => {
      if (typeof item === 'string') {
        const text = item.trim();
        if (!text) return null;
        return { title: 'Highlight', description: text };
      }
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const title = String(record.title || 'Highlight').trim();
      const description = String(record.description || record.details || '').trim();
      if (!description) return null;
      return { title, description };
    })
    .filter((item: unknown): item is YearPlanOperationalHighlight => Boolean(item));

  if (explicit.length > 0) return explicit;

  const byBucket: Record<YearPlanMonthlyBucket, number> = {
    holidays_closures: 0,
    meetings_admin: 0,
    excursions_extras: 0,
    donations_fundraisers: 0,
  };
  monthlyEntries.forEach((entry) => {
    byBucket[entry.bucket] += 1;
  });

  return [
    {
      title: 'Term Calendar Coverage',
      description: `${byBucket.holidays_closures} holiday/closure milestones captured across the year.`,
    },
    {
      title: 'Meetings & Governance',
      description: `${byBucket.meetings_admin} operational meetings/admin checkpoints are planned.`,
    },
    {
      title: 'Experiential Learning',
      description: `${byBucket.excursions_extras} excursions/extras are spread through the calendar.`,
    },
    {
      title: 'Community Support',
      description: `${byBucket.donations_fundraisers} donation/fundraising moments are included.`,
    },
  ];
}

// ── Fallback weekly themes ─────────────────────────────────────────────────

function buildFallbackWeeklyThemes(themesPerTerm: number): WeeklyTheme[] {
  const count = Math.min(52, Math.max(1, themesPerTerm));
  return Array.from({ length: count }, (_, index) => ({
    week: index + 1,
    theme: `Week ${index + 1} Focus`,
    description: 'Theme and activities to be finalized with your team.',
    activities: [],
  }));
}

// ── Master plan normalizer ─────────────────────────────────────────────────

export function normalizeGeneratedPlan(
  raw: unknown,
  config: YearPlanConfig,
): GeneratedYearPlan {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawTerms = Array.isArray(source.terms) ? source.terms : [];

  const orderedTerms = rawTerms
    .map((term: unknown, index: number) => {
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

    const themesPerTerm = getWeeklyThemesPerTerm(config.numberOfTerms);
    const weeklyThemesRaw = Array.isArray(rawTerm.weeklyThemes) ? rawTerm.weeklyThemes : [];
    const weeklyThemes =
      weeklyThemesRaw.length > 0
        ? weeklyThemesRaw
            .map((theme: unknown, index: number) => normalizeWeeklyTheme(theme, index))
            .slice(0, themesPerTerm)
        : buildFallbackWeeklyThemes(themesPerTerm);

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
        ? excursionsRaw.map((excursion: unknown) => normalizeExcursion(excursion, fallbackMidDate))
        : [],
      meetings: config.includeMeetings
        ? meetingsRaw.map((meeting: unknown) => normalizeMeeting(meeting, fallbackMidDate))
        : [],
      specialEvents: toStringArray(rawTerm.specialEvents),
    });
  }

  const monthlyEntries = normalizeMonthlyEntries(source, terms);
  const operationalHighlights = normalizeOperationalHighlights(source, monthlyEntries);

  return {
    academicYear: Number(source.academicYear) || config.academicYear,
    schoolVision:
      String(source.schoolVision || '').trim() ||
      'To nurture confident, curious, and kind learners through purposeful play.',
    terms,
    annualGoals: toStringArray(source.annualGoals),
    budgetEstimate: String(source.budgetEstimate || 'TBD').trim() || 'TBD',
    monthlyEntries,
    operationalHighlights,
  };
}
