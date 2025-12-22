/**
 * Utility functions for Class & Teacher Management
 * Extracted from app/screens/class-teacher-management.tsx
 */

import type { ClassInfo, Teacher } from './types';

/**
 * Get the status color for a class based on enrollment
 */
export function getClassStatusColor(
  classInfo: ClassInfo,
  theme: {
    textSecondary: string;
    error: string;
    warning: string;
    success: string;
  }
): string {
  if (!classInfo.is_active) return theme.textSecondary;
  if (classInfo.current_enrollment >= classInfo.capacity) return theme.error;
  if (classInfo.current_enrollment >= classInfo.capacity * 0.8) return theme.warning;
  return theme.success;
}

/**
 * Get the workload color for a teacher based on student count
 */
export function getTeacherWorkloadColor(
  teacher: Teacher,
  theme: {
    error: string;
    warning: string;
    success: string;
  }
): string {
  if (teacher.students_count > 30) return theme.error;
  if (teacher.students_count > 20) return theme.warning;
  return theme.success;
}

/**
 * Grade level options for class creation
 */
export const GRADE_LEVEL_OPTIONS = [
  { label: 'Select grade level...', value: '' },
  { label: 'Toddlers (18m - 2y)', value: 'Toddlers' },
  { label: 'Grade R', value: 'Grade R' },
  { label: 'Grade 1', value: 'Grade 1' },
  { label: 'Grade 2', value: 'Grade 2' },
  { label: 'Grade 3', value: 'Grade 3' },
  { label: 'Grade 4', value: 'Grade 4' },
  { label: 'Grade 5', value: 'Grade 5' },
  { label: 'Grade 6', value: 'Grade 6' },
  { label: 'Grade 7', value: 'Grade 7' },
];

/**
 * Initial class form data
 */
export const INITIAL_CLASS_FORM = {
  name: '',
  grade_level: '',
  capacity: 25,
  room_number: '',
  teacher_id: '',
};
