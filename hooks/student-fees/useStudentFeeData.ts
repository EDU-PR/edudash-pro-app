/**
 * Hook for loading and computing student fee data.
 * Handles student, fees, classes, and derived computed values.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Student, StudentFee, ClassOption } from './types';
import {
  type FeeSetupStatus,
  bootstrapFeesIfMissing,
  getEnrollmentMonthStart,
  mapFeeRow,
} from './feeHelpers';

export interface StudentFeeDataReturn {
  student: Student | null;
  setStudent: React.Dispatch<React.SetStateAction<Student | null>>;
  studentRef: React.MutableRefObject<Student | null>;
  fees: StudentFee[];
  displayFees: StudentFee[];
  classes: ClassOption[];
  loading: boolean;
  refreshing: boolean;
  feeSetupStatus: FeeSetupStatus;
  generatingFees: boolean;
  totals: { outstanding: number; paid: number; waived: number };
  organizationId: string | undefined;
  hasParent: boolean;
  onRefresh: () => Promise<void>;
  loadStudent: () => Promise<Student | null>;
  loadFees: (targetStudent?: Student | null) => Promise<void>;
  handleGenerateFees: () => Promise<void>;
}

export function useStudentFeeData(studentId?: string): StudentFeeDataReturn {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id || (profile as any)?.preschool_id;

  const [student, setStudent] = useState<Student | null>(null);
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feeBootstrapAttempted, setFeeBootstrapAttempted] = useState(false);
  const [feeSetupStatus, setFeeSetupStatus] = useState<FeeSetupStatus>('unknown');
  const [generatingFees, setGeneratingFees] = useState(false);
  const studentRef = useRef<Student | null>(null);

  useEffect(() => { studentRef.current = student; }, [student]);

  const loadStudent = useCallback(async (): Promise<Student | null> => {
    if (!studentId) return null;
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('students')
        .select(`
          id, first_name, last_name, class_id, parent_id, preschool_id, enrollment_date, date_of_birth, registration_fee_amount, registration_fee_paid,
          is_active, status,
          classes!students_class_id_fkey(name),
          profiles!students_parent_id_fkey(first_name, last_name)
        `)
        .eq('id', studentId)
        .single();

      if (error) throw error;

      const classData = Array.isArray(data.classes) ? data.classes[0] : data.classes;
      const parentData = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

      const next: Student = {
        id: data.id, first_name: data.first_name, last_name: data.last_name,
        class_id: data.class_id,
        is_active: data.is_active,
        status: data.status,
        registration_fee_amount: data.registration_fee_amount != null ? Number(data.registration_fee_amount) : null,
        registration_fee_paid: data.registration_fee_paid,
        class_name: classData?.name,
        parent_name: parentData ? `${parentData.first_name} ${parentData.last_name}` : undefined,
        parent_id: data.parent_id, preschool_id: data.preschool_id,
        enrollment_date: data.enrollment_date, date_of_birth: data.date_of_birth,
      };

      setStudent(next);
      studentRef.current = next;
      return next;
    } catch (error) {
      console.error('[StudentFeeManagement] Error loading student:', error);
      return null;
    }
  }, [studentId]);

  const loadFees = useCallback(async (targetStudent?: Student | null) => {
    if (!studentId) return;
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('student_fees')
        .select('*, fee_structures(name, fee_type, description)')
        .eq('student_id', studentId)
        .order('due_date', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(mapFeeRow);
      if (mapped.length > 0) { setFeeSetupStatus('ready'); }

      const bootstrapTarget = targetStudent ?? studentRef.current;
      if (mapped.length === 0 && bootstrapTarget && !feeBootstrapAttempted) {
        setFeeBootstrapAttempted(true);
        const status = await bootstrapFeesIfMissing(bootstrapTarget, organizationId, profile?.id);
        if (status) setFeeSetupStatus(status);

        const { data: refreshed } = await supabase
          .from('student_fees')
          .select('*, fee_structures(name, fee_type, description)')
          .eq('student_id', studentId)
          .order('due_date', { ascending: false });

        setFees((refreshed || []).map(mapFeeRow));
        return;
      }
      setFees(mapped);
    } catch (error) {
      console.error('[StudentFeeManagement] Error loading fees:', error);
    }
  }, [studentId, feeBootstrapAttempted, organizationId, profile?.id]);

  const loadClasses = useCallback(async () => {
    if (!organizationId) return;
    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('preschool_id', organizationId)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      console.error('[StudentFeeManagement] Error loading classes:', error);
    }
  }, [organizationId]);

  // Reset on student change
  useEffect(() => { setFeeBootstrapAttempted(false); setFeeSetupStatus('unknown'); }, [studentId]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const resolved = await loadStudent();
      await Promise.all([loadFees(resolved), loadClasses()]);
      setLoading(false);
    };
    load();
  }, [loadStudent, loadFees, loadClasses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const resolved = await loadStudent();
    await loadFees(resolved);
    setRefreshing(false);
  }, [loadStudent, loadFees]);

  const handleGenerateFees = useCallback(async () => {
    if (!student) return;
    setGeneratingFees(true);
    try {
      const status = await bootstrapFeesIfMissing(student, organizationId, profile?.id);
      if (status) setFeeSetupStatus(status);
      await loadFees(student);
    } finally {
      setGeneratingFees(false);
    }
  }, [student, loadFees, organizationId, profile?.id]);

  const totals = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const enrollmentStart = getEnrollmentMonthStart(student?.enrollment_date);

    const isPreEnrollment = (fee: StudentFee) => {
      if (!enrollmentStart || !fee.due_date) return false;
      const due = new Date(fee.due_date);
      return !Number.isNaN(due.getTime()) && due < enrollmentStart;
    };

    const unpaidStatuses = new Set(['pending', 'overdue', 'partially_paid']);
    const pending = fees.filter(f => {
      if (isPreEnrollment(f)) return false;
      if (!unpaidStatuses.has(f.status)) return false;
      if (!f.due_date) return true;
      const due = new Date(f.due_date);
      return Number.isNaN(due.getTime()) || due <= todayStart;
    });
    const paid = fees.filter(f => f.status === 'paid');
    const waived = fees.filter(f => f.status === 'waived' || (f.discount_amount || f.waived_amount));

    return {
      outstanding: pending.reduce((sum, f) => {
        const amountOutstanding = Number(f.amount_outstanding);
        if (Number.isFinite(amountOutstanding)) return sum + amountOutstanding;
        const amountPaid = Number(f.amount_paid || 0);
        return sum + Math.max(0, f.final_amount - amountPaid);
      }, 0),
      paid: paid.reduce((sum, f) => {
        const amountPaid = Number(f.amount_paid);
        if (Number.isFinite(amountPaid) && amountPaid > 0) return sum + amountPaid;
        return sum + f.final_amount;
      }, 0),
      waived: waived.reduce((sum, f) => sum + Number(f.discount_amount || f.waived_amount || 0), 0),
    };
  }, [fees, student?.enrollment_date]);

  const displayFees = useMemo(() => {
    const enrollmentStart = getEnrollmentMonthStart(student?.enrollment_date);
    if (!enrollmentStart) return fees;
    return fees.filter(f => {
      if (!f.due_date) return true;
      const due = new Date(f.due_date);
      return Number.isNaN(due.getTime()) || due >= enrollmentStart;
    });
  }, [fees, student?.enrollment_date]);

  const hasParent = Boolean(student?.parent_id || student?.parent_name);

  return {
    student, setStudent, studentRef, fees, displayFees, classes,
    loading, refreshing, feeSetupStatus, generatingFees,
    totals, organizationId, hasParent,
    onRefresh, loadStudent, loadFees, handleGenerateFees,
  };
}
