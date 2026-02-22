/**
 * Hook for student fee mutation actions.
 * Thin orchestrator — delegates to focused action modules.
 *
 * @see feeActionUtils.ts       — Pure utility functions
 * @see feeStatusActions.ts     — Mark paid / unpaid / receipts
 * @see feeModificationActions.ts — Waive / adjust
 * @see classFeeSync.ts         — Audit logging, tuition sync, fee prefill
 * @see classChangeActions.ts   — Change class, sync tuition to class
 * @see registrationActions.ts  — Registration paid status
 * @see studentLifecycleActions.ts — Enrollment date, deactivate
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { Student, StudentFee, ClassOption, ModalType } from './types';
import { getSupabaseErrorMessage, type ShowAlert } from './feeActionUtils';
import { markFeePaid, markFeeUnpaid, handleReceiptAction as receiptAction } from './feeStatusActions';
import { waiveFee, adjustFee } from './feeModificationActions';
import { changeStudentClass, syncTuitionFeesToClass } from './classChangeActions';
import { setRegistrationPaidStatus } from './registrationActions';
import { updateEnrollmentDate, deactivateStudent } from './studentLifecycleActions';
import { prefillRegistrationFeeForClass as prefillFee } from './classFeeSync';

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
  waiveAmount: string;
  setWaiveAmount: (v: string) => void;
  waiveReason: string;
  setWaiveReason: (v: string) => void;
  waiveType: 'full' | 'partial';
  setWaiveType: (v: 'full' | 'partial') => void;
  adjustAmount: string;
  setAdjustAmount: (v: string) => void;
  adjustReason: string;
  setAdjustReason: (v: string) => void;
  newClassId: string;
  setNewClassId: (v: string) => void;
  classRegistrationFee: string;
  setClassRegistrationFee: (v: string) => void;
  classFeeHint: string;
  setClassFeeHint: (v: string) => void;
  loadingSuggestedFee: boolean;
  canSubmitClassCorrection: boolean;
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

  // ── State ─────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [deactivatingStudent, setDeactivatingStudent] = useState(false);
  const [syncingTuitionFees, setSyncingTuitionFees] = useState(false);
  const [updatingRegistrationStatus, setUpdatingRegistrationStatus] = useState(false);
  const [processingFeeId, setProcessingFeeId] = useState<string | null>(null);
  const [processingFeeAction, setProcessingFeeAction] = useState<'mark_paid' | 'mark_unpaid' | null>(null);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [showEnrollmentPicker, setShowEnrollmentPicker] = useState(false);

  const [waiveAmount, setWaiveAmount] = useState('');
  const [waiveReason, setWaiveReason] = useState('');
  const [waiveType, setWaiveType] = useState<'full' | 'partial'>('full');

  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const [newClassId, setNewClassId] = useState('');
  const [classRegistrationFee, setClassRegistrationFee] = useState('');
  const [classFeeHint, setClassFeeHint] = useState('');
  const [loadingSuggestedFee, setLoadingSuggestedFee] = useState(false);

  // ── Handlers ──────────────────────────────────────────────

  const handleWaiveFee = async () => {
    if (!selectedFee || !profile?.id) return;
    setSaving(true);
    try {
      await waiveFee(
        selectedFee,
        student,
        waiveType,
        waiveAmount,
        waiveReason,
        showAlert,
        loadFees,
        {
          organizationId,
          actorId: profile.id,
          actorRole: profile.role || null,
          sourceScreen: 'principal-student-fees',
        },
      );
      setModalType(null); setSelectedFee(null); setWaiveAmount(''); setWaiveReason(''); setWaiveType('full');
    } catch (error: any) {
      console.error('[StudentFees] handleWaiveFee failed', { feeId: selectedFee.id, error });
      showAlert('Error', getSupabaseErrorMessage(error, 'Failed to waive fee.'), 'error');
    } finally { setSaving(false); }
  };

  const handleAdjustFee = async () => {
    if (!selectedFee || !profile?.id) return;
    setSaving(true);
    try {
      await adjustFee(
        selectedFee,
        adjustAmount,
        adjustReason,
        student,
        setStudent,
        showAlert,
        loadFees,
        {
          organizationId,
          actorId: profile.id,
          actorRole: profile.role || null,
          sourceScreen: 'principal-student-fees',
        },
      );
      setModalType(null); setSelectedFee(null); setAdjustAmount(''); setAdjustReason('');
    } catch (error: any) {
      console.error('[StudentFees] handleAdjustFee failed', { feeId: selectedFee.id, error });
      showAlert('Error', getSupabaseErrorMessage(error, 'Failed to adjust fee.'), 'error');
    } finally { setSaving(false); }
  };

  const handleChangeClass = async () => {
    if (!student || !newClassId || !profile?.id) return;
    setSaving(true);
    try {
      await changeStudentClass(
        student, studentRef, newClassId, classRegistrationFee, classes,
        organizationId, profile.id, profile.role || null, showAlert, loadStudent, loadFees,
      );
      setModalType(null); setNewClassId(''); setClassRegistrationFee(''); setClassFeeHint('');
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to change class.', 'error');
    } finally { setSaving(false); }
  };

  const handleSyncTuitionFeesToClass = useCallback(async () => {
    const currentStudent = studentRef.current || student;
    if (!currentStudent || syncingTuitionFees || saving || !profile?.id) return;
    setSyncingTuitionFees(true);
    setSaving(true);
    try {
      await syncTuitionFeesToClass(
        currentStudent, studentRef, classes, organizationId,
        profile.id, profile.role || null, showAlert, loadStudent, loadFees,
      );
    } catch (error: any) {
      showAlert('Error', getSupabaseErrorMessage(error, 'Failed to sync tuition fees.'), 'error');
    } finally { setSyncingTuitionFees(false); setSaving(false); }
  }, [classes, loadFees, loadStudent, organizationId, profile?.id, profile?.role, saving, showAlert, student, studentRef, syncingTuitionFees]);

  const handleSetRegistrationPaidStatus = useCallback(async (isPaid: boolean) => {
    const currentStudent = studentRef.current || student;
    if (!currentStudent || updatingRegistrationStatus || saving) return;
    setUpdatingRegistrationStatus(true);
    setSaving(true);
    try {
      await setRegistrationPaidStatus(
        isPaid, currentStudent, studentRef, setStudent, organizationId, profile?.id, showAlert,
      );
    } catch (error: any) {
      showAlert('Error', getSupabaseErrorMessage(error, 'Failed to update registration payment status.'), 'error');
    } finally { setUpdatingRegistrationStatus(false); setSaving(false); }
  }, [organizationId, profile?.id, saving, setStudent, showAlert, student, studentRef, updatingRegistrationStatus]);

  const handleUpdateEnrollmentDate = async (date: Date) => {
    if (!student) return;
    setSaving(true);
    try {
      await updateEnrollmentDate(date, student, studentRef, setStudent, showAlert, loadFees);
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to update enrollment date.', 'error');
    } finally { setSaving(false); }
  };

  const handleDeactivateStudent = useCallback(async () => {
    if (!student || deactivatingStudent) return;
    deactivateStudent(student, studentRef, setStudent, showAlert, loadStudent, loadFees);
  }, [deactivatingStudent, loadFees, loadStudent, showAlert, student, studentRef, setStudent]);

  const handleMarkPaid = async (fee: StudentFee) => {
    if (!profile?.id || !student || processingFeeId) return;
    setProcessingFeeId(fee.id); setProcessingFeeAction('mark_paid'); setSaving(true);
    try {
      await markFeePaid(fee, student, organizationId, profile.id, profile.role || null, showAlert, loadFees);
    } catch (error: any) {
      console.error('[StudentFees] handleMarkPaid failed', { feeId: fee.id, error });
      showAlert('Error', getSupabaseErrorMessage(error, 'Failed to update fee status.'), 'error');
    } finally { setSaving(false); setProcessingFeeId(null); setProcessingFeeAction(null); }
  };

  const handleMarkUnpaid = async (fee: StudentFee) => {
    if (!profile?.id || !student || processingFeeId) return;
    setProcessingFeeId(fee.id); setProcessingFeeAction('mark_unpaid'); setSaving(true);
    try {
      await markFeeUnpaid(fee, student, organizationId, profile.id, profile.role || null, showAlert, loadFees);
    } catch (error: any) {
      console.error('[StudentFees] handleMarkUnpaid failed', { feeId: fee.id, error });
      showAlert('Error', getSupabaseErrorMessage(error, 'Failed to update fee status.'), 'error');
    } finally { setSaving(false); setProcessingFeeId(null); setProcessingFeeAction(null); }
  };

  const handleReceiptAction = async (fee: StudentFee) => {
    try {
      await receiptAction(fee, student, profile, organizationId, showAlert, router);
    } catch (error: any) {
      showAlert('Receipt Error', error?.message || 'Failed to open receipt.', 'error');
    }
  };

  const prefillRegistrationFeeForClass = useCallback(async (classId: string) => {
    setLoadingSuggestedFee(true);
    try {
      await prefillFee(classId, classes, organizationId, studentRef, setClassRegistrationFee, setClassFeeHint);
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
    handleWaiveFee, handleAdjustFee, handleChangeClass, handleUpdateEnrollmentDate, handleDeactivateStudent,
    handleMarkPaid, handleMarkUnpaid, handleReceiptAction, handleSyncTuitionFeesToClass, handleSetRegistrationPaidStatus, prefillRegistrationFeeForClass,
  };
}
