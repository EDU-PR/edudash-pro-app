/**
 * Types for the Student Management screen and related hooks.
 */

export interface Student {
  id: string;
  student_id?: string | null;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  date_of_birth: string | null;
  age_months: number;
  age_years: number;
  preschool_id: string;
  class_id: string | null;
  parent_id: string | null;
  guardian_id: string | null;
  is_active: boolean;
  status: string;
  age_group_name?: string;
  class_name?: string;
  parent_name?: string;
}

export interface SchoolInfo {
  id: string;
  name: string;
  school_type: 'preschool' | 'primary' | 'secondary' | 'combined';
  grade_levels: string[];
}

export interface AgeGroup {
  id: string;
  name: string;
  min_age_months: number;
  max_age_months: number;
  age_min: number;
  age_max: number;
  school_type: string;
  description: string;
}

export interface FilterOptions {
  searchTerm: string;
  ageGroup: string;
  status: string;
  classId: string;
}

/** Callback signature compatible with useAlertModal's showAlert */
export type ShowAlert = (
  title: string,
  message: string,
  type?: 'success' | 'error' | 'warning' | 'info',
  buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
) => void;
