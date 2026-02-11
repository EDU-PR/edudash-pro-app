/**
 * Financial Data Service
 * 
 * Adapts existing database schema (payments + petty_cash_transactions) 
 * for financial dashboard display
 */

import { assertSupabase } from '@/lib/supabase';
import { FINANCE_MONTH_CUTOFF_DAY } from '@/lib/config/finance';
import { withPettyCashTenant } from '@/lib/utils/pettyCashTenant';
import {
  inferFeeCategoryCode,
  inferPaymentCategory,
  isTuitionFee,
  isUniformFee,
} from '@/lib/utils/feeUtils';
import { normalizePaymentMethodCode } from '@/lib/utils/paymentMethod';
import { isLikelyUtcMonthBoundaryShift, parseDateValue } from '@/lib/utils/dateUtils';
import { PayrollService } from '@/services/PayrollService';
import type {
  ApprovePopPaymentPayload,
  FinanceControlCenterBundle,
  FinanceMonthExpenseBreakdown,
  FinanceMonthSnapshot,
  FinanceReceivableStudentRow,
  FinanceReceivablesSummary,
} from '@/types/finance';

type FinanceTenantColumn = 'preschool_id' | 'organization_id' | 'school_id';

const PRIMARY_FINANCE_COLUMN: FinanceTenantColumn = 'preschool_id';
const SECONDARY_FINANCE_COLUMN: FinanceTenantColumn = 'organization_id';
const FALLBACK_FINANCE_COLUMN: FinanceTenantColumn = 'school_id';

const isMissingFinanceColumnError = (error: any, column: FinanceTenantColumn): boolean => {
  if (!error) return false;
  if (error?.code === '42703') return true;
  const message = String(error?.message || '').toLowerCase();
  return message.includes(column) && message.includes('does not exist');
};

const isMissingFinanceTenantColumn = (error: any): boolean =>
  isMissingFinanceColumnError(error, 'preschool_id') ||
  isMissingFinanceColumnError(error, 'organization_id') ||
  isMissingFinanceColumnError(error, 'school_id');

async function withFinanceTenant<T>(
  buildQuery: (column: FinanceTenantColumn) => PromiseLike<{ data: T | null; error: any; count?: number | null }>
): Promise<{ data: T | null; error: any; count?: number | null; column: FinanceTenantColumn }> {
  const primary = await buildQuery(PRIMARY_FINANCE_COLUMN);
  if (primary?.error && isMissingFinanceColumnError(primary.error, PRIMARY_FINANCE_COLUMN)) {
    const secondary = await buildQuery(SECONDARY_FINANCE_COLUMN);
    if (secondary?.error && isMissingFinanceColumnError(secondary.error, SECONDARY_FINANCE_COLUMN)) {
      const fallback = await buildQuery(FALLBACK_FINANCE_COLUMN);
      return { ...fallback, column: FALLBACK_FINANCE_COLUMN };
    }
    return { ...secondary, column: SECONDARY_FINANCE_COLUMN };
  }
  return { ...primary, column: PRIMARY_FINANCE_COLUMN };
}

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
  receiptUrl?: string | null;    // For petty cash or payment receipts
  receiptStoragePath?: string | null; // For payments with stored PDF path
  receiptCount?: number;         // Count from petty_cash_receipts
  hasReceipt?: boolean;          // True if any receipt evidence present
  source?: 'payment' | 'petty_cash' | 'financial_txn';
  paidDate?: string | null;
  dueDate?: string | null;
  isAdvancePayment?: boolean;
  feeIds?: string[] | null;
  feeLabels?: string[];
  feeSummary?: string | null;
  paymentMethod?: string | null;
  studentId?: string | null;
  parentId?: string | null;
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

export interface FinanceMonthPaymentBreakdown {
  month: string;
  total_collected: number;
  categories: Array<{
    category_code: string;
    amount: number;
    count: number;
  }>;
  methods: Array<{
    payment_method: string;
    amount: number;
    count: number;
  }>;
  purposes: Array<{
    purpose: string;
    amount: number;
    count: number;
  }>;
}

export class FinancialDataService {
  private static CATEGORY_LABELS: Record<string, string> = {
    tuition: 'Tuition',
    registration: 'Registration',
    uniform: 'Uniform',
    aftercare: 'Aftercare',
    transport: 'Transport',
    meal: 'Meals',
    ad_hoc: 'Other',
  };

  private static monthStartIsoFromDate(
    date: Date,
    options?: { shiftToNextMonth?: boolean },
  ): string {
    const normalized = options?.shiftToNextMonth
      ? new Date(date.getFullYear(), date.getMonth() + 1, 1)
      : new Date(date.getFullYear(), date.getMonth(), 1);
    return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private static monthStartIsoWithCutoff(
    value?: string | null,
    options?: { recoverUtcMonthBoundary?: boolean; applyCutoff?: boolean },
  ): string | null {
    if (!value) return null;
    const parsed = parseDateValue(value);
    if (!parsed) return null;
    const shouldRecover = Boolean(options?.recoverUtcMonthBoundary) &&
      isLikelyUtcMonthBoundaryShift(value, parsed);
    if (shouldRecover) {
      return this.monthStartIsoFromDate(parsed, { shiftToNextMonth: true });
    }
    const shouldShiftByCutoff = Boolean(options?.applyCutoff) &&
      parsed.getDate() >= FINANCE_MONTH_CUTOFF_DAY;
    return this.monthStartIsoFromDate(parsed, { shiftToNextMonth: shouldShiftByCutoff });
  }

  private static monthStartIsoFromValue(
    value?: string | null,
    options?: { recoverUtcMonthBoundary?: boolean },
  ): string | null {
    return this.monthStartIsoWithCutoff(value, {
      recoverUtcMonthBoundary: options?.recoverUtcMonthBoundary,
      applyCutoff: false,
    });
  }

  private static normalizeMonthIso(value?: string): string {
    const fallbackNow = new Date();
    return this.monthStartIsoFromValue(value || fallbackNow.toISOString()) ||
      `${fallbackNow.getFullYear()}-${String(fallbackNow.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private static nextMonthIso(monthIso: string): string {
    const base = new Date(monthIso);
    const date = Number.isNaN(base.getTime()) ? new Date() : base;
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private static normalizeReference(value?: string | null): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  private static normalizePurposeLabel(raw: unknown): string {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) return 'General';
    if (value.includes('tuition') || value === 'fees' || value.includes('school fee')) return 'Tuition';
    if (value.includes('registration') || value.includes('admission') || value.includes('enrol')) return 'Registration';
    if (value.includes('uniform')) return 'Uniform';
    if (value.includes('aftercare')) return 'Aftercare';
    if (value.includes('transport') || value.includes('bus') || value.includes('shuttle')) return 'Transport';
    if (value.includes('meal') || value.includes('food') || value.includes('lunch') || value.includes('snack')) return 'Meals';
    if (value.includes('book') || value.includes('stationery') || value.includes('material')) return 'Learning Materials';
    if (value.includes('trip') || value.includes('excursion') || value.includes('event')) return 'Excursions & Events';
    return value
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private static resolvePaymentPurposeLabel(payment: any): string {
    const metadata = payment?.metadata && typeof payment.metadata === 'object'
      ? payment.metadata
      : {};
    const categoryCode = inferFeeCategoryCode(
      payment?.category_code ||
      metadata?.category_code ||
      metadata?.fee_category ||
      metadata?.category ||
      payment?.description ||
      metadata?.payment_context ||
      'tuition',
    );
    const categoryLabel = this.CATEGORY_LABELS[categoryCode];
    if (categoryLabel) return categoryLabel;
    const firstCandidate = [
      metadata?.payment_context,
      metadata?.payment_purpose,
      metadata?.purpose,
      metadata?.fee_type,
      payment?.description,
    ].find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
    return this.normalizePurposeLabel(firstCandidate || categoryCode);
  }

  private static resolvePopPurposeLabel(upload: any): string {
    const categoryCode = inferFeeCategoryCode(
      upload?.category_code ||
      upload?.description ||
      upload?.title ||
      'tuition',
    );
    const categoryLabel = this.CATEGORY_LABELS[categoryCode];
    if (categoryLabel) return categoryLabel;
    return this.normalizePurposeLabel(upload?.description || upload?.title || 'General');
  }

  private static resolvePaymentAccountingMonth(payment: any): string | null {
    const metadata = payment?.metadata && typeof payment.metadata === 'object'
      ? payment.metadata
      : {};
    const explicitValues: Array<{ value: string | null | undefined; recoverUtcMonthBoundary?: boolean }> = [
      { value: metadata?.payment_for_month, recoverUtcMonthBoundary: true },
      { value: metadata?.billing_month, recoverUtcMonthBoundary: true },
      { value: metadata?.payment_month, recoverUtcMonthBoundary: true },
      { value: payment?.billing_month, recoverUtcMonthBoundary: true },
    ];

    for (const candidate of explicitValues) {
      const monthIso = this.monthStartIsoFromValue(
        typeof candidate.value === 'string' ? candidate.value : null,
        { recoverUtcMonthBoundary: candidate.recoverUtcMonthBoundary },
      );
      if (monthIso) return monthIso;
    }

    const fallbackDates = [
      payment?.transaction_date,
      metadata?.payment_date,
      payment?.created_at,
    ];
    for (const dateValue of fallbackDates) {
      const monthIso = this.monthStartIsoWithCutoff(
        typeof dateValue === 'string' ? dateValue : null,
        { applyCutoff: true },
      );
      if (monthIso) return monthIso;
    }

    return null;
  }

  private static resolvePopAccountingMonth(upload: any): string | null {
    const explicit = this.monthStartIsoFromValue(
      upload?.payment_for_month || upload?.billing_month,
      { recoverUtcMonthBoundary: true },
    );
    if (explicit) return explicit;

    const fallback = [
      upload?.payment_date,
      upload?.created_at,
    ];
    for (const value of fallback) {
      const monthIso = this.monthStartIsoWithCutoff(
        typeof value === 'string' ? value : null,
        { applyCutoff: true },
      );
      if (monthIso) return monthIso;
    }

    return null;
  }

  private static resolvePaymentAmount(payment: any): number {
    const amount = Number(payment?.amount);
    if (Number.isFinite(amount) && amount > 0) return amount;
    const cents = Number(payment?.amount_cents);
    if (Number.isFinite(cents) && cents > 0) return cents / 100;
    return 0;
  }

  private static async fetchStudentFees(
    preschoolId: string,
    options: { from: string; to: string; useDueDate: boolean }
  ) {
    const buildQuery = () => {
      let query = assertSupabase()
        .from('student_fees')
        .select('id, amount, final_amount, amount_paid, amount_outstanding, status, due_date, created_at, students!inner(id, preschool_id, organization_id)');

      query = query.or(
        `preschool_id.eq.${preschoolId},organization_id.eq.${preschoolId}`,
        { foreignTable: 'students' }
      );

      if (options.useDueDate) {
        query = query.gte('due_date', options.from).lt('due_date', options.to);
      } else {
        query = query.is('due_date', null).gte('created_at', options.from).lt('created_at', options.to);
      }

      return query;
    };

    const result = await buildQuery();
    const error = (result as any).error;
    const data = ((result as any).data || []) as any[];

    return { data, error };
  }
  /**
   * Get financial metrics for a preschool
   * @deprecated Principal finance now uses getFinanceControlCenterBundle().
   * Kept for legacy screens/routes that soft-redirect during migration.
   */
  static async getFinancialMetrics(preschoolId: string): Promise<FinancialMetrics> {
    try {
      const now = new Date();
      const monthStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const monthStart = `${monthStartDate.getFullYear()}-${String(monthStartDate.getMonth() + 1).padStart(2, '0')}-01`;
      const nextMonthStart = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

      let monthlyRevenue = 0;
      let totalOutstanding = 0;

      // Prefer fee due-month accounting so advance payments land in the correct month
      const [feesDueRes, feesFallbackRes] = await Promise.all([
        this.fetchStudentFees(preschoolId, {
          from: monthStart,
          to: nextMonthStart,
          useDueDate: true,
        }),
        this.fetchStudentFees(preschoolId, {
          from: monthStartDate.toISOString(),
          to: nextMonthDate.toISOString(),
          useDueDate: false,
        }),
      ]);

      if ((feesDueRes as any).error || (feesFallbackRes as any).error) {
        const feeError = (feesDueRes as any).error || (feesFallbackRes as any).error;
        if (!isMissingFinanceTenantColumn(feeError)) {
          console.error('Error fetching fees for revenue:', feeError);
        }

        // Fallback to payment-for-month accounting if fee query fails
        const extendedStart = new Date(monthStartDate);
        extendedStart.setMonth(extendedStart.getMonth() - 6);
        const extendedEnd = new Date(nextMonthDate);
        extendedEnd.setMonth(extendedEnd.getMonth() + 6);

        const { data: fallbackPayments } = await withFinanceTenant<Array<any>>((column) =>
          assertSupabase()
            .from('payments')
            .select('amount, status, created_at, metadata')
            .eq(column, preschoolId)
            .gte('created_at', extendedStart.toISOString())
            .lt('created_at', extendedEnd.toISOString())
        );

        const getAccountingDate = (payment: any) => {
          const metadata = payment?.metadata || {};
          const value = metadata?.payment_for_month || metadata?.payment_date || payment?.created_at;
          const date = value ? new Date(value) : null;
          return date && !Number.isNaN(date.getTime()) ? date : null;
        };

        monthlyRevenue = (fallbackPayments || [])
          .filter((payment) => {
            const date = getAccountingDate(payment);
            if (!date) return false;
            return date >= monthStartDate && date < nextMonthDate &&
              ['completed', 'approved'].includes(String(payment?.status));
          })
          .reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);

        totalOutstanding = (fallbackPayments || [])
          .filter((payment) => {
            const date = getAccountingDate(payment);
            if (!date) return false;
            return date >= monthStartDate && date < nextMonthDate &&
              ['pending', 'proof_submitted', 'under_review'].includes(String(payment?.status));
          })
          .reduce((sum, p) => sum + (Number(p?.amount) || 0), 0);
      } else {
        const feeRows = [
          ...((feesDueRes as any).data || []),
          ...((feesFallbackRes as any).data || []),
        ];
        monthlyRevenue = feeRows.reduce((sum, fee) => sum + this.getPaidAmountForFee(fee), 0);
        totalOutstanding = feeRows.reduce((sum, fee) => sum + this.getOutstandingAmountForFee(fee), 0);
      }

      // Get monthly expenses from petty cash (include financial_transaction_id for dedup)
      const { data: expenseTransactions, error: expenseError } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .select('amount, financial_transaction_id')
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

      // Collect financial_transaction IDs already counted via petty cash to avoid double-counting
      const linkedFtIds = new Set(
        (expenseTransactions || [])
          .map((t: any) => t.financial_transaction_id)
          .filter(Boolean)
      );

      // Include other expense sources from financial_transactions (completed/approved) for current month
      // DEDUP: exclude rows already linked from petty_cash_transactions
      try {
        const { data: otherExpTx } = await withFinanceTenant<Array<{ id?: string; amount: number | null; type?: string | null; status?: string | null; created_at?: string | null }>>((column) =>
          assertSupabase()
            .from('financial_transactions')
            .select('id, amount, type, status, created_at')
            .eq(column, preschoolId)
            .in('type', ['expense','operational_expense','salary','purchase'])
            .in('status', ['approved','completed'])
            .gte('created_at', monthStart)
            .lt('created_at', nextMonthStart)
        );
        const otherExp = (otherExpTx || [])
          .filter((t: any) => !linkedFtIds.has(t.id)) // skip already-counted
          .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount) || 0), 0);
        monthlyExpenses += otherExp;
      } catch { /* Intentional: non-fatal */ }

      // Get student count
      const { count: studentCount } = await withFinanceTenant((column) =>
        assertSupabase()
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq(column, preschoolId)
          .eq('is_active', true)
      );

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
      
      // Return zero data on error — never fake numbers
      return {
        monthlyRevenue: 0,
        outstandingPayments: 0,
        monthlyExpenses: 0,
        netIncome: 0,
        paymentCompletionRate: 0,
        totalStudents: 0,
        averageFeePerStudent: 0,
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
        const nextDate = new Date(year, month, 1); // JS Date handles Dec→Jan rollover
        const nextMonthStart = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-01`;

        // Get revenue for this month (fee due-month basis)
        let revenue = 0;
        try {
          const [feesDueRes, feesFallbackRes] = await Promise.all([
            this.fetchStudentFees(preschoolId, {
              from: monthStart,
              to: nextMonthStart,
              useDueDate: true,
            }),
            this.fetchStudentFees(preschoolId, {
              from: new Date(`${monthStart}T00:00:00`).toISOString(),
              to: new Date(`${nextMonthStart}T00:00:00`).toISOString(),
              useDueDate: false,
            }),
          ]);

          if ((feesDueRes as any).error || (feesFallbackRes as any).error) {
            const { data: monthlyRevenue } = await withFinanceTenant<Array<{ amount: number | null }>>((column) =>
              assertSupabase()
                .from('payments')
                .select('amount')
                .eq(column, preschoolId)
                .in('status', ['completed', 'approved'])
                .gte('created_at', monthStart)
                .lt('created_at', nextMonthStart)
            );
            revenue = monthlyRevenue?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
          } else {
            const feeRows = [
              ...((feesDueRes as any).data || []),
              ...((feesFallbackRes as any).data || []),
            ];
            revenue = feeRows.reduce((sum, fee) => sum + this.getPaidAmountForFee(fee), 0);
          }
        } catch {
          const { data: monthlyRevenue } = await withFinanceTenant<Array<{ amount: number | null }>>((column) =>
            assertSupabase()
              .from('payments')
              .select('amount')
              .eq(column, preschoolId)
              .in('status', ['completed', 'approved'])
              .gte('created_at', monthStart)
              .lt('created_at', nextMonthStart)
          );
          revenue = monthlyRevenue?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
        }

        // Get expenses for this month
        const { data: monthlyExpenses } = await withPettyCashTenant((column, client) =>
          client
            .from('petty_cash_transactions')
            .select('amount, financial_transaction_id')
            .eq(column, preschoolId)
            .eq('type', 'expense')
            .eq('status', 'approved')
            .gte('created_at', monthStart)
            .lt('created_at', nextMonthStart)
        );

        const petty = monthlyExpenses?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
        // Collect linked financial_transaction IDs to avoid double-counting
        const trendLinkedFtIds = new Set(
          (monthlyExpenses || [])
            .map((t: any) => t.financial_transaction_id)
            .filter(Boolean)
        );
        let otherExp = 0;
        try {
          const { data: monthOther } = await withFinanceTenant<Array<{ id?: string; amount: number | null; type?: string | null; status?: string | null; created_at?: string | null }>>((column) =>
            assertSupabase()
              .from('financial_transactions')
              .select('id, amount, type, status, created_at')
              .eq(column, preschoolId)
              .in('type', ['expense','operational_expense','salary','purchase'])
              .in('status', ['approved','completed'])
              .gte('created_at', monthStart)
              .lt('created_at', nextMonthStart)
          );
          otherExp = (monthOther || [])
            .filter((t: any) => !trendLinkedFtIds.has(t.id)) // skip already-counted
            .reduce((s: number, t: any) => s + Math.abs(Number(t.amount) || 0), 0);
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
      
      // Return empty trend data on error — never fake numbers
      return [];
    }
  }

  /**
   * Get recent transactions (combined from payments and petty cash)
   */
  static async getRecentTransactions(preschoolId: string, limit: number = 10): Promise<UnifiedTransaction[]> {
    try {
      const transactions: UnifiedTransaction[] = [];

      // Get recent payments
      const { data: payments, error: paymentsError } = await withFinanceTenant<Array<any>>((column) =>
        assertSupabase()
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
          .eq(column, preschoolId)
          .order('created_at', { ascending: false })
          .limit(Math.ceil(limit / 2))
      );

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
   * @deprecated Principal finance now uses getFinanceControlCenterBundle().
   * Kept for legacy screens/routes that soft-redirect during migration.
   */
  static async getOverview(preschoolId?: string): Promise<FinanceOverviewData> {
    try {
      const now = new Date();
      const expenseTypes = ['expense', 'operational_expense', 'salary', 'purchase'] as const;
      const expenseStatuses = ['approved', 'completed'] as const;

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

      const rangeStartDateStr = `${monthWindows[0]?.start.getFullYear()}-${String(monthWindows[0]?.start.getMonth() + 1).padStart(2, '0')}-01`;
      const rangeEndDateStr = `${monthWindows[monthWindows.length - 1]?.end.getFullYear()}-${String(monthWindows[monthWindows.length - 1]?.end.getMonth() + 1).padStart(2, '0')}-01`;

      const feesDuePromise = preschoolId
        ? this.fetchStudentFees(preschoolId, {
            from: rangeStartDateStr,
            to: rangeEndDateStr,
            useDueDate: true,
          })
        : assertSupabase()
            .from('student_fees')
            .select('amount, final_amount, amount_paid, status, due_date, created_at')
            .gte('due_date', rangeStartDateStr)
            .lt('due_date', rangeEndDateStr);

      const feesFallbackPromise = preschoolId
        ? this.fetchStudentFees(preschoolId, {
            from: rangeStartIso,
            to: rangeEndIso,
            useDueDate: false,
          })
        : assertSupabase()
            .from('student_fees')
            .select('amount, final_amount, amount_paid, status, due_date, created_at')
            .is('due_date', null)
            .gte('created_at', rangeStartIso)
            .lt('created_at', rangeEndIso);

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

      const financialExpensePromise = preschoolId
        ? withFinanceTenant((column) =>
            assertSupabase()
              .from('financial_transactions')
              .select(`
                amount,
                created_at,
                type,
                expense_categories(name)
              `)
              .eq(column, preschoolId)
              .in('type', expenseTypes as unknown as string[])
              .in('status', expenseStatuses as unknown as string[])
              .gte('created_at', rangeStartIso)
              .lt('created_at', rangeEndIso)
          )
        : assertSupabase()
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

      type SettledResult<T> =
        | { status: 'fulfilled'; value: T }
        | { status: 'rejected'; reason: unknown };
      const settle = async <T>(promise: PromiseLike<T>): Promise<SettledResult<T>> => {
        try {
          const value = await promise;
          return { status: 'fulfilled', value };
        } catch (reason) {
          return { status: 'rejected', reason };
        }
      };

      const [feesDueResult, feesFallbackResult, financialExpenseResult] = await Promise.all([
        settle(feesDuePromise),
        settle(feesFallbackPromise),
        settle(financialExpensePromise as PromiseLike<any>),
      ]);

      type FeeRow = {
        amount: number | null;
        final_amount: number | null;
        amount_paid: number | null;
        status: string | null;
        due_date: string | null;
        created_at: string | null;
      };
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

      const feesDueValue: any = feesDueResult.status === 'fulfilled' ? feesDueResult.value : null;
      const feesFallbackValue: any = feesFallbackResult.status === 'fulfilled' ? feesFallbackResult.value : null;
      const financialExpenseValue: any = financialExpenseResult.status === 'fulfilled'
        ? financialExpenseResult.value
        : null;

      const feesDueData: FeeRow[] = (feesDueValue?.data as FeeRow[] | null) || [];
      const feesFallbackData: FeeRow[] = (feesFallbackValue?.data as FeeRow[] | null) || [];
      const pettyCashData: PettyCashRow[] = (pettyCashResult.data as PettyCashRow[] | null) || [];
      const financialExpenseData: FinancialExpenseRow[] =
        (financialExpenseValue?.data as FinancialExpenseRow[] | null) || [];

      const feesData = [...feesDueData, ...feesFallbackData];

      feesData.forEach((fee) => {
        const monthIndex = toMonthIndex(fee.due_date || fee.created_at);
        if (monthIndex === null) return;
        revenueMonthly[monthIndex] += this.getPaidAmountForFee(fee);
      });

      if (feesData.length === 0 && preschoolId) {
        const extendedStart = new Date(monthWindows[0].start);
        extendedStart.setMonth(extendedStart.getMonth() - 6);
        const extendedEnd = new Date(monthWindows[monthWindows.length - 1].end);
        extendedEnd.setMonth(extendedEnd.getMonth() + 6);

        const { data: fallbackPayments } = await withFinanceTenant<Array<any>>((column) =>
          assertSupabase()
            .from('payments')
            .select('amount, status, created_at, metadata')
            .eq(column, preschoolId)
            .gte('created_at', extendedStart.toISOString())
            .lt('created_at', extendedEnd.toISOString())
        );

        const getAccountingDate = (payment: any) => {
          const metadata = payment?.metadata || {};
          const value = metadata?.payment_for_month || metadata?.payment_date || payment?.created_at;
          const date = value ? new Date(value) : null;
          return date && !Number.isNaN(date.getTime()) ? date : null;
        };

        (fallbackPayments || [])
          .filter((payment) => ['completed', 'approved'].includes(String(payment?.status)))
          .forEach((payment) => {
            const date = getAccountingDate(payment);
            if (!date) return;
            const index = toMonthIndex(date.toISOString());
            if (index === null) return;
            revenueMonthly[index] += Number(payment?.amount) || 0;
          });
      }

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
  static async getTransactions(
    dateRange: DateRange,
    preschoolId?: string,
    options?: { useAccountingDate?: boolean }
  ): Promise<TransactionRecord[]> {
    try {
      const transactions: TransactionRecord[] = [];

      console.log('[FinancialDataService] getTransactions called with:', {
        dateRange,
        preschoolId,
      });

      const useAccountingDate = options?.useAccountingDate ?? true;
      const rangeStart = new Date(dateRange.from);
      const rangeEnd = new Date(dateRange.to);
      const extendedStart = new Date(rangeStart);
      if (!Number.isNaN(extendedStart.getTime())) {
        extendedStart.setMonth(extendedStart.getMonth() - 2);
      }
      const paymentStartIso = useAccountingDate && !Number.isNaN(extendedStart.getTime())
        ? extendedStart.toISOString()
        : dateRange.from;

      // Get payments within date range
      // Use LEFT JOIN (no !inner) so payments without students still return
      const { data: payments, error: paymentsError } = preschoolId
        ? await withFinanceTenant<Array<any>>((column) =>
            assertSupabase()
              .from('payments')
              .select(`
                id,
                amount,
                description,
                status,
                created_at,
                payment_reference,
                attachment_url,
                metadata,
                payment_method,
                student_id,
                parent_id,
                fee_ids,
                students(first_name, last_name)
              `)
              .eq(column, preschoolId)
              .gte('created_at', paymentStartIso)
              .lte('created_at', dateRange.to)
              .order('created_at', { ascending: false })
          )
        : await assertSupabase()
            .from('payments')
            .select(`
              id,
              amount,
              description,
              status,
              created_at,
              payment_reference,
              attachment_url,
              metadata,
              payment_method,
              student_id,
              parent_id,
              fee_ids,
              students(first_name, last_name)
            `)
            .gte('created_at', paymentStartIso)
            .lte('created_at', dateRange.to)
            .order('created_at', { ascending: false });

      console.log('[FinancialDataService] Payments query result:', {
        count: payments?.length ?? 0,
        error: paymentsError?.message,
        preschoolId,
      });

      if (paymentsError) {
        console.error('Error fetching payments for transactions:', paymentsError);
      } else if (payments) {
        const feeIds = new Set<string>();
        const isUuid = (value: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

        payments.forEach((payment: any) => {
          const ids = Array.isArray(payment.fee_ids) ? payment.fee_ids : [];
          ids.filter((id: string) => typeof id === 'string' && isUuid(id)).forEach((id: string) => feeIds.add(id));
          const metadata = payment.metadata || {};
          const feeStructureId = metadata?.fee_structure_id || metadata?.fee_id;
          if (typeof feeStructureId === 'string' && isUuid(feeStructureId)) {
            feeIds.add(feeStructureId);
          }
        });

        const feeMap = new Map<string, any>();
        const feeIdList = Array.from(feeIds).filter((id) => typeof id === 'string' && isUuid(id));
        if (feeIdList.length > 0) {
          const { data: feeRows, error: feeError } = await assertSupabase()
            .from('student_fees')
            .select('id, due_date, paid_date, amount, final_amount, amount_paid, status, fee_structures(name, fee_type, description)')
            .in('id', feeIdList);
          if (feeError) {
            console.warn('[FinancialDataService] Failed to load fee metadata for payments:', feeError.message);
          } else {
            (feeRows || []).forEach((fee: any) => feeMap.set(fee.id, fee));
          }
        }

        const buildFeeSummary = (labels: string[]): string | null => {
          const unique = Array.from(new Set(labels.filter(Boolean)));
          if (unique.length === 0) return null;
          if (unique.length <= 2) return unique.join(' + ');
          return `${unique[0]} + ${unique.length - 1} more`;
        };

        payments.forEach((payment: any) => {
          const studentData = Array.isArray(payment.students) ? payment.students[0] : payment.students;
          const studentName = studentData 
            ? `${studentData.first_name} ${studentData.last_name}`
            : 'Student';
          const paymentFeeIds = Array.isArray(payment.fee_ids) ? payment.fee_ids : [];
          const validFeeIds = paymentFeeIds.filter((id: string) => typeof id === 'string' && isUuid(id));
          const fallbackLabels = paymentFeeIds.filter((id: string) => typeof id === 'string' && !isUuid(id));
          const metadata = payment.metadata || {};
          const feeStructureId = metadata?.fee_structure_id || metadata?.fee_id;
          if (typeof feeStructureId === 'string' && isUuid(feeStructureId) && !validFeeIds.includes(feeStructureId)) {
            validFeeIds.push(feeStructureId);
          }

          const feeRows = validFeeIds
            .map((id: string) => feeMap.get(id))
            .filter(Boolean);

          const feeLabels = [
            ...feeRows.map((fee: any) => this.getFeeLabel(fee)),
            ...fallbackLabels,
          ];
          const feeCategories: string[] = feeRows.map((fee: any) => this.getFeeCategoryLabel(fee));
          const uniqueCategories = Array.from(
            new Set(
              feeCategories
                .filter((category): category is string => Boolean(category))
                .map((category) => this.normalizeCategoryLabel(category))
            )
          );

          const metadataHint = metadata?.payment_context || metadata?.fee_type || metadata?.fee_category;
          const fallbackCategory = inferPaymentCategory(
            payment.description || metadata?.payment_purpose || metadataHint
          );
          if (metadataHint && typeof metadataHint === 'string') {
            const label = this.normalizeCategoryLabel(metadataHint);
            if (!feeLabels.length) feeLabels.push(label);
          }
          const category = uniqueCategories.length === 1
            ? uniqueCategories[0]
            : uniqueCategories.length > 1
              ? 'Multiple Fees'
              : fallbackCategory;

          const feeSummary = buildFeeSummary(feeLabels);

          const dueDates = feeRows
            .map((fee: any) => fee?.due_date)
            .filter(Boolean)
            .map((dateStr: string) => new Date(dateStr));

          let dueDate: string | null = null;
          let accountingDate = payment.created_at || new Date().toISOString();
          if (dueDates.length) {
            dueDates.sort((a, b) => a.getTime() - b.getTime());
            const earliest = dueDates[0];
            const sameMonth = dueDates.every(
              (date) => date.getFullYear() === earliest.getFullYear() && date.getMonth() === earliest.getMonth()
            );
            const earliestFee = feeRows.find((fee: any) => fee?.due_date && new Date(fee.due_date).getTime() === earliest.getTime());
            dueDate = earliestFee?.due_date || earliest.toISOString();
            if (sameMonth && dueDate) {
              accountingDate = dueDate;
            }
          }

          const receiptUrl = typeof metadata?.receipt_url === 'string' ? metadata.receipt_url : null;
          const receiptStoragePath = typeof metadata?.receipt_storage_path === 'string' ? metadata.receipt_storage_path : null;
          const hasReceipt = Boolean(receiptUrl || receiptStoragePath);

          const resolvedDate = useAccountingDate
            ? accountingDate
            : payment.created_at || accountingDate;

          transactions.push({
            id: payment.id,
            type: 'income',
            category,
            amount: payment.amount || 0,
            description: payment.description || `Payment from ${studentName}`,
            date: resolvedDate,
            status: this.mapPaymentStatus(payment.status),
            reference: payment.payment_reference ?? null,
            attachmentUrl: payment.attachment_url ?? null,
            receiptUrl,
            receiptStoragePath,
            hasReceipt,
            source: 'payment',
            paidDate: payment.created_at ?? null,
            dueDate,
            isAdvancePayment: this.isAdvancePayment(dueDate, payment.created_at),
            feeIds: validFeeIds.length ? validFeeIds : null,
            feeLabels,
            feeSummary,
            paymentMethod: payment.payment_method ?? null,
            studentId: payment.student_id ?? null,
            parentId: payment.parent_id ?? null,
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
        const { data: finTx, error: finError } = preschoolId
          ? await withFinanceTenant((column) =>
              assertSupabase()
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
                .eq(column, preschoolId)
                .gte('created_at', dateRange.from)
                .lte('created_at', dateRange.to)
                .order('created_at', { ascending: false })
            )
          : await assertSupabase()
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

      const rangeStartTime = rangeStart.getTime();
      const rangeEndTime = rangeEnd.getTime();
      const filteredTransactions = Number.isNaN(rangeStartTime) || Number.isNaN(rangeEndTime)
        ? transactions
        : transactions.filter((transaction) => {
            const time = new Date(transaction.date).getTime();
            if (Number.isNaN(time)) return false;
            return time >= rangeStartTime && time <= rangeEndTime;
          });

      // Sort by date (newest first)
      filteredTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      console.log('[FinancialDataService] Total transactions returned:', filteredTransactions.length);
      
      return filteredTransactions;

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

  private static normalizeCategoryLabel(value?: string | null): string {
    if (!value) return 'Other';
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private static getFeeStructure(fee: any) {
    const relation = fee?.fee_structures;
    return Array.isArray(relation) ? relation[0] : relation;
  }

  private static getFeeLabel(fee: any): string {
    const structure = this.getFeeStructure(fee);
    return structure?.name || structure?.fee_type || fee?.description || 'Fee';
  }

  private static getFeeCategoryLabel(fee: any): string {
    const structure = this.getFeeStructure(fee);
    if (isUniformFee(structure?.fee_type, structure?.name, structure?.description)) {
      return 'Uniform';
    }
    if (isTuitionFee(structure?.fee_type, structure?.name, structure?.description)) {
      return 'Tuition';
    }
    return structure?.fee_type || structure?.name || 'Fee';
  }

  private static getPaidAmountForFee(fee: any): number {
    const paid = Number(fee?.amount_paid || 0);
    if (paid > 0) return paid;
    const finalAmount = Number(fee?.final_amount ?? fee?.amount ?? 0);
    return String(fee?.status) === 'paid' ? finalAmount : 0;
  }

  private static getOutstandingAmountForFee(fee: any): number {
    const finalAmount = Number(fee?.final_amount ?? fee?.amount ?? 0);
    const paidAmount = Number(fee?.amount_paid ?? 0);
    const explicitOutstanding = Number(fee?.amount_outstanding);
    const derivedOutstanding = finalAmount - (Number.isFinite(paidAmount) ? paidAmount : 0);

    if (Number.isFinite(explicitOutstanding)) {
      return Math.max(explicitOutstanding, 0);
    }
    if (Number.isFinite(derivedOutstanding)) {
      return Math.max(derivedOutstanding, 0);
    }
    return 0;
  }

  private static isStudentActiveForReceivables(student: any): boolean {
    if (!student) return false;
    if (student.is_active !== true) return false;
    const status = String(student.status || '').toLowerCase().trim();
    return status === 'active';
  }

  private static isAdvancePayment(dueDate?: string | null, paidDate?: string | null): boolean {
    if (!dueDate || !paidDate) return false;
    const due = new Date(dueDate);
    const paid = new Date(paidDate);
    if (Number.isNaN(due.getTime()) || Number.isNaN(paid.getTime())) return false;
    const dueMonthStart = new Date(due.getFullYear(), due.getMonth(), 1);
    return paid < dueMonthStart;
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

  /**
   * Approve POP using explicit billing month/category and allocations.
   * Uses DB RPC to ensure payment + allocation + fee updates happen atomically.
   */
  static async approvePOPWithAllocations(payload: ApprovePopPaymentPayload): Promise<{
    paymentId?: string;
    allocatedAmount: number;
    overpaymentAmount: number;
  }> {
    const supabase = assertSupabase();
    const { data, error } = await supabase.rpc('approve_pop_payment', {
      p_upload_id: payload.uploadId,
      p_billing_month: payload.billingMonth,
      p_category_code: payload.categoryCode,
      p_allocations: payload.allocations || [],
      p_notes: payload.notes || null,
    });

    if (error) {
      console.error('[FinancialDataService] approve_pop_payment RPC failed:', error);
      throw new Error(error.message || 'Failed to approve payment proof');
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Failed to approve payment proof');
    }

    return {
      paymentId: data.payment_id,
      allocatedAmount: Number(data.allocated_amount || 0),
      overpaymentAmount: Number(data.overpayment_amount || 0),
    };
  }

  /**
   * Finance control-center snapshot for a selected month.
   */
  static async getMonthSnapshot(orgId: string, monthIso?: string): Promise<FinanceMonthSnapshot> {
    const supabase = assertSupabase();
    const month = this.normalizeMonthIso(monthIso);

    const { data, error } = await supabase.rpc('get_finance_month_snapshot', {
      p_org_id: orgId,
      p_month: month,
    });

    if (error) {
      console.error('[FinancialDataService] get_finance_month_snapshot RPC failed:', error);
      throw new Error(error.message || 'Failed to load finance month snapshot');
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Failed to load finance month snapshot');
    }

    return {
      success: true,
      organization_id: data.organization_id,
      month: data.month,
      month_locked: Boolean(data.month_locked),
      due_this_month: Number(data.due_this_month || 0),
      collected_this_month: Number(data.collected_this_month || 0),
      collected_allocated_amount: Number(data.collected_allocated_amount || 0),
      collected_source: data.collected_source === 'fee_ledger' ? 'fee_ledger' : 'allocations',
      kpi_delta: Number(data.kpi_delta || 0),
      still_outstanding: Number(data.still_outstanding || 0),
      pending_amount: Number(data.pending_amount || 0),
      overdue_amount: Number(data.overdue_amount || 0),
      pending_count: Number(data.pending_count || 0),
      overdue_count: Number(data.overdue_count || 0),
      pending_students: Number(data.pending_students || 0),
      overdue_students: Number(data.overdue_students || 0),
      prepaid_for_future_months: Number(data.prepaid_for_future_months || 0),
      expenses_this_month: Number(data.expenses_this_month || 0),
      petty_cash_expenses_this_month: Number(data.petty_cash_expenses_this_month || 0),
      financial_expenses_this_month: Number(data.financial_expenses_this_month || 0),
      payroll_expenses_this_month: Number(data.payroll_expenses_this_month || 0),
      operational_expenses_this_month: Number(data.operational_expenses_this_month || 0),
      registration_revenue: Number(data.registration_revenue || 0),
      excluded_inactive_due: Number(data.excluded_inactive_due || 0),
      excluded_inactive_outstanding: Number(data.excluded_inactive_outstanding || 0),
      excluded_inactive_students: Number(data.excluded_inactive_students || 0),
      family_credits_available: Number(data.family_credits_available || 0),
      net_after_expenses: Number(data.net_after_expenses || 0),
      payroll_due: Number(data.payroll_due || 0),
      payroll_paid: Number(data.payroll_paid || 0),
      pending_pop_reviews: Number(data.pending_pop_reviews || 0),
      categories: Array.isArray(data.categories) ? data.categories : [],
      as_of_date: String(data.as_of_date || data.generated_at || new Date().toISOString()),
      generated_at: data.generated_at || new Date().toISOString(),
    };
  }

  /**
   * Detailed payment breakdown for a selected month.
   * Used by Finance Control Center to show "what for" and "how paid".
   */
  static async getMonthPaymentBreakdown(
    orgId: string,
    monthIso?: string,
  ): Promise<FinanceMonthPaymentBreakdown> {
    const supabase = assertSupabase();
    const month = this.normalizeMonthIso(monthIso);
    const monthDate = new Date(month);
    const extendedStartDate = new Date(monthDate.getFullYear(), monthDate.getMonth() - 2, 1);
    const extendedEndDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 3, 1);
    const extendedStart = `${extendedStartDate.getFullYear()}-${String(extendedStartDate.getMonth() + 1).padStart(2, '0')}-01`;
    const extendedEnd = `${extendedEndDate.getFullYear()}-${String(extendedEndDate.getMonth() + 1).padStart(2, '0')}-01`;

    const [paymentsResult, popResult] = await Promise.all([
      supabase
        .from('payments')
        .select(
          'id, student_id, amount, amount_cents, status, billing_month, transaction_date, category_code, payment_method, payment_reference, metadata, description, created_at',
        )
        .eq('preschool_id', orgId)
        .in('status', ['completed', 'approved', 'paid', 'successful'])
        .gte('transaction_date', extendedStart)
        .lt('transaction_date', extendedEnd)
        .order('transaction_date', { ascending: false })
        .limit(2000),
      supabase
        .from('pop_uploads')
        .select(
          'id, student_id, payment_amount, payment_for_month, payment_date, payment_method, payment_reference, category_code, description, title, created_at, status',
        )
        .eq('preschool_id', orgId)
        .eq('upload_type', 'proof_of_payment')
        .in('status', ['approved', 'completed', 'verified'])
        .gte('created_at', extendedStart)
        .lt('created_at', extendedEnd)
        .order('created_at', { ascending: false })
        .limit(2000),
    ]);

    const data = paymentsResult.data;
    const error = paymentsResult.error;

    if (error) {
      console.error('[FinancialDataService] payment breakdown query failed:', error);
      throw new Error(error.message || 'Failed to load month payment breakdown');
    }

    const categoryMap = new Map<string, { amount: number; count: number }>();
    const methodMap = new Map<string, { amount: number; count: number }>();
    const purposeMap = new Map<string, { amount: number; count: number }>();
    const seenSignatures = new Set<string>();
    let totalCollected = 0;

    for (const payment of data || []) {
      const accountingMonth = this.resolvePaymentAccountingMonth(payment);
      if (accountingMonth !== month) continue;

      const amount = this.resolvePaymentAmount(payment);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const signatureMonth = accountingMonth || month;

      const metadata = payment?.metadata && typeof payment.metadata === 'object'
        ? payment.metadata
        : {};
      const categoryCode = inferFeeCategoryCode(
        payment?.category_code ||
        metadata?.category_code ||
        metadata?.fee_category ||
        metadata?.category ||
        payment?.description ||
        'tuition',
      );
      const methodCode = normalizePaymentMethodCode(
        payment?.payment_method ||
        metadata?.payment_method ||
        metadata?.method ||
        'other',
      );
      const purposeLabel = this.resolvePaymentPurposeLabel(payment);
      const paymentStudentSig = String(payment?.student_id || '').trim();
      const paymentRefSig = this.normalizeReference(
        payment?.payment_reference ||
        metadata?.payment_reference ||
        metadata?.reference ||
        '',
      );
      if (paymentStudentSig || paymentRefSig) {
        const signature = [
          paymentStudentSig,
          paymentRefSig,
          String(Math.round(amount * 100)),
          signatureMonth,
        ].join('|');
        seenSignatures.add(signature);
      }

      const existingCategory = categoryMap.get(categoryCode) || { amount: 0, count: 0 };
      existingCategory.amount += amount;
      existingCategory.count += 1;
      categoryMap.set(categoryCode, existingCategory);

      const existingMethod = methodMap.get(methodCode) || { amount: 0, count: 0 };
      existingMethod.amount += amount;
      existingMethod.count += 1;
      methodMap.set(methodCode, existingMethod);

      const existingPurpose = purposeMap.get(purposeLabel) || { amount: 0, count: 0 };
      existingPurpose.amount += amount;
      existingPurpose.count += 1;
      purposeMap.set(purposeLabel, existingPurpose);

      totalCollected += amount;
    }

    if (popResult.error) {
      console.warn('[FinancialDataService] pop fallback query failed:', popResult.error);
    } else {
      for (const upload of popResult.data || []) {
        const accountingMonth = this.resolvePopAccountingMonth(upload);
        if (accountingMonth !== month) continue;

        const amount = Number(upload?.payment_amount || 0);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        const signatureMonth = accountingMonth || month;

        const popStudentSig = String(upload?.student_id || '').trim();
        const popRefSig = this.normalizeReference(upload?.payment_reference || '');
        if (popStudentSig || popRefSig) {
          const signature = [
            popStudentSig,
            popRefSig,
            String(Math.round(amount * 100)),
            signatureMonth,
          ].join('|');
          if (seenSignatures.has(signature)) continue;
        }

        const categoryCode = inferFeeCategoryCode(
          upload?.category_code || upload?.description || upload?.title || 'tuition',
        );
        const methodCode = normalizePaymentMethodCode(upload?.payment_method || 'other');
        const purposeLabel = this.resolvePopPurposeLabel(upload);

        const existingCategory = categoryMap.get(categoryCode) || { amount: 0, count: 0 };
        existingCategory.amount += amount;
        existingCategory.count += 1;
        categoryMap.set(categoryCode, existingCategory);

        const existingMethod = methodMap.get(methodCode) || { amount: 0, count: 0 };
        existingMethod.amount += amount;
        existingMethod.count += 1;
        methodMap.set(methodCode, existingMethod);

        const existingPurpose = purposeMap.get(purposeLabel) || { amount: 0, count: 0 };
        existingPurpose.amount += amount;
        existingPurpose.count += 1;
        purposeMap.set(purposeLabel, existingPurpose);

        totalCollected += amount;
      }
    }

    const categories = Array.from(categoryMap.entries())
      .map(([category_code, values]) => ({
        category_code,
        amount: Number(values.amount.toFixed(2)),
        count: values.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    const methods = Array.from(methodMap.entries())
      .map(([payment_method, values]) => ({
        payment_method,
        amount: Number(values.amount.toFixed(2)),
        count: values.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    const purposes = Array.from(purposeMap.entries())
      .map(([purpose, values]) => ({
        purpose,
        amount: Number(values.amount.toFixed(2)),
        count: values.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      month,
      total_collected: Number(totalCollected.toFixed(2)),
      categories,
      methods,
      purposes,
    };
  }

  static async getMonthExpenseBreakdown(
    orgId: string,
    monthIso?: string,
  ): Promise<FinanceMonthExpenseBreakdown> {
    const month = this.normalizeMonthIso(monthIso);
    const nextMonth = this.nextMonthIso(month);
    const finalizedStatuses = new Set(['approved', 'completed']);

    const [pettyCashResult, financialResult] = await Promise.all([
      withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .select(
            'id, amount, description, category, type, status, created_at, transaction_date, receipt_number, reference_number',
          )
          .eq(column, orgId)
          .eq('type', 'expense')
          .gte('created_at', month)
          .lt('created_at', nextMonth)
          .order('created_at', { ascending: false })
          .limit(500),
      ),
      withFinanceTenant<Array<any>>((column) =>
        assertSupabase()
          .from('financial_transactions')
          .select(
            `
              id,
              amount,
              description,
              status,
              type,
              created_at,
              payment_reference,
              reference_number,
              expense_categories(name)
            `,
          )
          .eq(column, orgId)
          .in('type', ['expense', 'operational_expense', 'salary', 'purchase'])
          .gte('created_at', month)
          .lt('created_at', nextMonth)
          .order('created_at', { ascending: false })
          .limit(500),
      ),
    ]);

    if (pettyCashResult.error) {
      throw new Error(pettyCashResult.error.message || 'Failed to load petty cash expenses');
    }
    if (financialResult.error) {
      throw new Error(financialResult.error.message || 'Failed to load finance expense entries');
    }

    let pettyCashTotal = 0;
    let financialTotal = 0;
    const entries: FinanceMonthExpenseBreakdown['entries'] = [];

    for (const tx of (pettyCashResult.data || []) as Array<any>) {
      const amount = Math.abs(Number(tx?.amount || 0));
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const status = String(tx?.status || '').toLowerCase();
      if (finalizedStatuses.has(status)) {
        pettyCashTotal += amount;
      }

      entries.push({
        id: String(tx?.id || `petty-${entries.length}`),
        source: 'petty_cash',
        date: String(tx?.transaction_date || tx?.created_at || new Date().toISOString()),
        amount: Number(amount.toFixed(2)),
        status: status || 'pending',
        category: String(tx?.category || 'Petty Cash'),
        description: String(tx?.description || 'Petty cash expense'),
        reference: tx?.reference_number || tx?.receipt_number || null,
      });
    }

    for (const tx of (financialResult.data || []) as Array<any>) {
      const amount = Math.abs(Number(tx?.amount || 0));
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const status = String(tx?.status || '').toLowerCase();
      if (finalizedStatuses.has(status)) {
        financialTotal += amount;
      }

      const categoryData = Array.isArray(tx?.expense_categories)
        ? tx.expense_categories[0]
        : tx?.expense_categories;
      const fallbackType = this.normalizePurposeLabel(tx?.type || 'Expense');

      entries.push({
        id: String(tx?.id || `fin-${entries.length}`),
        source: 'financial_txn',
        date: String(tx?.created_at || new Date().toISOString()),
        amount: Number(amount.toFixed(2)),
        status: status || 'pending',
        category: String(categoryData?.name || fallbackType),
        description: String(tx?.description || fallbackType),
        reference: tx?.payment_reference || tx?.reference_number || null,
      });
    }

    entries.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0);
    });

    return {
      month,
      total_expenses: Number((pettyCashTotal + financialTotal).toFixed(2)),
      petty_cash_expenses: Number(pettyCashTotal.toFixed(2)),
      financial_expenses: Number(financialTotal.toFixed(2)),
      entries: entries.slice(0, 120),
    };
  }

  static async getReceivablesSnapshot(
    orgId: string,
    monthIso?: string,
  ): Promise<{ summary: FinanceReceivablesSummary; students: FinanceReceivableStudentRow[] }> {
    const month = this.normalizeMonthIso(monthIso);
    const nextMonth = this.nextMonthIso(month);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const unpaidStatuses = ['pending', 'overdue', 'partially_paid', 'pending_verification'];

    let feesData: any[] = [];

    const monthScopedQuery = await assertSupabase()
      .from('student_fees')
      .select(`
        id,
        student_id,
        status,
        due_date,
        billing_month,
        amount,
        final_amount,
        amount_paid,
        amount_outstanding,
        students!inner(
          id,
          first_name,
          last_name,
          is_active,
          status,
          preschool_id,
          organization_id
        )
      `)
      .or(`preschool_id.eq.${orgId},organization_id.eq.${orgId}`, { foreignTable: 'students' })
      .eq('billing_month', month)
      .in('status', unpaidStatuses);

    const missingBillingMonth = Boolean(monthScopedQuery.error) && (
      monthScopedQuery.error?.code === '42703' ||
      String(monthScopedQuery.error?.message || '').toLowerCase().includes('billing_month')
    );

    if (missingBillingMonth) {
      const fallbackQuery = await assertSupabase()
        .from('student_fees')
        .select(`
          id,
          student_id,
          status,
          due_date,
          amount,
          final_amount,
          amount_paid,
          amount_outstanding,
          students!inner(
            id,
            first_name,
            last_name,
            is_active,
            status,
            preschool_id,
            organization_id
          )
        `)
        .or(`preschool_id.eq.${orgId},organization_id.eq.${orgId}`, { foreignTable: 'students' })
        .gte('due_date', month)
        .lt('due_date', nextMonth)
        .in('status', unpaidStatuses);
      if (fallbackQuery.error) {
        throw new Error(fallbackQuery.error.message || 'Failed to load receivables');
      }
      feesData = fallbackQuery.data || [];
    } else if (monthScopedQuery.error) {
      throw new Error(monthScopedQuery.error.message || 'Failed to load receivables');
    } else {
      feesData = monthScopedQuery.data || [];
    }

    const studentMap = new Map<string, FinanceReceivableStudentRow>();
    const overdueStudents = new Set<string>();
    const pendingStudents = new Set<string>();
    let overdueAmount = 0;
    let pendingAmount = 0;
    let overdueCount = 0;
    let pendingCount = 0;

    for (const fee of feesData) {
      const status = String(fee?.status || '').toLowerCase();
      if (!unpaidStatuses.includes(status)) continue;

      const studentData = Array.isArray(fee?.students) ? fee.students[0] : fee?.students;
      const studentId = String(fee?.student_id || studentData?.id || '').trim();
      if (!studentId) continue;
      if (!this.isStudentActiveForReceivables(studentData)) continue;

      const amount = this.getOutstandingAmountForFee(fee);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const dueDate = fee?.due_date ? new Date(fee.due_date) : null;
      const isOverdue = status === 'overdue' ||
        (dueDate instanceof Date &&
          !Number.isNaN(dueDate.getTime()) &&
          dueDate < todayStart);

      if (isOverdue) {
        overdueAmount += amount;
        overdueCount += 1;
        overdueStudents.add(studentId);
      } else {
        pendingAmount += amount;
        pendingCount += 1;
        pendingStudents.add(studentId);
      }

      const existing = studentMap.get(studentId) || {
        student_id: studentId,
        first_name: String(studentData?.first_name || 'Student'),
        last_name: String(studentData?.last_name || ''),
        class_name: null,
        outstanding_amount: 0,
        pending_count: 0,
        overdue_count: 0,
      };

      existing.outstanding_amount += amount;
      if (isOverdue) existing.overdue_count += 1;
      else existing.pending_count += 1;
      studentMap.set(studentId, existing);
    }

    const students = Array.from(studentMap.values())
      .sort((a, b) => {
        if (b.outstanding_amount !== a.outstanding_amount) {
          return b.outstanding_amount - a.outstanding_amount;
        }
        if (b.overdue_count !== a.overdue_count) {
          return b.overdue_count - a.overdue_count;
        }
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      })
      .slice(0, 60)
      .map((row) => ({
        ...row,
        outstanding_amount: Number(row.outstanding_amount.toFixed(2)),
      }));

    return {
      summary: {
        month,
        pending_amount: Number(pendingAmount.toFixed(2)),
        overdue_amount: Number(overdueAmount.toFixed(2)),
        pending_count: pendingCount,
        overdue_count: overdueCount,
        pending_students: pendingStudents.size,
        overdue_students: overdueStudents.size,
        outstanding_students: studentMap.size,
        outstanding_amount: Number((pendingAmount + overdueAmount).toFixed(2)),
      },
      students,
    };
  }

  static async getFinanceControlCenterBundle(
    orgId: string,
    monthIso?: string,
  ): Promise<FinanceControlCenterBundle> {
    const month = this.normalizeMonthIso(monthIso);
    const supabase = assertSupabase();

    const settle = async <T>(promise: Promise<T>) => {
      try {
        const value = await promise;
        return { value, error: null as string | null };
      } catch (err: any) {
        return { value: null as T | null, error: err?.message || 'Failed to load section data' };
      }
    };

    const queuePromise = (async () => {
      const { data, error } = await supabase
        .from('pop_uploads')
        .select(`
          id,
          student_id,
          preschool_id,
          payment_amount,
          payment_date,
          payment_for_month,
          category_code,
          payment_reference,
          status,
          description,
          title,
          created_at,
          student:students(first_name,last_name)
        `)
        .eq('preschool_id', orgId)
        .eq('upload_type', 'proof_of_payment')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message || 'Failed to load payment queue');
      return data || [];
    })();

    const [snapshotRes, receivablesRes, expensesRes, breakdownRes, queueRes, payrollRes] = await Promise.all([
      settle(this.getMonthSnapshot(orgId, month)),
      settle(this.getReceivablesSnapshot(orgId, month)),
      settle(this.getMonthExpenseBreakdown(orgId, month)),
      settle(this.getMonthPaymentBreakdown(orgId, month)),
      settle(queuePromise),
      settle(PayrollService.getRoster(orgId, month)),
    ]);

    const errors: FinanceControlCenterBundle['errors'] = {};
    if (snapshotRes.error) errors.snapshot = snapshotRes.error;
    if (receivablesRes.error) errors.receivables = receivablesRes.error;
    if (expensesRes.error) errors.expenses = expensesRes.error;
    if (breakdownRes.error) errors.breakdown = breakdownRes.error;
    if (queueRes.error) errors.queue = queueRes.error;
    if (payrollRes.error) errors.payroll = payrollRes.error;
    const payrollValue: any = payrollRes.value;

    return {
      month,
      snapshot: snapshotRes.value,
      receivables: receivablesRes.value,
      expenses: expensesRes.value,
      payment_breakdown: breakdownRes.value,
      pending_pops: (queueRes.value || []) as any[],
      payroll: payrollValue,
      payroll_fallback_used: Boolean(payrollValue?.fallback_used),
      errors: Object.keys(errors).length ? errors : undefined,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPENSE LOGGING — Insert into financial_transactions
  // ═══════════════════════════════════════════════════════════════

  /**
   * Expense types supported by the financial_transactions table
   */
  static readonly EXPENSE_TYPES = [
    { key: 'salary', label: 'Staff Salary', icon: 'people', color: '#6366F1' },
    { key: 'operational_expense', label: 'Rent / Lease', icon: 'home', color: '#F59E0B' },
    { key: 'expense', label: 'Utilities (Water, Electricity)', icon: 'flash', color: '#3B82F6' },
    { key: 'purchase', label: 'Supplies / Equipment', icon: 'cart', color: '#10B981' },
    { key: 'expense', label: 'Maintenance / Repairs', icon: 'construct', color: '#EF4444' },
    { key: 'expense', label: 'Transport', icon: 'car', color: '#8B5CF6' },
    { key: 'expense', label: 'Food / Catering', icon: 'restaurant', color: '#EC4899' },
    { key: 'expense', label: 'Insurance', icon: 'shield-checkmark', color: '#14B8A6' },
    { key: 'expense', label: 'Other', icon: 'ellipsis-horizontal-circle', color: '#6B7280' },
  ] as const;

  /**
   * Log a new expense (salary, utility, rent, etc.) into financial_transactions
   */
  static async logExpense(params: {
    preschoolId: string;
    createdBy: string;
    type: string;
    amount: number;
    description: string;
    category?: string;
    expenseCategoryId?: string;
    vendorName?: string;
    paymentMethod?: string;
    paymentReference?: string;
    receiptImagePath?: string;
    metadata?: Record<string, any>;
  }): Promise<{ id: string }> {
    const supabase = assertSupabase();

    const payload: Record<string, any> = {
      preschool_id: params.preschoolId,
      created_by: params.createdBy,
      type: params.type,
      amount: params.amount,
      description: params.description,
      status: 'completed', // Principal-logged expenses are auto-approved
      vendor_name: params.vendorName || null,
      payment_method: params.paymentMethod || null,
      payment_reference: params.paymentReference || null,
      receipt_image_path: params.receiptImagePath || null,
      expense_category_id: params.expenseCategoryId || null,
      metadata: {
        ...(params.metadata || {}),
        category_label: params.category || params.type,
        logged_from: 'mobile_app',
      },
    };

    const { data, error } = await supabase
      .from('financial_transactions')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.error('[FinancialDataService] Failed to log expense:', error);
      throw new Error(error.message || 'Failed to log expense');
    }

    return { id: (data as any).id };
  }

  /**
   * Get expense categories for a preschool (from expense_categories table)
   */
  static async getExpenseCategories(preschoolId: string): Promise<Array<{
    id: string;
    name: string;
    color: string;
    icon: string;
    monthlyBudget: number;
  }>> {
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('expense_categories')
      .select('id, name, color, icon, monthly_budget')
      .eq('preschool_id', preschoolId)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.warn('[FinancialDataService] Failed to load expense categories:', error.message);
      return [];
    }

    return (data || []).map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color || '#6366F1',
      icon: cat.icon || 'receipt',
      monthlyBudget: Number(cat.monthly_budget) || 0,
    }));
  }

  /**
   * Get staff list for salary logging (teachers from this preschool)
   */
  static async getStaffForSalary(preschoolId: string): Promise<Array<{
    id: string;
    name: string;
    role: string;
  }>> {
    const supabase = assertSupabase();

    const { data, error } = await supabase
      .from('teachers')
      .select('id, first_name, last_name, subject_specialization')
      .eq('preschool_id', preschoolId)
      .eq('is_active', true)
      .order('first_name');

    if (error) {
      console.warn('[FinancialDataService] Failed to load staff:', error.message);
      return [];
    }

    return (data || []).map((t: any) => ({
      id: t.id,
      name: `${t.first_name} ${t.last_name}`.trim(),
      role: t.subject_specialization || 'Teacher',
    }));
  }
}
