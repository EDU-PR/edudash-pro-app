/**
 * Business logic helpers for students-detail screen.
 * Extracted to keep screen under 500 non-SS lines.
 */

import { logger } from '@/lib/logger';
import { assertSupabase } from '@/lib/supabase';
import { offlineCacheService } from '@/lib/services/offlineCacheService';
import { isPrincipalOrAbove } from '@/lib/roleUtils';
import type { Student } from '@/lib/screen-data/students-detail.types';

const TAG = 'StudentsDetail';

interface LoadStudentsParams {
  preschoolId: string;
  userId: string;
  userEmail?: string;
  userRole: string;
  includeInactive: boolean;
  forceRefresh: boolean;
}

interface LoadStudentsResult {
  students: Student[];
  fromCache: boolean;
}

/** Fetch and transform students from database. Returns the student list. */
export async function loadStudentsData(params: LoadStudentsParams): Promise<LoadStudentsResult> {
  const { preschoolId, userId, userEmail, userRole, includeInactive, forceRefresh } = params;

  // Try cache first
  if (!forceRefresh) {
    const identifier = isPrincipalOrAbove(userRole) ? preschoolId : `${preschoolId}_${userId}`;
    const cached = await offlineCacheService.get<Student[]>('student_data_', identifier, userId);
    if (cached) return { students: cached, fromCache: true };
  }

  logger.info(TAG, 'Fetching students for preschool:', preschoolId);

  const supabase = assertSupabase();

  let query = supabase
    .from('students')
    .select(`
      id, student_id, first_name, last_name, date_of_birth,
      parent_id, guardian_id, class_id, is_active, preschool_id,
      avatar_url, created_at, status, grade_level, gender,
      medical_conditions, allergies, emergency_contact_name, emergency_contact_phone,
      classes!students_class_id_fkey(name, teacher_id, teacher:profiles!classes_teacher_id_fkey(first_name, last_name)),
      parent:profiles!students_parent_id_fkey(first_name, last_name, email, phone),
      guardian:profiles!students_guardian_id_fkey(first_name, last_name, email, phone)
    `)
    .eq('preschool_id', preschoolId);

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data: studentsData, error: studentsError } = await query;

  if (studentsError) {
    logger.error(TAG, 'Error fetching students:', studentsError);
    throw new Error('Failed to load students. Please try again.');
  }

  logger.info(TAG, 'Students fetched:', studentsData?.length || 0);

  // Batch-fetch attendance rates
  const studentIds = (studentsData || []).map((s: any) => s.id);
  let attendanceMap: Record<string, { total: number; present: number; lastDate: string }> = {};

  if (studentIds.length > 0) {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const sinceDate = ninetyDaysAgo.toISOString().slice(0, 10);

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('student_id, status, attendance_date')
      .in('student_id', studentIds)
      .gte('attendance_date', sinceDate)
      .order('attendance_date', { ascending: false });

    if (attendanceData) {
      for (const row of attendanceData) {
        if (!attendanceMap[row.student_id]) {
          attendanceMap[row.student_id] = { total: 0, present: 0, lastDate: row.attendance_date };
        }
        attendanceMap[row.student_id].total++;
        if (row.status === 'present' || row.status === 'late') {
          attendanceMap[row.student_id].present++;
        }
      }
    }
  }

  const getRecord = (value: any): any => (Array.isArray(value) ? value[0] || null : value || null);

  // Transform to Student interface
  const transformedStudents: Student[] = (studentsData || []).map((db: any) => {
    const parentInfo = db.parent || db.guardian;
    const guardianName = parentInfo
      ? `${parentInfo.first_name || ''} ${parentInfo.last_name || ''}`.trim() || 'Not provided'
      : 'Not provided';

    const classRecord = getRecord(db.classes);
    const teacherRecord = getRecord(classRecord?.teacher);
    const className = classRecord?.name || null;
    const gradeLevel = db.grade_level || className || 'Not Assigned';

    return {
      id: db.id,
      studentId: db.student_id || db.id,
      firstName: db.first_name || 'Unknown',
      lastName: db.last_name || 'Student',
      grade: gradeLevel,
      dateOfBirth: db.date_of_birth || '',
      guardianName,
      guardianPhone: parentInfo?.phone || db.emergency_contact_phone || 'Not provided',
      guardianEmail: parentInfo?.email || 'Not provided',
      emergencyContact: db.emergency_contact_name || 'Not provided',
      emergencyPhone: db.emergency_contact_phone || 'Not provided',
      medicalConditions: db.medical_conditions || '',
      allergies: db.allergies || '',
      enrollmentDate: db.created_at?.split('T')[0] || '',
      status: (db.status || 'active') as 'active' | 'inactive' | 'pending',
      profilePhoto: db.avatar_url || undefined,
      attendanceRate: attendanceMap[db.id]
        ? Math.round((attendanceMap[db.id].present / attendanceMap[db.id].total) * 100)
        : 0,
      lastAttendance: attendanceMap[db.id]?.lastDate || '',
      assignedTeacher: teacherRecord
        ? `${teacherRecord.first_name || ''} ${teacherRecord.last_name || ''}`.trim()
        : 'Not Assigned',
      fees: { outstanding: 0, lastPayment: '', paymentStatus: 'current' as const },
      schoolId: preschoolId,
      classId: db.class_id,
    };
  });

  // Role-based filtering
  let filtered = transformedStudents;
  if (isPrincipalOrAbove(userRole)) {
    // Principals see all
  } else if (userRole === 'teacher') {
    const teacherFiltered = transformedStudents.filter((s) => {
      const matchingDb = (studentsData || []).find((d: any) => d.id === s.id);
      const classRec = getRecord(matchingDb?.classes);
      return classRec?.teacher_id === userId;
    });
    if (teacherFiltered.length > 0) filtered = teacherFiltered;
  } else {
    // Parents: filter by parent_id or guardian_id
    let parentFiltered = transformedStudents.filter((s) => {
      const matchingDb = (studentsData || []).find((d: any) => d.id === s.id);
      return matchingDb?.parent_id === userId || matchingDb?.guardian_id === userId;
    });
    if (parentFiltered.length === 0 && userEmail) {
      parentFiltered = transformedStudents.filter((s) => s.guardianEmail === userEmail);
    }
    filtered = parentFiltered;
  }

  // Cache fresh data
  const identifier = isPrincipalOrAbove(userRole) ? preschoolId : `${preschoolId}_${userId}`;
  await offlineCacheService.set<Student[]>('student_data_', identifier, filtered, userId, preschoolId);

  return { students: filtered, fromCache: false };
}

/** Soft-delete (deactivate) a student. */
export async function softDeleteStudent(
  studentId: string,
  userId: string,
  preschoolId: string,
  userRole: string,
): Promise<void> {
  const supabase = assertSupabase();

  const { error } = await supabase
    .from('students')
    .update({ is_active: false, status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', studentId);

  if (error) throw error;

  // Invalidate cache
  const identifier = isPrincipalOrAbove(userRole) ? preschoolId : `${preschoolId}_${userId}`;
  await offlineCacheService.remove('student_data_', identifier);
  logger.info(TAG, 'Student cache invalidated after soft delete');
}

/** Permanently delete a student record. */
export async function permanentDeleteStudent(
  studentId: string,
  userId: string,
  preschoolId: string,
  userRole: string,
): Promise<void> {
  const supabase = assertSupabase();

  // Clear registration_requests references first
  await supabase
    .from('registration_requests')
    .update({ edudash_student_id: null })
    .eq('edudash_student_id', studentId);

  const { error } = await supabase.from('students').delete().eq('id', studentId);
  if (error) throw error;

  // Invalidate cache
  const identifier = isPrincipalOrAbove(userRole) ? preschoolId : `${preschoolId}_${userId}`;
  await offlineCacheService.remove('student_data_', identifier);
  logger.info(TAG, 'Student cache invalidated after permanent delete');
}
