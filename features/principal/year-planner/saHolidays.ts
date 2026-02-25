// South African Public Holidays with contextual fundraiser ideas
// Used to auto-populate year plans with gazetted holidays

import type { YearPlanMonthlyEntry } from '@/components/principal/ai-planner/types';
import { getSACalendarForYear } from '@/lib/data/saSchoolCalendar';

export interface SAHolidayWithFundraisers {
  date: string;
  name: string;
  fundraiserIdeas: string[];
}

const FUNDRAISER_IDEAS: Record<string, string[]> = {
  "New Year's Day": [
    'New Year Resolution pledge drive',
    'Back-to-school supply fundraiser',
  ],
  'Human Rights Day': [
    'Human Rights awareness walk sponsorship',
    'Community art auction for equality',
  ],
  'Good Friday': [
    'Easter egg hunt fundraiser',
    'Hot cross bun sale',
  ],
  'Family Day': [
    'Family Fun Day ticket sales',
    'Picnic basket auction',
  ],
  'Freedom Day': [
    'Freedom Run sponsorship',
    'Democracy tree planting event',
  ],
  "Workers' Day": [
    'Worker appreciation donations',
    'Community service day sponsorship',
  ],
  'Youth Day': [
    'Youth Development Fund drive',
    'Book collection for youth libraries',
  ],
  "National Women's Day": [
    'Women Empowerment workshop sponsorship',
    'Sanitary products drive',
  ],
  'Heritage Day': [
    'Heritage Food Festival',
    'Cultural Dress Day donations',
    'Traditional Arts & Crafts market',
  ],
  'Day of Reconciliation': [
    'Unity walk sponsorship',
    'Community potluck donations',
  ],
  'Christmas Day': [
    'Gift wrapping fundraiser',
    'Holiday hamper donations',
    'Santa visit experience',
  ],
  'Day of Goodwill': [
    'Charity drive for local shelters',
    'End-of-year giving campaign',
  ],
};

function matchFundraiserKey(holidayName: string): string[] {
  const lower = holidayName.toLowerCase();
  for (const [key, ideas] of Object.entries(FUNDRAISER_IDEAS)) {
    if (key.toLowerCase() === lower) return ideas;
  }
  for (const [key, ideas] of Object.entries(FUNDRAISER_IDEAS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return ideas;
  }
  return [];
}

/**
 * Returns SA public holidays for the given year, each enriched with
 * contextual fundraiser ideas suitable for a school calendar.
 */
export function getSAPublicHolidays(year: number): SAHolidayWithFundraisers[] {
  const { holidays } = getSACalendarForYear(year);

  return holidays.map((h) => ({
    date: h.date,
    name: h.name,
    fundraiserIdeas: matchFundraiserKey(h.name),
  }));
}

/**
 * Look up fundraiser ideas by holiday name.
 * Returns an empty array if the holiday is not recognized.
 */
export function getHolidayFundraiserIdeas(holidayName: string): string[] {
  return matchFundraiserKey(holidayName);
}

/**
 * Merge SA public holidays into an existing set of monthly entries.
 * - Skips holidays that are already represented (same name or same date
 *   under `holidays_closures`).
 * - Attaches fundraiser ideas to each holiday entry's `details` field.
 */
export function injectSAHolidaysIntoMonthlyEntries(
  entries: YearPlanMonthlyEntry[],
  academicYear: number,
): YearPlanMonthlyEntry[] {
  const holidays = getSAPublicHolidays(academicYear);

  const existingDates = new Set(
    entries
      .filter((e) => e.bucket === 'holidays_closures')
      .map((e) => e.startDate)
      .filter(Boolean),
  );

  const existingNames = new Set(
    entries
      .filter((e) => e.bucket === 'holidays_closures')
      .map((e) => e.title.toLowerCase().trim()),
  );

  const newEntries: YearPlanMonthlyEntry[] = [];

  for (const holiday of holidays) {
    const nameLower = holiday.name.toLowerCase().trim();
    if (existingDates.has(holiday.date) || existingNames.has(nameLower)) {
      continue;
    }

    const monthIndex = Number(holiday.date.slice(5, 7));
    const fundraiserText =
      holiday.fundraiserIdeas.length > 0
        ? `SA Public Holiday. Fundraiser ideas: ${holiday.fundraiserIdeas.join('; ')}`
        : 'SA Public Holiday';

    newEntries.push({
      monthIndex,
      bucket: 'holidays_closures',
      subtype: 'holiday',
      title: holiday.name,
      details: fundraiserText,
      startDate: holiday.date,
      endDate: holiday.date,
      source: 'ai',
      isPublished: false,
      publishedToCalendar: false,
    });
  }

  if (newEntries.length === 0) return entries;

  return [...entries, ...newEntries].sort(
    (a, b) => a.monthIndex - b.monthIndex || a.bucket.localeCompare(b.bucket),
  );
}
