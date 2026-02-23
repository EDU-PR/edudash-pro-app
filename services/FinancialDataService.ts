/**
 * Financial Data Service
 *
 * Adapts existing database schema (payments + petty_cash_transactions)
 * for financial dashboard display.
 *
 * Implementation is split across sub-modules in `./finance/`.
 * This file is a thin facade that preserves the original public API
 * so that all existing imports continue to work unchanged.
 *
 * Types are in services/financial/types.ts for reuse.
 */

import type {
  ApprovePopPaymentPayload,
  FinanceControlCenterBundle,
  FinanceMonthExpenseBreakdown,
  FinanceQueueStage,
  FinanceQueueStageSummary,
  FinanceMonthSnapshot,
  FinanceReceivableStudentRow,
  FinanceReceivablesSummary,
} from '@/types/finance';

// Re-export types for backward compatibility
export type {
  UnifiedTransaction,
  FinancialMetrics,
  MonthlyTrendData,
  DateRange,
  TransactionRecord,
  FinanceOverviewData,
  FinanceMonthPaymentBreakdown,
  FinanceTenantColumn,
} from './financial/types';

import type {
  UnifiedTransaction,
  FinancialMetrics,
  MonthlyTrendData,
  DateRange,
  TransactionRecord,
  FinanceOverviewData,
  FinanceMonthPaymentBreakdown,
} from './financial/types';

// ── Sub-module imports ────────────────────────────────────────────
import { getFinancialMetrics, getMonthlyTrendData } from './finance/metricsService';
import { getOverview } from './finance/overviewService';
import { getRecentTransactions, getTransactions } from './finance/transactionService';
import { formatCurrency, getStatusColor, getDisplayStatus } from './finance/statusHelpers';
import {
  getMonthSnapshot,
  getMonthPaymentBreakdown,
  approvePOPWithAllocations,
  getFinanceControlCenterBundle,
} from './finance/controlCenterService';
import {
  getMonthExpenseBreakdown,
  getReceivablesSnapshot,
  EXPENSE_TYPES,
  logExpense,
  getExpenseCategories,
  getStaffForSalary,
} from './finance/expenseAndReceivables';
import { getPaymentsForBankReconciliation } from './finance/reconciliationService';

export class FinancialDataService {
  /** @deprecated Use getFinanceControlCenterBundle(). */
  static getFinancialMetrics(preschoolId: string): Promise<FinancialMetrics> {
    return getFinancialMetrics(preschoolId);
  }

  static getMonthlyTrendData(preschoolId: string): Promise<MonthlyTrendData[]> {
    return getMonthlyTrendData(preschoolId);
  }

  static getRecentTransactions(
    preschoolId: string,
    limit: number = 10,
  ): Promise<UnifiedTransaction[]> {
    return getRecentTransactions(preschoolId, limit);
  }

  /** @deprecated Use getFinanceControlCenterBundle(). */
  static getOverview(preschoolId?: string): Promise<FinanceOverviewData> {
    return getOverview(preschoolId);
  }

  static getTransactions(
    dateRange: DateRange,
    preschoolId?: string,
    options?: { useAccountingDate?: boolean },
  ): Promise<TransactionRecord[]> {
    return getTransactions(dateRange, preschoolId, options);
  }

<<<<<<< HEAD
=======
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

  private static getReceivableEligibility(
    student: any,
    monthIso: string,
    nextMonthIso: string,
  ): 'eligible' | 'inactive' | 'future_enrollment' | 'unverified_registration' {
    if (!this.isStudentActiveForReceivables(student)) return 'inactive';

    const monthStart = parseDateValue(monthIso);
    const nextMonthStart = parseDateValue(nextMonthIso);
    const enrollmentDate = parseDateValue(student?.enrollment_date || null);
    if (
      enrollmentDate &&
      nextMonthStart &&
      !Number.isNaN(enrollmentDate.getTime()) &&
      !Number.isNaN(nextMonthStart.getTime()) &&
      enrollmentDate >= nextMonthStart
    ) {
      return 'future_enrollment';
    }

    const hasRegistrationFlags = (
      student?.payment_verified !== null &&
      student?.payment_verified !== undefined
    ) || (
      student?.registration_fee_paid !== null &&
      student?.registration_fee_paid !== undefined
    );
    const registrationVerified = Boolean(student?.payment_verified) || Boolean(student?.registration_fee_paid);
    const isNewEnrollmentWindow = Boolean(
      enrollmentDate &&
      monthStart &&
      !Number.isNaN(enrollmentDate.getTime()) &&
      !Number.isNaN(monthStart.getTime()) &&
      enrollmentDate >= monthStart
    );
    if (hasRegistrationFlags && !registrationVerified && isNewEnrollmentWindow) {
      return 'unverified_registration';
    }

    return 'eligible';
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
>>>>>>> e60d4ec7 (Moving to Composer Edits)
  static formatCurrency(amount: number): string {
    return formatCurrency(amount);
  }

  static getStatusColor(status: string): string {
    return getStatusColor(status);
  }

  static getDisplayStatus(status: string): string {
    return getDisplayStatus(status);
  }

  static approvePOPWithAllocations(
    payload: ApprovePopPaymentPayload,
  ): Promise<{ paymentId?: string; allocatedAmount: number; overpaymentAmount: number }> {
    return approvePOPWithAllocations(payload);
  }

  static getMonthSnapshot(orgId: string, monthIso?: string): Promise<FinanceMonthSnapshot> {
    return getMonthSnapshot(orgId, monthIso);
  }

  static getMonthPaymentBreakdown(
    orgId: string,
    monthIso?: string,
  ): Promise<FinanceMonthPaymentBreakdown> {
    return getMonthPaymentBreakdown(orgId, monthIso);
  }

  static getMonthExpenseBreakdown(
    orgId: string,
    monthIso?: string,
  ): Promise<FinanceMonthExpenseBreakdown> {
    return getMonthExpenseBreakdown(orgId, monthIso);
  }

  static getReceivablesSnapshot(
    orgId: string,
    monthIso?: string,
  ): Promise<{ summary: FinanceReceivablesSummary; students: FinanceReceivableStudentRow[] }> {
<<<<<<< HEAD
    return getReceivablesSnapshot(orgId, monthIso);
=======
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
          enrollment_date,
          registration_fee_paid,
          payment_verified,
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
            enrollment_date,
            registration_fee_paid,
            payment_verified,
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
    const excludedInactiveStudents = new Set<string>();
    const excludedFutureEnrollmentStudents = new Set<string>();
    const excludedUnverifiedStudents = new Set<string>();
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

      const eligibility = this.getReceivableEligibility(studentData, month, nextMonth);
      if (eligibility !== 'eligible') {
        if (eligibility === 'inactive') excludedInactiveStudents.add(studentId);
        if (eligibility === 'future_enrollment') excludedFutureEnrollmentStudents.add(studentId);
        if (eligibility === 'unverified_registration') excludedUnverifiedStudents.add(studentId);
        continue;
      }

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
        excluded_inactive_students: excludedInactiveStudents.size,
        excluded_future_enrollment_students: excludedFutureEnrollmentStudents.size,
        excluded_unverified_students: excludedUnverifiedStudents.size,
      },
      students,
    };
>>>>>>> e60d4ec7 (Moving to Composer Edits)
  }

  static getFinanceControlCenterBundle(
    orgId: string,
    monthIso?: string,
  ): Promise<FinanceControlCenterBundle> {
    return getFinanceControlCenterBundle(orgId, monthIso);
  }

  static readonly EXPENSE_TYPES = EXPENSE_TYPES;

  static logExpense(params: {
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
    return logExpense(params);
  }

  static getExpenseCategories(
    preschoolId: string,
  ): Promise<Array<{ id: string; name: string; color: string; icon: string; monthlyBudget: number }>> {
    return getExpenseCategories(preschoolId);
  }

  static getStaffForSalary(
    preschoolId: string,
  ): Promise<Array<{ id: string; name: string; role: string }>> {
    return getStaffForSalary(preschoolId);
  }

  static getPaymentsForBankReconciliation(
    orgId: string,
    monthIso: string,
  ): Promise<
    Array<{
      date: string;
      amount: number;
      reference: string;
      student: string;
      parent: string;
      category: string;
      status: string;
    }>
  > {
    return getPaymentsForBankReconciliation(orgId, monthIso);
  }
}
