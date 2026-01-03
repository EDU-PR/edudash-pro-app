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

      // Get POP uploads FIRST so we can use them to determine fee status
      const { data: uploads } = await supabase
        .from('pop_uploads')
        .select('*')
        .eq('student_id', selectedChildId)
        .eq('upload_type', 'proof_of_payment')
        .order('created_at', { ascending: false });
      
      const popUploadsData = uploads || [];
      setPOPUploads(popUploadsData as POPUpload[]);

      // Get student fees with fee structure details
      const { data: fees } = await supabase
        .from('student_fees')
        .select(`
          *,
          fee_structures (
            name,
            fee_type,
            description
          )
        `)
        .eq('student_id', selectedChildId)
        .order('due_date', { ascending: true });

      if (fees && fees.length > 0) {
        // Map database fields to expected StudentFee interface
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        const mappedFees: StudentFee[] = fees.map((f: any) => {
          // Generate month-specific description from due_date
          const dueDate = new Date(f.due_date);
          const month = monthNames[dueDate.getMonth()];
          const year = dueDate.getFullYear();
          const baseName = f.fee_structures?.name || f.fee_structures?.description || 'School Fees';
          // Extract age group if present (e.g., "Monthly School Fees - Ages 4-6" -> "4-6 years")
          const ageMatch = baseName.match(/Ages?\s*([\d]+-[\d]+|[\d]+\s*(?:months?|years?)?)/i);
          const ageGroup = ageMatch ? ageMatch[1] : '';
          const description = `${month} ${year} School Fees${ageGroup ? ` (${ageGroup}${!ageGroup.includes('year') && !ageGroup.includes('month') ? ' years' : ''})` : ''}`;
          
          // Determine status based on both student_fees.status AND POP uploads
          let effectiveStatus = f.status;
          
          // Check if there's a POP upload that could affect the status
          // Match by payment_date being close to the fee's due_date (same month/year)
          // or by similar amount
          const matchingPOP = popUploadsData.find((pop: any) => {
            if (!pop.payment_date) return false;
            const popDate = new Date(pop.payment_date);
            const feeDate = new Date(f.due_date);
            // Match if same month/year OR similar amount
            const sameMonth = popDate.getMonth() === feeDate.getMonth() && popDate.getFullYear() === feeDate.getFullYear();
            const similarAmount = pop.payment_amount && Math.abs(pop.payment_amount - (f.final_amount || f.amount)) < 10;
            return sameMonth || similarAmount;
          });
          
          if (matchingPOP) {
            if (matchingPOP.status === 'approved') {
              effectiveStatus = 'paid';
            } else if (matchingPOP.status === 'pending') {
              effectiveStatus = 'pending_verification';
            } else if (matchingPOP.status === 'rejected') {
              // Keep original status but could show as needs attention
              effectiveStatus = f.status;
            }
          }
          
          return {
            id: f.id,
            student_id: f.student_id,
            fee_type: f.fee_structures?.fee_type || 'tuition',
            description,
            amount: f.final_amount || f.amount,
            due_date: f.due_date,
            grace_period_days: 7,
            paid_date: f.paid_date,
            status: effectiveStatus,
            pop_status: matchingPOP?.status, // Include POP status for UI display
          };
        });
        setStudentFees(mappedFees);
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

      // POP uploads already loaded at the start of this function
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

  // Realtime subscription for POP status updates
  useEffect(() => {
    if (!selectedChildId) return;
    
    const supabase = assertSupabase();
    
    // Subscribe to pop_uploads changes for this child
    const subscription = supabase
      .channel(`pop_uploads_${selectedChildId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pop_uploads',
          filter: `student_id=eq.${selectedChildId}`,
        },
        (payload) => {
          console.log('[Payments] POP status updated:', payload.new);
          // Update local state with new status
          setPOPUploads((prev) => 
            prev.map((upload) => 
              upload.id === payload.new.id 
                ? { ...upload, ...payload.new } as POPUpload
                : upload
            )
          );
          // Also reload fees to reflect any payment status changes
          loadFees();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [selectedChildId, loadFees]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChildren();
    await loadFees();
  }, [loadChildren, loadFees]);

  // Computed values
  const upcomingFees = useMemo(() => {
    // Include pending_verification as it's still "upcoming" until fully verified
    return studentFees.filter(f => 
      f.status === 'pending' || 
      f.status === 'overdue' || 
      f.status === 'partially_paid' ||
      f.status === 'pending_verification'
    );
  }, [studentFees]);

  const paidFees = useMemo(() => {
    return studentFees.filter(f => f.status === 'paid');
  }, [studentFees]);

  // Fees awaiting POP verification (separate from pending)
  const pendingVerificationFees = useMemo(() => {
    return studentFees.filter(f => f.status === 'pending_verification');
  }, [studentFees]);

  const outstandingBalance = useMemo(() => {
    // Don't include pending_verification in outstanding balance since payment was made
    return upcomingFees
      .filter(f => f.status !== 'pending_verification')
      .reduce((sum, f) => sum + f.amount, 0);
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
    pendingVerificationFees,
    outstandingBalance,
    onRefresh,
    reloadFees: loadFees,
  };
}
