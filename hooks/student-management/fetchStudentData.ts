/**
 * Fetches school info, age groups, classes, and students for a given org.
 * Returns processed students with computed age info and parent names.
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

import type { Student, AgeGroup, ShowAlert } from './types';
import { calculateAgeInfo, findAgeGroup } from './studentHelpers';

export interface FetchStudentDataResult {
  school: { id: string; name: string; school_type: string; grade_levels: string[] } | null;
  ageGroups: AgeGroup[];
  classes: any[];
  students: Student[];
}

export async function fetchStudentData(
  orgId: string,
  showAlert: ShowAlert,
): Promise<FetchStudentDataResult> {
  const preschoolId = orgId;

  const { data: school } = await assertSupabase()
    .from('preschools')
    .select('id, name, school_type, grade_levels')
    .eq('id', preschoolId)
    .single();

  // Prefer per-school age groups (preschool_id); fall back to school_type for backwards compatibility
  const schoolType = school?.school_type || 'preschool';
  let ageGroupsData: any[] | null = null;
  const baseSelect =
    'id, name, min_age_months, max_age_months, age_min, age_max, school_type, description';
  const { data: perSchool, error: perSchoolErr } = await assertSupabase()
    .from('age_groups')
    .select(baseSelect)
    .eq('preschool_id', preschoolId)
    .eq('is_active', true)
    .order('min_age_months');
  if (!perSchoolErr && perSchool && perSchool.length > 0) {
    ageGroupsData = perSchool;
  }
  if (!ageGroupsData || ageGroupsData.length === 0) {
    const { data: byType } = await assertSupabase()
      .from('age_groups')
      .select(baseSelect)
      .eq('school_type', schoolType)
      .eq('is_active', true)
      .order('min_age_months');
    ageGroupsData = byType;
  }

  const { data: classesData } = await assertSupabase()
    .from('classes')
    .select('id, name, grade_level, teacher_id')
    .eq('preschool_id', preschoolId)
    .eq('active', true)
    .order('name');

  const { data: studentsData, error: studentsError } = await assertSupabase()
    .from('students')
    .select(
      `id, student_id, first_name, last_name, avatar_url,
       date_of_birth, preschool_id, class_id, parent_id,
       guardian_id, is_active, status,
       classes (name)`,
    )
    .eq('preschool_id', preschoolId)
    .eq('status', 'active')
    .eq('is_active', true)
    .order('first_name');

  if (studentsError) {
    logger.error('StudentMgmt', 'Students query error', studentsError);
  }

  // Resolve parent names
  const parentIds = [
    ...new Set(
      (studentsData || [])
        .map((s: any) => s.parent_id || s.guardian_id)
        .filter(Boolean),
    ),
  ];

  let parentMap: Record<string, string> = {};
  if (parentIds.length > 0) {
    const { data: parents } = await assertSupabase()
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', parentIds);
    parentMap = (parents || []).reduce((acc: any, p: any) => {
      acc[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      return acc;
    }, {});
  }

  const processedStudents: Student[] = (studentsData || []).map(
    (student: any) => {
      const ageInfo = calculateAgeInfo(student.date_of_birth);
      const ageGroup = findAgeGroup(ageInfo.age_months, ageGroupsData || []);
      const parentId = student.parent_id || student.guardian_id;
      const className = student.classes?.name || undefined;

      return {
        ...student,
        student_id: student.student_id || null,
        avatar_url: student.avatar_url || null,
        age_months: ageInfo.age_months,
        age_years: ageInfo.age_years,
        age_group_name: ageGroup?.name || className,
        class_name: className,
        parent_name: parentId ? parentMap[parentId] : undefined,
      };
    },
  );

  return {
    school,
    ageGroups: ageGroupsData || [],
    classes: classesData || [],
    students: processedStudents,
  };
}
