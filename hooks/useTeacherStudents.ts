import { useCallback, useEffect, useState } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface TeacherStudentSummary {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  className: string | null;
  classId: string | null;
  parentId: string | null;
  guardianId: string | null;
}

interface UseTeacherStudentsParams {
  teacherId: string | null | undefined;
  organizationId: string | null | undefined;
  limit?: number;
}

export const useTeacherStudents = ({ teacherId, organizationId, limit = 4 }: UseTeacherStudentsParams) => {
  const [students, setStudents] = useState<TeacherStudentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    if (!teacherId) {
      setStudents([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = assertSupabase()
        .from('classes')
        .select('id, name, preschool_id, organization_id, students(id, first_name, last_name, avatar_url, date_of_birth, is_active, parent_id, guardian_id)')
        .eq('teacher_id', teacherId)
        .eq('active', true);

      if (organizationId) {
        query = query.or(`preschool_id.eq.${organizationId},organization_id.eq.${organizationId}`);
      }

      const { data, error: queryError } = await query;
      if (queryError) {
        throw new Error(queryError.message);
      }

      const flattened: TeacherStudentSummary[] = [];
      (data || []).forEach((cls) => {
        const className = cls.name || null;
        const classId = cls.id || null;
        (cls.students as Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          date_of_birth: string | null;
          is_active?: boolean | null;
          parent_id?: string | null;
          guardian_id?: string | null;
        }> | null || []).forEach((student) => {
          if (student.is_active === false) return;
          flattened.push({
            id: student.id,
            firstName: student.first_name || 'Child',
            lastName: student.last_name || '',
            avatarUrl: student.avatar_url ?? null,
            dateOfBirth: student.date_of_birth ?? null,
            className,
            classId,
            parentId: student.parent_id ?? null,
            guardianId: student.guardian_id ?? null,
          });
        });
      });

      setStudents(limit > 0 ? flattened.slice(0, limit) : flattened);
    } catch (err) {
      logger.error('[useTeacherStudents] Failed to fetch teacher students:', err);
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [teacherId, organizationId, limit]);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  return {
    students,
    loading,
    error,
    refresh: fetchStudents,
  };
};

export default useTeacherStudents;
