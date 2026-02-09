/**
 * Types for the Principal Fee Overview feature.
 */

export interface StudentWithFees {
  id: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  class_name?: string;
  parent_name?: string;
  fees: {
    fee_count: number;
    outstanding: number;
    paid: number;
    waived: number;
    overdue_count: number;
    pending_count: number;
  };
}

export interface FinancialSummary {
  totalStudents: number;
  totalOutstanding: number;
  totalPaid: number;
  totalWaived: number;
  overdueStudents: number;
  registrationFees: { collected: number; pending: number };
  schoolFees: { collected: number; pending: number };
}

export interface PaymentSummary {
  completedCount: number;
  completedAmount: number;
  pendingCount: number;
  pendingAmount: number;
  rejectedCount: number;
  rejectedAmount: number;
  missingEvidenceCount: number;
  methodBreakdown: PaymentBreakdownItem[];
  purposeBreakdown: PaymentBreakdownItem[];
}

export interface PaymentBreakdownItem {
  key: string;
  label: string;
  count: number;
  amount: number;
  completedAmount: number;
  pendingAmount: number;
}

export interface PopSummary {
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  rejectedCount: number;
  rejectedAmount: number;
  missingReferenceCount: number;
}

export interface ExpenseSummary {
  totalAmount: number;
  transactionCount: number;
  missingReceiptCount: number;
}

export interface UniformPaymentSummary {
  totalPaid: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
  totalRequests: number;
  submittedRequests: number;
}

export interface FeeBreakdownRow {
  key: string;
  name: string;
  feeType?: string | null;
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  count: number;
  prepaidAmount: number;
  prepaidCount: number;
}

export interface AccountingSnapshot {
  income: number;
  pending: number;
  expenses: number;
  net: number;
  completionRate: number;
}

export type FilterType = 'all' | 'outstanding' | 'paid' | 'overdue';
export type TimeFilter = 'month' | 'all';

export interface FeeOverviewData {
  students: StudentWithFees[];
  summary: FinancialSummary;
  paymentSummary: PaymentSummary;
  popSummary: PopSummary;
  expenseSummary: ExpenseSummary;
  feeBreakdown: FeeBreakdownRow[];
  advancePayments: { amount: number; count: number } | null;
  accountingSnapshot: AccountingSnapshot;
  uniformSummary: UniformPaymentSummary | null;
}
