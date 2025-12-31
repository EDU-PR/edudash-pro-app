import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import type { PaymentChild, StudentFee, FeeStructure, PaymentMethod, POPUpload } from '@/types/payments';

export function useParentPayments() {
  const { user, profile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [children, setChildren] = useState<PaymentChild[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [feeStructure, setFeeStructure] = useState<FeeStructure[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [popUploads, setPOPUploads] = useState<POPUpload[]>([]);

  const getNextFeeMonth = useCallback(() => {
    const now = new Date();
    const day = now.getDate(), month = now.getMonth(), year = now.getFullYear();
    if (day > 7) return month === 11 ? { month: 0, year: year + 1 } : { month: month + 1, year };
    return { month, year };
  }, []);

  // Load children linked to parent
  const loadChildren = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const supabase = assertSupabase();

      const { data: directChildren, error } = await supabase
        .from('students')
        .select('id, student_id, first_name, last_name, preschool_id, registration_fee_amount, registration_fee_paid, payment_verified')
        .or(`parent_id.eq.${user.id},guardian_id.eq.${user.id}`);

      if (error) {
        console.error('[Payments] Error loading children:', error);
        return;
      }

      if (directChildren && directChildren.length > 0) {
        const childrenData: PaymentChild[] = await Promise.all(
          directChildren.map(async (student) => {
            let schoolName = '';
            if (student.preschool_id) {
              const { data: school } = await supabase.from('preschools').select('name').eq('id', student.preschool_id).single();
              schoolName = school?.name || '';
            }
            return { ...student, preschool_name: schoolName, student_code: student.student_id || student.id.slice(0, 8).toUpperCase() };
          })
        );
        setChildren(childrenData);
        if (!selectedChildId && childrenData.length > 0) setSelectedChildId(childrenData[0].id);
      }
    } catch (error) {
      console.error('[Payments] Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, selectedChildId]);

  // Load fees for selected child
  const loadFees = useCallback(async () => {
    if (!selectedChildId) return;
    
    try {
      const supabase = assertSupabase();
      const selectedChild = children.find(c => c.id === selectedChildId);
      const childPreschoolId = selectedChild?.preschool_id || profile?.preschool_id;

      // Get student fees
      const { data: fees } = await supabase
        .from('student_fees')
        .select('*')
        .eq('student_id', selectedChildId)
        .order('due_date', { ascending: true });

      if (fees && fees.length > 0) {
        setStudentFees(fees as StudentFee[]);
      }

      // Get fee structure for the school
      if (childPreschoolId) {
        const { data: schoolFees } = await supabase
          .from('school_fee_structures')
          .select('*')
          .eq('preschool_id', childPreschoolId)
          .eq('is_active', true);

        if (schoolFees && schoolFees.length > 0) {
          setFeeStructure(schoolFees.map((f: any) => ({
            id: f.id, fee_type: f.fee_category || f.name, amount: f.amount_cents / 100,
            description: f.description || f.name, payment_frequency: f.billing_frequency, age_group: f.age_group,
          })));
          
          // Generate next month's fee if no fees exist
          const monthlyFee = schoolFees.find((f: any) => f.fee_category === 'tuition');
          if (monthlyFee && (!fees || fees.length === 0)) {
            const { month, year } = getNextFeeMonth();
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            setStudentFees([{
              id: `pending-${monthNames[month].toLowerCase()}-${year}`, student_id: selectedChildId, fee_type: 'monthly_tuition',
              description: `${monthNames[month]} ${year} School Fees${monthlyFee.age_group ? ` (${monthlyFee.age_group})` : ''}`,
              amount: monthlyFee.amount_cents / 100, due_date: `${year}-${String(month + 1).padStart(2, '0')}-01`,
              grace_period_days: 7, status: 'pending',
            }]);
          }
        }

        // Get payment methods
        const { data: paymentMethodsData } = await supabase
          .from('organization_payment_methods')
          .select('*')
          .eq('organization_id', childPreschoolId)
          .eq('active', true)
          .order('preferred', { ascending: false });
        
        if (paymentMethodsData) {
          setPaymentMethods(paymentMethodsData as PaymentMethod[]);
        }
      }

      // Get POP uploads for this child
      const { data: uploads } = await supabase
        .from('pop_uploads')
        .select('*')
        .eq('student_id', selectedChildId)
        .eq('upload_type', 'proof_of_payment')
        .order('created_at', { ascending: false });
      
      if (uploads) {
        setPOPUploads(uploads as POPUpload[]);
      }
    } catch (error) {
      console.error('[Payments] Error loading fees:', error);
    }
  }, [selectedChildId, children, profile?.preschool_id, getNextFeeMonth]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    if (selectedChildId) {
      loadFees();
    }
  }, [selectedChildId, loadFees]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChildren();
    await loadFees();
  }, [loadChildren, loadFees]);

  // Computed values
  const upcomingFees = useMemo(() => {
    return studentFees.filter(f => f.status === 'pending' || f.status === 'overdue' || f.status === 'partially_paid');
  }, [studentFees]);

  const paidFees = useMemo(() => {
    return studentFees.filter(f => f.status === 'paid');
  }, [studentFees]);

  const outstandingBalance = useMemo(() => {
    return upcomingFees.reduce((sum, f) => sum + f.amount, 0);
  }, [upcomingFees]);

  const selectedChild = useMemo(() => {
    return children.find(c => c.id === selectedChildId);
  }, [children, selectedChildId]);

  return {
    loading,
    refreshing,
    children,
    selectedChildId,
    setSelectedChildId,
    selectedChild,
    studentFees,
    feeStructure,
    paymentMethods,
    popUploads,
    upcomingFees,
    paidFees,
    outstandingBalance,
    onRefresh,
    reloadFees: loadFees,
  };
}
