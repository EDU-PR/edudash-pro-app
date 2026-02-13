import { useCallback, useEffect, useState } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface StudentSummary {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  className: string | null;
}

interface UseRecentStudentsParams {
  organizationId: string | null | undefined;
  limit?: number;
}

export const useRecentStudents = ({ organizationId, limit = 4 }: UseRecentStudentsParams) => {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    if (!organizationId) {
      setStudents([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await assertSupabase()
        .from('students')
        .select('id, first_name, last_name, avatar_url, date_of_birth, class_id, classes(name), created_at, organization_id, preschool_id, is_active')
        .or(`organization_id.eq.${organizationId},preschool_id.eq.${organizationId}`)
        .eq('status', 'active')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (queryError) {
        throw new Error(queryError.message);
      }

      const summaries = (data || []).map((row) => ({
        id: row.id,
        firstName: row.first_name || 'Child',
        lastName: row.last_name || '',
        avatarUrl: row.avatar_url ?? null,
        dateOfBirth: row.date_of_birth ?? null,
        className: (row.classes as { name?: string } | null)?.name ?? null,
      }));

      setStudents(summaries);
    } catch (err) {
      logger.error('[useRecentStudents] Failed to fetch students:', err);
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [organizationId, limit]);

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

export default useRecentStudents;
