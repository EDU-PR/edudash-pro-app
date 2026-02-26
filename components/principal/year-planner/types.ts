// Types for Year Planner

import type { AcademicTerm } from '@/types/ecd-planning';

export type { AcademicTerm };

export interface TermFormData {
  name: string;
  academic_year: number;
  term_number: number;
  start_date: Date;
  end_date: Date;
  description: string;
  is_active: boolean;
  is_published: boolean;
}

export const getDefaultTermFormData = (): TermFormData => ({
  name: '',
  academic_year: new Date().getFullYear(),
  term_number: 1,
  start_date: new Date(),
  end_date: new Date(),
  description: '',
  is_active: false,
  is_published: false,
});

export const termFormDataFromTerm = (term: AcademicTerm): TermFormData => ({
  name: term.name,
  academic_year: term.academic_year,
  term_number: term.term_number,
  start_date: new Date(term.start_date),
  end_date: new Date(term.end_date),
  description: term.description || '',
  is_active: term.is_active,
  is_published: term.is_published,
});

/** Row from year_plan_monthly_entries for native Year Planner monthly view */
export interface YearPlanMonthlyEntryRow {
  id: string;
  preschool_id: string;
  academic_year: number;
  month_index: number;
  bucket: string;
  subtype: string | null;
  title: string;
  details: string | null;
  start_date: string | null;
  end_date: string | null;
  is_published: boolean;
}

export interface YearPlannerState {
  terms: AcademicTerm[];
  monthlyEntries: YearPlanMonthlyEntryRow[];
  loading: boolean;
  refreshing: boolean;
}

export interface YearPlannerActions {
  fetchTerms: () => Promise<void>;
  handleRefresh: () => void;
  handleSubmit: (formData: TermFormData, editingTerm: AcademicTerm | null) => Promise<boolean>;
  handleDelete: (term: AcademicTerm) => void;
  handleTogglePublish: (term: AcademicTerm) => Promise<void>;
}

/**
 * Group terms by academic year
 */
export function groupTermsByYear(terms: AcademicTerm[]): Record<number, AcademicTerm[]> {
  return terms.reduce((acc, term) => {
    const year = term.academic_year;
    if (!acc[year]) acc[year] = [];
    acc[year].push(term);
    return acc;
  }, {} as Record<number, AcademicTerm[]>);
}
