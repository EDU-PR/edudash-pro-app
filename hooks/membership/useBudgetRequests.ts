/**
 * Hook for budget requests
 * Data Source: organization_budgets table
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';

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

export const CATEGORIES = ['Events', 'Marketing', 'Transport', 'Training', 'Equipment', 'Operations', 'Other'];

export const STATUS_CONFIG = {
  pending: { color: '#F59E0B', label: 'Pending', icon: 'time' },
  approved: { color: '#10B981', label: 'Approved', icon: 'checkmark-circle' },
  rejected: { color: '#EF4444', label: 'Rejected', icon: 'close-circle' },
  disbursed: { color: '#3B82F6', label: 'Disbursed', icon: 'wallet' },
};

export function useBudgetRequests(statusFilter: FilterType = 'all') {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const organizationId = profile?.organization_id;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['budget-requests', organizationId, statusFilter],
    queryFn: async (): Promise<BudgetRequest[]> => {
      if (!organizationId) return [];
      
      const supabase = assertSupabase();
      
      const { data: budgets, error: budgetError } = await supabase
        .from('organization_budgets')
        .select(`
          id,
          category,
          department,
          budgeted_amount,
          status,
          notes,
          created_at,
          created_by,
          approved_by,
          approved_at
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (budgetError) {
        console.error('Error fetching budgets:', budgetError);
        return [];
      }

      if (!budgets || budgets.length === 0) {
        return [];
      }

      // Get creator and reviewer names
      const userIds = new Set<string>();
      budgets.forEach(b => {
        if (b.created_by) userIds.add(b.created_by);
        if (b.approved_by) userIds.add(b.approved_by);
      });

      let userNames: Record<string, string> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', Array.from(userIds));
        
        if (profiles) {
          userNames = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || p.email || 'Unknown';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return budgets.map(b => ({
        id: b.id,
        title: `${b.category}${b.department ? ` - ${b.department}` : ''}`,
        description: b.notes || `Budget allocation for ${b.category}`,
        amount: Number(b.budgeted_amount),
        category: b.category,
        status: mapBudgetStatus(b.status),
        submitted_by: b.created_by ? (userNames[b.created_by] || 'Unknown') : 'System',
        submitted_at: b.created_at,
        reviewed_by: b.approved_by ? (userNames[b.approved_by] || undefined) : undefined,
        reviewed_at: b.approved_at || undefined,
        notes: b.notes || undefined,
      }));
    },
    enabled: !!organizationId,
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
    mutationFn: async (newRequest: { title: string; description: string; amount: number; category: string }) => {
      if (!organizationId || !user?.id) {
        throw new Error('Not authenticated or no organization');
      }
      
      const supabase = assertSupabase();
      const currentYear = new Date().getFullYear();
      
      const { data, error } = await supabase
        .from('organization_budgets')
        .insert({
          organization_id: organizationId,
          category: newRequest.category,
          department: newRequest.title,
          budgeted_amount: newRequest.amount,
          notes: newRequest.description,
          status: 'proposed',
          fiscal_year: currentYear,
          period_type: 'annual',
          period_start: `${currentYear}-01-01`,
          period_end: `${currentYear}-12-31`,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      return {
        id: data.id,
        title: newRequest.title,
        description: newRequest.description,
        amount: newRequest.amount,
        category: newRequest.category,
        status: 'pending' as const,
        submitted_by: profile?.full_name || 'You',
        submitted_at: new Date().toISOString(),
      };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budget-requests'] }),
  });

  return { 
    requests, 
    isLoading, 
    isRefreshing: isFetching && !isLoading, 
    error: error as Error | null, 
    stats, 
    refetch, 
    submitRequest: submitMutation.mutateAsync, 
    isSubmitting: submitMutation.isPending 
  };
}

// Helper to map database status to UI status
function mapBudgetStatus(status: string): 'pending' | 'approved' | 'rejected' | 'disbursed' {
  switch (status) {
    case 'draft':
    case 'proposed':
    case 'frozen':
      return 'pending';
    case 'approved':
      return 'approved';
    case 'active':
      return 'disbursed';
    case 'closed':
      return 'rejected';
    default:
      return 'pending';
  }
}
