/**
 * Financial Data Service Types
 *
 * Shared interfaces and type aliases used across all financial service modules.
 *
 * @module services/financial/types
 * @max-lines 200
 */

export type FinanceTenantColumn = 'preschool_id' | 'organization_id' | 'school_id';

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
  reference?: string | null;
  attachmentUrl?: string | null;
  receiptUrl?: string | null;
  receiptStoragePath?: string | null;
  receiptCount?: number;
  hasReceipt?: boolean;
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
  revenueMonthly: number[];
  expensesMonthly: number[];
  categoriesBreakdown: { name: string; value: number }[];
  keyMetrics: {
    monthlyRevenue: number;
    monthlyExpenses: number;
    cashFlow: number;
  };
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
