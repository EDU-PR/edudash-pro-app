import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { fetchParentChildren } from '@/lib/parent-children';
import type { PaymentChild, StudentFee, FeeStructure, PaymentMethod, POPUpload } from '@/types/payments';
import { selectFeeStructureForChild, type FeeStructureCandidate } from '@/lib/utils/feeStructureSelector';

const isTuitionFee = (feeType?: string | null, name?: string | null, description?: string | null) => {
  const text = `${feeType ?? ''} ${name ?? ''} ${description ?? ''}`.toLowerCase();
  return text.includes('tuition') || text.includes('school fees') || text.includes('school fee') || text.includes('monthly');
};

const resolveAgeGroupLabel = (child?: PaymentChild) => {
  const directName =
    child?.age_group?.name ||
    child?.age_group_ref_data?.name ||
    child?.grade_level ||
    child?.grade;
  if (directName) return directName;

  const min = child?.age_group?.age_min ?? child?.age_group_ref_data?.age_min ?? null;
  const max = child?.age_group?.age_max ?? child?.age_group_ref_data?.age_max ?? null;
  if (min != null || max != null) {
    if (min != null && max != null) return `${min}-${max}`;
    if (min != null) return `${min}+`;
    if (max != null) return `0-${max}`;
  }
  return null;
};

const buildFeeContext = (child?: PaymentChild) => ({
  dateOfBirth: child?.date_of_birth ?? null,
  ageGroupLabel: resolveAgeGroupLabel(child),
  gradeLevel: child?.grade_level ?? child?.grade ?? null,
});

export function useParentPayments() {
  const { user, profile } = useAuth();
  const appState = useRef(AppState.currentState);
  // Use ref for loadFees to avoid stale closure issues in realtime callbacks
  const loadFeesRef = useRef<(() => Promise<void>) | undefined>(undefined);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [children, setChildren] = useState<PaymentChild[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [feeStructure, setFeeStructure] = useState<FeeStructure[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [popUploads, setPOPUploads] = useState<POPUpload[]>([]);

  const getEnrollmentMonthStart = useCallback((date?: string | null) => {
    if (!date) return null;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, []);

  const getNextFeeMonth = useCallback(() => {
    const now = new Date();
    const day = now.getDate(), month = now.getMonth(), year = now.getFullYear();
    if (day > 7) return month === 11 ? { month: 0, year: year + 1 } : { month: month + 1, year };
    return { month, year };
  }, []);

  // Load children linked to parent
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
              // Try preschools first, then organizations (for membership orgs like SOA)
              let school = null;
              ({ data: school } = await supabase.from('preschools').select('name').eq('id', student.preschool_id).maybeSingle());
              if (!school) {
                ({ data: school } = await supabase.from('organizations').select('name').eq('id', student.preschool_id).maybeSingle());
              }
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
  }, [profile?.id, profile?.preschool_id, profile?.organization_id, selectedChildId]);

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
            id,
            name,
            fee_type,
            description,
            grade_levels
          )
        `)
        .eq('student_id', selectedChildId)
        .order('due_date', { ascending: true });

      let mappedFees: StudentFee[] = [];
      let hasTuitionFeesForChild = false;

      if (fees && fees.length > 0) {
        const enrollmentStart = getEnrollmentMonthStart(selectedChild?.enrollment_date);
        let filteredFees = fees.filter((f: any) => {
          if (!enrollmentStart || !f?.due_date) return true;
          const dueDate = new Date(f.due_date);
          if (Number.isNaN(dueDate.getTime())) return true;
          return dueDate >= enrollmentStart;
        });

        const feeContext = buildFeeContext(selectedChild);
        const canFilterByAge = Boolean(feeContext.dateOfBirth || feeContext.ageGroupLabel || feeContext.gradeLevel);
        const tuitionStructures = filteredFees
          .filter((f: any) => isTuitionFee(f?.fee_structures?.fee_type, f?.fee_structures?.name, f?.fee_structures?.description))
          .map((f: any) => f.fee_structures)
          .filter((fs: any) => fs && fs.id) as FeeStructureCandidate[];

        const uniqueTuitionStructures = tuitionStructures.filter((fs, idx, arr) =>
          arr.findIndex(item => item.id === fs.id) === idx
        );

        const selectedStructure = canFilterByAge && uniqueTuitionStructures.length > 1
          ? selectFeeStructureForChild(uniqueTuitionStructures, feeContext)
          : null;
        const selectedStructureId = selectedStructure?.id;

        if (selectedStructureId) {
          filteredFees = filteredFees.filter((f: any) => {
            if (!isTuitionFee(f?.fee_structures?.fee_type, f?.fee_structures?.name, f?.fee_structures?.description)) {
              return true;
            }
            const feeStructureId = f?.fee_structures?.id || f?.fee_structure_id;
            return !feeStructureId || feeStructureId === selectedStructureId;
          });
        }

        hasTuitionFeesForChild = filteredFees.some((f: any) =>
          isTuitionFee(f?.fee_structures?.fee_type, f?.fee_structures?.name, f?.fee_structures?.description)
        );

        // Map database fields to expected StudentFee interface
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        mappedFees = filteredFees.map((f: any) => {
          // Generate month-specific description from due_date
          const dueDate = new Date(f.due_date);
          const month = monthNames[dueDate.getMonth()];
          const year = dueDate.getFullYear();
          const baseName = f.fee_structures?.name || f.fee_structures?.description || 'School Fees';
          // Extract age group if present (e.g., "Monthly School Fees - Ages 4-6" -> "4-6 years")
          const ageMatch = baseName.match(/Ages?\s*([\d]+-[\d]+|[\d]+\s*(?:months?|years?)?)/i);
          const ageGroup = ageMatch ? ageMatch[1] : '';
          const description = `${month} ${year} School Fees${ageGroup ? ` (${ageGroup}${!ageGroup.includes('year') && !ageGroup.includes('month') ? ' years' : ''})` : ''}`;
          
          // SIMPLIFIED: Trust database student_fees.status as source of truth
          // The approvePayment function in usePrincipalHub already updates this to 'paid'
          // Find matching POP just for display purposes (pop_status field)
          const matchingPOP = popUploadsData.find((pop: any) => {
            if (!pop.payment_date) return false;
            const popDate = new Date(pop.payment_date);
            const feeDate = new Date(f.due_date);
            const sameMonth = popDate.getMonth() === feeDate.getMonth() && popDate.getFullYear() === feeDate.getFullYear();
            const similarAmount = pop.payment_amount && Math.abs(pop.payment_amount - (f.final_amount || f.amount)) < 10;
            return sameMonth || similarAmount;
          });
          
          return {
            id: f.id,
            student_id: f.student_id,
            fee_type: f.fee_structures?.fee_type || 'tuition',
            description,
            amount: f.final_amount || f.amount,
            due_date: f.due_date,
            grace_period_days: 7,
            paid_date: f.paid_date,
            status: f.status, // Trust database status directly
            pop_status: matchingPOP?.status, // Include POP status for UI display
          };
        });
      }

      // Get fee structure for the school (try school_fee_structures first, fallback to fee_structures)
      if (childPreschoolId) {
        let resolvedFees: any[] = [];
        const { data: schoolFees } = await supabase
          .from('school_fee_structures')
          .select('*')
          .eq('preschool_id', childPreschoolId)
          .eq('is_active', true);

        if (schoolFees && schoolFees.length > 0) {
          resolvedFees = schoolFees.map((f: any) => ({
            id: f.id,
            name: f.name,
            fee_type: f.fee_category || f.name,
            amount: f.amount_cents / 100,
            description: f.description || f.name,
            payment_frequency: f.billing_frequency,
            age_group: f.age_group,
            grade_level: f.grade_level,
          }));
        } else {
          const { data: legacyFees } = await supabase
            .from('fee_structures')
            .select('*')
            .eq('preschool_id', childPreschoolId)
            .eq('is_active', true);

          if (legacyFees && legacyFees.length > 0) {
            resolvedFees = legacyFees.map((f: any) => ({
              id: f.id,
              name: f.name,
              fee_type: f.fee_type || f.name,
              amount: f.amount,
              description: f.description || f.name,
              payment_frequency: f.frequency,
              age_group: Array.isArray(f.grade_levels) ? f.grade_levels.join(', ') : undefined,
              grade_levels: Array.isArray(f.grade_levels) ? f.grade_levels : undefined,
            }));
          }
        }

        if (resolvedFees.length > 0) {
          setFeeStructure(resolvedFees as FeeStructure[]);

          // Generate next month's fee if no tuition fees exist (age-aware selection)
          const tuitionFees = resolvedFees.filter((f: any) => isTuitionFee(f.fee_type, f.name, f.description));
          const selectedFee = tuitionFees.length > 0
            ? selectFeeStructureForChild(tuitionFees as FeeStructureCandidate[], buildFeeContext(selectedChild)) || tuitionFees[0]
            : null;
          if (selectedFee && (!fees || fees.length === 0 || !hasTuitionFeesForChild)) {
            const { month, year } = getNextFeeMonth();
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            mappedFees = [
              ...mappedFees,
              {
                id: `pending-${monthNames[month].toLowerCase()}-${year}`,
                student_id: selectedChildId,
                fee_type: 'monthly_tuition',
                description: `${monthNames[month]} ${year} School Fees${selectedFee.age_group ? ` (${selectedFee.age_group})` : ''}`,
                amount: selectedFee.amount,
                due_date: `${year}-${String(month + 1).padStart(2, '0')}-01`,
                grace_period_days: 7,
                status: 'pending',
              },
            ];
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

      setStudentFees(mappedFees);
      // POP uploads already loaded at the start of this function
    } catch (error) {
      console.error('[Payments] Error loading fees:', error);
    }
  }, [selectedChildId, children, profile?.preschool_id, getNextFeeMonth]);

  // Keep loadFeesRef in sync with latest loadFees
  useEffect(() => {
    loadFeesRef.current = loadFees;
  }, [loadFees]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  useEffect(() => {
    if (selectedChildId) {
      loadFees();
    }
  }, [selectedChildId, loadFees]);

  // Refresh data when app comes to foreground (e.g., after notification tap)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[Payments] App came to foreground, refreshing data...');
        // Use ref to get fresh loadFees reference, not stale closure
        if (selectedChildId && loadFeesRef.current) {
          loadFeesRef.current();
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [selectedChildId]); // Removed loadFees dependency - using ref instead
  // Realtime subscription for POP status updates AND student_fees changes
  useEffect(() => {
    if (!selectedChildId) return;
    
    const supabase = assertSupabase();
    
    // Subscribe to BOTH pop_uploads AND student_fees changes for this child
    const subscription = supabase
      .channel(`payments_${selectedChildId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pop_uploads',
          filter: `student_id=eq.${selectedChildId}`,
        },
        (payload) => {
          console.log('[Payments] POP uploaded via realtime:', payload.new);
          // Add new POP to local state
          setPOPUploads((prev) => {
            // Check if already exists to avoid duplicates
            if (prev.some(u => u.id === payload.new.id)) {
              return prev;
            }
            return [{ ...payload.new } as POPUpload, ...prev];
          });
          // Reload fees using ref to get fresh function
          if (loadFeesRef.current) {
            loadFeesRef.current();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pop_uploads',
          filter: `student_id=eq.${selectedChildId}`,
        },
        (payload) => {
          console.log('[Payments] POP status updated via realtime:', payload.new);
          // Update local POP state
          setPOPUploads((prev) => 
            prev.map((upload) => 
              upload.id === payload.new.id 
                ? { ...upload, ...payload.new } as POPUpload
                : upload
            )
          );
          // Reload fees using ref to get fresh function
          if (loadFeesRef.current) {
            loadFeesRef.current();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'student_fees',
          filter: `student_id=eq.${selectedChildId}`,
        },
        (payload) => {
          console.log('[Payments] Fee status updated via realtime:', payload.new);
          // Reload fees to reflect the database change
          // This is the KEY fix - when principal approves, student_fees.status changes
          if (loadFeesRef.current) {
            loadFeesRef.current();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [selectedChildId]); // Removed loadFees dependency - using ref instead

  const onRefresh = useCallback(async () => {
    console.log('[ParentPayments] Manual refresh triggered');
    setRefreshing(true);
    try {
      await loadChildren();
      await loadFees();
      console.log('[ParentPayments] Manual refresh completed successfully');
    } catch (error) {
      console.error('[ParentPayments] Manual refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
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
    // Include fees that are overdue or due within the next 7 days
    const today = new Date();
    const dueSoonCutoff = new Date();
    dueSoonCutoff.setDate(dueSoonCutoff.getDate() + 7);
    return upcomingFees
      .filter(f => f.status !== 'pending_verification')
      .filter(f => {
        if (!f.due_date) return true;
        const dueDate = new Date(f.due_date);
        if (Number.isNaN(dueDate.getTime())) return true;
        return dueDate <= dueSoonCutoff;
      })
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
