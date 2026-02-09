/** useParentPayments — orchestrates payment data loading, realtime, and derived state */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { fetchParentChildren } from '@/lib/parent-children';
import type { PaymentChild, StudentFee, FeeStructure, PaymentMethod, POPUpload } from '@/types/payments';
import { logger } from '@/lib/logger';
import { fetchPaymentFees } from './fetchFees';
export function useParentPayments() {
  const { user, profile } = useAuth();
  const appState = useRef(AppState.currentState);
  const loadFeesRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [children, setChildren] = useState<PaymentChild[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [feeStructure, setFeeStructure] = useState<FeeStructure[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [popUploads, setPOPUploads] = useState<POPUpload[]>([]);
  const loadChildren = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setLoading(true);
      const supabase = assertSupabase();
      const linkedChildren = await fetchParentChildren(profile.id, {
        includeInactive: false,
        schoolId: profile.preschool_id || profile.organization_id || undefined,
      });
      if (linkedChildren && linkedChildren.length > 0) {
        const childrenData: PaymentChild[] = await Promise.all(
          linkedChildren.map(async (student: any) => {
            let schoolName = '';
            if (student.preschool_id) {
              let school = null;
              ({ data: school } = await supabase.from('preschools').select('name').eq('id', student.preschool_id).maybeSingle());
              if (!school) ({ data: school } = await supabase.from('organizations').select('name').eq('id', student.preschool_id).maybeSingle());
              schoolName = school?.name || '';
            }
            return { ...student, preschool_name: schoolName, student_code: student.student_id || student.id.slice(0, 8).toUpperCase() };
          })
        );
        setChildren(childrenData);
        if (!selectedChildId && childrenData.length > 0) setSelectedChildId(childrenData[0].id);
      }
    } catch (error) {
      logger.error('[Payments] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, profile?.preschool_id, profile?.organization_id, selectedChildId]);
  const loadFees = useCallback(async () => {
    if (!selectedChildId) return;
    try {
      const result = await fetchPaymentFees(selectedChildId, children, profile?.preschool_id);
      setPOPUploads(result.popUploads);
      setStudentFees(result.studentFees);
      setFeeStructure(result.feeStructure);
      setPaymentMethods(result.paymentMethods);
    } catch (error) {
      logger.error('[Payments] Error loading fees:', error);
    }
  }, [selectedChildId, children, profile?.preschool_id]);
  useEffect(() => { loadFeesRef.current = loadFees; }, [loadFees]);
  useEffect(() => { loadChildren(); }, [loadChildren]);
  useEffect(() => { if (selectedChildId) loadFees(); }, [selectedChildId, loadFees]);
  // Refresh on app foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        logger.debug('[Payments] App came to foreground, refreshing data...');
        if (selectedChildId && loadFeesRef.current) loadFeesRef.current();
      }
      appState.current = nextAppState;
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [selectedChildId]);
  // Realtime: POP uploads + student_fees changes
  useEffect(() => {
    if (!selectedChildId) return;
    const supabase = assertSupabase();
    const subscription = supabase
      .channel(`payments_${selectedChildId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pop_uploads', filter: `student_id=eq.${selectedChildId}` }, (payload) => {
        logger.debug('[Payments] POP uploaded via realtime:', payload.new);
        setPOPUploads((prev) => prev.some(u => u.id === payload.new.id) ? prev : [{ ...payload.new } as POPUpload, ...prev]);
        loadFeesRef.current?.();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pop_uploads', filter: `student_id=eq.${selectedChildId}` }, (payload) => {
        logger.debug('[Payments] POP status updated via realtime:', payload.new);
        setPOPUploads((prev) => prev.map((u) => u.id === payload.new.id ? { ...u, ...payload.new } as POPUpload : u));
        loadFeesRef.current?.();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'student_fees', filter: `student_id=eq.${selectedChildId}` }, () => {
        logger.debug('[Payments] Fee status updated via realtime');
        loadFeesRef.current?.();
      })
      .subscribe();
    return () => { supabase.removeChannel(subscription); };
  }, [selectedChildId]);
  const onRefresh = useCallback(async () => {
    logger.debug('[ParentPayments] Manual refresh triggered');
    setRefreshing(true);
    try {
      await loadChildren();
      await loadFees();
    } catch (error) {
      logger.error('[ParentPayments] Manual refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadChildren, loadFees]);
  const upcomingFees = useMemo(() =>
    studentFees.filter(f => f.status === 'pending' || f.status === 'overdue' || f.status === 'partially_paid' || f.status === 'pending_verification'),
  [studentFees]);
  const paidFees = useMemo(() => studentFees.filter(f => f.status === 'paid'), [studentFees]);
  const pendingVerificationFees = useMemo(() => studentFees.filter(f => f.status === 'pending_verification'), [studentFees]);
  const outstandingBalance = useMemo(() => {
    const dueSoonCutoff = new Date();
    dueSoonCutoff.setDate(dueSoonCutoff.getDate() + 7);
    return upcomingFees
      .filter(f => f.status !== 'pending_verification')
      .filter(f => { if (!f.due_date) return true; const d = new Date(f.due_date); return Number.isNaN(d.getTime()) || d <= dueSoonCutoff; })
      .reduce((sum, f) => sum + f.amount, 0);
  }, [upcomingFees]);
  const selectedChild = useMemo(() => children.find(c => c.id === selectedChildId), [children, selectedChildId]);
  return {
    loading, refreshing, children, selectedChildId, setSelectedChildId, selectedChild,
    studentFees, feeStructure, paymentMethods, popUploads,
    upcomingFees, paidFees, pendingVerificationFees, outstandingBalance,
    onRefresh, reloadFees: loadFees,
  };
}
