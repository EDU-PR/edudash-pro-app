/**
 * useTeacherLessons Hook
 * 
 * Simple, robust hook for fetching teacher's lessons.
 * Designed to be reliable and easy to use with the lesson assignment flow.
 * 
 * @module hooks/useTeacherLessons
 */

import { useState, useCallback, useEffect } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface TeacherLesson {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  age_group: string;
  duration_minutes: number;
  status: 'draft' | 'active' | 'published' | 'archived';
  is_ai_generated: boolean;
  teacher_id: string | null;
  preschool_id: string | null;
  created_at: string;
  updated_at: string;
  content: any;
  objectives: string[] | null;
}

export interface UseTeacherLessonsOptions {
  /** Filter by status (default: all statuses) */
  status?: 'draft' | 'active' | 'published' | 'archived' | 'all';
  /** Filter by AI-generated lessons only */
  aiGeneratedOnly?: boolean;
  /** Include lessons from all teachers in organization */
  includeOrganization?: boolean;
  /** Maximum number of lessons to fetch */
  limit?: number;
  /** Enable auto-refresh on mount */
  autoRefresh?: boolean;
}

export interface UseTeacherLessonsReturn {
  lessons: TeacherLesson[];
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  refetch: () => Promise<void>;
  
  // Categorized lessons
  myLessons: TeacherLesson[];
  organizationLessons: TeacherLesson[];
  activeLessons: TeacherLesson[];
  draftLessons: TeacherLesson[];
  
  // Stats
  stats: {
    total: number;
    active: number;
    draft: number;
    aiGenerated: number;
  };
}

/**
 * Hook for fetching and managing teacher's lessons
 * 
 * @example
 * ```tsx
 * const { lessons, isLoading, error, refetch } = useTeacherLessons();
 * 
 * // Get only active lessons
 * const { activeLessons } = useTeacherLessons({ status: 'active' });
 * 
 * // Include lessons from organization
 * const { organizationLessons } = useTeacherLessons({ includeOrganization: true });
 * ```
 */
export function useTeacherLessons(options: UseTeacherLessonsOptions = {}): UseTeacherLessonsReturn {
  const { profile, user } = useAuth();
  const [lessons, setLessons] = useState<TeacherLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    status = 'all',
    aiGeneratedOnly = false,
    includeOrganization = true,
    limit = 100,
    autoRefresh = true,
  } = options;

  const organizationId = profile?.organization_id || profile?.preschool_id;
  const teacherId = user?.id || profile?.id;

  const fetchLessons = useCallback(async () => {
    if (!teacherId) {
      console.log('[useTeacherLessons] No teacher ID available');
      setLessons([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = assertSupabase();
      
      console.log('[useTeacherLessons] Fetching lessons for teacher:', teacherId, 'org:', organizationId);

      // Build the query with simple, direct approach
      let query = supabase
        .from('lessons')
        .select(`
          id,
          title,
          description,
          subject,
          age_group,
          duration_minutes,
          status,
          is_ai_generated,
          teacher_id,
          preschool_id,
          created_at,
          updated_at,
          content,
          objectives
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filter by teacher and/or organization
      if (includeOrganization && organizationId) {
        // Get lessons from teacher OR from the same organization
        query = query.or(`teacher_id.eq.${teacherId},preschool_id.eq.${organizationId}`);
      } else {
        // Only get lessons created by this teacher
        query = query.eq('teacher_id', teacherId);
      }

      // Filter by status if specified
      if (status !== 'all') {
        query = query.eq('status', status);
      }

      // Filter AI-generated only if specified
      if (aiGeneratedOnly) {
        query = query.eq('is_ai_generated', true);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('[useTeacherLessons] Fetch error:', fetchError);
        setError(fetchError.message || 'Failed to fetch lessons');
        setLessons([]);
        return;
      }

      console.log('[useTeacherLessons] Fetched', data?.length || 0, 'lessons');
      setLessons(data || []);
      setError(null);

    } catch (err: any) {
      console.error('[useTeacherLessons] Unexpected error:', err);
      setError(err?.message || 'An unexpected error occurred');
      setLessons([]);
    } finally {
      setIsLoading(false);
    }
  }, [teacherId, organizationId, status, aiGeneratedOnly, includeOrganization, limit]);

  // Initial fetch
  useEffect(() => {
    if (autoRefresh) {
      fetchLessons();
    }
  }, [fetchLessons, autoRefresh]);

  // Categorized lessons
  const myLessons = lessons.filter(l => l.teacher_id === teacherId);
  const organizationLessons = lessons.filter(l => 
    l.preschool_id === organizationId && l.teacher_id !== teacherId
  );
  const activeLessons = lessons.filter(l => l.status === 'active' || l.status === 'published');
  const draftLessons = lessons.filter(l => l.status === 'draft');

  // Stats
  const stats = {
    total: lessons.length,
    active: activeLessons.length,
    draft: draftLessons.length,
    aiGenerated: lessons.filter(l => l.is_ai_generated).length,
  };

  return {
    lessons,
    isLoading,
    error,
    isEmpty: !isLoading && lessons.length === 0,
    refetch: fetchLessons,
    myLessons,
    organizationLessons,
    activeLessons,
    draftLessons,
    stats,
  };
}

export default useTeacherLessons;
