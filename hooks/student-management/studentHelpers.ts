/**
 * Pure helper functions for student age calculation, grouping, and display.
 */

import type { AgeGroup, FilterOptions, Student } from './types';

export function calculateAgeInfo(dateOfBirth: string | null): {
  age_months: number;
  age_years: number;
} {
  if (!dateOfBirth) return { age_months: 0, age_years: 0 };

  const birth = new Date(dateOfBirth);
  const today = new Date();

  const totalMonths =
    (today.getFullYear() - birth.getFullYear()) * 12 +
    (today.getMonth() - birth.getMonth());
  const years = Math.floor(totalMonths / 12);

  return {
    age_months: Math.max(0, totalMonths),
    age_years: years,
  };
}

export function findAgeGroup(
  ageMonths: number,
  ageGroups: AgeGroup[],
): AgeGroup | undefined {
  return ageGroups.find(
    (group) =>
      ageMonths >= group.min_age_months && ageMonths <= group.max_age_months,
  );
}

export function formatAge(
  ageMonths: number,
  ageYears: number,
  schoolType: string,
): string {
  if (schoolType === 'preschool') {
    if (ageYears < 2) {
      return `${ageMonths} months`;
    }
    const remainingMonths = ageMonths % 12;
    return remainingMonths > 0
      ? `${ageYears}y ${remainingMonths}m`
      : `${ageYears} years`;
  }
  return `${ageYears} years`;
}

/** Preschool age group names configurable per school (principals/admins). */
export const PRESCHOOL_AGE_GROUP_NAMES = ['Curious Cubs', 'Little Explorers', 'Panda'] as const;

export function getAgeGroupColor(
  ageGroupName: string | undefined,
  schoolType: string,
): string {
  if (!ageGroupName) return '#9CA3AF';

  if (schoolType === 'preschool') {
    switch (ageGroupName) {
      case 'Curious Cubs':
        return '#EC4899';
      case 'Little Explorers':
        return '#8B5CF6';
      case 'Panda':
        return '#059669';
      case 'Toddlers':
        return '#EC4899';
      case 'Preschool 3-4':
        return '#8B5CF6';
      case 'Preschool 4-5':
        return '#3B82F6';
      case 'Pre-K (Reception)':
        return '#059669';
      default:
        return '#6B7280';
    }
  }

  if (ageGroupName?.includes('Grade R') || ageGroupName?.includes('Grade 1-3'))
    return '#059669';
  if (ageGroupName?.includes('Grade 4-6')) return '#3B82F6';
  if (ageGroupName?.includes('Grade 7-9')) return '#8B5CF6';
  if (ageGroupName?.includes('Grade 10-12')) return '#DC2626';
  return '#6B7280';
}

export function getSchoolTypeDisplay(schoolType: string): string {
  switch (schoolType) {
    case 'preschool':
      return 'Pre-School';
    case 'primary':
      return 'Primary School';
    case 'secondary':
      return 'Secondary School';
    case 'combined':
      return 'Combined School';
    default:
      return 'School';
  }
}

export function filterStudents(
  students: Student[],
  filters: FilterOptions,
): Student[] {
  return students.filter((student) => {
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      const fullName =
        `${student.first_name} ${student.last_name}`.toLowerCase();
      if (!fullName.includes(searchLower)) return false;
    }

    if (filters.ageGroup) {
      if (filters.ageGroup === 'Unassigned') {
        if (student.age_group_name) return false;
      } else {
        if (student.age_group_name !== filters.ageGroup) return false;
      }
    }
    if (filters.status && student.status !== filters.status) return false;
    if (filters.classId && student.class_id !== filters.classId) return false;

    return true;
  });
}

/**
 * Returns age group counts. For preschool, only Curious Cubs, Little Explorers, Panda
 * (and Other, Unassigned) are shown; other names are collapsed into "Other".
 */
export function getAgeGroupStats(
  students: Student[],
  schoolType: string = 'preschool',
): Record<string, number> {
  const raw: Record<string, number> = {};
  students.forEach((student) => {
    const group = student.age_group_name || 'Unassigned';
    raw[group] = (raw[group] || 0) + 1;
  });
  if (schoolType !== 'preschool') return raw;
  const stats: Record<string, number> = {};
  let otherCount = 0;
  Object.entries(raw).forEach(([name, count]) => {
    if (PRESCHOOL_AGE_GROUP_NAMES.includes(name as any)) {
      stats[name] = count;
    } else if (name === 'Unassigned') {
      stats[name] = count;
    } else {
      otherCount += count;
    }
  });
  if (otherCount > 0) stats['Other'] = otherCount;
  PRESCHOOL_AGE_GROUP_NAMES.forEach((name) => {
    if (!(name in stats)) stats[name] = 0;
  });
  if (!('Unassigned' in stats)) stats['Unassigned'] = 0;
  return stats;
}
