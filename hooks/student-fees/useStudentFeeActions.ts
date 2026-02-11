/**
 * Hook for student fee mutation actions.
 * Handles waive, adjust, class change, mark paid/unpaid, receipts, enrollment.
 */

import { useState, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { isTuitionFee } from '@/lib/utils/feeUtils';
import { logger } from '@/lib/logger';
import type { Student, StudentFee, ClassOption, ModalType } from './types';
import { isRegistrationFeeEntry } from './types';
import {
  upsertPaymentRecord,
  upsertFinancialTransaction,
  generateReceiptForFee,
  fetchReceiptUrlForFee,
  openReceiptUrl,
  resolveSuggestedRegistrationFee,
  resolveSuggestedTuitionFee,
  type SuggestedTuitionResolution,
} from './feeHelpers';

type ShowAlert = (title: string, message: string, type?: 'info' | 'warning' | 'success' | 'error', buttons?: any[]) => void;
const STUDENT_DELETE_RETENTION_DAYS = 30;
const TAG = 'StudentFees';

type TuitionSyncIssue = {
  status: 'ambiguous' | 'unmatched';
  reason: string;
  message: string;
  className?: string;
};

type SyncPendingTuitionFeesResult = {
  updated: number;
  amount?: number | null;
  className?: string;
  resolutionStatus: SuggestedTuitionResolution['status'];
  resolutionReason: string;
};

function describeTuitionResolution(reason: string, className?: string): string {
  const classLabel = className || 'this class';
  if (reason.startsWith('multiple_grade_level_matches:')) {
    return `Multiple tuition structures match ${classLabel} by grade. Open Fee Setup to keep only one active match.`;
  }
  if (reason.startsWith('multiple_class_label_matches:')) {
    return `Multiple tuition structures match ${classLabel} by class label. Open Fee Setup to remove overlapping labels.`;
  }
  if (reason.startsWith('multiple_age_range_matches:')) {
    return `Multiple tuition structures match ${classLabel} by age range. Open Fee Setup to remove overlapping ranges.`;
  }
  if (reason === 'insufficient_context_missing_grade_class_and_age') {
    return 'Cannot determine tuition because class and age context is missing.';
  }
  if (reason === 'no_deterministic_match') {
    return `No active tuition structure matches ${classLabel}.`;
  }
  if (reason === 'no_active_tuition_structures') {
    return 'No active tuition structures are configured.';
  }
  if (reason === 'query_failed') {
    return 'Could not read tuition setup. Please retry and check connection.';
  }
  return `Tuition setup needs review (${reason}).`;
}

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
  syncingTuitionFees: boolean;
  updatingRegistrationStatus: boolean;
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
  tuitionSyncIssue: TuitionSyncIssue | null;
  clearTuitionSyncIssue: () => void;
  // Handlers
  handleWaiveFee: () => Promise<void>;
  handleAdjustFee: () => Promise<void>;
  handleChangeClass: () => Promise<void>;
  handleUpdateEnrollmentDate: (date: Date) => Promise<void>;
  handleDeactivateStudent: () => Promise<void>;
  handleMarkPaid: (fee: StudentFee) => Promise<void>;
  handleMarkUnpaid: (fee: StudentFee) => Promise<void>;
  handleReceiptAction: (fee: StudentFee) => Promise<void>;
  handleSyncTuitionFeesToClass: () => Promise<void>;
  handleSetRegistrationPaidStatus: (isPaid: boolean) => Promise<void>;
  prefillRegistrationFeeForClass: (classId: string) => Promise<void>;
}

export function useStudentFeeActions(params: StudentFeeActionsParams): StudentFeeActionsReturn {
  const { student, setStudent, studentRef, classes, organizationId, loadFees, loadStudent, showAlert, router } = params;
  const { profile } = useAuth();

  const [saving, setSaving] = useState(false);
  const [deactivatingStudent, setDeactivatingStudent] = useState(false);
  const [syncingTuitionFees, setSyncingTuitionFees] = useState(false);
  const [updatingRegistrationStatus, setUpdatingRegistrationStatus] = useState(false);
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
  const [tuitionSyncIssue, setTuitionSyncIssue] = useState<TuitionSyncIssue | null>(null);

  const clearTuitionSyncIssue = useCallback(() => {
    setTuitionSyncIssue(null);
  }, []);

  const logFeeAssignmentCorrection = useCallback(async (
    payload: {
      student: Student;
      source: 'change_class' | 'manual_sync';
      previousClassName?: string | null;
      nextClassName?: string | null;
      updatedFeeRows: number;
      tuitionAmount?: number | null;
    },
  ) => {
    if (!profile?.id) return;

    const supabase = assertSupabase();
    const nowIso = new Date().toISOString();
    const studentName = `${payload.student.first_name} ${payload.student.last_name}`.trim();
    const metadata = {
      source: payload.source,
      updated_fee_rows: payload.updatedFeeRows,
      previous_class_name: payload.previousClassName || null,
      next_class_name: payload.nextClassName || null,
      tuition_amount: payload.tuitionAmount ?? null,
    };

    try {
      const { error } = await supabase.rpc('create_audit_log', {
        p_event_type: 'admin_action',
        p_event_name: 'correct_fee_assignment',
        p_actor_id: profile.id,
        p_target_id: payload.student.id,
        p_target_type: 'student',
        p_metadata: metadata,
        p_success: true,
      });
      if (error) throw error;
    } catch (rpcError) {
      const { error: insertError } = await supabase.from('audit_logs').insert({
        action: 'correct_fee_assignment',
        event_type: 'admin_action',
        event_name: 'correct_fee_assignment',
        event_description: `Correct fee assignment for ${studentName}`,
        actor_id: profile.id,
        actor_role: profile.role || null,
        actor_organization_id: organizationId || payload.student.preschool_id || null,
        target_id: payload.student.id,
        target_name: studentName || null,
        target_type: 'student',
        resource_id: payload.student.id,
        resource_type: 'student_fees',
        changes_made: metadata as any,
        metadata: { ...metadata, fallback: 'audit_logs_insert' } as any,
        occurred_at: nowIso,
        success: true,
      });
      if (insertError) {
        console.warn('[StudentFees] Failed to write fee assignment audit log', {
          rpcError,
          insertError,
          metadata,
        });
      }
    }
  }, [organizationId, profile?.id, profile?.role]);

  const syncPendingTuitionFees = useCallback(async (
    targetStudent: Student,
    className?: string | null,
  ): Promise<SyncPendingTuitionFeesResult> => {
    if (!organizationId) {
      return {
        updated: 0,
        resolutionStatus: 'unmatched',
        resolutionReason: 'missing_organization_id',
      };
    }

    const supabase = assertSupabase();
    const resolvedClassName =
      className ||
      classes.find((c) => c.id === targetStudent.class_id)?.name ||
      targetStudent.class_name ||
      '';

    if (!resolvedClassName) {
      const reason = 'insufficient_context_missing_grade_class_and_age';
      setTuitionSyncIssue({
        status: 'unmatched',
        reason,
        message: describeTuitionResolution(reason),
      });
      logger.warn(TAG, 'Tuition sync skipped due to missing class context', {
        studentId: targetStudent.id,
      });
      return {
        updated: 0,
        resolutionStatus: 'unmatched',
        resolutionReason: reason,
      };
    }

    const resolution = await resolveSuggestedTuitionFee(
      organizationId,
      targetStudent,
      resolvedClassName,
    );
    if (resolution.status !== 'matched' || !resolution.fee) {
      const issueStatus = resolution.status === 'ambiguous' ? 'ambiguous' : 'unmatched';
      const issueMessage = describeTuitionResolution(resolution.reason, resolvedClassName);
      setTuitionSyncIssue({
        status: issueStatus,
        reason: resolution.reason,
        message: issueMessage,
        className: resolvedClassName,
      });
      logger.warn(TAG, 'Tuition sync unresolved', {
        studentId: targetStudent.id,
        className: resolvedClassName,
        resolution,
      });
      return {
        updated: 0,
        className: resolvedClassName,
        resolutionStatus: resolution.status,
        resolutionReason: resolution.reason,
      };
    }
    setTuitionSyncIssue(null);
    const selectedTuitionFee = resolution.fee;

    const { data: feeRows, error: feesError } = await supabase
      .from('student_fees')
      .select(`
        id,
        status,
        amount_paid,
        discount_amount,
        amount_outstanding,
        category_code,
        fee_structures!student_fees_fee_structure_id_fkey(fee_type, name, description)
      `)
      .eq('student_id', targetStudent.id)
      .in('status', ['pending', 'overdue', 'partially_paid']);

    if (feesError) {
      throw feesError;
    }

    const eligibleFeeIds = (feeRows || [])
      .filter((row: any) => {
        const amountPaid = Number(row.amount_paid || 0);
        const discountAmount = Number(row.discount_amount || 0);
        if (amountPaid > 0.0001 || discountAmount > 0.0001) return false;

        if (String(row.category_code || '').toLowerCase() === 'tuition') {
          return true;
        }

        const structure = Array.isArray(row.fee_structures) ? row.fee_structures[0] : row.fee_structures;
        return isTuitionFee(structure?.fee_type, structure?.name, structure?.description);
      })
      .map((row: any) => row.id as string);

    if (!eligibleFeeIds.length) {
      logger.info(TAG, 'Tuition sync found no eligible fee rows', {
        studentId: targetStudent.id,
        className: resolvedClassName,
        feeId: selectedTuitionFee.id,
        amount: Number(selectedTuitionFee.amount),
      });
      return {
        updated: 0,
        className: resolvedClassName,
        amount: Number(selectedTuitionFee.amount),
        resolutionStatus: 'matched',
        resolutionReason: resolution.reason,
      };
    }

    const nowIso = new Date().toISOString();
    const normalizedAmount = Number(selectedTuitionFee.amount);
    await Promise.all(
      eligibleFeeIds.map((feeId) =>
        supabase
          .from('student_fees')
          .update({
            fee_structure_id: selectedTuitionFee.id,
            amount: normalizedAmount,
            final_amount: normalizedAmount,
            amount_outstanding: normalizedAmount,
            updated_at: nowIso,
          })
          .eq('id', feeId)
          .throwOnError(),
      ),
    );

    logger.info(TAG, 'Tuition sync updated fee rows', {
      studentId: targetStudent.id,
      className: resolvedClassName,
      feeId: selectedTuitionFee.id,
      amount: normalizedAmount,
      updatedCount: eligibleFeeIds.length,
      resolutionReason: resolution.reason,
    });

    return {
      updated: eligibleFeeIds.length,
      amount: normalizedAmount,
      className: resolvedClassName,
      resolutionStatus: 'matched',
      resolutionReason: resolution.reason,
    };
  }, [classes, organizationId]);

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
      const nowIso = new Date().toISOString();
      await supabase
        .from('students')
        .update({ class_id: newClassId, registration_fee_amount: normalizedFee, updated_at: nowIso })
        .eq('id', student.id)
        .throwOnError();
      const newClass = classes.find(c => c.id === newClassId);

      const tempStudent: Student = {
        ...(studentRef.current || student),
        class_id: newClassId,
        class_name: newClass?.name || student.class_name,
        registration_fee_amount: normalizedFee,
      };

      const tuitionSync = await syncPendingTuitionFees(tempStudent, newClass?.name || null);
      await logFeeAssignmentCorrection({
        student: tempStudent,
        source: 'change_class',
        previousClassName: student.class_name || classes.find((c) => c.id === student.class_id)?.name || null,
        nextClassName: newClass?.name || null,
        updatedFeeRows: tuitionSync.updated,
        tuitionAmount: tuitionSync.amount ?? null,
      });
      const tuitionSyncMessage =
        tuitionSync.resolutionStatus !== 'matched'
          ? ` Tuition sync skipped: ${describeTuitionResolution(tuitionSync.resolutionReason, tuitionSync.className)}`
          : tuitionSync.updated > 0
          ? ` Updated ${tuitionSync.updated} unpaid tuition fee entr${tuitionSync.updated === 1 ? 'y' : 'ies'} to match ${tuitionSync.className || 'the class'} pricing.`
          : ' No unpaid tuition fees needed syncing.';

      showAlert(
        'Student Updated',
        `Class set to ${newClass?.name || 'new class'} and registration fee updated to R${normalizedFee.toFixed(2)}.${tuitionSyncMessage}`,
        tuitionSync.resolutionStatus === 'matched' ? 'success' : 'warning',
      );
      setModalType(null); setNewClassId(''); setClassRegistrationFee(''); setClassFeeHint('');
      const refreshed = await loadStudent();
      await loadFees(refreshed);
    } catch (error: any) { showAlert('Error', error.message || 'Failed to change class.', 'error'); }
    finally { setSaving(false); }
  };

  const handleSyncTuitionFeesToClass = useCallback(async () => {
    const currentStudent = studentRef.current || student;
    if (!currentStudent || syncingTuitionFees || saving) return;
    if (!currentStudent.class_id && !currentStudent.class_name) {
      showAlert('Class Required', 'Assign a class first, then sync tuition fees.', 'warning');
      return;
    }

    setSyncingTuitionFees(true);
    setSaving(true);
    try {
      const syncResult = await syncPendingTuitionFees(currentStudent);
      await logFeeAssignmentCorrection({
        student: currentStudent,
        source: 'manual_sync',
        previousClassName: currentStudent.class_name || classes.find((c) => c.id === currentStudent.class_id)?.name || null,
        nextClassName: currentStudent.class_name || classes.find((c) => c.id === currentStudent.class_id)?.name || null,
        updatedFeeRows: syncResult.updated,
        tuitionAmount: syncResult.amount ?? null,
      });
      if (syncResult.resolutionStatus !== 'matched') {
        showAlert(
          syncResult.resolutionStatus === 'ambiguous' ? 'Ambiguous Fee Setup' : 'Fee Setup Needs Review',
          describeTuitionResolution(syncResult.resolutionReason, syncResult.className),
          'warning',
        );
      } else if (syncResult.updated > 0) {
        showAlert(
          'Tuition Synced',
          `Updated ${syncResult.updated} unpaid tuition fee entr${syncResult.updated === 1 ? 'y' : 'ies'} to ${syncResult.className || 'class'} pricing.`,
          'success',
        );
      } else {
        showAlert(
          'No Updates Needed',
          'No unpaid tuition fees were eligible for automatic correction.',
          'info',
        );
      }
      const refreshed = await loadStudent();
      await loadFees(refreshed);
    } catch (error: any) {
      showAlert('Error', getSupabaseErrorMessage(error, 'Failed to sync tuition fees.'), 'error');
    } finally {
      setSyncingTuitionFees(false);
      setSaving(false);
    }
  }, [classes, loadFees, loadStudent, logFeeAssignmentCorrection, saving, showAlert, student, studentRef, syncPendingTuitionFees, syncingTuitionFees]);

  const handleSetRegistrationPaidStatus = useCallback(async (isPaid: boolean) => {
    const currentStudent = studentRef.current || student;
    if (!currentStudent || updatingRegistrationStatus || saving) return;
    if (currentStudent.registration_fee_paid === isPaid && currentStudent.payment_verified === isPaid) {
      showAlert(
        'No Change',
        `Registration is already marked as ${isPaid ? 'paid' : 'not paid'}.`,
        'info',
      );
      return;
    }

    setUpdatingRegistrationStatus(true);
    setSaving(true);
    try {
      const supabase = assertSupabase();
      const nowIso = new Date().toISOString();
      const paymentDate = isPaid ? nowIso.split('T')[0] : null;

      await supabase
        .from('students')
        .update({
          registration_fee_paid: isPaid,
          payment_verified: isPaid,
          payment_date: paymentDate,
          updated_at: nowIso,
        })
        .eq('id', currentStudent.id)
        .throwOnError();

      const schoolId = currentStudent.preschool_id || organizationId;
      if (schoolId) {
        const registrationPayload = {
          registration_fee_paid: isPaid,
          payment_verified: isPaid,
          payment_date: paymentDate,
          payment_method: isPaid ? 'manual_principal' : null,
          updated_at: nowIso,
        };

        const { error: reqByStudentErr } = await supabase
          .from('registration_requests')
          .update(registrationPayload)
          .eq('organization_id', schoolId)
          .in('status', ['pending', 'approved'])
          .eq('edudash_student_id', currentStudent.id);
        if (reqByStudentErr) {
          console.warn('[StudentFees] registration_requests update by student id failed', reqByStudentErr);
        }

        if (currentStudent.date_of_birth) {
          const { error: reqByNameErr } = await supabase
            .from('registration_requests')
            .update(registrationPayload)
            .eq('organization_id', schoolId)
            .in('status', ['pending', 'approved'])
            .eq('student_first_name', currentStudent.first_name)
            .eq('student_last_name', currentStudent.last_name)
            .eq('student_dob', currentStudent.date_of_birth);
          if (reqByNameErr) {
            console.warn('[StudentFees] registration_requests update by student name failed', reqByNameErr);
          }

          const { error: childReqErr } = await supabase
            .from('child_registration_requests')
            .update({
              registration_fee_paid: isPaid,
              payment_verified: isPaid,
              payment_verified_at: isPaid ? nowIso : null,
              payment_verified_by: isPaid ? profile?.id || null : null,
              updated_at: nowIso,
            })
            .eq('preschool_id', schoolId)
            .in('status', ['pending', 'approved'])
            .eq('child_first_name', currentStudent.first_name)
            .eq('child_last_name', currentStudent.last_name)
            .eq('child_birth_date', currentStudent.date_of_birth);
          if (childReqErr) {
            console.warn('[StudentFees] child_registration_requests update failed', childReqErr);
          }
        }
      }

      const nextStudent: Student = {
        ...currentStudent,
        registration_fee_paid: isPaid,
        payment_verified: isPaid,
        payment_date: paymentDate,
      };
      studentRef.current = nextStudent;
      setStudent(nextStudent);

      showAlert(
        'Registration Updated',
        isPaid
          ? 'Registration has been marked as paid and verified.'
          : 'Registration has been marked as not paid.',
        'success',
      );
    } catch (error: any) {
      showAlert(
        'Error',
        getSupabaseErrorMessage(error, 'Failed to update registration payment status.'),
        'error',
      );
    } finally {
      setUpdatingRegistrationStatus(false);
      setSaving(false);
    }
  }, [organizationId, profile?.id, saving, setStudent, showAlert, student, studentRef, updatingRegistrationStatus]);

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
    saving, deactivatingStudent, syncingTuitionFees, updatingRegistrationStatus, processingFeeId, processingFeeAction, modalType, setModalType, selectedFee, setSelectedFee,
    showEnrollmentPicker, setShowEnrollmentPicker,
    waiveAmount, setWaiveAmount, waiveReason, setWaiveReason, waiveType, setWaiveType,
    adjustAmount, setAdjustAmount, adjustReason, setAdjustReason,
    newClassId, setNewClassId, classRegistrationFee, setClassRegistrationFee,
    classFeeHint, setClassFeeHint, loadingSuggestedFee, canSubmitClassCorrection,
    tuitionSyncIssue, clearTuitionSyncIssue,
    handleWaiveFee, handleAdjustFee, handleChangeClass, handleUpdateEnrollmentDate, handleDeactivateStudent,
    handleMarkPaid, handleMarkUnpaid, handleReceiptAction, handleSyncTuitionFeesToClass, handleSetRegistrationPaidStatus, prefillRegistrationFeeForClass,
  };
}
