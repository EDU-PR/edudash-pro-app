/**
 * usePrincipalFinancials Hook
 * 
 * Comprehensive financial data for principal dashboard
 * Aggregates registration fees, school fees, payments, and expenses
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface PrincipalFinancials {
  // Registration fees
  registrationFeesCollected: number;
  pendingRegistrationFees: number;
  registrationFeeCount: number;
  
  // Monthly school fees
  monthlyFeesCollected: number;
  outstandingSchoolFees: number;
  overdueFeesCount: number;
  
  // General payments
  paymentsThisMonth: number;
  pendingPOPReviews: number;
  
  // Expenses
  expensesThisMonth: number;
  
  // Calculated
  totalRevenueThisMonth: number;
  netIncomeThisMonth: number;
  collectionRate: number;
  
  // Breakdowns
  feeTypeBreakdown: {
    type: string;
    collected: number;
    outstanding: number;
  }[];
  
  // Trends
  monthlyTrend: {
    month: string;
    revenue: number;
    expenses: number;
  }[];
}

export interface UsePrincipalFinancialsReturn {
  data: PrincipalFinancials | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePrincipalFinancials(preschoolId: string | undefined): UsePrincipalFinancialsReturn {
  const [data, setData] = useState<PrincipalFinancials | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchFinancials = useCallback(async () => {
    if (!preschoolId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const currentDate = new Date();
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();

      // 1. Registration fees from registration_requests
      const { data: registrations } = await supabase
        .from('registration_requests')
        .select('id, registration_fee_amount, registration_fee_paid, payment_verified, status, created_at')
        .eq('organization_id', preschoolId);

      const paidRegistrations = registrations?.filter(r => 
        r.payment_verified && r.status === 'approved'
      ) || [];
      const pendingRegistrations = registrations?.filter(r => 
        !r.payment_verified && r.registration_fee_amount && r.status !== 'rejected'
      ) || [];

      const registrationFeesCollected = paidRegistrations.reduce(
        (sum, r) => sum + (parseFloat(r.registration_fee_amount as any) || 0), 0
      );
      const pendingRegistrationFees = pendingRegistrations.reduce(
        (sum, r) => sum + (parseFloat(r.registration_fee_amount as any) || 0), 0
      );

      // 2. Student fees from student_fees table
      const { data: studentFees } = await supabase
        .from('student_fees')
        .select(`
          id, amount, status, fee_type, due_date, paid_date,
          students!inner(preschool_id)
        `)
        .eq('students.preschool_id', preschoolId);

      const paidFees = studentFees?.filter(f => f.status === 'paid') || [];
      const outstandingFees = studentFees?.filter(f => 
        f.status === 'pending' || f.status === 'overdue'
      ) || [];
      const overdueFees = studentFees?.filter(f => f.status === 'overdue') || [];

      // Calculate monthly fees (paid this month)
      const monthlyFeesCollected = paidFees
        .filter(f => {
          if (!f.paid_date) return false;
          const paidDate = new Date(f.paid_date);
          return paidDate >= new Date(monthStart) && paidDate <= new Date(monthEnd);
        })
        .reduce((sum, f) => sum + (f.amount || 0), 0);

      const outstandingSchoolFees = outstandingFees.reduce((sum, f) => sum + (f.amount || 0), 0);

      // 3. General payments this month
      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount, status, created_at')
        .eq('preschool_id', preschoolId)
        .in('status', ['completed', 'approved'])
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      const paymentsThisMonth = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      // 4. POP uploads pending review
      const { count: pendingPOPReviews } = await supabase
        .from('pop_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .eq('status', 'pending');

      // 5. Expenses from petty cash
      const { data: expenses } = await supabase
        .from('petty_cash_transactions')
        .select('id, amount, type, status, created_at')
        .eq('school_id', preschoolId)
        .eq('type', 'expense')
        .in('status', ['approved', 'completed'])
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      const expensesThisMonth = expenses?.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0) || 0;

      // 6. Fee type breakdown
      const feeTypeBreakdown = calculateFeeTypeBreakdown(studentFees || []);

      // 7. Monthly trend (last 6 months)
      const monthlyTrend = await fetchMonthlyTrend(supabase, preschoolId);

      // Calculate totals
      const totalRevenueThisMonth = registrationFeesCollected + monthlyFeesCollected + paymentsThisMonth;
      const netIncomeThisMonth = totalRevenueThisMonth - expensesThisMonth;
      const totalExpected = totalRevenueThisMonth + pendingRegistrationFees + outstandingSchoolFees;
      const collectionRate = totalExpected > 0 ? (totalRevenueThisMonth / totalExpected) * 100 : 0;

      setData({
        registrationFeesCollected,
        pendingRegistrationFees,
        registrationFeeCount: paidRegistrations.length,
        monthlyFeesCollected,
        outstandingSchoolFees,
        overdueFeesCount: overdueFees.length,
        paymentsThisMonth,
        pendingPOPReviews: pendingPOPReviews || 0,
        expensesThisMonth,
        totalRevenueThisMonth,
        netIncomeThisMonth,
        collectionRate,
        feeTypeBreakdown,
        monthlyTrend,
      });
    } catch (err: any) {
      console.error('Error fetching principal financials:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [preschoolId, supabase]);

  useEffect(() => {
    fetchFinancials();
  }, [fetchFinancials]);

  return {
    data,
    loading,
    error,
    refresh: fetchFinancials,
  };
}

function calculateFeeTypeBreakdown(fees: any[]): PrincipalFinancials['feeTypeBreakdown'] {
  const breakdown: Record<string, { collected: number; outstanding: number }> = {};

  fees.forEach(fee => {
    const type = fee.fee_type || 'other';
    if (!breakdown[type]) {
      breakdown[type] = { collected: 0, outstanding: 0 };
    }

    if (fee.status === 'paid') {
      breakdown[type].collected += fee.amount || 0;
    } else if (fee.status === 'pending' || fee.status === 'overdue') {
      breakdown[type].outstanding += fee.amount || 0;
    }
  });

  return Object.entries(breakdown).map(([type, data]) => ({
    type: formatFeeType(type),
    collected: data.collected,
    outstanding: data.outstanding,
  }));
}

function formatFeeType(type: string): string {
  const labels: Record<string, string> = {
    registration: 'Registration',
    tuition: 'Tuition',
    monthly_tuition: 'Monthly Tuition',
    materials: 'Materials',
    transport: 'Transport',
    meals: 'Meals',
    activities: 'Activities',
    other: 'Other',
  };
  return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function fetchMonthlyTrend(
  supabase: ReturnType<typeof createClient>,
  preschoolId: string
): Promise<PrincipalFinancials['monthlyTrend']> {
  const trend: PrincipalFinancials['monthlyTrend'] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const month = date.getMonth();
    const year = date.getFullYear();
    const monthStart = new Date(year, month, 1).toISOString();
    const monthEnd = new Date(year, month + 1, 0).toISOString();

    // Get revenue
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('preschool_id', preschoolId)
      .in('status', ['completed', 'approved'])
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd);

    const revenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // Get expenses
    const { data: expenses } = await supabase
      .from('petty_cash_transactions')
      .select('amount')
      .eq('school_id', preschoolId)
      .eq('type', 'expense')
      .in('status', ['approved', 'completed'])
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd);

    const expenseTotal = expenses?.reduce((sum, e) => sum + Math.abs(e.amount || 0), 0) || 0;

    trend.push({
      month: `${monthNames[month]} ${year}`,
      revenue,
      expenses: expenseTotal,
    });
  }

  return trend;
}
