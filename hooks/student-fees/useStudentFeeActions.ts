/**
 * Hook for student fee mutation actions.
 * Handles waive, adjust, class change, mark paid/unpaid, receipts, enrollment.
 */

import { useState, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Student, StudentFee, ClassOption, ModalType } from './types';
import { isRegistrationFeeEntry } from './types';
import {
  upsertPaymentRecord,
  upsertFinancialTransaction,
  generateReceiptForFee,
  fetchReceiptUrlForFee,
  openReceiptUrl,
  resolveSuggestedRegistrationFee,
} from './feeHelpers';

type ShowAlert = (title: string, message: string, type?: 'info' | 'warning' | 'success' | 'error', buttons?: any[]) => void;
const STUDENT_DELETE_RETENTION_DAYS = 30;

function toDayStart(dateValue?: string | null): Date | null {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function resolvePendingLikeStatus(
  fee: StudentFee,
  nextOutstanding: number,
  amountPaid: number,
): StudentFee['status'] {
  if (nextOutstanding <= 0) return nextOutstanding === 0 ? 'paid' : 'waived';
  if (amountPaid > 0) return 'partially_paid';
  const dueStart = toDayStart(fee.due_date);
  if (!dueStart) return 'pending';
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return dueStart < todayStart ? 'overdue' : 'pending';
}

function getSupabaseErrorMessage(error: any, fallback: string): string {
  if (!error) return fallback;
  const message = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' | ');
  return message || fallback;
}

export interface StudentFeeActionsParams {
  student: Student | null;
  setStudent: React.Dispatch<React.SetStateAction<Student | null>>;
  studentRef: React.MutableRefObject<Student | null>;
  classes: ClassOption[];
  organizationId: string | undefined;
  loadFees: (s?: Student | null) => Promise<void>;
  loadStudent: () => Promise<Student | null>;
  showAlert: ShowAlert;
  router: any;
}

export interface StudentFeeActionsReturn {
  saving: boolean;
  deactivatingStudent: boolean;
  processingFeeId: string | null;
  processingFeeAction: 'mark_paid' | 'mark_unpaid' | null;
  modalType: ModalType;
  setModalType: (t: ModalType) => void;
  selectedFee: StudentFee | null;
  setSelectedFee: (f: StudentFee | null) => void;
  showEnrollmentPicker: boolean;
  setShowEnrollmentPicker: (v: boolean) => void;
  // Waive form
  waiveAmount: string;
  setWaiveAmount: (v: string) => void;
  waiveReason: string;
  setWaiveReason: (v: string) => void;
  waiveType: 'full' | 'partial';
  setWaiveType: (v: 'full' | 'partial') => void;
  // Adjust form
  adjustAmount: string;
  setAdjustAmount: (v: string) => void;
  adjustReason: string;
  setAdjustReason: (v: string) => void;
  // Class change form
  newClassId: string;
  setNewClassId: (v: string) => void;
  classRegistrationFee: string;
  setClassRegistrationFee: (v: string) => void;
  classFeeHint: string;
  setClassFeeHint: (v: string) => void;
  loadingSuggestedFee: boolean;
  canSubmitClassCorrection: boolean;
  // Handlers
  handleWaiveFee: () => Promise<void>;
  handleAdjustFee: () => Promise<void>;
  handleChangeClass: () => Promise<void>;
  handleUpdateEnrollmentDate: (date: Date) => Promise<void>;
  handleDeactivateStudent: () => Promise<void>;
  handleMarkPaid: (fee: StudentFee) => Promise<void>;
  handleMarkUnpaid: (fee: StudentFee) => Promise<void>;
  handleReceiptAction: (fee: StudentFee) => Promise<void>;
  prefillRegistrationFeeForClass: (classId: string) => Promise<void>;
}

export function useStudentFeeActions(params: StudentFeeActionsParams): StudentFeeActionsReturn {
  const { student, setStudent, studentRef, classes, organizationId, loadFees, loadStudent, showAlert, router } = params;
  const { profile } = useAuth();

  const [saving, setSaving] = useState(false);
  const [deactivatingStudent, setDeactivatingStudent] = useState(false);
  const [processingFeeId, setProcessingFeeId] = useState<string | null>(null);
  const [processingFeeAction, setProcessingFeeAction] = useState<'mark_paid' | 'mark_unpaid' | null>(null);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [showEnrollmentPicker, setShowEnrollmentPicker] = useState(false);

  // Waive form
  const [waiveAmount, setWaiveAmount] = useState('');
  const [waiveReason, setWaiveReason] = useState('');
  const [waiveType, setWaiveType] = useState<'full' | 'partial'>('full');

  // Adjust form
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Class change form
  const [newClassId, setNewClassId] = useState('');
  const [classRegistrationFee, setClassRegistrationFee] = useState('');
  const [classFeeHint, setClassFeeHint] = useState('');
  const [loadingSuggestedFee, setLoadingSuggestedFee] = useState(false);

  // ── Waive ─────────────────────────────────────────────────

  const handleWaiveFee = async () => {
    if (!selectedFee || !profile?.id) return;
    const currentFinal = Number(selectedFee.final_amount || selectedFee.amount || 0);
    const currentDiscount = Number(selectedFee.discount_amount || selectedFee.waived_amount || 0);
    const currentPaid = Number(selectedFee.amount_paid || 0);
    const currentOutstanding = Number.isFinite(Number(selectedFee.amount_outstanding))
      ? Number(selectedFee.amount_outstanding)
      : Math.max(0, currentFinal - currentPaid);
    const amount = waiveType === 'full' ? currentOutstanding : parseFloat(waiveAmount);
    if (waiveType === 'partial' && (!amount || amount <= 0 || amount > currentOutstanding)) {
      showAlert('Invalid Amount', 'Please enter a valid waiver amount.', 'warning'); return;
    }
    if (!waiveReason.trim()) { showAlert('Reason Required', 'Please provide a reason for the waiver.', 'warning'); return; }

    setSaving(true);
    try {
      const supabase = assertSupabase();
      const nowIso = new Date().toISOString();
      const newFinal = Math.max(0, currentFinal - amount);
      const newDiscount = Number((currentDiscount + amount).toFixed(2));
      const newOutstanding = Math.max(0, newFinal - currentPaid);
      const nextStatus =
        newFinal <= 0
          ? 'waived'
          : resolvePendingLikeStatus(selectedFee, newOutstanding, currentPaid);

      await supabase.from('student_fees').update({
        discount_amount: newDiscount,
        final_amount: newFinal,
        status: nextStatus,
        amount_outstanding: newOutstanding,
        updated_at: nowIso,
      }).eq('id', selectedFee.id).throwOnError();

      showAlert('Fee Waived', waiveType === 'full' ? 'The fee has been fully waived.' : `R${amount.toFixed(2)} has been waived from this fee.`, 'success');
      setModalType(null); setSelectedFee(null); setWaiveAmount(''); setWaiveReason(''); setWaiveType('full');
      loadFees();
    } catch (error: any) {
      console.error('[StudentFees] handleWaiveFee failed', { feeId: selectedFee.id, error });
      showAlert('Error', getSupabaseErrorMessage(error, 'Failed to waive fee.'), 'error');
    }
    finally { setSaving(false); }
  };

  // ── Adjust ────────────────────────────────────────────────

  const handleAdjustFee = async () => {
    if (!selectedFee || !profile?.id) return;
    const amount = parseFloat(adjustAmount);
    if (!amount || amount <= 0) { showAlert('Invalid Amount', 'Please enter a valid amount.', 'warning'); return; }
    if (!adjustReason.trim()) { showAlert('Reason Required', 'Please provide a reason for the adjustment.', 'warning'); return; }

    setSaving(true);
    try {
      const supabase = assertSupabase();
      const amountPaid = Number(selectedFee.amount_paid || 0);
      const amountOutstanding = Math.max(0, amount - amountPaid);
      const nextStatus = resolvePendingLikeStatus(selectedFee, amountOutstanding, amountPaid);
      await supabase.from('student_fees').update({
        amount,
        final_amount: amount,
        discount_amount: 0,
        amount_outstanding: amountOutstanding,
        status: amount === 0 ? 'waived' : nextStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', selectedFee.id).throwOnError();

      if (isRegistrationFeeEntry(selectedFee.fee_type, selectedFee.description)) {
        const { error: regError } = await supabase.from('students').update({ registration_fee_amount: amount, updated_at: new Date().toISOString() }).eq('id', selectedFee.student_id);
        if (!regError) setStudent(prev => prev ? { ...prev, registration_fee_amount: amount } : prev);
      }

      showAlert('Fee Adjusted', `Fee amount updated to R${amount.toFixed(2)}.`, 'success');
      setModalType(null); setSelectedFee(null); setAdjustAmount(''); setAdjustReason('');
      loadFees();
    } catch (error: any) {
      console.error('[StudentFees] handleAdjustFee failed', { feeId: selectedFee.id, error });
      showAlert('Error', getSupabaseErrorMessage(error, 'Failed to adjust fee.'), 'error');
    }
    finally { setSaving(false); }
  };

  // ── Class change ──────────────────────────────────────────

  const handleChangeClass = async () => {
    if (!student || !newClassId) return;
    const parsedFee = Number.parseFloat(classRegistrationFee);
    if (Number.isNaN(parsedFee) || parsedFee < 0) { showAlert('Invalid Amount', 'Please enter a valid registration fee amount.', 'warning'); return; }

    const normalizedFee = Number(parsedFee.toFixed(2));
    const currentFee = Number(student.registration_fee_amount || 0);
    if (newClassId === student.class_id && Math.abs(normalizedFee - currentFee) < 0.01) {
      showAlert('No Changes', 'Class and registration fee are unchanged.', 'info'); return;
    }

    setSaving(true);
    try {
      const supabase = assertSupabase();
      await supabase.from('students').update({ class_id: newClassId, registration_fee_amount: normalizedFee, updated_at: new Date().toISOString() }).eq('id', student.id).throwOnError();
      const newClass = classes.find(c => c.id === newClassId);
      showAlert('Student Updated', `Class set to ${newClass?.name || 'new class'} and registration fee updated to R${normalizedFee.toFixed(2)}.`, 'success');
      setModalType(null); setNewClassId(''); setClassRegistrationFee(''); setClassFeeHint('');
      const refreshed = await loadStudent();
      await loadFees(refreshed);
    } catch (error: any) { showAlert('Error', error.message || 'Failed to change class.', 'error'); }
    finally { setSaving(false); }
  };

  // ── Enrollment date ───────────────────────────────────────

  const handleUpdateEnrollmentDate = async (date: Date) => {
    if (!student) return;
    setSaving(true);
    try {
      const supabase = assertSupabase();
      const formatted = date.toISOString().split('T')[0];
      await supabase.from('students').update({ enrollment_date: formatted, updated_at: new Date().toISOString() }).eq('id', student.id).throwOnError();
      const updated = { ...student, enrollment_date: formatted };
      setStudent(updated); studentRef.current = updated;
      showAlert('Start Date Updated', `Enrollment start set to ${formatted}.`, 'success');
      await loadFees(updated);
    } catch (error: any) { showAlert('Error', error.message || 'Failed to update enrollment date.', 'error'); }
    finally { setSaving(false); }
  };

  const handleDeactivateStudent = useCallback(async () => {
    if (!student || deactivatingStudent) return;

    const studentName = `${student.first_name} ${student.last_name}`.trim();
    showAlert(
      'Mark Student Inactive',
      `Are you sure you want to mark ${studentName} as inactive?\n\nThis will:\n- remove the learner from unpaid-fees follow-up\n- keep records for ${STUDENT_DELETE_RETENTION_DAYS} days before permanent deletion\n- allow reactivation during the retention window`,
      'warning',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Inactive',
          style: 'destructive',
          onPress: async () => {
            const currentStudent = studentRef.current || student;
            if (!currentStudent) return;

            setDeactivatingStudent(true);
            setSaving(true);
            const supabase = assertSupabase();
            const nowIso = new Date().toISOString();
            const retentionDate = new Date();
            retentionDate.setDate(retentionDate.getDate() + STUDENT_DELETE_RETENTION_DAYS);
            const retentionIso = retentionDate.toISOString();
            const retentionLabel = retentionDate.toLocaleDateString('en-ZA', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            const reason = `Removed by principal - left school (retention ${STUDENT_DELETE_RETENTION_DAYS} days)`;

            try {
              const { error: rpcError } = await supabase.rpc('deactivate_student', {
                student_uuid: currentStudent.id,
                reason,
              });

              if (rpcError) {
                let { error: fallbackError } = await supabase
                  .from('students')
                  .update({
                    is_active: false,
                    status: 'inactive',
                    class_id: null,
                    deleted_at: nowIso,
                    delete_reason: reason,
                    permanent_delete_after: retentionIso,
                    updated_at: nowIso,
                  } as any)
                  .eq('id', currentStudent.id);

                if (fallbackError && /column .* does not exist|schema cache/i.test(fallbackError.message || '')) {
                  const { error: minimalError } = await supabase
                    .from('students')
                    .update({
                      is_active: false,
                      status: 'inactive',
                      class_id: null,
                      updated_at: nowIso,
                    })
                    .eq('id', currentStudent.id);
                  fallbackError = minimalError;
                }

                if (fallbackError) {
                  throw fallbackError;
                }
              }

              setStudent((prev) => (prev
                ? {
                    ...prev,
                    is_active: false,
                    status: 'inactive',
                    class_id: null,
                    deleted_at: nowIso,
                    permanent_delete_after: retentionIso,
                  }
                : prev));

              const refreshed = await loadStudent();
              await loadFees(refreshed);

              showAlert(
                'Student Inactive',
                `${studentName} is now inactive and excluded from unpaid fee follow-up. Permanent deletion is scheduled after ${retentionLabel}.`,
                'success',
              );
            } catch (error: any) {
              showAlert('Error', getSupabaseErrorMessage(error, 'Failed to mark student inactive.'), 'error');
            } finally {
              setDeactivatingStudent(false);
              setSaving(false);
            }
          },
        },
      ],
    );
  }, [deactivatingStudent, loadFees, loadStudent, showAlert, student, studentRef, setStudent]);

  // ── Mark paid / unpaid ────────────────────────────────────

  const handleMarkPaid = async (fee: StudentFee) => {
    if (!profile?.id || !student) return;
    if (processingFeeId) return;
    setProcessingFeeId(fee.id);
    setProcessingFeeAction('mark_paid');
    setSaving(true);
    try {
      const supabase = assertSupabase();
      const nowIso = new Date().toISOString();
      const paidDate = nowIso.split('T')[0];
      const amount = fee.final_amount || fee.amount;
      await supabase.from('student_fees').update({ status: 'paid', paid_date: paidDate, amount_paid: amount, amount_outstanding: 0, updated_at: nowIso }).eq('id', fee.id).throwOnError();
      await upsertPaymentRecord(fee, 'completed', student, organizationId, profile.id);
      await upsertFinancialTransaction(fee, 'completed', student, organizationId, profile.id);
      await generateReceiptForFee(fee, amount, paidDate, student, profile as any, organizationId);
      showAlert('Payment Updated', 'Fee marked as paid.', 'success');
      loadFees();
    } catch (error: any) {
      console.error('[StudentFees] handleMarkPaid failed', { feeId: fee.id, error });
      showAlert('Error', getSupabaseErrorMessage(error, 'Failed to update fee status.'), 'error');
    }
    finally {
      setSaving(false);
      setProcessingFeeId(null);
      setProcessingFeeAction(null);
    }
  };

  const handleMarkUnpaid = async (fee: StudentFee) => {
    if (!profile?.id || !student) return;
    if (processingFeeId) return;
    setProcessingFeeId(fee.id);
    setProcessingFeeAction('mark_unpaid');
    setSaving(true);
    try {
      const supabase = assertSupabase();
      const nowIso = new Date().toISOString();
      const amount = fee.final_amount || fee.amount;
      const nextStatus = resolvePendingLikeStatus(fee, amount, 0);
      await supabase
        .from('student_fees')
        .update({ status: nextStatus, paid_date: null, amount_paid: 0, amount_outstanding: amount, updated_at: nowIso })
        .eq('id', fee.id)
        .throwOnError();
      await upsertPaymentRecord(fee, 'reversed', student, organizationId, profile.id);
      await upsertFinancialTransaction(fee, 'voided', student, organizationId, profile.id);
      showAlert('Payment Updated', 'Fee marked as unpaid.', 'success');
      loadFees();
    } catch (error: any) {
      console.error('[StudentFees] handleMarkUnpaid failed', { feeId: fee.id, error });
      showAlert('Error', getSupabaseErrorMessage(error, 'Failed to update fee status.'), 'error');
    }
    finally {
      setSaving(false);
      setProcessingFeeId(null);
      setProcessingFeeAction(null);
    }
  };

  // ── Receipts ──────────────────────────────────────────────

  const handleReceiptAction = async (fee: StudentFee) => {
    if (fee.status !== 'paid') { showAlert('Receipt Unavailable', 'Only paid fees can generate receipts.', 'warning'); return; }
    try {
      const existingUrl = await fetchReceiptUrlForFee(fee);
      if (existingUrl) { await openReceiptUrl(existingUrl, router); return; }
      showAlert('Generate Receipt?', 'No receipt exists yet for this fee. Generate one now?', 'info', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Generate', onPress: async () => {
          if (!student || !profile) return;
          const paidDate = fee.paid_date || new Date().toISOString().split('T')[0];
          const amount = fee.final_amount || fee.amount;
          const result = await generateReceiptForFee(fee, amount, paidDate, student, profile as any, organizationId);
          if (result?.receiptUrl) { await openReceiptUrl(result.receiptUrl, router); }
          else { showAlert('Receipt Error', 'Receipt generated but link is unavailable.', 'warning'); }
        }},
      ]);
    } catch (error: any) { showAlert('Receipt Error', error?.message || 'Failed to open receipt.', 'error'); }
  };

  // ── Class fee prefill ─────────────────────────────────────

  const prefillRegistrationFeeForClass = useCallback(async (classId: string) => {
    const selectedClass = classes.find(c => c.id === classId);
    if (!selectedClass || !organizationId) return;
    setLoadingSuggestedFee(true);
    try {
      const suggested = await resolveSuggestedRegistrationFee(organizationId, studentRef.current, selectedClass.name);
      if (suggested != null && Number.isFinite(suggested)) {
        setClassRegistrationFee(suggested.toFixed(2));
        setClassFeeHint(`Suggested fee for ${selectedClass.name} loaded from active registration fee setup.`);
      } else {
        setClassFeeHint(`No class-linked registration fee found for ${selectedClass.name}. Enter the correct amount manually.`);
      }
    } finally { setLoadingSuggestedFee(false); }
  }, [classes, organizationId, studentRef]);

  // ── Computed ──────────────────────────────────────────────

  const parsedFee = Number.parseFloat(classRegistrationFee);
  const hasValidFee = !Number.isNaN(parsedFee) && parsedFee >= 0;
  const currentFee = Number(student?.registration_fee_amount || 0);
  const hasClassChange = Boolean(newClassId) && newClassId !== student?.class_id;
  const hasFeeChange = hasValidFee && Math.abs(parsedFee - currentFee) >= 0.01;
  const canSubmitClassCorrection = Boolean(newClassId) && hasValidFee && (hasClassChange || hasFeeChange) && !saving && !loadingSuggestedFee;

  return {
    saving, deactivatingStudent, processingFeeId, processingFeeAction, modalType, setModalType, selectedFee, setSelectedFee,
    showEnrollmentPicker, setShowEnrollmentPicker,
    waiveAmount, setWaiveAmount, waiveReason, setWaiveReason, waiveType, setWaiveType,
    adjustAmount, setAdjustAmount, adjustReason, setAdjustReason,
    newClassId, setNewClassId, classRegistrationFee, setClassRegistrationFee,
    classFeeHint, setClassFeeHint, loadingSuggestedFee, canSubmitClassCorrection,
    handleWaiveFee, handleAdjustFee, handleChangeClass, handleUpdateEnrollmentDate, handleDeactivateStudent,
    handleMarkPaid, handleMarkUnpaid, handleReceiptAction, prefillRegistrationFeeForClass,
  };
}
