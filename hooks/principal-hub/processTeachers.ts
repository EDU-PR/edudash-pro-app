/**
 * Principal Hub — Teacher Processing
 *
 * Processes raw teacher rows into TeacherSummary[] with performance indicators.
 * Uses vw_teacher_overview for efficient batch stats when available.
 */

import { logger } from '@/lib/logger';
import { assertSupabase } from '@/lib/supabase';
import type { TeacherSummary } from './types';

type TFunc = (key: string, opts?: Record<string, any>) => string;

export async function processTeachers(
  teachersData: any[],
  preschoolId: string,
  t: TFunc,
): Promise<TeacherSummary[]> {
  if (!teachersData.length) return [];

  const supabase = assertSupabase();

  // Preload per-teacher stats from materialised view (tenant-isolated by RLS)
  const overviewByEmail = new Map<string, { class_count: number; student_count: number }>();
  try {
    const { data: rows } = await supabase
      .from('vw_teacher_overview')
      .select('email, class_count, student_count');
    (rows || []).forEach((row: any) => {
      if (row?.email) {
        overviewByEmail.set(String(row.email).toLowerCase(), {
          class_count: Number(row.class_count || 0),
          student_count: Number(row.student_count || 0),
        });
      }
    });
  } catch (e) {
    logger.warn('[PrincipalHub] vw_teacher_overview fetch failed, using per-teacher queries:', e);
  }

  return Promise.all(
    teachersData.map(async (teacher: any) => {
      // Resolve effective user ID (classes.teacher_id → users.id)
      let effectiveUserId: string | null = teacher.user_id || null;
      if (!effectiveUserId && teacher.email) {
        try {
          const { data: fp } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', teacher.email)
            .or(`preschool_id.eq.${preschoolId},organization_id.eq.${preschoolId}`)
            .maybeSingle();
          if (fp?.id) effectiveUserId = fp.id;
        } catch { /* non-fatal */ }
      }

      // --- Class counts ---
      let teacherClassesCount = 0;
      let classIds: string[] = [];
      const viewStats = overviewByEmail.get(String(teacher.email || '').toLowerCase());

      if (viewStats) {
        teacherClassesCount = viewStats.class_count || 0;
      } else if (effectiveUserId) {
        const { count } = await supabase
          .from('classes').select('id', { count: 'exact', head: true })
          .eq('teacher_id', effectiveUserId).or('active.eq.true,active.is.null')
          .eq('preschool_id', preschoolId);
        teacherClassesCount = count || 0;

        const { data: classRows } = await supabase
          .from('classes').select('id')
          .eq('teacher_id', effectiveUserId).or('active.eq.true,active.is.null')
          .eq('preschool_id', preschoolId);
        classIds = (classRows || []).map((c: any) => c.id);
      }

      // Lone-teacher fallback: attribute unassigned classes
      if (teacherClassesCount === 0 && teachersData.length === 1) {
        const { data: unassigned } = await supabase
          .from('classes').select('id')
          .is('teacher_id', null).or('active.eq.true,active.is.null')
          .eq('preschool_id', preschoolId);
        if (unassigned?.length) {
          classIds = unassigned.map((c: any) => c.id);
          teacherClassesCount = classIds.length;
        }
      }

      // --- Student counts ---
      let studentsInClasses = 0;
      if (viewStats) {
        studentsInClasses = viewStats.student_count || 0;
      } else if (classIds.length > 0) {
        const { count } = await supabase
          .from('students').select('id', { count: 'exact', head: true })
          .in('class_id', classIds)
          .eq('status', 'active')
          .eq('is_active', true);
        studentsInClasses = count || 0;
      }

      // --- Teacher attendance rate ---
      let teacherAttendanceRate = 0;
      if (classIds.length > 0) {
        const studentIds = await supabase
          .from('students')
          .select('id')
          .in('class_id', classIds)
          .eq('status', 'active')
          .eq('is_active', true)
          .then((res: { data: any[] | null }) => (res.data || []).map((s: any) => s.id));

        if (studentIds.length > 0) {
          const { data: att } = await supabase
            .from('attendance').select('status, student_id')
            .in('student_id', studentIds)
            .gte('attendance_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
          if (att?.length) {
            teacherAttendanceRate = Math.round(
              (att.filter((a: any) => a.status === 'present').length / att.length) * 100,
            );
          }
        }
      }

      // --- Performance evaluation ---
      const { status, performanceIndicator } = evaluatePerformance(
        teacherClassesCount, studentsInClasses, teacherAttendanceRate, t,
      );

      return {
        id: teacher.id,
        email: teacher.email,
        first_name: teacher.first_name || 'Unknown',
        last_name: teacher.last_name || 'Teacher',
        full_name: `${teacher.first_name || 'Unknown'} ${teacher.last_name || 'Teacher'}`.trim(),
        phone: teacher.phone,
        subject_specialization: teacher.subject_specialization || 'General',
        hire_date: teacher.created_at,
        classes_assigned: teacherClassesCount,
        students_count: studentsInClasses,
        status,
        performance_indicator: performanceIndicator,
      } satisfies TeacherSummary;
    }),
  );
}

// ────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────

function evaluatePerformance(
  classesCount: number,
  studentsCount: number,
  attendanceRate: number,
  t: TFunc,
): { status: TeacherSummary['status']; performanceIndicator: string } {
  const ratio = studentsCount > 0 ? studentsCount / Math.max(classesCount, 1) : 0;

  if (classesCount === 0) {
    return { status: 'needs_attention', performanceIndicator: t('teacher.performance.no_classes', { defaultValue: 'No classes assigned - requires attention' }) };
  }
  if (ratio > 25) {
    return { status: 'needs_attention', performanceIndicator: t('teacher.performance.high_ratio', { ratio: Math.round(ratio), defaultValue: 'High student ratio ({{ratio}}:1) - may need support' }) };
  }
  if (classesCount >= 3 && ratio <= 20 && attendanceRate >= 85) {
    return { status: 'excellent', performanceIndicator: t('teacher.performance.excellent', { classes: classesCount, ratio: Math.round(ratio), attendance: attendanceRate, defaultValue: 'Excellent performance - {{classes}} classes, {{ratio}}:1 ratio, {{attendance}}% attendance' }) };
  }
  if (classesCount >= 2 && ratio <= 22 && attendanceRate >= 80) {
    return { status: 'excellent', performanceIndicator: t('teacher.performance.strong', { classes: classesCount, defaultValue: 'Strong performance - {{classes}} classes, good attendance rates' }) };
  }
  if (ratio <= 25 && attendanceRate >= 75) {
    return { status: 'good', performanceIndicator: t('teacher.performance.good', { students: studentsCount, defaultValue: 'Good performance - managing {{students}} students effectively' }) };
  }
  return { status: 'needs_attention', performanceIndicator: t('teacher.performance.review_needed', { attendance: attendanceRate, defaultValue: 'Performance review needed - {{attendance}}% attendance rate in classes' }) };
}
