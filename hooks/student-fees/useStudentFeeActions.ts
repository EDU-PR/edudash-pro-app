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
  handleMarkPaid: (fee: StudentFee) => Promise<void>;
  handleMarkUnpaid: (fee: StudentFee) => Promise<void>;
  handleReceiptAction: (fee: StudentFee) => Promise<void>;
  prefillRegistrationFeeForClass: (classId: string) => Promise<void>;
}

export function useStudentFeeActions(params: StudentFeeActionsParams): StudentFeeActionsReturn {
  const { student, setStudent, studentRef, classes, organizationId, loadFees, loadStudent, showAlert, router } = params;
  const { profile } = useAuth();

  const [saving, setSaving] = useState(false);
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
    const amount = waiveType === 'full' ? selectedFee.final_amount : parseFloat(waiveAmount);
    if (waiveType === 'partial' && (!amount || amount <= 0 || amount > selectedFee.final_amount)) {
      showAlert('Invalid Amount', 'Please enter a valid waiver amount.', 'warning'); return;
    }
    if (!waiveReason.trim()) { showAlert('Reason Required', 'Please provide a reason for the waiver.', 'warning'); return; }

    setSaving(true);
    try {
      const supabase = assertSupabase();
      const newFinal = selectedFee.final_amount - amount;
      await supabase.from('student_fees').update({
        final_amount: Math.max(0, newFinal),
        waived_amount: (selectedFee.waived_amount || 0) + amount,
        waived_reason: waiveReason.trim(), waived_at: new Date().toISOString(), waived_by: profile.id,
        status: newFinal <= 0 ? 'waived' : selectedFee.status,
        amount_outstanding: Math.max(0, newFinal),
      }).eq('id', selectedFee.id).throwOnError();

      showAlert('Fee Waived', waiveType === 'full' ? 'The fee has been fully waived.' : `R${amount.toFixed(2)} has been waived from this fee.`, 'success');
      setModalType(null); setSelectedFee(null); setWaiveAmount(''); setWaiveReason(''); setWaiveType('full');
      loadFees();
    } catch (error: any) { showAlert('Error', error.message || 'Failed to waive fee.', 'error'); }
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
      await supabase.from('student_fees').update({
        amount, final_amount: amount, amount_outstanding: amount, status: 'pending', updated_at: new Date().toISOString(),
      }).eq('id', selectedFee.id).throwOnError();

      try { await supabase.from('fee_adjustments').insert({ fee_id: selectedFee.id, student_id: selectedFee.student_id, previous_amount: selectedFee.final_amount, new_amount: amount, reason: adjustReason.trim(), adjusted_by: profile.id }); } catch { /* table may not exist */ }

      if (isRegistrationFeeEntry(selectedFee.fee_type, selectedFee.description)) {
        const { error: regError } = await supabase.from('students').update({ registration_fee_amount: amount, updated_at: new Date().toISOString() }).eq('id', selectedFee.student_id);
        if (!regError) setStudent(prev => prev ? { ...prev, registration_fee_amount: amount } : prev);
      }

      showAlert('Fee Adjusted', `Fee amount updated to R${amount.toFixed(2)}.`, 'success');
      setModalType(null); setSelectedFee(null); setAdjustAmount(''); setAdjustReason('');
      loadFees();
    } catch (error: any) { showAlert('Error', error.message || 'Failed to adjust fee.', 'error'); }
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

  // ── Mark paid / unpaid ────────────────────────────────────

  const handleMarkPaid = async (fee: StudentFee) => {
    if (!profile?.id || !student) return;
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
    } catch (error: any) { showAlert('Error', error.message || 'Failed to update fee status.', 'error'); }
    finally { setSaving(false); }
  };

  const handleMarkUnpaid = async (fee: StudentFee) => {
    if (!profile?.id || !student) return;
    setSaving(true);
    try {
      const supabase = assertSupabase();
      const nowIso = new Date().toISOString();
      const amount = fee.final_amount || fee.amount;
      await supabase.from('student_fees').update({ status: 'pending', paid_date: null, amount_paid: null, amount_outstanding: amount, updated_at: nowIso }).eq('id', fee.id).throwOnError();
      await upsertPaymentRecord(fee, 'reversed', student, organizationId, profile.id);
      await upsertFinancialTransaction(fee, 'voided', student, organizationId, profile.id);
      showAlert('Payment Updated', 'Fee marked as unpaid.', 'success');
      loadFees();
    } catch (error: any) { showAlert('Error', error.message || 'Failed to update fee status.', 'error'); }
    finally { setSaving(false); }
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
    saving, modalType, setModalType, selectedFee, setSelectedFee,
    showEnrollmentPicker, setShowEnrollmentPicker,
    waiveAmount, setWaiveAmount, waiveReason, setWaiveReason, waiveType, setWaiveType,
    adjustAmount, setAdjustAmount, adjustReason, setAdjustReason,
    newClassId, setNewClassId, classRegistrationFee, setClassRegistrationFee,
    classFeeHint, setClassFeeHint, loadingSuggestedFee, canSubmitClassCorrection,
    handleWaiveFee, handleAdjustFee, handleChangeClass, handleUpdateEnrollmentDate,
    handleMarkPaid, handleMarkUnpaid, handleReceiptAction, prefillRegistrationFeeForClass,
  };
}
