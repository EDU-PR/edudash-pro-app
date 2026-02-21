import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import { SimpleHeader } from '@/components/ui/SimpleHeader';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { derivePreschoolId } from '@/lib/roleUtils';
import { assertSupabase } from '@/lib/supabase';
import { inferFeeCategoryCode } from '@/lib/utils/feeUtils';
import { getMonthStartISO } from '@/lib/utils/dateUtils';
import { normalizePaymentMethodCode, PAYMENT_METHOD_LABELS } from '@/lib/utils/paymentMethod';
import { FinancialDataService } from '@/services/FinancialDataService';
import { PayrollService } from '@/services/PayrollService';
import { ExportService } from '@/lib/services/finance/ExportService';
import { PayrollPaymentHistory } from '@/components/principal/PayrollPaymentHistory';
import { PayrollAdvanceModal } from '@/components/principal/PayrollAdvanceModal';
import { useFinanceAccessGuard } from '@/hooks/useFinanceAccessGuard';
import FinancePasswordPrompt from '@/components/security/FinancePasswordPrompt';
import type {
  FeeCategoryCode,
  FinanceControlCenterBundle,
  FinancePendingPOPRow,
  PayrollRosterItem,
} from '@/types/finance';
import { CenterTab, TAB_ITEMS, formatCurrency } from '@/lib/screen-data/finance-control-center.types';

const CATEGORY_LABELS: Record<string, string> = {
  tuition: 'Tuition',
  registration: 'Registration',
  deposit: 'Deposit',
  uniform: 'Uniform',
  aftercare: 'Aftercare',
  transport: 'Transport',
  meal: 'Meals',
  meals: 'Meals',
  activities: 'Activities',
  excursion: 'Excursion',
  fundraiser: 'Fundraiser',
  donation_drive: 'Donation Drive',
  books: 'Books & Stationery',
  other: 'Other',
  ad_hoc: 'Other',
};

const CATEGORY_COLORS: Record<FeeCategoryCode, string> = {
  tuition: '#3B82F6',
  registration: '#8B5CF6',
  uniform: '#F59E0B',
  aftercare: '#22C55E',
  transport: '#06B6D4',
  meal: '#EF4444',
  meals: '#EF4444',
  deposit: '#A855F7',
  activities: '#0EA5E9',
  excursion: '#0891B2',
  fundraiser: '#14B8A6',
  donation_drive: '#10B981',
  books: '#F97316',
  other: '#64748B',
  ad_hoc: '#64748B',
};

const CATEGORY_OPTIONS: FeeCategoryCode[] = [
  'tuition',
  'registration',
  'deposit',
  'uniform',
  'aftercare',
  'transport',
  'meals',
  'meal',
  'activities',
  'excursion',
  'fundraiser',
  'donation_drive',
  'books',
  'other',
  'ad_hoc',
];

const TAB_SET = new Set<CenterTab>(TAB_ITEMS.map((tab) => tab.id));

const isCenterTab = (value: unknown): value is CenterTab =>
  typeof value === 'string' && TAB_SET.has(value as CenterTab);

const getTabFromParam = (value?: string | string[]): CenterTab => {
  const tab = Array.isArray(value) ? value[0] : value;
  return isCenterTab(tab) ? tab : 'overview';
};

const formatAmountInput = (value: number): string => {
  if (!Number.isFinite(value)) return '';
  const rounded = Number(value.toFixed(2));
  return String(rounded).replace(/\.00$/, '');
};

const parseAmountInput = (value: string): number => {
  const normalized = value.replace(/,/g, '').trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const deriveNetSalary = (recipient?: PayrollRosterItem | null): number => {
  if (!recipient) return 0;
  const base = Number(recipient.base_salary || 0);
  const allowances = Number(recipient.allowances || 0);
  const deductions = Number(recipient.deductions || 0);
  const explicitNet = Number(recipient.net_salary);
  if (Number.isFinite(explicitNet) && explicitNet > 0) return explicitNet;
  const computed = base + allowances - deductions;
  return Number.isFinite(computed) ? computed : 0;
};

const pickSectionError = (
  errors: FinanceControlCenterBundle['errors'] | undefined,
  key: 'snapshot' | 'receivables' | 'expenses' | 'breakdown' | 'queue' | 'payroll',
): string | null => {
  const value = errors?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

export default function FinanceControlCenterScreen() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const { showAlert, alertProps } = useAlertModal();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();

  const orgId = derivePreschoolId(profile);
  const financeAccess = useFinanceAccessGuard();
  const [activeTab, setActiveTab] = React.useState<CenterTab>(() => getTabFromParam(params.tab));
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const [monthCursor, setMonthCursor] = React.useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [bundle, setBundle] = React.useState<FinanceControlCenterBundle | null>(null);
  const [processingPopId, setProcessingPopId] = React.useState<string | null>(null);
  const [queueCategoryOverrides, setQueueCategoryOverrides] = React.useState<Record<string, FeeCategoryCode>>({});

  const [showPayModal, setShowPayModal] = React.useState(false);
  const [selectedRecipient, setSelectedRecipient] = React.useState<PayrollRosterItem | null>(null);
  const [payAmount, setPayAmount] = React.useState('');
  const [payMethod, setPayMethod] = React.useState('bank_transfer');
  const [payReference, setPayReference] = React.useState('');
  const [payNotes, setPayNotes] = React.useState('');
  const [recordingPayment, setRecordingPayment] = React.useState(false);
  const [showSalaryModal, setShowSalaryModal] = React.useState(false);
  const [selectedSalaryRecipient, setSelectedSalaryRecipient] = React.useState<PayrollRosterItem | null>(null);
  const [salaryBase, setSalaryBase] = React.useState('');
  const [salaryAllowances, setSalaryAllowances] = React.useState('');
  const [salaryDeductions, setSalaryDeductions] = React.useState('');
  const [salaryNotes, setSalaryNotes] = React.useState('');
  const [savingSalary, setSavingSalary] = React.useState(false);
  const [showHistoryModal, setShowHistoryModal] = React.useState(false);
  const [historyRecipient, setHistoryRecipient] = React.useState<PayrollRosterItem | null>(null);
  const [showAdvanceModal, setShowAdvanceModal] = React.useState(false);
  const [advanceRecipient, setAdvanceRecipient] = React.useState<PayrollRosterItem | null>(null);
  const [exportingReconciliation, setExportingReconciliation] = React.useState(false);

  const monthIso = React.useMemo(
    () => `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}-01`,
    [monthCursor],
  );
  const monthLabel = React.useMemo(
    () => monthCursor.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }),
    [monthCursor],
  );

  React.useEffect(() => {
    const nextTab = getTabFromParam(params.tab);
    setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
  }, [params.tab]);

  const setTab = React.useCallback((nextTab: CenterTab) => {
    setActiveTab(nextTab);
    try {
      router.setParams({ tab: nextTab } as any);
    } catch {
      // Intentional: non-fatal.
    }
  }, [router]);

  const snapshot = bundle?.snapshot || null;
  const receivables = bundle?.receivables || null;
  const expenses = bundle?.expenses || null;
  const paymentBreakdown = bundle?.payment_breakdown || null;
  const pendingPOPs = bundle?.pending_pops || [];
  const payrollItems = bundle?.payroll?.items || [];

  const derivedOverview = React.useMemo(() => {
    const due = Number(snapshot?.due_this_month || 0);
    const collected = Number(snapshot?.collected_this_month || 0);
    const collectedAllocated = Number(snapshot?.collected_allocated_amount || 0);
    const outstanding = Number(snapshot?.still_outstanding || 0);
    const snapshotExpensesTotal = Number(snapshot?.expenses_this_month || 0);
    const breakdownExpensesTotal = Number(expenses?.total_expenses || 0);
    const snapshotPettyCashExpenses = Number(snapshot?.petty_cash_expenses_this_month || 0);
    const breakdownPettyCashExpenses = Number(expenses?.petty_cash_expenses || 0);
    const snapshotFinancialExpenses = Number(snapshot?.financial_expenses_this_month || 0);
    const breakdownFinancialExpenses = Number(expenses?.financial_expenses || 0);
    const totalExpenses = snapshotExpensesTotal > 0 ? snapshotExpensesTotal : breakdownExpensesTotal;
    const pettyCashExpenses = snapshotPettyCashExpenses > 0 ? snapshotPettyCashExpenses : breakdownPettyCashExpenses;
    const financialExpenses = snapshotFinancialExpenses > 0 ? snapshotFinancialExpenses : breakdownFinancialExpenses;
    const pendingAmount = Number(snapshot?.pending_amount || 0);
    const overdueAmount = Number(snapshot?.overdue_amount || 0);
    const equationDelta = Math.abs((due - collected) - outstanding);
    const allocationGap = Number.isFinite(Number(snapshot?.kpi_delta))
      ? Number(snapshot?.kpi_delta || 0)
      : Math.abs((due - outstanding) - collectedAllocated);

    return {
      due,
      collected,
      collectedAllocated,
      collectedSource: snapshot?.collected_source || 'allocations',
      outstanding,
      expenses: totalExpenses,
      pettyCashExpenses,
      financialExpenses,
      expenseEntries: Number(expenses?.entries?.length || 0),
      netAfterExpenses: Number(snapshot?.net_after_expenses || (collected - totalExpenses)),
      pendingAmount,
      overdueAmount,
      pendingStudents: Number(snapshot?.pending_students || receivables?.summary?.pending_students || 0),
      overdueStudents: Number(snapshot?.overdue_students || receivables?.summary?.overdue_students || 0),
      pendingCount: Number(snapshot?.pending_count || receivables?.summary?.pending_count || 0),
      overdueCount: Number(snapshot?.overdue_count || receivables?.summary?.overdue_count || 0),
      pendingPOPs: Math.max(Number(snapshot?.pending_pop_reviews || 0), pendingPOPs.length),
      prepaid: Number(snapshot?.prepaid_for_future_months || 0),
      payrollDue: Number(snapshot?.payroll_due || 0),
      payrollPaid: Number(snapshot?.payroll_paid || 0),
      kpiCorrelated: equationDelta < 0.01,
      kpiDelta: equationDelta,
      allocationGap,
      snapshotAsOf: snapshot?.as_of_date || snapshot?.generated_at || null,
    };
  }, [snapshot, receivables, expenses, pendingPOPs.length]);

  const loadData = React.useCallback(async (force = false) => {
    if (financeAccess.needsPassword) return;
    if (!orgId) return;
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await FinancialDataService.getFinanceControlCenterBundle(orgId, monthIso);
      setBundle(data);
      if (!data.snapshot && !data.receivables && !data.expenses && !data.payment_breakdown && !data.pending_pops.length) {
        showAlert({
          title: 'Finance Warning',
          message: 'Some finance sections are unavailable. You can still use the available tabs.',
          type: 'warning',
        });
      }
    } catch (error: any) {
      showAlert({
        title: 'Finance Error',
        message: error?.message || 'Failed to load finance control center',
        type: 'error',
      });
    } finally {
      setLoading(financeAccess.needsPassword ? true : false);
      setRefreshing(false);
    }
  }, [financeAccess.needsPassword, orgId, monthIso, showAlert]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = React.useCallback(() => {
    loadData(true);
  }, [loadData]);

  const resolveQueueCategory = React.useCallback((upload: FinancePendingPOPRow): FeeCategoryCode => {
    const override = queueCategoryOverrides[upload.id];
    if (override) return override;
    return inferFeeCategoryCode(upload.category_code || upload.description || upload.title || 'tuition');
  }, [queueCategoryOverrides]);

  const openQueueCategoryPicker = React.useCallback((upload: FinancePendingPOPRow) => {
    const currentCode = resolveQueueCategory(upload);
    showAlert({
      title: 'Payment Category',
      message: 'Choose the category to use when approving this payment proof.',
      type: 'warning',
      buttons: [
        ...CATEGORY_OPTIONS.map((code) => ({
          text: `${CATEGORY_LABELS[code]}${currentCode === code ? ' ✓' : ''}`,
          onPress: () => {
            setQueueCategoryOverrides((prev) => ({ ...prev, [upload.id]: code }));
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  }, [resolveQueueCategory, showAlert]);

  const handleQuickApprove = React.useCallback(async (upload: FinancePendingPOPRow) => {
    if (!orgId) return;
    setProcessingPopId(upload.id);
    try {
      const billingMonth = getMonthStartISO(upload.payment_for_month || upload.payment_date || monthIso, {
        recoverUtcMonthBoundary: Boolean(upload.payment_for_month),
      });
      const originalCategory = inferFeeCategoryCode(upload.category_code || upload.description || upload.title || 'tuition');
      const categoryCode = resolveQueueCategory(upload);
      const categoryCorrectionNote = categoryCode !== originalCategory
        ? `Category corrected from ${CATEGORY_LABELS[originalCategory]} to ${CATEGORY_LABELS[categoryCode]}`
        : `Category confirmed as ${CATEGORY_LABELS[categoryCode]}`;
      await FinancialDataService.approvePOPWithAllocations({
        uploadId: upload.id,
        billingMonth,
        categoryCode,
        notes: `Approved from Finance Control Center. ${categoryCorrectionNote}.`,
      });
      setQueueCategoryOverrides((prev) => {
        const next = { ...prev };
        delete next[upload.id];
        return next;
      });
      await loadData(true);
    } catch (error: any) {
      showAlert({
        title: 'Approval Failed',
        message: error?.message || 'Could not approve payment',
        type: 'error',
      });
    } finally {
      setProcessingPopId(null);
    }
  }, [loadData, monthIso, orgId, resolveQueueCategory, showAlert]);

  const rejectPaymentProof = React.useCallback(async (upload: FinancePendingPOPRow, reason: string) => {
    setProcessingPopId(upload.id);
    try {
      const { error } = await assertSupabase()
        .from('pop_uploads')
        .update({
          status: 'rejected',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reason.trim(),
        })
        .eq('id', upload.id);
      if (error) throw error;
      await loadData(true);
    } catch (err: any) {
      showAlert({
        title: 'Rejection Failed',
        message: err?.message || 'Could not reject payment',
        type: 'error',
      });
    } finally {
      setProcessingPopId(null);
    }
  }, [loadData, profile?.id, showAlert]);

  const handleQuickReject = React.useCallback((upload: FinancePendingPOPRow) => {
    showAlert({
      title: 'Reject Payment',
      message: 'Choose a reason:',
      type: 'warning',
      buttons: [
        { text: 'Wrong amount', onPress: () => rejectPaymentProof(upload, 'Wrong amount submitted') },
        { text: 'Unreadable proof', onPress: () => rejectPaymentProof(upload, 'Proof document is unreadable') },
        { text: 'Duplicate payment', onPress: () => rejectPaymentProof(upload, 'Duplicate payment submission') },
        { text: 'Cancel', style: 'cancel' },
      ],
    });
  }, [rejectPaymentProof, showAlert]);

  const openPayModal = React.useCallback((recipient: PayrollRosterItem) => {
    setSelectedRecipient(recipient);
    setPayAmount(formatAmountInput(deriveNetSalary(recipient)));
    setPayMethod('bank_transfer');
    setPayReference('');
    setPayNotes('');
    setShowPayModal(true);
  }, []);

  const openSalaryModal = React.useCallback((recipient: PayrollRosterItem) => {
    setSelectedSalaryRecipient(recipient);
    setSalaryBase(formatAmountInput(Number(recipient.base_salary || 0)));
    setSalaryAllowances(formatAmountInput(Number(recipient.allowances || 0)));
    setSalaryDeductions(formatAmountInput(Number(recipient.deductions || 0)));
    setSalaryNotes('');
    setShowSalaryModal(true);
  }, []);

  const salaryPreviewNet = React.useMemo(() => {
    const base = parseAmountInput(salaryBase);
    const allowances = parseAmountInput(salaryAllowances);
    const deductions = parseAmountInput(salaryDeductions);
    if (![base, allowances, deductions].every(Number.isFinite)) return 0;
    return Number((base + allowances - deductions).toFixed(2));
  }, [salaryBase, salaryAllowances, salaryDeductions]);

  const submitPayrollPayment = React.useCallback(async () => {
    if (!selectedRecipient) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showAlert({ title: 'Invalid Amount', message: 'Enter a valid payment amount.', type: 'warning' });
      return;
    }

    try {
      setRecordingPayment(true);
      await PayrollService.recordPayment({
        payrollRecipientId: selectedRecipient.payroll_recipient_id,
        amount,
        paymentMonth: monthIso,
        paymentMethod: normalizePaymentMethodCode(payMethod),
        reference: payReference.trim() || undefined,
        notes: payNotes.trim() || undefined,
      });
      setShowPayModal(false);
      await loadData(true);
    } catch (error: any) {
      showAlert({ title: 'Payroll Error', message: error?.message || 'Failed to record payroll payment', type: 'error' });
    } finally {
      setRecordingPayment(false);
    }
  }, [selectedRecipient, payAmount, monthIso, payMethod, payReference, payNotes, loadData, showAlert]);

  const submitSalaryUpdate = React.useCallback(async () => {
    if (!selectedSalaryRecipient) return;

    const base = parseAmountInput(salaryBase);
    const allowances = parseAmountInput(salaryAllowances);
    const deductions = parseAmountInput(salaryDeductions);

    if (![base, allowances, deductions].every(Number.isFinite)) {
      showAlert({
        title: 'Invalid Salary',
        message: 'Enter valid numeric values for salary fields.',
        type: 'warning',
      });
      return;
    }

    if (base < 0 || allowances < 0 || deductions < 0) {
      showAlert({
        title: 'Invalid Salary',
        message: 'Salary values cannot be negative.',
        type: 'warning',
      });
      return;
    }

    try {
      setSavingSalary(true);
      await PayrollService.upsertSalaryProfile({
        payrollRecipientId: selectedSalaryRecipient.payroll_recipient_id,
        baseSalary: base,
        allowances,
        deductions,
        effectiveFrom: monthIso,
        notes: salaryNotes.trim() || undefined,
      });
      setShowSalaryModal(false);
      await loadData(true);
    } catch (error: any) {
      showAlert({
        title: 'Salary Update Failed',
        message: error?.message || 'Could not update salary profile',
        type: 'error',
      });
    } finally {
      setSavingSalary(false);
    }
  }, [selectedSalaryRecipient, salaryBase, salaryAllowances, salaryDeductions, salaryNotes, monthIso, loadData, showAlert]);

  const closeMonth = React.useCallback(() => {
    if (!orgId) return;
    showAlert({
      title: 'Close Month',
      message: `Lock ${monthLabel}? Backdated edits will be blocked until reopened.`,
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock Month',
          onPress: async () => {
            try {
              await PayrollService.closeMonth(orgId, monthIso);
              await loadData(true);
              showAlert({
                title: 'Month Locked',
                message: `${monthLabel} is now locked. You can export payments for bank reconciliation before starting fresh for next month.`,
                type: 'success',
              });
            } catch (error: any) {
              showAlert({ title: 'Month Lock Failed', message: error?.message || 'Could not lock month', type: 'error' });
            }
          },
        },
      ],
    });
  }, [orgId, monthIso, monthLabel, loadData, showAlert]);

  const handleExportBankReconciliation = React.useCallback(async () => {
    if (!orgId) return;
    setExportingReconciliation(true);
    try {
      const rows = await FinancialDataService.getPaymentsForBankReconciliation(orgId, monthIso);
      await ExportService.exportPaymentsForBankReconciliation(rows, monthLabel);
    } catch (error: any) {
      showAlert({
        title: 'Export Failed',
        message: error?.message || 'Could not export payments for bank reconciliation',
        type: 'error',
      });
    } finally {
      setExportingReconciliation(false);
    }
  }, [orgId, monthIso, monthLabel, showAlert]);

  const renderSectionError = (message: string | null) => {
    if (!message) return null;
    return (
      <View style={styles.errorCard}>
        <Ionicons name="warning-outline" size={16} color={theme.warning || '#F59E0B'} />
        <Text style={styles.errorText}>{message}</Text>
      </View>
    );
  };

  const renderOverview = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>At a Glance</Text>
      {renderSectionError(pickSectionError(bundle?.errors, 'snapshot'))}
      {renderSectionError(pickSectionError(bundle?.errors, 'expenses'))}
      <View style={styles.cardGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Due This Month</Text>
          <Text style={styles.metricValue}>{formatCurrency(derivedOverview.due)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Collected This Month</Text>
          <Text style={[styles.metricValue, { color: theme.success }]}>{formatCurrency(derivedOverview.collected)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Outstanding</Text>
          <Text style={[styles.metricValue, { color: theme.error }]}>{formatCurrency(derivedOverview.outstanding)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Pending</Text>
          <Text style={[styles.metricValue, { color: theme.warning || '#F59E0B' }]}>{formatCurrency(derivedOverview.pendingAmount)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Overdue</Text>
          <Text style={[styles.metricValue, { color: theme.error }]}>{formatCurrency(derivedOverview.overdueAmount)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Prepaid Future</Text>
          <Text style={[styles.metricValue, { color: theme.primary }]}>{formatCurrency(derivedOverview.prepaid)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Pending POP</Text>
          <Text style={[styles.metricValue, { color: theme.warning || '#F59E0B' }]}>{derivedOverview.pendingPOPs}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Expenses This Month</Text>
          <Text style={[styles.metricValue, { color: theme.error }]}>{formatCurrency(derivedOverview.expenses)}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Net After Expenses</Text>
          <Text style={[styles.metricValue, { color: derivedOverview.netAfterExpenses >= 0 ? theme.success : theme.error }]}>
            {formatCurrency(derivedOverview.netAfterExpenses)}
          </Text>
        </View>
      </View>

      {snapshot && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Pending and overdue are scoped to {monthLabel} as of{' '}
            {new Date(derivedOverview.snapshotAsOf || Date.now()).toLocaleDateString('en-ZA')}.
          </Text>
        </View>
      )}

      {snapshot && derivedOverview.collectedSource === 'fee_ledger' && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Collected is temporarily using fee-ledger math ({formatCurrency(derivedOverview.collected)}) while
            allocation sync catches up ({formatCurrency(derivedOverview.collectedAllocated)} allocated, gap {formatCurrency(derivedOverview.allocationGap)}).
          </Text>
        </View>
      )}

      {snapshot && !derivedOverview.kpiCorrelated && (
        <View style={styles.errorCard}>
          <Ionicons name="analytics-outline" size={16} color={theme.warning || '#F59E0B'} />
          <Text style={styles.errorText}>
            KPI correlation warning: Due - Collected differs from Outstanding by {formatCurrency(derivedOverview.kpiDelta)}.
          </Text>
        </View>
      )}

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>Receivables</Text>
        <Text style={styles.calloutText}>
          Pending students {derivedOverview.pendingStudents} ({derivedOverview.pendingCount} fees) | Overdue students {derivedOverview.overdueStudents} ({derivedOverview.overdueCount} fees)
        </Text>
      </View>

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>Payroll</Text>
        <Text style={styles.calloutText}>
          Due {formatCurrency(derivedOverview.payrollDue)} | Paid {formatCurrency(derivedOverview.payrollPaid)}
        </Text>
      </View>

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>Expenses</Text>
        <Text style={styles.calloutText}>
          Petty cash {formatCurrency(derivedOverview.pettyCashExpenses)} | Logged expenses {formatCurrency(derivedOverview.financialExpenses)}
        </Text>
        <Text style={styles.calloutText}>
          {derivedOverview.expenseEntries} month-scoped entries loaded for {monthLabel}.
        </Text>
      </View>
    </View>
  );

  const renderReceivables = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Receivables</Text>
      {renderSectionError(pickSectionError(bundle?.errors, 'receivables'))}
      {!receivables || receivables.students.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No pending or overdue receivables for this month.</Text>
        </View>
      ) : (
        receivables.students.map((row) => {
          const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Student';
          return (
            <TouchableOpacity
              key={row.student_id}
              style={styles.queueCard}
              onPress={() => router.push(`/screens/principal-student-fees?studentId=${row.student_id}` as any)}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.queueTitle}>{fullName}</Text>
                <Text style={styles.breakdownValue}>{formatCurrency(row.outstanding_amount)}</Text>
              </View>
              <View style={styles.badgeRow}>
                {row.pending_count > 0 && (
                  <View style={[styles.statusBadge, { backgroundColor: (theme.warning || '#F59E0B') + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: theme.warning || '#F59E0B' }]}>
                      {row.pending_count} pending
                    </Text>
                  </View>
                )}
                {row.overdue_count > 0 && (
                  <View style={[styles.statusBadge, { backgroundColor: theme.error + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color: theme.error }]}>
                      {row.overdue_count} overdue
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );

  const renderCollections = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Collections</Text>
      {renderSectionError(pickSectionError(bundle?.errors, 'breakdown'))}
      {renderSectionError(pickSectionError(bundle?.errors, 'expenses'))}

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>What Payments Were For</Text>
        {(paymentBreakdown?.purposes || []).length === 0 ? (
          <Text style={styles.calloutText}>No purpose data for this month yet.</Text>
        ) : (
          (paymentBreakdown?.purposes || []).map((row) => (
            <View key={row.purpose} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownLabel}>{row.purpose}</Text>
                <Text style={styles.breakdownMeta}>{row.count} payment{row.count === 1 ? '' : 's'}</Text>
              </View>
              <Text style={styles.breakdownValue}>{formatCurrency(row.amount)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>How Payments Were Made</Text>
        {(paymentBreakdown?.methods || []).length === 0 ? (
          <Text style={styles.calloutText}>No method data for this month yet.</Text>
        ) : (
          (paymentBreakdown?.methods || []).map((row) => (
            <View key={row.payment_method} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownLabel}>
                  {PAYMENT_METHOD_LABELS[row.payment_method] || row.payment_method}
                </Text>
                <Text style={styles.breakdownMeta}>{row.count} payment{row.count === 1 ? '' : 's'}</Text>
              </View>
              <Text style={styles.breakdownValue}>{formatCurrency(row.amount)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>Category Totals</Text>
        {(snapshot?.categories || []).length === 0 ? (
          <Text style={styles.calloutText}>No category totals for this month yet.</Text>
        ) : (
          (snapshot?.categories || []).map((row) => (
            <View key={row.category_code} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownLabel}>
                  {CATEGORY_LABELS[row.category_code] || row.category_code.replace('_', ' ')}
                </Text>
                <Text style={styles.breakdownMeta}>
                  Due {formatCurrency(row.due)} | Outstanding {formatCurrency(row.outstanding)}
                </Text>
              </View>
              <Text style={styles.breakdownValue}>{formatCurrency(row.collected)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.calloutCard}>
        <Text style={styles.calloutTitle}>Expense Entries (Petty Cash + Expense Log)</Text>
        {!!expenses && (
          <Text style={styles.calloutText}>
            Total {formatCurrency(expenses.total_expenses)} | Petty cash {formatCurrency(expenses.petty_cash_expenses)} | Logged expenses {formatCurrency(expenses.financial_expenses)}
          </Text>
        )}
        {(expenses?.entries || []).length === 0 ? (
          <Text style={styles.calloutText}>No expense entries for this month yet.</Text>
        ) : (
          (expenses?.entries || []).map((row) => (
            <View key={`${row.source}-${row.id}`} style={styles.breakdownRow}>
              <View style={styles.breakdownLeft}>
                <Text style={styles.breakdownLabel}>{row.category}</Text>
                <Text style={styles.breakdownMeta}>
                  {row.source === 'petty_cash' ? 'Petty Cash' : 'Expense Log'} • {FinancialDataService.getDisplayStatus(row.status)}
                </Text>
                <Text style={styles.breakdownMeta}>{row.description}</Text>
                <Text style={styles.breakdownMeta}>
                  {new Date(row.date).toLocaleDateString('en-ZA', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {row.reference ? ` • Ref ${row.reference}` : ''}
                </Text>
              </View>
              <Text style={[styles.breakdownValue, { color: theme.error }]}>{formatCurrency(row.amount)}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );

  const renderQueue = () => (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Operational Queue</Text>
        <TouchableOpacity onPress={() => router.push('/screens/pop-review' as any)}>
          <Text style={styles.linkText}>Open Full Review</Text>
        </TouchableOpacity>
      </View>
      {renderSectionError(pickSectionError(bundle?.errors, 'queue'))}
      {pendingPOPs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No pending payment proofs for this school.</Text>
        </View>
      ) : (
        pendingPOPs.map((item) => {
          const processing = processingPopId === item.id;
          const studentName = `${item.student?.first_name || ''} ${item.student?.last_name || ''}`.trim() || 'Student';
          const categoryCode = resolveQueueCategory(item);
          const categoryColor = CATEGORY_COLORS[categoryCode] || theme.primary;
          const displayMonth = getMonthStartISO(item.payment_for_month || item.payment_date || item.created_at, {
            recoverUtcMonthBoundary: Boolean(item.payment_for_month),
          });
          return (
            <View key={item.id} style={styles.queueCard}>
              <Text style={styles.queueTitle}>{studentName}</Text>
              <Text style={styles.queueSubtext}>
                {formatCurrency(item.payment_amount)} for{' '}
                {new Date(displayMonth).toLocaleDateString('en-ZA', {
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <View style={styles.queueMetaRow}>
                <View style={[styles.categoryBadge, { backgroundColor: categoryColor + '20', borderColor: categoryColor + '55' }]}>
                  <Text style={[styles.categoryBadgeText, { color: categoryColor }]}>
                    {CATEGORY_LABELS[categoryCode]}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.categoryEditButton, { borderColor: theme.border }]}
                  onPress={() => openQueueCategoryPicker(item)}
                  disabled={processing}
                >
                  <Ionicons name="create-outline" size={12} color={theme.textSecondary} />
                  <Text style={[styles.categoryEditText, { color: theme.textSecondary }]}>Change</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.queueSubtext}>Ref: {item.payment_reference || 'N/A'}</Text>
              <View style={styles.queueActions}>
                <TouchableOpacity
                  style={[styles.secondaryButton, processing && { opacity: 0.6 }]}
                  onPress={() => handleQuickReject(item)}
                  disabled={processing}
                >
                  <Text style={styles.secondaryButtonText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, processing && { opacity: 0.6 }]}
                  onPress={() => handleQuickApprove(item)}
                  disabled={processing}
                >
                  {processing ? <EduDashSpinner size="small" color="#fff" /> : <Text style={styles.primaryButtonText}>Approve</Text>}
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  const renderPayroll = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Payroll (Teachers + Principal)</Text>
      {renderSectionError(pickSectionError(bundle?.errors, 'payroll'))}
      {bundle?.payroll_fallback_used && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Payroll roster is in compatibility mode. Apply migration 20260212102000_fix_payroll_roster_on_conflict.sql to remove this warning.
          </Text>
        </View>
      )}
      {payrollItems.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No payroll recipients found yet.</Text>
        </View>
      ) : (
        payrollItems.map((item) => {
          const netSalary = deriveNetSalary(item);
          return (
            <View key={item.payroll_recipient_id} style={styles.queueCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.queueTitle}>{item.display_name}</Text>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{item.role_type === 'principal' ? 'Principal' : 'Teacher'}</Text>
                </View>
              </View>
              <Text style={styles.queueSubtext}>Net Salary: {formatCurrency(netSalary)}</Text>
              <Text style={styles.queueSubtext}>
                Base {formatCurrency(item.base_salary)} | Allowances {formatCurrency(item.allowances)} | Deductions {formatCurrency(item.deductions)}
              </Text>
              <Text style={styles.queueSubtext}>
                Paid This Month: {item.paid_this_month ? formatCurrency(item.paid_amount_this_month) : 'Not yet'}
              </Text>
              <View style={styles.queueActions}>
                <TouchableOpacity style={styles.primaryButton} onPress={() => openPayModal(item)}>
                  <Text style={styles.primaryButtonText}>Record Payment</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => openSalaryModal(item)}>
                  <Text style={styles.secondaryButtonText}>Edit Salary</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.queueActions, { marginTop: 4 }]}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setHistoryRecipient(item);
                    setShowHistoryModal(true);
                  }}
                >
                  <Ionicons name="receipt-outline" size={14} color={theme.text} />
                  <Text style={styles.secondaryButtonText}> History</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setAdvanceRecipient(item);
                    setShowAdvanceModal(true);
                  }}
                >
                  <Ionicons name="cash-outline" size={14} color={theme.text} />
                  <Text style={styles.secondaryButtonText}> Advances</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  const renderRules = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Categories & Rules</Text>
      <View style={styles.ruleCard}>
        <Text style={styles.ruleText}>Every payment must include billing month and category.</Text>
        <Text style={styles.ruleText}>Pending and overdue KPIs are sourced from student fee ledger records.</Text>
        <Text style={styles.ruleText}>Late-month payments (day 25 onward) roll into next month when billing month is missing.</Text>
        <Text style={styles.ruleText}>Principal payroll is tracked in the same roster as teachers.</Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, snapshot?.month_locked && { opacity: 0.6 }]}
        onPress={closeMonth}
        disabled={Boolean(snapshot?.month_locked)}
      >
        <Text style={styles.primaryButtonText}>
          {snapshot?.month_locked ? 'Month Locked' : `Lock ${monthLabel}`}
        </Text>
      </TouchableOpacity>
      {snapshot?.month_locked && (
        <Text style={[styles.queueSubtext, { marginTop: 8 }]}>This month is locked. Backdated finance edits are blocked.</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <SimpleHeader title="Finance Control Center" />
      <View style={styles.monthBar}>
        <TouchableOpacity style={styles.monthButton} onPress={() => setShowMonthPicker(true)}>
          <Ionicons name="calendar-outline" size={18} color={theme.primary} />
          <Text style={styles.monthButtonText}>{monthLabel}</Text>
        </TouchableOpacity>
        <View style={styles.monthBarActions}>
          <TouchableOpacity
            style={[styles.monthBarActionButton, { borderColor: theme.border }]}
            onPress={handleExportBankReconciliation}
            disabled={exportingReconciliation}
          >
            {exportingReconciliation ? (
              <EduDashSpinner size="small" color={theme.primary} />
            ) : (
              <Ionicons name="download-outline" size={18} color={theme.primary} />
            )}
            <Text style={[styles.monthBarActionText, { color: theme.primary }]}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.monthBarActionButton,
              { borderColor: theme.border },
              snapshot?.month_locked && { opacity: 0.6 },
            ]}
            onPress={closeMonth}
            disabled={Boolean(snapshot?.month_locked)}
          >
            <Ionicons
              name={snapshot?.month_locked ? 'lock-closed' : 'lock-open-outline'}
              size={18}
              color={snapshot?.month_locked ? theme.textSecondary : theme.primary}
            />
            <Text
              style={[
                styles.monthBarActionText,
                { color: snapshot?.month_locked ? theme.textSecondary : theme.primary },
              ]}
            >
              {snapshot?.month_locked ? 'Locked' : 'Lock'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabRow}>
        {TAB_ITEMS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, active && styles.tabButtonActive]}
              onPress={() => setTab(tab.id)}
            >
              <Ionicons name={tab.icon} size={16} color={active ? '#fff' : theme.textSecondary} />
              <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <EduDashSpinner size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'receivables' && renderReceivables()}
          {activeTab === 'collections' && renderCollections()}
          {activeTab === 'queue' && renderQueue()}
          {activeTab === 'payroll' && renderPayroll()}
          {activeTab === 'rules' && renderRules()}
          <View style={{ height: 36 }} />
        </ScrollView>
      )}

      <FinancePasswordPrompt
        visible={financeAccess.promptVisible}
        onSuccess={financeAccess.markUnlocked}
        onCancel={() => {
          financeAccess.dismissPrompt();
          try {
            router.back();
          } catch {
            router.replace('/screens/principal-dashboard' as any);
          }
        }}
      />

      {showMonthPicker && (
        <DateTimePicker
          value={monthCursor}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowMonthPicker(false);
            if (event.type === 'dismissed' || !selectedDate) return;
            setMonthCursor(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
          }}
        />
      )}

      <Modal
        visible={showPayModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPayModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <ScrollView
                style={styles.modalFormScroll}
                contentContainerStyle={styles.modalFormContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.modalTitle}>Record Payroll Payment</Text>
                <Text style={styles.queueSubtext}>{selectedRecipient?.display_name}</Text>

                <Text style={styles.inputLabel}>Amount (R)</Text>
                <TextInput
                  style={styles.input}
                  value={payAmount}
                  onChangeText={setPayAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                />

                <Text style={styles.inputLabel}>Method</Text>
                <View style={styles.methodChipRow}>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([code, label]) => {
                    const selected = payMethod === code;
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[styles.methodChip, selected && styles.methodChipActive]}
                        onPress={() => setPayMethod(code)}
                      >
                        <Text style={[styles.methodChipText, selected && styles.methodChipTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.inputLabel}>Reference (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={payReference}
                  onChangeText={setPayReference}
                  placeholder="Reference"
                  placeholderTextColor={theme.textSecondary}
                />

                <Text style={styles.inputLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 64 }]}
                  value={payNotes}
                  onChangeText={setPayNotes}
                  placeholder="Notes"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowPayModal(false)} disabled={recordingPayment}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={submitPayrollPayment} disabled={recordingPayment}>
                  {recordingPayment ? <EduDashSpinner size="small" color="#fff" /> : <Text style={styles.primaryButtonText}>Save Payment</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showSalaryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSalaryModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <ScrollView
                style={styles.modalFormScroll}
                contentContainerStyle={styles.modalFormContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.modalTitle}>Edit Salary</Text>
                <Text style={styles.queueSubtext}>{selectedSalaryRecipient?.display_name}</Text>
                <Text style={styles.queueSubtext}>Effective month: {monthLabel}</Text>

                <Text style={styles.inputLabel}>Base Salary (R)</Text>
                <TextInput
                  style={styles.input}
                  value={salaryBase}
                  onChangeText={setSalaryBase}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                />

                <Text style={styles.inputLabel}>Allowances (R)</Text>
                <TextInput
                  style={styles.input}
                  value={salaryAllowances}
                  onChangeText={setSalaryAllowances}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                />

                <Text style={styles.inputLabel}>Deductions (R)</Text>
                <TextInput
                  style={styles.input}
                  value={salaryDeductions}
                  onChangeText={setSalaryDeductions}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                />

                <View style={styles.salarySummaryCard}>
                  <Text style={styles.salarySummaryLabel}>Net Salary</Text>
                  <Text style={styles.salarySummaryValue}>{formatCurrency(salaryPreviewNet)}</Text>
                </View>

                <Text style={styles.inputLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 64 }]}
                  value={salaryNotes}
                  onChangeText={setSalaryNotes}
                  placeholder="Notes"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowSalaryModal(false)} disabled={savingSalary}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={submitSalaryUpdate} disabled={savingSalary}>
                  {savingSalary ? <EduDashSpinner size="small" color="#fff" /> : <Text style={styles.primaryButtonText}>Save Salary</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <PayrollPaymentHistory
        visible={showHistoryModal}
        recipient={historyRecipient}
        monthIso={monthIso}
        monthLabel={monthLabel}
        onClose={() => { setShowHistoryModal(false); setHistoryRecipient(null); }}
        onDataChanged={() => loadData(true)}
      />
      <PayrollAdvanceModal
        visible={showAdvanceModal}
        recipient={advanceRecipient}
        organizationId={orgId || ''}
        onClose={() => { setShowAdvanceModal(false); setAdvanceRecipient(null); }}
        onDataChanged={() => loadData(true)}
      />
      <AlertModal {...alertProps} />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    monthBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 12,
    },
    monthBarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    monthBarActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    monthBarActionText: {
      fontSize: 12,
      fontWeight: '600',
    },
    monthButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: theme.primary + '40',
      backgroundColor: theme.primary + '15',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    monthButtonText: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 13,
    },
    tabRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    tabButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tabButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    tabButtonText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    tabButtonTextActive: {
      color: '#fff',
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
    },
    loaderWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    section: {
      gap: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
    },
    cardGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    metricCard: {
      width: '48%',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 12,
      backgroundColor: theme.cardBackground,
    },
    metricLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 6,
    },
    metricValue: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
    },
    calloutCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 14,
      backgroundColor: theme.cardBackground,
    },
    calloutTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 6,
    },
    calloutText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    infoBanner: {
      borderWidth: 1,
      borderColor: theme.primary + '40',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.primary + '12',
    },
    infoBannerText: {
      color: theme.text,
      fontSize: 12,
      lineHeight: 17,
    },
    errorCard: {
      borderWidth: 1,
      borderColor: (theme.warning || '#F59E0B') + '55',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: (theme.warning || '#F59E0B') + '16',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    errorText: {
      color: theme.text,
      fontSize: 12,
      flex: 1,
      lineHeight: 17,
    },
    breakdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.border + '80',
    },
    breakdownLeft: {
      flex: 1,
      paddingRight: 10,
    },
    breakdownLabel: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    breakdownMeta: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    breakdownValue: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '800',
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    linkText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
    },
    emptyCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
      backgroundColor: theme.surface,
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 13,
    },
    queueCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: theme.cardBackground,
      gap: 4,
    },
    queueTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    queueSubtext: {
      color: theme.textSecondary,
      fontSize: 12,
    },
    queueMetaRow: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    queueActions: {
      marginTop: 10,
      flexDirection: 'row',
      gap: 8,
    },
    badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    categoryBadge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      alignSelf: 'flex-start',
    },
    categoryBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    categoryEditButton: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 5,
      gap: 4,
      marginLeft: 'auto',
    },
    categoryEditText: {
      fontSize: 11,
      fontWeight: '600',
    },
    primaryButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 110,
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    secondaryButton: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 90,
    },
    secondaryButtonText: {
      color: theme.text,
      fontSize: 13,
      fontWeight: '700',
    },
    rolePill: {
      backgroundColor: theme.primary + '20',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    rolePillText: {
      fontSize: 11,
      color: theme.primary,
      fontWeight: '700',
    },
    ruleCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: theme.cardBackground,
      gap: 8,
    },
    ruleText: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    modalKeyboardAvoid: {
      flex: 1,
    },
    modalCard: {
      backgroundColor: theme.cardBackground,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 16,
      borderTopWidth: 1,
      borderColor: theme.border,
      maxHeight: '90%',
    },
    modalFormScroll: {
      flexShrink: 1,
    },
    modalFormContent: {
      paddingBottom: 8,
      gap: 8,
    },
    modalTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: '800',
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
      marginTop: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      backgroundColor: theme.surface,
      fontSize: 14,
    },
    methodChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    methodChip: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
      backgroundColor: theme.surface,
    },
    methodChipActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary,
    },
    methodChipText: {
      fontSize: 11,
      color: theme.text,
      fontWeight: '700',
    },
    methodChipTextActive: {
      color: '#fff',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 10,
    },
    salarySummaryCard: {
      borderWidth: 1,
      borderColor: theme.primary + '40',
      backgroundColor: theme.primary + '12',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 8,
    },
    salarySummaryLabel: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '700',
      marginBottom: 4,
    },
    salarySummaryValue: {
      fontSize: 18,
      color: theme.text,
      fontWeight: '800',
    },
  });
