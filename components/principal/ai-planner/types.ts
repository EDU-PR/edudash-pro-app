// Types for Principal AI Year Planner

export interface YearPlanConfig {
  academicYear: number;
  numberOfTerms: number;
  ageGroups: string[];
  focusAreas: string[];
  planningFramework: 'caps_ncf_hybrid' | 'grade_rr_52_week' | 'custom';
  strictTemplateMode: boolean;
  separateAgeGroupTracks: boolean;
  includeExcursions: boolean;
  includeMeetings: boolean;
  includeAssessmentGuidance: boolean;
  includeInclusionAdaptations: boolean;
  includeHomeLinkExtensions: boolean;
  budgetLevel: 'low' | 'medium' | 'high';
  principalRules: string;
  specialConsiderations: string;
}

export type YearPlanMonthlyBucket =
  | 'holidays_closures'
  | 'meetings_admin'
  | 'excursions_extras'
  | 'donations_fundraisers';

export type YearPlanMonthlySubtype =
  | 'holiday'
  | 'closure'
  | 'staff_meeting'
  | 'parent_meeting'
  | 'training'
  | 'excursion'
  | 'extra_mural'
  | 'donation_drive'
  | 'fundraiser'
  | 'other';

export interface YearPlanMonthlyEntry {
  id?: string;
  monthIndex: number; // 1..12
  bucket: YearPlanMonthlyBucket;
  subtype?: YearPlanMonthlySubtype | string | null;
  title: string;
  details?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  source?: 'ai' | 'manual' | 'synced';
  isPublished?: boolean;
  publishedToCalendar?: boolean;
}

export interface YearPlanOperationalHighlight {
  title: string;
  description: string;
}

export interface WeeklyTheme {
  week: number;
  theme: string;
  description: string;
  activities: string[];
}

export interface PlannedExcursion {
  title: string;
  destination: string;
  suggestedDate: string;
  learningObjectives: string[];
  estimatedCost: string;
}

export interface PlannedMeeting {
  title: string;
  type: string;
  suggestedDate: string;
  agenda: string[];
}

export interface GeneratedTerm {
  termNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  weeklyThemes: WeeklyTheme[];
  excursions: PlannedExcursion[];
  meetings: PlannedMeeting[];
  specialEvents: string[];
}

export interface GeneratedYearPlan {
  academicYear: number;
  schoolVision: string;
  terms: GeneratedTerm[];
  annualGoals: string[];
  budgetEstimate: string;
  monthlyEntries: YearPlanMonthlyEntry[];
  operationalHighlights: YearPlanOperationalHighlight[];
}

export const AGE_GROUPS = ['0-1', '1-2', '2-3', '3-4', '4-5', '5-6'];

export const FOCUS_AREAS = [
  'Language Development',
  'Numeracy & Math',
  'Physical Development',
  'Creative Arts',
  'Science & Discovery',
  'Social Skills',
  'Emotional Intelligence',
  'Life Skills',
  'Music & Movement',
  'CAPS Alignment',
];

export const PLANNING_FRAMEWORKS = [
  { id: 'caps_ncf_hybrid', label: 'CAPS + NCF Hybrid' },
  { id: 'grade_rr_52_week', label: 'Grade RR 52-Week Structure' },
  { id: 'custom', label: 'Custom Framework' },
] as const;

export const getInitialConfig = (): YearPlanConfig => ({
  academicYear: new Date().getFullYear(),
  numberOfTerms: 4,
  ageGroups: ['3-4', '4-5', '5-6'],
  focusAreas: ['Language Development', 'Numeracy & Math', 'Physical Development'],
  planningFramework: 'caps_ncf_hybrid',
  strictTemplateMode: false,
  separateAgeGroupTracks: true,
  includeExcursions: true,
  includeMeetings: true,
  includeAssessmentGuidance: true,
  includeInclusionAdaptations: true,
  includeHomeLinkExtensions: true,
  budgetLevel: 'medium',
  principalRules: '',
  specialConsiderations: '',
});
