/**
 * Async data-fetching logic for the fee overview screen.
 * Returns all summaries, breakdowns, and student lists in one call.
 */

import { assertSupabase } from '@/lib/supabase';
import { withPettyCashTenant } from '@/lib/utils/pettyCashTenant';
import { isUniformLabel } from '@/lib/utils/feeUtils';
import type {
  StudentWithFees, FinancialSummary, PaymentSummary, PopSummary,
  ExpenseSummary, FeeBreakdownRow, UniformPaymentSummary,
  AccountingSnapshot, FeeOverviewData, TimeFilter,
} from './types';
import {
  toNumber, getFeeAmount, getPaidAmount, getOutstandingAmount,
  getWaivedAmount, isInMonth, getFeeMonthDate, getFeeLabel, getFeeType,
  isAdvancePayment, isPreEnrollment, UNPAID_STATUSES, PENDING_VERIFICATION_STATUS,
} from './feeOverviewHelpers';

export async function fetchFeeOverviewData(
  organizationId: string,
  timeFilter: TimeFilter,
): Promise<FeeOverviewData> {
  const supabase = assertSupabase();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const monthIso = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}-01`;

  const snapshotPromise = timeFilter === 'month'
    ? supabase.rpc('get_finance_month_snapshot', {
        p_org_id: organizationId,
        p_month: monthIso,
      })
    : Promise.resolve({ data: null, error: null } as { data: any; error: any });

  // 1. Fetch students + fees + registrations in parallel
  const { data: studentsData, error: studentsError } = await supabase
    .from('students')
    .select(`
      id, first_name, last_name, enrollment_date, class_id, is_active, status,
      classes!students_class_id_fkey(name),
      profiles!students_parent_id_fkey(first_name, last_name)
    `)
    .eq('preschool_id', organizationId)
    .eq('is_active', true)
    .order('first_name');
  if (studentsError) throw studentsError;

  const activeStudentsData = (studentsData || []).filter(
    (student: any) => student?.is_active === true && String(student?.status || '').toLowerCase() === 'active',
  );

  const studentIds = activeStudentsData.map((s: any) => s.id);
  const { data: feesData, error: feesError } = studentIds.length
    ? await supabase.from('student_fees')
        .select('*, fee_structures(name, fee_type, description)')
        .in('student_id', studentIds)
    : { data: [] as any[], error: null };
  if (feesError) throw feesError;

  const [{ data: registrations }, { data: inAppRegistrations }, snapshotResult] = await Promise.all([
    supabase.from('registration_requests')
      .select('registration_fee_amount, payment_verified, status, created_at')
      .eq('organization_id', organizationId),
    supabase.from('child_registration_requests')
      .select('registration_fee_amount, payment_verified, status, created_at')
      .eq('preschool_id', organizationId),
    snapshotPromise,
  ]);

  const monthSnapshot = snapshotResult?.error
    ? null
    : snapshotResult?.data?.success
      ? snapshotResult.data
      : null;
  if (snapshotResult?.error) {
    console.warn('[FeeOverview] Failed to load get_finance_month_snapshot, using local aggregate fallback.', snapshotResult.error);
  }

  // 2. Group fees + build enrollment map
  const feesByStudent = new Map<string, any[]>();
  (feesData || []).forEach(fee => {
    const arr = feesByStudent.get(fee.student_id) || [];
    arr.push(fee);
    feesByStudent.set(fee.student_id, arr);
  });

  const enrollmentMap = new Map<string, Date | null>();
  activeStudentsData.forEach((s: any) => {
    const d = s.enrollment_date ? new Date(s.enrollment_date) : null;
    enrollmentMap.set(s.id, d ? new Date(d.getFullYear(), d.getMonth(), 1) : null);
  });

  // 3. Process students into StudentWithFees
  const processedStudents = buildStudentList(
    activeStudentsData, feesByStudent, enrollmentMap,
    timeFilter, monthStart, monthEnd, todayStart,
  );

  // 4. Fee breakdown + advance payments
  const { feeBreakdown, advancePayments } = buildFeeBreakdown(
    feesData || [], enrollmentMap, timeFilter, monthStart, monthEnd,
  );

  // 5. Totals + registration summary
  const summary = buildFinancialSummary(
    processedStudents, registrations || [], inAppRegistrations || [],
    timeFilter, monthStart, monthEnd, monthSnapshot,
  );

  // 6. Payments, POP, expenses
  const isMonth = timeFilter === 'month';
  const periodStart = monthStart.toISOString();
  const periodEnd = monthEnd.toISOString();
  const applyPeriod = (query: any, col = 'created_at') =>
    isMonth ? query.gte(col, periodStart).lt(col, periodEnd) : query;

  const [paymentsRes, popsRes, pettyRes, finRes] = await Promise.all([
    applyPeriod(supabase.from('payments')
      .select('amount, status, payment_reference, attachment_url, payment_method, description, metadata, created_at')
      .eq('preschool_id', organizationId)),
    applyPeriod(supabase.from('pop_uploads')
      .select('payment_amount, status, payment_reference, file_path, created_at, payment_date')
      .eq('preschool_id', organizationId)
      .eq('upload_type', 'proof_of_payment'), 'payment_date'),
    withPettyCashTenant((column, client) => applyPeriod(
      client.from('petty_cash_transactions')
        .select('id, amount, receipt_url, created_at, status, type')
        .eq(column, organizationId)
        .eq('type', 'expense'))),
    applyPeriod(supabase.from('financial_transactions')
      .select('id, amount, receipt_image_path, type, status, created_at')
      .eq('preschool_id', organizationId)
      .in('type', ['expense', 'operational_expense', 'salary', 'purchase'])),
  ]);

  const paymentsData = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
  const popsData = Array.isArray(popsRes.data) ? popsRes.data : [];
  const pettyData = Array.isArray(pettyRes.data) ? pettyRes.data : [];
  const finData = Array.isArray(finRes.data) ? finRes.data : [];

  const paymentSummary = buildPaymentSummary(paymentsData);
  const popSummary = buildPopSummary(popsData);
  const expenseSummary = buildExpenseSummary(pettyData, finData, supabase);

  const income = timeFilter === 'month' && monthSnapshot
    ? Number(monthSnapshot.collected_this_month || 0)
    : paymentSummary.completedAmount;
  const pending = timeFilter === 'month' && monthSnapshot
    ? Number(monthSnapshot.still_outstanding || 0)
    : paymentSummary.pendingAmount;
  const expenses = expenseSummary.totalAmount;
  const due = timeFilter === 'month' && monthSnapshot
    ? Number(monthSnapshot.due_this_month || 0)
    : income + pending;
  const completionRate = due > 0 ? (income / due) * 100 : 0;
  const accountingSnapshot: AccountingSnapshot = {
    income, pending, expenses, net: income - expenses, completionRate,
  };

  // 7. Uniform summary
  const uniformSummary = await fetchUniformSummary(supabase, organizationId, activeStudentsData);

  return {
    students: processedStudents, summary, paymentSummary, popSummary,
    expenseSummary, feeBreakdown, advancePayments, accountingSnapshot, uniformSummary,
  };
}

// ---------------------------------------------------------------------------
// Internal builders
// ---------------------------------------------------------------------------

function buildStudentList(
  studentsData: any[], feesByStudent: Map<string, any[]>,
  enrollmentMap: Map<string, Date | null>,
  timeFilter: TimeFilter, monthStart: Date, monthEnd: Date, todayStart: Date,
): StudentWithFees[] {
  return studentsData.map((student: any) => {
    const studentFees = feesByStudent.get(student.id) || [];
    const classData = Array.isArray(student.classes) ? student.classes[0] : student.classes;
    const parentData = Array.isArray(student.profiles) ? student.profiles[0] : student.profiles;
    const enrollmentMS = enrollmentMap.get(student.id) || null;

    const payableFees = studentFees.filter(f => !isPreEnrollment(f, enrollmentMS));
    const monthFees = payableFees.filter(f => isInMonth(getFeeMonthDate(f), monthStart, monthEnd));
    const baseFees = timeFilter === 'month' ? monthFees : payableFees;
    const unpaidFees = baseFees.filter(f => UNPAID_STATUSES.has(String(f.status)));

    const outstanding = unpaidFees.reduce((s, f) => s + getOutstandingAmount(f), 0);
    const paid = baseFees.reduce((s, f) => s + getPaidAmount(f), 0);
    const waived = baseFees.reduce((s, f) => s + getWaivedAmount(f), 0);

    const overdue_count = baseFees.filter(f => {
      if (!UNPAID_STATUSES.has(String(f.status)) || String(f.status) === PENDING_VERIFICATION_STATUS) return false;
      if (!f?.due_date) return false;
      const due = new Date(f.due_date);
      return !Number.isNaN(due.getTime()) && due < todayStart;
    }).length;

    const pending_count = baseFees.filter(f => {
      if (!UNPAID_STATUSES.has(String(f.status))) return false;
      if (String(f.status) === PENDING_VERIFICATION_STATUS) return true;
      if (!f?.due_date) return true;
      const due = new Date(f.due_date);
      return Number.isNaN(due.getTime()) || due >= todayStart;
    }).length;

    return {
      id: student.id, first_name: student.first_name, last_name: student.last_name,
      class_id: student.class_id,
      class_name: classData?.name,
      parent_name: parentData ? `${parentData.first_name} ${parentData.last_name}` : undefined,
      fees: { fee_count: baseFees.length, outstanding, paid, waived, overdue_count, pending_count },
    };
  });
}

function buildFeeBreakdown(
  feesData: any[], enrollmentMap: Map<string, Date | null>,
  timeFilter: TimeFilter, monthStart: Date, monthEnd: Date,
) {
  const breakdownMap = new Map<string, FeeBreakdownRow>();
  let advanceCount = 0;
  let advanceAmount = 0;

  feesData.forEach((fee: any) => {
    const enrollmentMS = enrollmentMap.get(fee.student_id) || null;
    if (isPreEnrollment(fee, enrollmentMS)) return;
    if (timeFilter === 'month' && !isInMonth(getFeeMonthDate(fee), monthStart, monthEnd)) return;

    const key = fee.fee_structure_id || getFeeLabel(fee);
    const label = getFeeLabel(fee);
    const feeType = getFeeType(fee);
    const amount = getFeeAmount(fee);
    const paidAmt = getPaidAmount(fee);
    const outAmt = UNPAID_STATUSES.has(String(fee?.status)) ? getOutstandingAmount(fee) : 0;

    const existing = breakdownMap.get(key) || {
      key, name: label, feeType, totalDue: 0, totalPaid: 0,
      outstanding: 0, count: 0, prepaidAmount: 0, prepaidCount: 0,
    };
    existing.totalDue += amount;
    existing.totalPaid += paidAmt;
    existing.outstanding += outAmt;
    existing.count += 1;

    if (timeFilter === 'month' && isAdvancePayment(fee)) {
      existing.prepaidAmount += paidAmt;
      existing.prepaidCount += 1;
      advanceCount += 1;
      advanceAmount += paidAmt;
    }
    breakdownMap.set(key, existing);
  });

  return {
    feeBreakdown: Array.from(breakdownMap.values()).sort((a, b) => b.totalDue - a.totalDue),
    advancePayments: timeFilter === 'month' && advanceCount > 0
      ? { amount: advanceAmount, count: advanceCount }
      : null,
  };
}

function buildFinancialSummary(
  students: StudentWithFees[], registrations: any[], inAppRegistrations: any[],
  timeFilter: TimeFilter, monthStart: Date, monthEnd: Date, monthSnapshot?: any | null,
): FinancialSummary {
  const totalOutstanding = students.reduce((s, st) => s + st.fees.outstanding, 0);
  const totalPaid = students.reduce((s, st) => s + st.fees.paid, 0);
  const totalWaived = students.reduce((s, st) => s + st.fees.waived, 0);
  const overdueStudents = students.filter(st => st.fees.overdue_count > 0).length;

  const regData = [...registrations, ...inAppRegistrations];
  const filterByTime = (r: any) => {
    if (timeFilter !== 'month') return true;
    if (!r?.created_at) return false;
    const created = new Date(r.created_at);
    return !Number.isNaN(created.getTime()) && created >= monthStart && created < monthEnd;
  };

  const regCollected = regData.filter(filterByTime)
    .filter((r: any) => r.payment_verified && r.status === 'approved')
    .reduce((s: number, r: any) => s + (parseFloat(r.registration_fee_amount) || 0), 0);
  const regPending = regData.filter(filterByTime)
    .filter((r: any) => !r.payment_verified && r.registration_fee_amount && r.status !== 'rejected')
    .reduce((s: number, r: any) => s + (parseFloat(r.registration_fee_amount) || 0), 0);

  const schoolCollected = timeFilter === 'month' && monthSnapshot
    ? Number(monthSnapshot.collected_this_month || 0)
    : totalPaid;
  const schoolOutstanding = timeFilter === 'month' && monthSnapshot
    ? Number(monthSnapshot.still_outstanding || 0)
    : totalOutstanding;

  return {
    totalStudents: students.length,
    totalOutstanding: schoolOutstanding + regPending,
    totalPaid: schoolCollected + regCollected,
    totalWaived,
    overdueStudents,
    registrationFees: { collected: regCollected, pending: regPending },
    schoolFees: { collected: schoolCollected, pending: schoolOutstanding },
  };
}

function slugifyKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizePaymentMethodLabel(raw: unknown): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return 'Unspecified';
  if (value.includes('eft') || value.includes('bank')) return 'Bank Transfer / EFT';
  if (value.includes('cash')) return 'Cash';
  if (value.includes('card') || value.includes('pos')) return 'Card';
  if (value.includes('payfast')) return 'PayFast';
  if (value.includes('mobile')) return 'Mobile Payment';
  if (value.includes('manual')) return 'Manual';
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizePaymentPurposeLabel(payment: any): string {
  const metadata = payment?.metadata && typeof payment.metadata === 'object'
    ? payment.metadata
    : {};
  const candidates = [
    metadata?.category_code,
    metadata?.payment_context,
    metadata?.payment_purpose,
    metadata?.fee_type,
    metadata?.purpose,
    payment?.description,
  ];
  const first = candidates.find((v) => typeof v === 'string' && String(v).trim().length > 0);
  const value = String(first || '').trim().toLowerCase();
  if (!value) return 'General';

  if (value.includes('uniform')) return 'Uniform';
  if (value.includes('registration') || value.includes('admission') || value.includes('enrol')) return 'Registration';
  if (value.includes('tuition') || value.includes('school fee') || value === 'fees') return 'Tuition';
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

function addPaymentBreakdown(
  map: Map<string, {
    key: string;
    label: string;
    count: number;
    amount: number;
    completedAmount: number;
    pendingAmount: number;
  }>,
  label: string,
  amount: number,
  status: 'completed' | 'pending',
) {
  const key = slugifyKey(label);
  const entry = map.get(key) || {
    key,
    label,
    count: 0,
    amount: 0,
    completedAmount: 0,
    pendingAmount: 0,
  };
  entry.count += 1;
  entry.amount += amount;
  if (status === 'completed') entry.completedAmount += amount;
  else entry.pendingAmount += amount;
  map.set(key, entry);
}

function buildPaymentSummary(paymentsData: any[]): PaymentSummary {
  const methodBreakdown = new Map<string, {
    key: string;
    label: string;
    count: number;
    amount: number;
    completedAmount: number;
    pendingAmount: number;
  }>();
  const purposeBreakdown = new Map<string, {
    key: string;
    label: string;
    count: number;
    amount: number;
    completedAmount: number;
    pendingAmount: number;
  }>();

  const summary = paymentsData.reduce((acc, payment: any) => {
    const status = String(payment.status || 'pending');
    const amount = Number(payment.amount) || 0;
    const hasEvidence = Boolean(payment.payment_reference) || Boolean(payment.attachment_url);
    const methodLabel = normalizePaymentMethodLabel(payment.payment_method);
    const purposeLabel = normalizePaymentPurposeLabel(payment);

    if (['completed', 'approved'].includes(status)) {
      acc.completedCount += 1; acc.completedAmount += amount;
      if (!hasEvidence) acc.missingEvidenceCount += 1;
      addPaymentBreakdown(methodBreakdown, methodLabel, amount, 'completed');
      addPaymentBreakdown(purposeBreakdown, purposeLabel, amount, 'completed');
    } else if (['pending', 'proof_submitted', 'under_review'].includes(status)) {
      acc.pendingCount += 1; acc.pendingAmount += amount;
      if (!hasEvidence) acc.missingEvidenceCount += 1;
      addPaymentBreakdown(methodBreakdown, methodLabel, amount, 'pending');
      addPaymentBreakdown(purposeBreakdown, purposeLabel, amount, 'pending');
    } else if (['failed', 'rejected', 'reversed', 'voided', 'cancelled'].includes(status)) {
      acc.rejectedCount += 1; acc.rejectedAmount += amount;
    } else {
      acc.pendingCount += 1; acc.pendingAmount += amount;
      if (!hasEvidence) acc.missingEvidenceCount += 1;
      addPaymentBreakdown(methodBreakdown, methodLabel, amount, 'pending');
      addPaymentBreakdown(purposeBreakdown, purposeLabel, amount, 'pending');
    }
    return acc;
  }, {
    completedCount: 0, completedAmount: 0, pendingCount: 0, pendingAmount: 0,
    rejectedCount: 0, rejectedAmount: 0, missingEvidenceCount: 0,
    methodBreakdown: [], purposeBreakdown: [],
  } as PaymentSummary);

  summary.methodBreakdown = Array.from(methodBreakdown.values()).sort((a, b) => b.amount - a.amount);
  summary.purposeBreakdown = Array.from(purposeBreakdown.values()).sort((a, b) => b.amount - a.amount);
  return summary;
}

function buildPopSummary(popsData: any[]): PopSummary {
  return popsData.reduce((acc, pop: any) => {
    const status = String(pop.status || 'pending');
    const amount = Number(pop.payment_amount) || 0;
    if (status === 'approved') { acc.approvedCount += 1; acc.approvedAmount += amount; }
    else if (status === 'rejected') { acc.rejectedCount += 1; acc.rejectedAmount += amount; }
    else { acc.pendingCount += 1; acc.pendingAmount += amount; }
    if (!pop.payment_reference) acc.missingReferenceCount += 1;
    return acc;
  }, {
    pendingCount: 0, pendingAmount: 0, approvedCount: 0, approvedAmount: 0,
    rejectedCount: 0, rejectedAmount: 0, missingReferenceCount: 0,
  } as PopSummary);
}

function buildExpenseSummary(
  pettyData: any[], finData: any[], supabase: any,
): ExpenseSummary {
  // Note: receipt lookup is async in original but we fold it into a sync summary
  // for simplicity — missing receipt detection uses receipt_url field only here.
  const pettyTotal = pettyData.reduce((s, t: any) => s + Math.abs(Number(t.amount) || 0), 0);
  const pettyMissing = pettyData.filter((t: any) => !t.receipt_url).length;
  const finTotal = finData.reduce((s, t: any) => s + Math.abs(Number(t.amount) || 0), 0);
  const finMissing = finData.filter((t: any) => !t.receipt_image_path).length;

  return {
    totalAmount: pettyTotal + finTotal,
    transactionCount: pettyData.length + finData.length,
    missingReceiptCount: pettyMissing + finMissing,
  };
}

async function fetchUniformSummary(
  supabase: any, organizationId: string, studentsData: any[],
): Promise<UniformPaymentSummary | null> {
  try {
    const [{ data: uniformRequests }, { data: uniformPops }, { data: uniformPayments }] = await Promise.all([
      supabase.from('uniform_requests').select('id, student_id').eq('preschool_id', organizationId),
      supabase.from('pop_uploads')
        .select('id, payment_amount, status, description, title')
        .eq('preschool_id', organizationId).eq('upload_type', 'proof_of_payment'),
      supabase.from('payments')
        .select('id, amount, status, description, metadata')
        .eq('preschool_id', organizationId),
    ]);

    const uPops = (uniformPops || []).filter((p: any) =>
      isUniformLabel(p?.description) || isUniformLabel(p?.title));
    const uPayments = (uniformPayments || []).filter((p: any) =>
      isUniformLabel(p?.description) ||
      isUniformLabel(p?.metadata?.payment_purpose) ||
      String(p?.metadata?.payment_context || '').toLowerCase() === 'uniform' ||
      String(p?.metadata?.fee_type || '').toLowerCase() === 'uniform');

    let uPaid = 0, uPending = 0, uPaidCount = 0, uPendingCount = 0;
    uPops.forEach((p: any) => {
      const amt = Number(p.payment_amount) || 0;
      if (p.status === 'approved') { uPaid += amt; uPaidCount += 1; }
      else { uPending += amt; uPendingCount += 1; }
    });
    uPayments.forEach((p: any) => {
      const amt = Number(p.amount) || 0;
      if (['completed', 'approved'].includes(String(p.status))) { uPaid += amt; uPaidCount += 1; }
      else if (['pending', 'proof_submitted', 'under_review'].includes(String(p.status))) { uPending += amt; uPendingCount += 1; }
    });

    const allStudentIds = new Set(studentsData.map((s: any) => s.id));
    const submittedIds = new Set((uniformRequests || []).map((r: any) => r.student_id));

    return {
      totalPaid: uPaid, totalPending: uPending,
      paidCount: uPaidCount, pendingCount: uPendingCount,
      totalRequests: allStudentIds.size, submittedRequests: submittedIds.size,
    };
  } catch {
    return null;
  }
}
