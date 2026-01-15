// Types for ECD Planning Features

export interface AcademicTerm {
  id: string;
  preschool_id: string;
  created_by: string;
  name: string;
  academic_year: number;
  term_number: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_published: boolean;
  description?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CurriculumTheme {
  id: string;
  preschool_id: string;
  created_by: string;
  title: string;
  description?: string;
  term_id?: string;
  week_number?: number;
  start_date?: string;
  end_date?: string;
  learning_objectives: string[];
  key_concepts: string[];
  vocabulary_words: string[];
  suggested_activities: string[];
  materials_needed: string[];
  developmental_domains: string[];
  age_groups: string[];
  is_published: boolean;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface LessonTemplate {
  id: string;
  preschool_id: string;
  created_by: string;
  name: string;
  description?: string;
  template_structure: {
    sections: Array<{
      name: string;
      required: boolean;
    }>;
  };
  default_duration_minutes: number;
  default_age_group: string;
  default_subject?: string;
  usage_count: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeeklyPlan {
  id: string;
  preschool_id: string;
  class_id?: string;
  created_by: string;
  term_id?: string;
  theme_id?: string;
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  daily_plans: {
    monday: { activities: string[]; learning_objectives: string[] };
    tuesday: { activities: string[]; learning_objectives: string[] };
    wednesday: { activities: string[]; learning_objectives: string[] };
    thursday: { activities: string[]; learning_objectives: string[] };
    friday: { activities: string[]; learning_objectives: string[] };
  };
  weekly_focus?: string;
  weekly_objectives: string[];
  materials_list: string[];
  status: 'draft' | 'submitted' | 'approved' | 'published';
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export const DEVELOPMENTAL_DOMAINS = [
  'cognitive',
  'physical',
  'social',
  'emotional',
  'language',
] as const;

export const AGE_GROUPS = ['1-2', '3-4', '4-5', '5-6', '3-6'] as const;

export type DevelopmentalDomain = typeof DEVELOPMENTAL_DOMAINS[number];
export type AgeGroup = typeof AGE_GROUPS[number];
