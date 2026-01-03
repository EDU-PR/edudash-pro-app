/**
 * Hook for fetching youth programs
 * Uses React Query pattern with mock data (ready for real API)
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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

// Mock data - replace with Supabase query when table exists
const MOCK_PROGRAMS: YouthProgram[] = [
  { id: '1', name: 'Youth Leadership Summit 2025', description: 'Annual leadership development program', status: 'active', start_date: '2025-02-01', end_date: '2025-02-28', budget: 150000, participants_count: 245, created_by: 'youth_president', created_at: '2025-01-15T10:00:00Z', category: 'Leadership' },
  { id: '2', name: 'Digital Skills Bootcamp', description: 'Intensive training for digital literacy', status: 'active', start_date: '2025-01-20', end_date: '2025-03-15', budget: 80000, participants_count: 120, created_by: 'youth_president', created_at: '2025-01-10T08:30:00Z', category: 'Education' },
  { id: '3', name: 'Community Outreach Initiative', description: 'Youth-led community service program', status: 'draft', start_date: '2025-04-01', budget: 45000, participants_count: 0, created_by: 'youth_president', created_at: '2025-01-20T14:00:00Z', category: 'Community' },
  { id: '4', name: 'Sports Tournament 2024', description: 'Inter-regional youth sports competition', status: 'completed', start_date: '2024-11-01', end_date: '2024-12-15', budget: 200000, participants_count: 500, created_by: 'youth_president', created_at: '2024-10-01T09:00:00Z', category: 'Sports' },
];

interface UseYouthProgramsOptions {
  statusFilter?: FilterType;
  searchQuery?: string;
}

export function useYouthPrograms(options: UseYouthProgramsOptions = {}) {
  const { statusFilter = 'all', searchQuery = '' } = options;
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['youth-programs', orgId, statusFilter],
    queryFn: async () => {
      // TODO: Replace with actual Supabase query
      await new Promise(resolve => setTimeout(resolve, 300));
      return MOCK_PROGRAMS;
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
