/**
 * Hook for budget requests
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface BudgetRequest {
  id: string;
  title: string;
  description: string;
  amount: number;
  category: string;
  status: 'pending' | 'approved' | 'rejected' | 'disbursed';
  submitted_by: string;
  submitted_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
}

type FilterType = 'all' | 'pending' | 'approved' | 'rejected';

const MOCK_REQUESTS: BudgetRequest[] = [
  { id: '1', title: 'Leadership Summit Catering', description: 'Catering services for annual summit', amount: 45000, category: 'Events', status: 'approved', submitted_by: 'Youth President', submitted_at: '2025-01-15T10:00:00Z', reviewed_by: 'CEO', reviewed_at: '2025-01-16T14:30:00Z', notes: 'Approved with minor adjustments' },
  { id: '2', title: 'Marketing Materials', description: 'Promotional materials for recruitment', amount: 15000, category: 'Marketing', status: 'pending', submitted_by: 'Youth President', submitted_at: '2025-01-18T08:30:00Z' },
  { id: '3', title: 'Transport Costs - Regional Visit', description: 'Transport for executive team visits', amount: 25000, category: 'Transport', status: 'disbursed', submitted_by: 'Youth President', submitted_at: '2025-01-10T11:00:00Z', reviewed_by: 'Treasurer', reviewed_at: '2025-01-11T09:00:00Z' },
  { id: '4', title: 'Training Workshop', description: 'Skills development for coordinators', amount: 30000, category: 'Training', status: 'rejected', submitted_by: 'Youth Secretary', submitted_at: '2025-01-05T15:00:00Z', reviewed_by: 'CFO', reviewed_at: '2025-01-07T10:00:00Z', notes: 'Budget exceeded for Q1' },
];

export const CATEGORIES = ['Events', 'Marketing', 'Transport', 'Training', 'Equipment', 'Other'];

export const STATUS_CONFIG = {
  pending: { color: '#F59E0B', label: 'Pending', icon: 'time' },
  approved: { color: '#10B981', label: 'Approved', icon: 'checkmark-circle' },
  rejected: { color: '#EF4444', label: 'Rejected', icon: 'close-circle' },
  disbursed: { color: '#3B82F6', label: 'Disbursed', icon: 'wallet' },
};

export function useBudgetRequests(statusFilter: FilterType = 'all') {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['budget-requests', profile?.organization_id, statusFilter],
    queryFn: async () => {
      await new Promise(r => setTimeout(r, 300));
      return MOCK_REQUESTS;
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000,
  });

  const requests = useMemo(() => {
    if (!data) return [];
    if (statusFilter === 'all') return data;
    return data.filter(r => r.status === statusFilter);
  }, [data, statusFilter]);

  const stats = useMemo(() => {
    const all = data || [];
    return {
      total: all.length,
      pending: all.filter(r => r.status === 'pending').length,
      approved: all.filter(r => ['approved', 'disbursed'].includes(r.status)).length,
      pendingAmount: all.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0),
    };
  }, [data]);

  const submitMutation = useMutation({
    mutationFn: async (newRequest: Omit<BudgetRequest, 'id' | 'status' | 'submitted_at'>) => {
      await new Promise(r => setTimeout(r, 500));
      return { ...newRequest, id: Date.now().toString(), status: 'pending' as const, submitted_at: new Date().toISOString() };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget-requests'] }),
  });

  return { requests, isLoading, isRefreshing: isFetching && !isLoading, error: error as Error | null, stats, refetch, submitRequest: submitMutation.mutateAsync, isSubmitting: submitMutation.isPending };
}
