/**
 * useFinanceData Hook - React Query for Finance Dashboard
 * Fetches financial summary, payments, invoices and regional data
 * 
 * Data Sources:
 * - organization_transactions table
 * - member_fees table  
 * - organization_budgets table
 * - organization_members table
 */
import { useQuery } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface FinancialSummary {
  totalRevenue: number;
  thisMonth: number;
  outstanding: number;
  pendingPayments: number;
  collectionRate: number;
}

export interface Payment {
  id: string;
  member_name: string;
  amount: number;
  payment_method: 'card' | 'eft' | 'cash' | 'payfast' | 'other';
  reference: string;
  created_at: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface Invoice {
  id: string;
  invoice_number: string;
  member_name: string;
  member_number: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  due_date: string;
  paid_date?: string;
}

export interface RegionFinance {
  region: string;
  code: string;
  collected: number;
  outstanding: number;
  members_paid: number;
  total_members: number;
}

export function useFinancialSummary() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['financial-summary', organizationId],
    queryFn: async (): Promise<FinancialSummary> => {
      if (!organizationId) {
        return { totalRevenue: 0, thisMonth: 0, outstanding: 0, pendingPayments: 0, collectionRate: 0 };
      }
      
      const supabase = assertSupabase();
      
      // Get current year and month boundaries
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      
      // Total revenue this year (completed transactions)
      const { data: yearRevenue } = await supabase
        .from('organization_transactions')
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('transaction_type', 'income')
        .in('status', ['completed', 'approved'])
        .gte('transaction_date', yearStart);

      const totalRevenue = yearRevenue?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // This month revenue
      const { data: monthRevenue } = await supabase
        .from('organization_transactions')
        .select('amount')
        .eq('organization_id', organizationId)
        .eq('transaction_type', 'income')
        .in('status', ['completed', 'approved'])
        .gte('transaction_date', monthStart);

      const thisMonth = monthRevenue?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      // Outstanding from member_fees (unpaid fees)
      const { data: outstandingFees } = await supabase
        .from('member_fees')
        .select('amount_due, amount_paid')
        .eq('organization_id', organizationId)
        .eq('status', 'pending');

      const outstanding = outstandingFees?.reduce((sum, f) => 
        sum + (Number(f.amount_due) - Number(f.amount_paid || 0)), 0) || 0;

      // Pending payments count
      const { count: pendingPayments } = await supabase
        .from('member_fees')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'pending');

      // Calculate collection rate (paid / (paid + outstanding))
      const totalExpected = totalRevenue + outstanding;
      const collectionRate = totalExpected > 0 
        ? Math.round((totalRevenue / totalExpected) * 1000) / 10 
        : 0;

      return {
        totalRevenue,
        thisMonth,
        outstanding,
        pendingPayments: pendingPayments || 0,
        collectionRate,
      };
    },
    enabled: !!organizationId,
    staleTime: 60000, // 1 minute
  });
}

export function useRecentPayments(limit: number = 10) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['recent-payments', organizationId, limit],
    queryFn: async (): Promise<Payment[]> => {
      if (!organizationId) return [];
      
      const supabase = assertSupabase();
      
      const { data: transactions, error } = await supabase
        .from('organization_transactions')
        .select(`
          id,
          amount,
          payment_method,
          reference_number,
          transaction_date,
          status,
          description,
          payer_member_id
        `)
        .eq('organization_id', organizationId)
        .eq('transaction_type', 'income')
        .order('transaction_date', { ascending: false })
        .limit(limit);

      if (error || !transactions) {
        console.error('Error fetching payments:', error);
        return [];
      }

      // Get member names
      const memberIds = transactions
        .filter(t => t.payer_member_id)
        .map(t => t.payer_member_id);

      let memberNames: Record<string, string> = {};
      if (memberIds.length > 0) {
        const { data: members } = await supabase
          .from('organization_members')
          .select('id, user_id')
          .in('id', memberIds);

        if (members && members.length > 0) {
          const userIds = members.map(m => m.user_id).filter(Boolean);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);

          if (profiles) {
            const profileMap = profiles.reduce((acc, p) => {
              acc[p.id] = p.full_name || 'Unknown';
              return acc;
            }, {} as Record<string, string>);

            members.forEach(m => {
              if (m.user_id) {
                memberNames[m.id] = profileMap[m.user_id] || 'Unknown';
              }
            });
          }
        }
      }

      return transactions.map(t => ({
        id: t.id,
        member_name: t.payer_member_id 
          ? (memberNames[t.payer_member_id] || 'Unknown Member')
          : (t.description || 'Payment'),
        amount: Number(t.amount),
        payment_method: mapPaymentMethod(t.payment_method),
        reference: t.reference_number || `REF-${t.id.slice(0, 8)}`,
        created_at: t.transaction_date,
        status: mapTransactionStatus(t.status),
      }));
    },
    enabled: !!organizationId,
    staleTime: 30000,
  });
}

export function useOverdueInvoices() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['overdue-invoices', organizationId],
    queryFn: async (): Promise<Invoice[]> => {
      if (!organizationId) return [];
      
      const supabase = assertSupabase();
      const now = new Date().toISOString();
      
      const { data: fees, error } = await supabase
        .from('member_fees')
        .select(`
          id,
          fee_type,
          amount_due,
          amount_paid,
          due_date,
          status,
          member_id,
          member:member_id(
            id,
            member_number,
            user_id
          )
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .lt('due_date', now)
        .order('due_date', { ascending: true })
        .limit(10);

      if (error || !fees) {
        console.error('Error fetching overdue invoices:', error);
        return [];
      }

      // Get user names for members
      const userIds = fees
        .filter(f => (f.member as any)?.user_id)
        .map(f => (f.member as any).user_id);

      let userNames: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        if (profiles) {
          userNames = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || 'Unknown';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return fees.map(f => {
        const member = f.member as any;
        const memberName = member?.user_id 
          ? (userNames[member.user_id] || 'Unknown Member')
          : 'Unknown Member';

        return {
          id: f.id,
          invoice_number: `INV-${f.id.slice(0, 8).toUpperCase()}`,
          member_name: memberName,
          member_number: member?.member_number || 'N/A',
          amount: Number(f.amount_due) - Number(f.amount_paid || 0),
          status: 'overdue' as const,
          due_date: f.due_date,
        };
      });
    },
    enabled: !!organizationId,
    staleTime: 60000,
  });
}

export function useRegionalFinance() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['regional-finance', organizationId],
    queryFn: async (): Promise<RegionFinance[]> => {
      if (!organizationId) return [];
      
      const supabase = assertSupabase();
      
      // Get regions
      const { data: regions, error: regionsError } = await supabase
        .from('organization_regions')
        .select('id, name, code')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (regionsError || !regions || regions.length === 0) {
        return [];
      }

      const regionFinance: RegionFinance[] = [];

      for (const region of regions) {
        // Get total members in region
        const { count: totalMembers } = await supabase
          .from('organization_members')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('region_id', region.id)
          .eq('status', 'active');

        // Get revenue from this region
        const { data: regionTransactions } = await supabase
          .from('organization_transactions')
          .select('amount, status')
          .eq('organization_id', organizationId)
          .eq('region_id', region.id)
          .eq('transaction_type', 'income');

        const collected = regionTransactions
          ?.filter(t => t.status === 'completed' || t.status === 'approved')
          ?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        const pending = regionTransactions
          ?.filter(t => t.status === 'pending')
          ?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        // Estimate members paid (rough calculation based on average fee)
        const avgFee = (totalMembers || 0) > 0 && collected > 0
          ? collected / ((totalMembers || 1) * 0.8) // Assume 80% paid
          : 1200; // Default assumption

        const membersPaid = avgFee > 0 ? Math.min(Math.floor(collected / avgFee), totalMembers || 0) : 0;

        regionFinance.push({
          region: region.name,
          code: region.code || region.name.substring(0, 2).toUpperCase(),
          collected,
          outstanding: pending,
          members_paid: membersPaid,
          total_members: totalMembers || 0,
        });
      }

      // Sort by collected amount descending
      regionFinance.sort((a, b) => b.collected - a.collected);

      return regionFinance;
    },
    enabled: !!organizationId,
    staleTime: 120000, // 2 minutes - this is expensive
  });
}

// Helper functions
function mapPaymentMethod(method: string | null): 'card' | 'eft' | 'cash' | 'payfast' | 'other' {
  if (!method) return 'other';
  const m = method.toLowerCase();
  if (m.includes('card') || m.includes('credit') || m.includes('debit')) return 'card';
  if (m.includes('eft') || m.includes('bank') || m.includes('transfer')) return 'eft';
  if (m.includes('cash')) return 'cash';
  if (m.includes('payfast')) return 'payfast';
  return 'other';
}

function mapTransactionStatus(status: string | null): 'completed' | 'pending' | 'failed' {
  if (!status) return 'pending';
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'approved' || s === 'success') return 'completed';
  if (s === 'failed' || s === 'rejected' || s === 'cancelled') return 'failed';
  return 'pending';
}
