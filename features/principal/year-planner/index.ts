// Year Planner sub-module barrel exports

export {
  toStringArray,
  parseCurrency,
  isValidDate,
  toDateOnly,
  addDays,
  normalizeWeeklyTheme,
  normalizeExcursion,
  normalizeMeetingType,
  normalizeMeeting,
  parseMonthIndex,
  inferMonthlySubtype,
  normalizeMonthlyBucket,
  normalizeMonthlyEntries,
  normalizeOperationalHighlights,
  normalizeGeneratedPlan,
  MONTH_NAMES,
  MONTHLY_BUCKETS,
  type MeetingType,
} from './normalizers';

export {
  getSAPublicHolidays,
  getHolidayFundraiserIdeas,
  injectSAHolidaysIntoMonthlyEntries,
  type SAHolidayWithFundraisers,
} from './saHolidays';

export {
  mapPlanToRpcPayload,
  persistTermsAndThemesFallback,
  loadTermIdMap,
  distributeSpecialEventDate,
  persistExcursionsMeetingsAndEvents,
  GENERATED_MARKER,
} from './persistence';

export {
  isAuthRelatedErrorMessage,
  findMatchingBrace,
  tryRepairTruncatedYearPlanJson,
  extractJsonObject,
  generateYearPlanViaAI,
  type GenerateYearPlanResult,
} from './generation';

export {
  exportYearPlanAsPDF,
  shareYearPlanPDF,
} from './pdfExport';
