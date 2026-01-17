// Types for Principal AI Year Planner

export interface YearPlanConfig {
  academicYear: number;
  numberOfTerms: number;
  ageGroups: string[];
  focusAreas: string[];
  includeExcursions: boolean;
  includeMeetings: boolean;
  budgetLevel: 'low' | 'medium' | 'high';
  specialConsiderations: string;
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

export const getInitialConfig = (): YearPlanConfig => ({
  academicYear: new Date().getFullYear(),
  numberOfTerms: 4,
  ageGroups: ['3-4', '4-5', '5-6'],
  focusAreas: ['Language Development', 'Numeracy & Math', 'Physical Development'],
  includeExcursions: true,
  includeMeetings: true,
  budgetLevel: 'medium',
  specialConsiderations: '',
});
