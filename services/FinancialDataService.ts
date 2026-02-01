/**
 * Financial Data Service
 * 
 * Adapts existing database schema (payments + petty_cash_transactions) 
 * for financial dashboard display
 */

import { assertSupabase } from '@/lib/supabase';
import { withPettyCashTenant } from '@/lib/utils/pettyCashTenant';

export interface UnifiedTransaction {
  id: string;
  type: 'revenue' | 'expense' | 'outstanding';
  amount: number;
  description: string;
  status: string;
  date: string;
  reference?: string;
  source: 'payment' | 'petty_cash' | 'financial_txn';
  metadata?: any;
}

export interface FinancialMetrics {
  monthlyRevenue: number;
  outstandingPayments: number;
  monthlyExpenses: number;
  netIncome: number;
  paymentCompletionRate: number;
  totalStudents: number;
  averageFeePerStudent: number;
}

export interface MonthlyTrendData {
  month: string;
  revenue: number;
  expenses: number;
  netIncome: number;
}

export interface DateRange {
  from: string; // ISO
  to: string;   // ISO
}

export interface TransactionRecord {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string; // ISO
  status: 'completed' | 'pending' | 'overdue' | 'approved' | 'rejected';
  // Optional enrichments
  reference?: string | null;
  attachmentUrl?: string | null; // For payments POP/attachments
  receiptUrl?: string | null;    // For petty cash single URL
  receiptCount?: number;         // Count from petty_cash_receipts
  hasReceipt?: boolean;          // True if any receipt evidence present
  source?: 'payment' | 'petty_cash' | 'financial_txn';
}

export interface FinanceOverviewData {
  revenueMonthly: number[]; // last 12 months
  expensesMonthly: number[]; // last 12 months
  categoriesBreakdown: { name: string; value: number }[];
  keyMetrics: {
    monthlyRevenue: number;
    monthlyExpenses: number;
    cashFlow: number;
  };
  // Indicates that the service returned fallback sample data (not live DB data)
  isSample?: boolean;
}

export class FinancialDataService {
  /**
   * Get financial metrics for a preschool
   */
  static async getFinancialMetrics(preschoolId: string): Promise<FinancialMetrics> {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const monthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
      const nextMonthStart = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`;

      // Get monthly revenue from completed payments
      const { data: revenuePayments, error: revenueError } = await assertSupabase()
        .from('payments')
        .select('amount')
        .eq('preschool_id', preschoolId)
        .in('status', ['completed', 'approved'])
        .gte('created_at', monthStart)
        .lt('created_at', nextMonthStart);

      if (revenueError) {
        console.error('Error fetching revenue:', revenueError);
      }

      const monthlyRevenue = revenuePayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      // Get outstanding payments
      const { data: outstandingPayments, error: outstandingError } = await assertSupabase()
        .from('payments')
        .select('amount')
        .eq('preschool_id', preschoolId)
        .in('status', ['pending', 'proof_submitted', 'under_review']);

      if (outstandingError) {
        console.error('Error fetching outstanding:', outstandingError);
      }

      const totalOutstanding = outstandingPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      // Get monthly expenses from petty cash
      const { data: expenseTransactions, error: expenseError } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .select('amount')
          .eq(column, preschoolId)
          .eq('type', 'expense')
          .in('status', ['approved', 'pending']) // Include pending for current spending
          .gte('created_at', monthStart)
          .lt('created_at', nextMonthStart)
      );

      if (expenseError) {
        console.error('Error fetching expenses:', expenseError);
      }

let monthlyExpenses = expenseTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

      // Include other expense sources from financial_transactions (completed/approved) for current month
      try {
        const { data: otherExpTx } = await assertSupabase()
          .from('financial_transactions')
          .select('amount, type, status, created_at')
          .eq('preschool_id', preschoolId)
          .in('type', ['expense','operational_expense','salary','purchase'])
          .in('status', ['approved','completed'])
          .gte('created_at', monthStart)
          .lt('created_at', nextMonthStart);
        const otherExp = (otherExpTx || []).reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount) || 0), 0);
        monthlyExpenses += otherExp;
      } catch { /* Intentional: non-fatal */ }

      // Get student count
      const { count: studentCount } = await assertSupabase()
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('preschool_id', preschoolId)
        .eq('is_active', true);

      // Calculate metrics
      const netIncome = monthlyRevenue - monthlyExpenses;
      const totalPaymentVolume = monthlyRevenue + totalOutstanding;
      const paymentCompletionRate = totalPaymentVolume > 0 ? (monthlyRevenue / totalPaymentVolume) * 100 : 0;
      const averageFeePerStudent = studentCount && studentCount > 0 ? monthlyRevenue / studentCount : 0;

      return {
        monthlyRevenue,
        outstandingPayments: totalOutstanding,
        monthlyExpenses,
        netIncome,
        paymentCompletionRate,
        totalStudents: studentCount || 0,
        averageFeePerStudent
      };

    } catch (error) {
      console.error('Error calculating financial metrics:', error);
      
      // Return sample data as fallback
      return {
        monthlyRevenue: 15000,
        outstandingPayments: 2500,
        monthlyExpenses: 8500,
        netIncome: 6500,
        paymentCompletionRate: 85.7,
        totalStudents: 25,
        averageFeePerStudent: 600
      };
    }
  }

  /**
   * Get monthly trend data for the last 6 months
   */
  static async getMonthlyTrendData(preschoolId: string): Promise<MonthlyTrendData[]> {
    try {
      const trendData: MonthlyTrendData[] = [];

      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const monthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
        const nextMonthStart = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;

        // Get revenue for this month
        const { data: monthlyRevenue } = await assertSupabase()
          .from('payments')
          .select('amount')
          .eq('preschool_id', preschoolId)
          .in('status', ['completed', 'approved'])
          .gte('created_at', monthStart)
          .lt('created_at', nextMonthStart);

        // Get expenses for this month
        const { data: monthlyExpenses } = await withPettyCashTenant((column, client) =>
          client
            .from('petty_cash_transactions')
            .select('amount')
            .eq(column, preschoolId)
            .eq('type', 'expense')
            .eq('status', 'approved')
            .gte('created_at', monthStart)
            .lt('created_at', nextMonthStart)
        );

        const revenue = monthlyRevenue?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
const petty = monthlyExpenses?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
let otherExp = 0;
try {
  const { data: monthOther } = await assertSupabase()
    .from('financial_transactions')
    .select('amount, type, status, created_at')
    .eq('preschool_id', preschoolId)
    .in('type', ['expense','operational_expense','salary','purchase'])
    .in('status', ['approved','completed'])
    .gte('created_at', monthStart)
    .lt('created_at', nextMonthStart);
  otherExp = (monthOther || []).reduce((s: number, t: any) => s + Math.abs(Number(t.amount) || 0), 0);
} catch { /* Intentional: non-fatal */ }
const expenses = petty + otherExp;

        trendData.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          revenue,
          expenses,
          netIncome: revenue - expenses
        });
      }

      return trendData;

    } catch (error) {
      console.error('Error fetching trend data:', error);
      
      // Return sample trend data as fallback
      return [
        { month: 'Aug', revenue: 12000, expenses: 7500, netIncome: 4500 },
        { month: 'Sep', revenue: 14000, expenses: 8200, netIncome: 5800 },
        { month: 'Oct', revenue: 13500, expenses: 8000, netIncome: 5500 },
        { month: 'Nov', revenue: 15200, expenses: 8500, netIncome: 6700 },
        { month: 'Dec', revenue: 14800, expenses: 8300, netIncome: 6500 },
        { month: 'Jan', revenue: 15000, expenses: 8500, netIncome: 6500 }
      ];
    }
  }

  /**
   * Get recent transactions (combined from payments and petty cash)
   */
  static async getRecentTransactions(preschoolId: string, limit: number = 10): Promise<UnifiedTransaction[]> {
    try {
      const transactions: UnifiedTransaction[] = [];

      // Get recent payments
const { data: payments, error: paymentsError } = await assertSupabase()
        .from('payments')
        .select(`
          id,
          amount,
          description,
          status,
          created_at,
          payment_reference,
          metadata,
          students!inner(first_name, last_name)
        `)
        .eq('preschool_id', preschoolId)
        .order('created_at', { ascending: false })
        .limit(Math.ceil(limit / 2));

      if (!paymentsError && payments) {
(payments || []).forEach((payment: any) => {
          const studentData = Array.isArray(payment.students) ? payment.students[0] : payment.students;
          const studentName = studentData 
            ? `${studentData.first_name} ${studentData.last_name}`
            : 'Student';
          
          transactions.push({
            id: payment.id,
            type: payment.status === 'completed' || payment.status === 'approved' ? 'revenue' : 'outstanding',
            amount: payment.amount || 0,
            description: payment.description || `Payment from ${studentName}`,
            status: payment.status,
            date: payment.created_at,
            reference: payment.payment_reference,
            source: 'payment',
            metadata: payment.metadata
          });
        });
      }

      // Get recent petty cash transactions
const { data: pettyCash, error: pettyCashError } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .select('id, amount, description, status, created_at, receipt_number, receipt_url, category, type')
          .eq(column, preschoolId)
          .order('created_at', { ascending: false })
          .limit(Math.ceil(limit / 2))
      );

      if (!pettyCashError && pettyCash) {
(pettyCash || []).forEach((transaction: any) => {
          transactions.push({
            id: transaction.id,
            type: 'expense',
            amount: Math.abs(transaction.amount),
            description: transaction.description,
            status: transaction.status,
            date: transaction.created_at,
            reference: transaction.receipt_number,
            source: 'petty_cash',
            metadata: { category: transaction.category, type: transaction.type }
          });
        });
      }

      // Sort by date and limit results
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return transactions.slice(0, limit);

    } catch (error) {
      console.error('Error fetching recent transactions:', error);
      
      // Return sample data as fallback
      return [{
        id: 'sample-1',
        type: 'revenue',
        amount: 1500,
        description: 'Monthly tuition payment - Sample Student',
        status: 'completed',
        date: new Date().toISOString(),
        source: 'payment'
      }];
    }
  }

  /**
   * Get financial overview data for dashboard
   */
  static async getOverview(preschoolId?: string): Promise<FinanceOverviewData> {
    try {
      const now = new Date();
      const expenseTypes = ['expense', 'operational_expense', 'salary', 'purchase'] as const;
      const expenseStatuses = ['approved', 'completed'] as const;
      const revenueStatuses = ['completed', 'approved'] as const;

      const formatMonthKey = (date: Date): string =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const monthWindows: { key: string; start: Date; end: Date }[] = [];
      for (let i = 11; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        monthWindows.push({ key: formatMonthKey(start), start, end });
      }

      const monthIndexByKey = new Map<string, number>(
        monthWindows.map((window, index) => [window.key, index])
      );

      const revenueMonthly = monthWindows.map(() => 0);
      const expensesMonthly = monthWindows.map(() => 0);
      const categoriesMap = new Map<string, number>();

      const rangeStartIso = monthWindows[0]?.start.toISOString();
      const rangeEndIso = monthWindows[monthWindows.length - 1]?.end.toISOString();

      if (!rangeStartIso || !rangeEndIso) {
        throw new Error('Failed to compute financial overview date range');
      }

      let paymentsQuery = assertSupabase()
        .from('payments')
        .select('amount, created_at')
        .in('status', revenueStatuses as unknown as string[])
        .gte('created_at', rangeStartIso)
        .lt('created_at', rangeEndIso);

      if (preschoolId) {
        paymentsQuery = paymentsQuery.eq('preschool_id', preschoolId);
      }

      const pettyCashResult = await withPettyCashTenant((column, client) => {
        let query = client
          .from('petty_cash_transactions')
          .select('amount, created_at, category')
          .eq('type', 'expense')
          .in('status', expenseStatuses as unknown as string[])
          .gte('created_at', rangeStartIso)
          .lt('created_at', rangeEndIso);
        if (preschoolId) {
          query = query.eq(column, preschoolId);
        }
        return query;
      });

      let financialExpenseQuery = assertSupabase()
        .from('financial_transactions')
        .select(`
          amount,
          created_at,
          type,
          expense_categories(name)
        `)
        .in('type', expenseTypes as unknown as string[])
        .in('status', expenseStatuses as unknown as string[])
        .gte('created_at', rangeStartIso)
        .lt('created_at', rangeEndIso);

      if (preschoolId) {
        financialExpenseQuery = financialExpenseQuery.eq('preschool_id', preschoolId);
      }

      const [paymentsResult, financialExpenseResult] = await Promise.allSettled([
        paymentsQuery,
        financialExpenseQuery,
      ]);

      type PaymentRow = { amount: number | null; created_at: string | null };
      type PettyCashRow = { amount: number | null; created_at: string | null; category: string | null };
      type ExpenseCategoryRow = { name?: string | null } | null;
      type FinancialExpenseRow = {
        amount: number | null;
        created_at: string | null;
        type: string | null;
        expense_categories?: ExpenseCategoryRow[] | ExpenseCategoryRow;
      };

      const toMonthIndex = (createdAt: string | null): number | null => {
        if (!createdAt) return null;
        const date = new Date(createdAt);
        if (Number.isNaN(date.getTime())) return null;
        const key = formatMonthKey(date);
        const index = monthIndexByKey.get(key);
        return index === undefined ? null : index;
      };

      const paymentsData: PaymentRow[] = paymentsResult.status === 'fulfilled'
        ? (paymentsResult.value.data as PaymentRow[] | null) || []
        : [];
      const pettyCashData: PettyCashRow[] = (pettyCashResult.data as PettyCashRow[] | null) || [];
      const financialExpenseData: FinancialExpenseRow[] = financialExpenseResult.status === 'fulfilled'
        ? (financialExpenseResult.value.data as FinancialExpenseRow[] | null) || []
        : [];

      paymentsData.forEach((payment) => {
        const monthIndex = toMonthIndex(payment.created_at);
        if (monthIndex === null) return;
        revenueMonthly[monthIndex] += Number(payment.amount) || 0;
      });

      pettyCashData.forEach((expense) => {
        const monthIndex = toMonthIndex(expense.created_at);
        if (monthIndex === null) return;
        const amount = Math.abs(Number(expense.amount) || 0);
        expensesMonthly[monthIndex] += amount;

        const categoryName = expense.category || 'Other';
        categoriesMap.set(categoryName, (categoriesMap.get(categoryName) || 0) + amount);
      });

      financialExpenseData.forEach((expense) => {
        const monthIndex = toMonthIndex(expense.created_at);
        if (monthIndex === null) return;
        const amount = Math.abs(Number(expense.amount) || 0);
        expensesMonthly[monthIndex] += amount;

        const categoryData = Array.isArray(expense.expense_categories)
          ? expense.expense_categories[0]
          : expense.expense_categories;
        const categoryName = categoryData?.name || expense.type || 'Expense';
        categoriesMap.set(categoryName, (categoriesMap.get(categoryName) || 0) + amount);
      });

      const categoriesBreakdown = Array.from(categoriesMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      const currentRevenue = revenueMonthly[revenueMonthly.length - 1] || 0;
      const currentExpenses = expensesMonthly[expensesMonthly.length - 1] || 0;

      return {
        revenueMonthly,
        expensesMonthly,
        categoriesBreakdown,
        keyMetrics: {
          monthlyRevenue: currentRevenue,
          monthlyExpenses: currentExpenses,
          cashFlow: currentRevenue - currentExpenses,
        },
        isSample: false,
      };
      
    } catch (error) {
      console.error('Error fetching financial overview:', error);
      
      // Return fallback data
      return {
        revenueMonthly: Array(12).fill(0).map(() => Math.floor(Math.random() * 50000) + 20000),
        expensesMonthly: Array(12).fill(0).map(() => Math.floor(Math.random() * 30000) + 10000),
        categoriesBreakdown: [
          { name: 'Supplies', value: 8500 },
          { name: 'Maintenance', value: 6200 },
          { name: 'Utilities', value: 4800 },
          { name: 'Other', value: 3200 },
        ],
        keyMetrics: {
          monthlyRevenue: 45000,
          monthlyExpenses: 22500,
          cashFlow: 22500,
        },
        isSample: true,
      };
    }
  }

  /**
   * Get transactions within a date range (for financial transactions screen)
   */
  static async getTransactions(dateRange: DateRange, preschoolId?: string): Promise<TransactionRecord[]> {
    try {
      const transactions: TransactionRecord[] = [];

      console.log('[FinancialDataService] getTransactions called with:', {
        dateRange,
        preschoolId,
      });

      // Get payments within date range
      // Use LEFT JOIN (no !inner) so payments without students still return
      let paymentsQuery = assertSupabase()
        .from('payments')
        .select(`
          id,
          amount,
          description,
          status,
          created_at,
          payment_reference,
          attachment_url,
          student_id,
          students(first_name, last_name)
        `)
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)
        .order('created_at', { ascending: false });

      if (preschoolId) {
        paymentsQuery = paymentsQuery.eq('preschool_id', preschoolId);
      }

      const { data: payments, error: paymentsError } = await paymentsQuery;

      console.log('[FinancialDataService] Payments query result:', {
        count: payments?.length ?? 0,
        error: paymentsError?.message,
        preschoolId,
      });

      if (paymentsError) {
        console.error('Error fetching payments for transactions:', paymentsError);
      } else if (payments) {
        payments.forEach((payment: any) => {
          const studentData = Array.isArray(payment.students) ? payment.students[0] : payment.students;
          const studentName = studentData 
            ? `${studentData.first_name} ${studentData.last_name}`
            : 'Student';
          
          transactions.push({
            id: payment.id,
            type: 'income',
            category: 'Tuition',
            amount: payment.amount || 0,
            description: payment.description || `Payment from ${studentName}`,
            date: payment.created_at,
            status: this.mapPaymentStatus(payment.status),
            reference: payment.payment_reference ?? null,
            attachmentUrl: payment.attachment_url ?? null,
            source: 'payment',
          });
        });
      }

      // Get petty cash transactions within date range
      const { data: pettyCash, error: pettyCashError } = await withPettyCashTenant((column, client) => {
        let query = client
          .from('petty_cash_transactions')
          .select('id, amount, description, status, created_at, category, type, receipt_url, receipt_number, reference_number')
          .gte('created_at', dateRange.from)
          .lte('created_at', dateRange.to)
          .order('created_at', { ascending: false });
        if (preschoolId) {
          query = query.eq(column, preschoolId);
        }
        return query;
      });

      console.log('[FinancialDataService] Petty cash query result:', {
        count: pettyCash?.length ?? 0,
        error: pettyCashError?.message,
        preschoolId,
      });

      if (pettyCashError) {
        console.error('Error fetching petty cash for transactions:', pettyCashError);
      } else if (pettyCash) {
        // Build receipt counts per transaction from petty_cash_receipts
        let receiptsMap = new Map<string, number>();
        try {
          const pettyCashIds = pettyCash.map((t: any) => t.id);
          if (pettyCashIds.length) {
            const { data: receipts } = await withPettyCashTenant((column, client) => {
              let query = client
                .from('petty_cash_receipts')
                .select('transaction_id');
              if (preschoolId) {
                query = query.eq(column, preschoolId);
              }
              return query.in('transaction_id', pettyCashIds);
            });
            (receipts || []).forEach((r: any) => {
              receiptsMap.set(r.transaction_id, (receiptsMap.get(r.transaction_id) || 0) + 1);
            });
          }
        } catch (err) {
          console.warn('Failed to fetch petty cash receipts:', err);
        }

        pettyCash.forEach((transaction: any) => {
          const count = receiptsMap.get(transaction.id) || 0;
          const receiptUrl = transaction.receipt_url ?? null;
          transactions.push({
            id: transaction.id,
            type: 'expense',
            category: transaction.category || 'Other',
            amount: Math.abs(transaction.amount),
            description: transaction.description,
            date: transaction.created_at,
            status: this.mapPettyCashStatus(transaction.status),
            reference: transaction.receipt_number ?? transaction.reference_number ?? null,
            receiptUrl,
            receiptCount: count,
            hasReceipt: Boolean(receiptUrl) || count > 0,
            source: 'petty_cash',
          });
        });
      }

      // Include financial transactions (expenses) within date range
      // Note: financial_transactions uses expense_category_id, not category
      try {
        let finQuery = assertSupabase()
          .from('financial_transactions')
          .select(`
            id, 
            amount, 
            description, 
            status, 
            created_at, 
            type,
            expense_category_id,
            expense_categories(name)
          `)
          .gte('created_at', dateRange.from)
          .lte('created_at', dateRange.to)
          .order('created_at', { ascending: false });
        if (preschoolId) {
          finQuery = finQuery.eq('preschool_id', preschoolId);
        }
        const { data: finTx, error: finError } = await finQuery;
        
        console.log('[FinancialDataService] Financial transactions query result:', {
          count: finTx?.length ?? 0,
          error: finError?.message,
          preschoolId,
        });
        
        (finTx || []).forEach((txn: any) => {
          const lowerType = String(txn.type || '').toLowerCase();
          const isExpense = lowerType.includes('expense') || Number(txn.amount) < 0;
          // Get category name from joined expense_categories or use type as fallback
          const categoryData = Array.isArray(txn.expense_categories) 
            ? txn.expense_categories[0] 
            : txn.expense_categories;
          const categoryName = categoryData?.name || txn.type || 'Expense';
          
          if (isExpense) {
            transactions.push({
              id: txn.id,
              type: 'expense',
              category: categoryName,
              amount: Math.abs(Number(txn.amount) || 0),
              description: txn.description || 'Expense',
              date: txn.created_at,
              status: this.mapPettyCashStatus(txn.status),
              source: 'financial_txn',
            });
          }
        });
      } catch (err) { 
        console.error('[FinancialDataService] Error fetching financial_transactions:', err);
      }

      // Sort by date (newest first)
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      console.log('[FinancialDataService] Total transactions returned:', transactions.length);
      
      return transactions;

    } catch (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
  }

  /**
   * Map payment status to transaction status
   */
  private static mapPaymentStatus(status: string): 'completed' | 'pending' | 'overdue' | 'approved' | 'rejected' {
    switch (status) {
      case 'completed':
      case 'approved':
        return 'completed';
      case 'pending':
      case 'proof_submitted':
      case 'under_review':
        return 'pending';
      case 'failed':
      case 'rejected':
      case 'reversed':
      case 'voided':
      case 'cancelled':
        return 'rejected';
      case 'overdue':
        return 'overdue';
      default:
        return 'pending';
    }
  }

  /**
   * Map petty cash status to transaction status
   */
  private static mapPettyCashStatus(status: string): 'completed' | 'pending' | 'overdue' | 'approved' | 'rejected' {
    switch (status) {
      case 'approved':
        return 'completed';
      case 'pending':
        return 'pending';
      case 'rejected':
        return 'rejected';
      default:
        return 'pending';
    }
  }

  /**
   * Format currency for display
   */
  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(amount);
  }

  /**
   * Get status color for display
   */
  static getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'approved':
        return '#10B981';
      case 'pending':
      case 'proof_submitted':
      case 'under_review':
        return '#F59E0B';
      case 'failed':
      case 'rejected':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  }

  /**
   * Get display-friendly status text
   */
  static getDisplayStatus(status: string): string {
    switch (status.toLowerCase()) {
      case 'proof_submitted':
        return 'Proof Submitted';
      case 'under_review':
        return 'Under Review';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  }
}
