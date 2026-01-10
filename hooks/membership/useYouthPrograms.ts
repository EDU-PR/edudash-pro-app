/**
 * Hook for fetching youth programs
 * Uses React Query with Supabase courses table
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';

export interface YouthProgram {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  start_date: string;
  end_date?: string;
  budget?: number;
  participants_count: number;
  created_by: string;
  created_at: string;
  category: string;
}

type FilterType = 'all' | 'active' | 'draft' | 'completed';

interface UseYouthProgramsOptions {
  statusFilter?: FilterType;
  searchQuery?: string;
}

export function useYouthPrograms(options: UseYouthProgramsOptions = {}) {
  const { statusFilter = 'all', searchQuery = '' } = options;
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['youth-programs', orgId, statusFilter, searchQuery],
    queryFn: async () => {
      if (!orgId) {
        throw new Error('Organization not found');
      }

      const supabase = assertSupabase();
      
      // Build query for courses (used as programs)
      let query = supabase
        .from('courses')
        .select(`
          id,
          title,
          description,
          course_code,
          start_date,
          end_date,
          is_active,
          max_students,
          instructor_id,
          organization_id,
          metadata,
          created_at,
          updated_at,
          profiles:instructor_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (statusFilter === 'active') {
        query = query.eq('is_active', true);
      } else if (statusFilter === 'draft') {
        query = query.eq('is_active', false);
      } else if (statusFilter === 'completed') {
        // Completed programs have end_date in the past
        query = query.lt('end_date', new Date().toISOString().split('T')[0]);
      }

      // Apply search
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,course_code.ilike.%${searchQuery}%`);
      }

      const { data: courses, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Map courses to YouthProgram format
      const programs: YouthProgram[] = (courses || []).map((course: any) => {
        // Determine status based on dates and is_active
        let status: 'draft' | 'active' | 'completed' | 'cancelled' = 'draft';
        if (course.is_active) {
          if (course.end_date && new Date(course.end_date) < new Date()) {
            status = 'completed';
          } else {
            status = 'active';
          }
        } else {
          status = 'draft';
        }

        // Extract budget and category from metadata
        const metadata = course.metadata || {};
        const budget = metadata.budget || null;
        const category = metadata.category || 'General';

        // Get participants count (would need a separate query or join)
        // For now, use max_students as a proxy or 0
        const participants_count = metadata.participants_count || 0;

        return {
          id: course.id,
          name: course.title,
          description: course.description || '',
          status,
          start_date: course.start_date || course.created_at.split('T')[0],
          end_date: course.end_date || undefined,
          budget,
          participants_count,
          created_by: course.instructor_id,
          created_at: course.created_at,
          category,
        };
      });

      return programs;
    },
    enabled: !!orgId,
    staleTime: 60000,
  });

  const programs = useMemo(() => {
    if (!data) return [];
    let result = [...data];
    
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    
    return result;
  }, [data, statusFilter, searchQuery]);

  const stats = useMemo(() => ({
    total: (data || []).length,
    active: (data || []).filter(p => p.status === 'active').length,
    totalBudget: (data || []).reduce((sum, p) => sum + (p.budget || 0), 0),
    totalParticipants: (data || []).reduce((sum, p) => sum + p.participants_count, 0),
  }), [data]);

  return { programs, isLoading, isRefreshing: isFetching && !isLoading, error: error as Error | null, stats, refetch };
}

export const STATUS_CONFIG = {
  draft: { color: '#F59E0B', label: 'Draft', icon: 'document-text' },
  active: { color: '#10B981', label: 'Active', icon: 'play-circle' },
  completed: { color: '#3B82F6', label: 'Completed', icon: 'checkmark-circle' },
  cancelled: { color: '#EF4444', label: 'Cancelled', icon: 'close-circle' },
};

export const CATEGORY_ICONS: Record<string, string> = {
  Leadership: 'school', Education: 'book', Community: 'people', Sports: 'football', Culture: 'color-palette', Technology: 'laptop',
};
