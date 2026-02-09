export type FeeCategoryCode =
  | 'tuition'
  | 'registration'
  | 'uniform'
  | 'aftercare'
  | 'transport'
  | 'meal'
  | 'ad_hoc';

export type FeeStatus =
  | 'pending'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'waived'
  | 'pending_verification';

export interface PaymentAllocationInput {
  student_fee_id: string;
  amount: number;
  notes?: string;
}

export interface ApprovePopPaymentPayload {
  uploadId: string;
  billingMonth: string;
  categoryCode: FeeCategoryCode;
  allocations?: PaymentAllocationInput[];
  notes?: string;
}

export interface FinanceMonthCategoryRow {
  category_code: FeeCategoryCode;
  due: number;
  collected: number;
  outstanding: number;
}

export interface FinanceMonthSnapshot {
  success: boolean;
  organization_id: string;
  month: string;
  month_locked: boolean;
  due_this_month: number;
  collected_this_month: number;
  still_outstanding: number;
  pending_amount: number;
  overdue_amount: number;
  pending_count: number;
  overdue_count: number;
  pending_students: number;
  overdue_students: number;
  prepaid_for_future_months: number;
  payroll_due: number;
  payroll_paid: number;
  pending_pop_reviews: number;
  categories: FinanceMonthCategoryRow[];
  as_of_date: string;
  generated_at: string;
}

export interface PayrollRosterItem {
  payroll_recipient_id: string;
  role_type: 'teacher' | 'principal';
  display_name: string;
  teacher_id?: string | null;
  profile_id?: string | null;
  active: boolean;
  base_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  salary_effective_from?: string | null;
  paid_this_month: boolean;
  paid_amount_this_month: number;
  last_paid_at?: string | null;
}

export interface PayrollRosterBundle {
  success: boolean;
  organization_id: string;
  month: string;
  items: PayrollRosterItem[];
  generated_at: string;
  fallback_used?: boolean;
}

export interface FinanceReceivablesSummary {
  month: string;
  pending_amount: number;
  overdue_amount: number;
  pending_count: number;
  overdue_count: number;
  pending_students: number;
  overdue_students: number;
  outstanding_students: number;
  outstanding_amount: number;
}

export interface FinanceReceivableStudentRow {
  student_id: string;
  first_name: string;
  last_name: string;
  class_name?: string | null;
  outstanding_amount: number;
  pending_count: number;
  overdue_count: number;
}

export interface FinancePaymentPurposeRow {
  purpose: string;
  amount: number;
  count: number;
}

export interface FinancePendingPOPRow {
  id: string;
  student_id: string;
  preschool_id: string;
  payment_amount?: number;
  payment_date?: string;
  payment_for_month?: string;
  category_code?: string;
  payment_reference?: string;
  status: string;
  description?: string;
  title: string;
  created_at: string;
  student?: {
    first_name?: string;
    last_name?: string;
  } | null;
}

export interface FinanceControlCenterBundle {
  month: string;
  snapshot: FinanceMonthSnapshot | null;
  receivables: {
    summary: FinanceReceivablesSummary;
    students: FinanceReceivableStudentRow[];
  } | null;
  payment_breakdown: {
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
    purposes: FinancePaymentPurposeRow[];
  } | null;
  pending_pops: FinancePendingPOPRow[];
  payroll: PayrollRosterBundle | null;
  payroll_fallback_used: boolean;
  errors?: Partial<Record<'snapshot' | 'receivables' | 'breakdown' | 'queue' | 'payroll', string>>;
}
