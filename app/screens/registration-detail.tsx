/**
 * Registration Detail Screen
 * 
 * Shows full details of a registration request including:
 * - Student information
 * - Guardian information  
 * - Documents (birth cert, clinic card, ID)
 * - Payment status and proof
 * - Campaign/discount applied
 * - Approval actions
 */

import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { selectFeeStructureForChild, type FeeStructureCandidate } from '@/lib/utils/feeStructureSelector';
import { isTuitionFee } from '@/lib/utils/feeUtils';
import { AlertModal, type AlertButton } from '@/components/ui/AlertModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Registration {
  id: string;
  organization_id: string;
  organization_name?: string;
  edusite_id?: string;
  // Guardian info
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  guardian_address?: string;
  guardian_id_number?: string;
  // Student info
  student_first_name: string;
  student_last_name: string;
  student_dob: string;
  student_gender?: string;
  student_id_number?: string;
  // Document URLs
  student_birth_certificate_url?: string;
  student_clinic_card_url?: string;
  guardian_id_document_url?: string;
  documents_uploaded: boolean;
  documents_deadline?: string;
  // Payment info
  payment_reference?: string;
  registration_fee_amount?: number;
  registration_fee_paid: boolean;
  payment_verified?: boolean;
  payment_method?: string;
  payment_date?: string;
  proof_of_payment_url?: string;
  campaign_applied?: string;
  discount_amount?: number;
  // Medical info
  medical_conditions?: string;
  allergies?: string;
  special_needs?: string;
  // Emergency contact
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  // Status
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_date?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  // Source tracking - which table this came from
  source?: 'edusite' | 'in-app' | 'aftercare';
  // Parent ID for in-app registrations
  parent_id?: string;
}

export default function RegistrationDetailScreen() {
  const { theme, isDark } = useTheme();
  const colors = theme; // Alias for compatibility
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popViewed, setPopViewed] = useState(false); // Track if POP has been viewed
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Alert modal state
  interface AlertState {
    visible: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
    buttons: AlertButton[];
  }

  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const showAlert = (title: string, message: string, type: AlertState['type'] = 'info', buttons: AlertButton[] = [{ text: 'OK', style: 'default' }]) => {
    setAlertState({ visible: true, title, message, type, buttons });
  };

  const hideAlert = () => {
    setAlertState(prev => ({ ...prev, visible: false }));
  };

  const getStartMonthIso = (offset: number): string => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return monthStart.toISOString().split('T')[0];
  };

  const promptStartMonth = (onSelect: (startDateIso: string) => void) => {
    showAlert(
      'Start Month',
      'When does the child start? This sets the first fee and avoids false unpaid fees.',
      'info',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Starts This Month',
          style: 'default',
          onPress: () => {
            hideAlert();
            onSelect(getStartMonthIso(0));
          },
        },
        {
          text: 'Starts Next Month',
          style: 'default',
          onPress: () => {
            hideAlert();
            onSelect(getStartMonthIso(1));
          },
        },
      ]
    );
  };

  // Check if registration can be approved
  const canApprove = (reg: Registration): boolean => {
    const requiresPayment = (reg.registration_fee_amount || 0) > 0;
    if (!requiresPayment) return true;
    return !!reg.payment_verified;
  };

  // Fetch registration details
  useEffect(() => {
    const fetchRegistration = async () => {
      if (!id) {
        setError('Registration ID not provided');
        setLoading(false);
        return;
      }

      try {
        const supabase = assertSupabase();
        
        // First try registration_requests (EduSite sync)
        const { data, error: fetchError } = await supabase
          .from('registration_requests')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }
        
        if (data) {
          setRegistration({ ...data, source: 'edusite' as const });
          setLoading(false);
          return;
        }

        // If not found, try child_registration_requests (in-app submissions)
        const { data: inAppData, error: inAppError } = await supabase
          .from('child_registration_requests')
          .select(`
            id,
            child_first_name,
            child_last_name,
            child_birth_date,
            child_gender,
            medical_info,
            dietary_requirements,
            special_needs,
            emergency_contact_name,
            emergency_contact_phone,
            notes,
            parent_id,
            preschool_id,
            status,
            reviewed_by,
            reviewed_at,
            rejection_reason,
            created_at,
            registration_fee_amount,
            registration_fee_paid,
            payment_method,
            proof_of_payment_url,
            payment_verified,
            parent:profiles!parent_id(first_name, last_name, email, phone)
          `)
          .eq('id', id)
          .maybeSingle();

        if (inAppError && inAppError.code !== 'PGRST116') {
          throw inAppError;
        }

        if (inAppData) {
          // Transform to Registration interface
          const parentData = Array.isArray(inAppData.parent) ? inAppData.parent[0] : inAppData.parent;
          const transformed: Registration = {
            id: inAppData.id,
            organization_id: inAppData.preschool_id,
            guardian_name: parentData 
              ? `${parentData.first_name || ''} ${parentData.last_name || ''}`.trim() 
              : 'Parent',
            guardian_email: parentData?.email || '',
            guardian_phone: parentData?.phone || '',
            student_first_name: inAppData.child_first_name,
            student_last_name: inAppData.child_last_name,
            student_dob: inAppData.child_birth_date,
            student_gender: inAppData.child_gender,
            documents_uploaded: true,
            // Payment info from DB
            registration_fee_amount: inAppData.registration_fee_amount || 0,
            registration_fee_paid: inAppData.registration_fee_paid || false,
            payment_verified: inAppData.payment_verified || false,
            payment_method: inAppData.payment_method,
            proof_of_payment_url: inAppData.proof_of_payment_url,
            status: inAppData.status,
            reviewed_by: inAppData.reviewed_by,
            rejection_reason: inAppData.rejection_reason,
            notes: inAppData.notes,
            created_at: inAppData.created_at,
            // Source tracking
            source: 'in-app' as const,
            parent_id: inAppData.parent_id,
            // Document fields (not available for in-app)
            guardian_id_document_url: undefined,
            student_birth_certificate_url: undefined,
            student_clinic_card_url: undefined,
          };
          setRegistration(transformed);
          setLoading(false);
          return;
        }
        
        // Not found in either table
        setError('Registration not found. It may have been deleted or you do not have permission to view it.');
      } catch (err: any) {
        console.error('Error fetching registration:', err);
        setError(err.message || 'Failed to load registration');
      } finally {
        setLoading(false);
      }
    };

    fetchRegistration();
  }, [id]);

  // Calculate age from DOB
  const calculateAge = (dob: string): string => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    if (years === 0) {
      return `${months} months`;
    }
    return `${years} years, ${months} months`;
  };

  // Format date
  const formatDate = (date: string | undefined): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Format date with time
  const formatDateTime = (date: string | undefined): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status color
  const getStatusColor = (status: Registration['status']): string => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      case 'pending': return '#F59E0B';
      default: return colors.textSecondary;
    }
  };

  // Open document
  const openDocument = (url: string | undefined, name: string) => {
    if (!url) {
      showAlert('Not Available', `${name} has not been uploaded yet.`, 'warning');
      return;
    }
    Linking.openURL(url).catch(() => {
      showAlert('Error', 'Could not open document', 'error');
    });
  };

  // Call guardian
  const callGuardian = () => {
    if (!registration?.guardian_phone) return;
    Linking.openURL(`tel:${registration.guardian_phone}`);
  };

  // Email guardian
  const emailGuardian = () => {
    if (!registration?.guardian_email) return;
    Linking.openURL(`mailto:${registration.guardian_email}`);
  };

  // WhatsApp guardian
  const whatsAppGuardian = () => {
    if (!registration?.guardian_phone) return;
    const phone = registration.guardian_phone.replace(/[^0-9]/g, '');
    // Convert to international format if needed
    const intlPhone = phone.startsWith('0') ? `27${phone.slice(1)}` : phone;
    Linking.openURL(`whatsapp://send?phone=${intlPhone}`);
  };

  const approveRegistrationCore = async (startDateIso: string) => {
    if (!registration) return;
    const supabase = assertSupabase();
    const isInApp = registration.source === 'in-app';
    const reviewerId = user?.id;
    const enrollmentDate = startDateIso || new Date().toISOString().split('T')[0];

    if (isInApp) {
      // Fetch full in-app registration
      const { data: regData, error: regError } = await supabase
        .from('child_registration_requests')
        .select('*, parent:profiles!parent_id(id, first_name, last_name)')
        .eq('id', registration.id)
        .single();

      if (regError) throw regError;

      // Generate student_id code
      let studentIdCode: string;
      try {
        const { data: org } = await supabase
          .from('preschools')
          .select('name')
          .eq('id', regData.preschool_id)
          .single();

        const orgCode = org?.name?.substring(0, 3).toUpperCase() || 'STU';
        const year = new Date().getFullYear().toString().slice(-2);

        const { count } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('preschool_id', regData.preschool_id);

        const nextNum = ((count || 0) + 1).toString().padStart(4, '0');
        studentIdCode = `${orgCode}-${year}-${nextNum}`;
      } catch (idErr) {
        console.warn('Failed to generate student_id, using fallback:', idErr);
        studentIdCode = `STU-${new Date().getFullYear().toString().slice(-2)}-${Date.now().toString().slice(-4)}`;
      }

      // Create student record
      const { data: newStudent, error: studentError } = await supabase
        .from('students')
        .insert({
          student_id: studentIdCode,
          first_name: regData.child_first_name?.trim() || regData.child_first_name,
          last_name: regData.child_last_name?.trim() || regData.child_last_name,
          date_of_birth: regData.child_birth_date,
          gender: regData.child_gender,
          enrollment_date: enrollmentDate,
          medical_conditions: regData.medical_info,
          allergies: regData.dietary_requirements,
          notes: regData.special_needs ? `Special needs: ${regData.special_needs}` : regData.notes,
          emergency_contact_name: regData.emergency_contact_name,
          emergency_contact_phone: regData.emergency_contact_phone,
          parent_id: regData.parent_id,
          guardian_id: regData.parent_id,
          registration_fee_amount: regData.registration_fee_amount || 0,
          registration_fee_paid: regData.registration_fee_paid || false,
          payment_verified: regData.payment_verified || false,
          preschool_id: regData.preschool_id,
          is_active: true,
          status: 'active',
        })
        .select('id')
        .single();

      if (studentError) throw studentError;

      // Link parent to student in junction table (for multi-parent support)
      if (regData.parent_id) {
        try {
          const { data: existingLink } = await supabase
            .from('student_parent_relationships')
            .select('id')
            .eq('parent_id', regData.parent_id)
            .eq('student_id', newStudent.id)
            .maybeSingle();

          if (!existingLink) {
            await supabase
              .from('student_parent_relationships')
              .insert({
                parent_id: regData.parent_id,
                student_id: newStudent.id,
                relationship_type: 'parent',
                is_primary: true,
              });
          }
        } catch (linkError) {
          console.warn('Failed to link parent to student:', linkError);
        }
      }

      // Auto-assign tuition fees
      try {
        const { data: feeStructures, error: feeError } = await supabase
          .from('fee_structures')
          .select('id, amount, fee_type, name, description, grade_levels, effective_from, created_at')
          .eq('preschool_id', regData.preschool_id)
          .eq('is_active', true)
          .order('effective_from', { ascending: false })
          .order('created_at', { ascending: false });

        if (feeError) {
          console.warn('Failed to load tuition fee structures:', feeError);
        }

        const tuitionFees = (feeStructures || []).filter((fee: any) =>
          isTuitionFee(fee.fee_type, fee.name, fee.description)
        );

        const selectedFee = selectFeeStructureForChild(
          tuitionFees as FeeStructureCandidate[],
          {
            dateOfBirth: regData.child_birth_date,
            enrollmentDate,
          }
        );

        if (selectedFee) {
          const startDate = new Date(enrollmentDate);
          const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          const nextMonth = new Date(startMonth.getFullYear(), startMonth.getMonth() + 1, 1);

          const feesToInsert = [startMonth, nextMonth].map(date => ({
            student_id: newStudent.id,
            fee_structure_id: selectedFee.id,
            amount: selectedFee.amount,
            final_amount: selectedFee.amount,
            due_date: date.toISOString().split('T')[0],
            status: 'pending',
            amount_outstanding: selectedFee.amount,
          }));

          await supabase.from('student_fees').insert(feesToInsert);
        }
      } catch (feeErr) {
        console.warn('Failed to auto-assign fees (non-critical):', feeErr);
      }

      // Ensure the parent is linked to this school via secure RPC.
      if (regData.parent_id) {
        try {
          await supabase.rpc('link_profile_to_school', {
            p_target_profile_id: regData.parent_id,
            p_school_id: regData.preschool_id,
            p_role: 'parent',
          });
        } catch (linkErr) {
          console.warn('[RegistrationDetail] Parent linkage RPC warning:', linkErr);
        }
      }

      // Update registration status
      const { error: updateError } = await supabase
        .from('child_registration_requests')
        .update({
          status: 'approved',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', registration.id);

      if (updateError) throw updateError;

      // Notify parent
      try {
        if (regData.parent_id) {
          await supabase.functions.invoke('notifications-dispatcher', {
            body: {
              event_type: 'child_registration_approved',
              user_ids: [regData.parent_id],
              parent_id: regData.parent_id,
              registration_id: registration.id,
              preschool_id: regData.preschool_id,
              student_id: newStudent.id,
              child_name: `${registration.student_first_name} ${registration.student_last_name}`,
            },
          });
        }
      } catch (notifErr) {
        console.warn('Failed to send approval notification:', notifErr);
      }

      showAlert(
        'Success',
        '✅ Registration approved!\n\n👶 Student profile created\n👤 Linked to parent\n📱 Parent notified',
        'success',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }

    // EduSite flow
    const { data: regData, error: regFetchError } = await supabase
      .from('registration_requests')
      .select('*')
      .eq('id', registration.id)
      .single();

    if (regFetchError) throw regFetchError;

    let parentId: string | null = null;
    const { data: existingParent } = await supabase
      .from('profiles')
      .select('id, organization_id, preschool_id')
      .eq('email', regData.guardian_email)
      .maybeSingle();

    if (existingParent) {
      parentId = existingParent.id;
      const needsOrgUpdate = !existingParent.organization_id ||
        existingParent.organization_id !== regData.organization_id ||
        existingParent.preschool_id !== regData.organization_id;

      if (needsOrgUpdate) {
        try {
          await supabase.rpc('link_profile_to_school', {
            p_target_profile_id: parentId,
            p_school_id: regData.organization_id,
            p_role: 'parent',
          });
        } catch (linkErr) {
          console.warn('[RegistrationDetail] Parent linkage RPC warning:', linkErr);
        }
      }
    }

    // Generate student_id code
    let studentIdCode: string;
    try {
      const { data: org } = await supabase
        .from('preschools')
        .select('name')
        .eq('id', regData.organization_id)
        .single();

      const orgCode = org?.name?.substring(0, 3).toUpperCase() || 'STU';
      const year = new Date().getFullYear().toString().slice(-2);

      const { count } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('preschool_id', regData.organization_id);

      const nextNum = ((count || 0) + 1).toString().padStart(4, '0');
      studentIdCode = `${orgCode}-${year}-${nextNum}`;
    } catch {
      studentIdCode = `STU-${new Date().getFullYear().toString().slice(-2)}-${Date.now().toString().slice(-4)}`;
    }

    const { data: newStudent, error: studentError } = await supabase
      .from('students')
      .insert({
        student_id: studentIdCode,
        first_name: regData.student_first_name?.trim() || regData.student_first_name,
        last_name: regData.student_last_name?.trim() || regData.student_last_name,
        date_of_birth: regData.student_dob,
        gender: regData.student_gender,
        enrollment_date: enrollmentDate,
        parent_id: parentId,
        guardian_id: parentId,
        registration_fee_amount: regData.registration_fee_amount || 0,
        registration_fee_paid: regData.registration_fee_paid || false,
        payment_verified: regData.payment_verified || false,
        preschool_id: regData.organization_id,
        is_active: true,
        status: 'active',
        emergency_contact_name: regData.guardian_name,
        emergency_contact_phone: regData.guardian_phone,
      })
      .select('id')
      .single();

    if (studentError) throw studentError;

    if (parentId) {
      try {
        const { data: existingLink } = await supabase
          .from('student_parent_relationships')
          .select('id')
          .eq('parent_id', parentId)
          .eq('student_id', newStudent.id)
          .maybeSingle();

        if (!existingLink) {
          await supabase
            .from('student_parent_relationships')
            .insert({
              parent_id: parentId,
              student_id: newStudent.id,
              relationship_type: 'parent',
              is_primary: true,
            });
        }
      } catch (linkError) {
        console.warn('Failed to link parent to student:', linkError);
      }
    }

    try {
      const { data: feeStructures, error: feeError } = await supabase
        .from('fee_structures')
        .select('id, amount, fee_type, name, description, grade_levels, effective_from, created_at')
        .eq('preschool_id', regData.organization_id)
        .eq('is_active', true)
        .order('effective_from', { ascending: false })
        .order('created_at', { ascending: false });

      if (feeError) {
        console.warn('Failed to load tuition fee structures:', feeError);
      }

      const tuitionFees = (feeStructures || []).filter((fee: any) =>
        isTuitionFee(fee.fee_type, fee.name, fee.description)
      );

      const selectedFee = selectFeeStructureForChild(
        tuitionFees as FeeStructureCandidate[],
        {
          dateOfBirth: regData.student_dob,
          enrollmentDate,
        }
      );

      if (selectedFee) {
        const startDate = new Date(enrollmentDate);
        const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const nextMonth = new Date(startMonth.getFullYear(), startMonth.getMonth() + 1, 1);

        const feesToInsert = [startMonth, nextMonth].map(date => ({
          student_id: newStudent.id,
          fee_structure_id: selectedFee.id,
          amount: selectedFee.amount,
          final_amount: selectedFee.amount,
          due_date: date.toISOString().split('T')[0],
          status: 'pending',
          amount_outstanding: selectedFee.amount,
        }));

        await supabase.from('student_fees').insert(feesToInsert);
      }
    } catch (feeErr) {
      console.warn('Failed to auto-assign fees:', feeErr);
    }

    const { error: updateError } = await supabase
      .from('registration_requests')
      .update({
        status: 'approved',
        reviewed_by: reviewerId,
        reviewed_date: new Date().toISOString(),
        edudash_student_id: newStudent.id,
        edudash_parent_id: parentId,
      })
      .eq('id', registration.id);

    if (updateError) throw updateError;

    // Ensure parent account creation + linking via Edge Function (best effort).
    try {
      const { error: syncError, data: syncData } = await supabase.functions.invoke(
        'sync-registration-to-edudash',
        { body: { registration_id: registration.id } }
      );
      const syncResponse = syncData as { error?: string } | null;
      if (syncError || syncResponse?.error) {
        console.warn(
          '[RegistrationDetail] sync-registration-to-edudash warning:',
          syncError?.message || syncResponse?.error
        );
      }
    } catch (syncErr) {
      console.warn('[RegistrationDetail] sync-registration-to-edudash failed:', syncErr);
    }

    if (parentId) {
      try {
        await supabase.functions.invoke('notifications-dispatcher', {
          body: {
            event_type: 'child_registration_approved',
            user_ids: [parentId],
            registration_id: registration.id,
            student_id: newStudent.id,
            child_name: `${registration.student_first_name} ${registration.student_last_name}`,
          },
        });
      } catch (notifErr) {
        console.warn('Failed to send approval notification:', notifErr);
      }
    }

    showAlert(
      'Success',
      `✅ Registration approved!\n\n👶 Student profile created (${studentIdCode})\n${parentId ? '👤 Linked to parent\n📱 Parent notified' : '⚠️ Parent account not found - they need to register'}`,
      'success',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  // Approve registration
  const handleApprove = async () => {
    if (!registration) return;

    const requiresPayment = (registration.registration_fee_amount || 0) > 0;
    if (requiresPayment && !registration.payment_verified) {
      showAlert('Payment Required', 'Please verify payment before approving this registration.', 'warning');
      return;
    }

    promptStartMonth(async (startDateIso) => {
      setProcessing(true);
      try {
        await approveRegistrationCore(startDateIso);
      } catch (err: any) {
        showAlert('Error', err.message || 'Failed to approve registration', 'error');
      } finally {
        setProcessing(false);
      }
    });
  };

  // Reject registration
  const handleReject = () => {
    if (!registration) return;
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  // Confirm rejection with reason
  const confirmRejection = async () => {
    if (!rejectionReason.trim()) {
      showAlert('Error', 'Please provide a rejection reason', 'error');
      return;
    }
    setShowRejectionModal(false);
    await processRejection(rejectionReason);
  };

  // Process the rejection
  const processRejection = async (reason: string) => {
    if (!registration) return;
    
    setProcessing(true);
    try {
      const supabase = assertSupabase();
      
      const isInApp = registration.source === 'in-app';
      const tableName = isInApp ? 'child_registration_requests' : 'registration_requests';
      
      const updateData: Record<string, any> = {
        status: 'rejected',
        rejection_reason: reason,
      };
      
      if (isInApp) {
        updateData.reviewed_by = user?.id;
        updateData.reviewed_at = new Date().toISOString();
      } else {
        updateData.reviewed_by = user?.email;
        updateData.reviewed_date = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', registration.id);

      if (error) throw error;

      showAlert('Rejected', 'Registration has been rejected.', 'info', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to reject registration', 'error');
    } finally {
      setProcessing(false);
    }
  };

  // Verify payment (and approve registration)
  const handleVerifyPayment = async () => {
    if (!registration) return;
    const hasPop = !!registration.proof_of_payment_url;
    
    showAlert(
      hasPop ? 'Verify Payment & Approve' : 'Confirm Payment (No POP)',
      hasPop
        ? 'Confirm that the payment has been received and approve this registration?'
        : 'No proof of payment was uploaded. Confirm the payment was received and approve this registration?',
      'info',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify & Approve',
          style: 'default',
          onPress: async () => {
            hideAlert();
            setProcessing(true);
            try {
              const supabase = assertSupabase();
              const tableName = registration.source === 'in-app' 
                ? 'child_registration_requests' 
                : 'registration_requests';
              
              const { error } = await supabase
                .from(tableName)
                .update({
                  payment_verified: true,
                  registration_fee_paid: true,
                })
                .eq('id', registration.id);

              if (error) throw error;

              setRegistration(prev => prev ? {
                ...prev,
                payment_verified: true,
                registration_fee_paid: true,
              } : null);
              setProcessing(false);
              promptStartMonth(async (startDateIso) => {
                setProcessing(true);
                try {
                  await approveRegistrationCore(startDateIso);
                } catch (err: any) {
                  showAlert('Error', err.message || 'Failed to approve registration', 'error');
                } finally {
                  setProcessing(false);
                }
              });
            } catch (err: any) {
              showAlert('Error', err.message || 'Failed to verify payment', 'error');
              setProcessing(false);
            } finally {
              // Processing state handled above
            }
          },
        },
      ]
    );
  };

  // Section component
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );

  // Info row component
  const InfoRow = ({ icon, label, value, onPress }: { 
    icon: string; 
    label: string; 
    value: string | undefined; 
    onPress?: () => void;
  }) => (
    <TouchableOpacity 
      style={styles.infoRow} 
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
        <Ionicons name={icon as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{value || 'N/A'}</Text>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  // Document button component
  const DocumentButton = ({ icon, label, url, uploaded }: {
    icon: string;
    label: string;
    url?: string;
    uploaded: boolean;
  }) => (
    <TouchableOpacity
      style={[
        styles.documentButton,
        { backgroundColor: uploaded ? colors.primary + '10' : colors.background },
        !uploaded && { borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }
      ]}
      onPress={() => openDocument(url, label)}
    >
      <Ionicons 
        name={icon as any} 
        size={24} 
        color={uploaded ? colors.primary : colors.textSecondary} 
      />
      <Text style={[
        styles.documentLabel, 
        { color: uploaded ? colors.primary : colors.textSecondary }
      ]}>
        {label}
      </Text>
      <View style={[
        styles.documentStatus,
        { backgroundColor: uploaded ? '#10B98120' : '#F59E0B20' }
      ]}>
        <Ionicons 
          name={uploaded ? 'checkmark-circle' : 'time'} 
          size={14} 
          color={uploaded ? '#10B981' : '#F59E0B'} 
        />
        <Text style={{ 
          color: uploaded ? '#10B981' : '#F59E0B',
          fontSize: 11,
          marginLeft: 4,
        }}>
          {uploaded ? 'Uploaded' : 'Pending'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Error state
  if (error || !registration) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Error' }} />
        <Ionicons name="warning" size={64} color="#EF4444" />
        <Text style={[styles.errorText, { color: colors.text }]}>
          {error || 'Registration not found'}
        </Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Stack.Screen 
        options={{ 
          headerShown: false, // We handle our own header with safe area
        }} 
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={isDark ? ['#1E3A5F', '#0F172A'] : ['#3B82F6', '#1D4ED8']}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          {/* Back Button */}
          <TouchableOpacity 
            style={styles.backButtonAbsolute}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>
              {registration.student_first_name?.[0]}{registration.student_last_name?.[0]}
            </Text>
          </View>
          <Text style={styles.studentNameLarge}>
            {registration.student_first_name} {registration.student_last_name}
          </Text>
          <Text style={styles.ageLarge}>
            {calculateAge(registration.student_dob)} old • {registration.student_gender || 'N/A'}
          </Text>
          
          {/* Status Badge */}
          <View style={[
            styles.statusBadgeLarge,
            { backgroundColor: getStatusColor(registration.status) }
          ]}>
            <Text style={styles.statusTextLarge}>
              {registration.status.toUpperCase()}
            </Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction} onPress={callGuardian}>
              <Ionicons name="call" size={20} color="#fff" />
              <Text style={styles.quickActionText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={whatsAppGuardian}>
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={styles.quickActionText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={emailGuardian}>
              <Ionicons name="mail" size={20} color="#fff" />
              <Text style={styles.quickActionText}>Email</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Guardian Information */}
        <Section title="Guardian Information">
          <InfoRow icon="person" label="Name" value={registration.guardian_name} />
          <InfoRow icon="call" label="Phone" value={registration.guardian_phone} onPress={callGuardian} />
          <InfoRow icon="mail" label="Email" value={registration.guardian_email} onPress={emailGuardian} />
          <InfoRow icon="location" label="Address" value={registration.guardian_address} />
          {registration.guardian_id_number && (
            <InfoRow icon="card" label="ID Number" value={registration.guardian_id_number} />
          )}
        </Section>

        {/* Student Information */}
        <Section title="Student Information">
          <InfoRow icon="calendar" label="Date of Birth" value={formatDate(registration.student_dob)} />
          <InfoRow icon="person" label="Gender" value={registration.student_gender} />
          {registration.student_id_number && (
            <InfoRow icon="card" label="ID Number" value={registration.student_id_number} />
          )}
        </Section>

        {/* Medical Information */}
        {(registration.medical_conditions || registration.allergies || registration.special_needs) && (
          <Section title="Medical Information">
            {registration.medical_conditions && (
              <InfoRow icon="medkit" label="Medical Conditions" value={registration.medical_conditions} />
            )}
            {registration.allergies && (
              <InfoRow icon="warning" label="Allergies" value={registration.allergies} />
            )}
            {registration.special_needs && (
              <InfoRow icon="heart" label="Special Needs" value={registration.special_needs} />
            )}
          </Section>
        )}

        {/* Emergency Contact */}
        {registration.emergency_contact_name && (
          <Section title="Emergency Contact">
            <InfoRow icon="person" label="Name" value={registration.emergency_contact_name} />
            <InfoRow icon="call" label="Phone" value={registration.emergency_contact_phone} />
            <InfoRow icon="people" label="Relationship" value={registration.emergency_contact_relationship} />
          </Section>
        )}

        {/* Documents */}
        <Section title="Documents">
          <View style={styles.documentsGrid}>
            <DocumentButton
              icon="document-text"
              label="Birth Certificate"
              url={registration.student_birth_certificate_url}
              uploaded={!!registration.student_birth_certificate_url}
            />
            <DocumentButton
              icon="medical"
              label="Clinic Card"
              url={registration.student_clinic_card_url}
              uploaded={!!registration.student_clinic_card_url}
            />
            <DocumentButton
              icon="card"
              label="Guardian ID"
              url={registration.guardian_id_document_url}
              uploaded={!!registration.guardian_id_document_url}
            />
          </View>
          {registration.documents_deadline && (
            <Text style={[styles.deadlineText, { color: colors.textSecondary }]}>
              Documents deadline: {formatDate(registration.documents_deadline)}
            </Text>
          )}
        </Section>

        {/* Payment Information */}
        <Section title="Payment Information">
          <View style={[
            styles.paymentStatus,
            { backgroundColor: registration.registration_fee_paid ? '#10B98115' : '#EF444415' }
          ]}>
            <Ionicons 
              name={registration.registration_fee_paid ? 'checkmark-circle' : 'close-circle'} 
              size={32} 
              color={registration.registration_fee_paid ? '#10B981' : '#EF4444'} 
            />
            <View style={styles.paymentStatusText}>
              <Text style={[styles.paymentStatusTitle, { 
                color: registration.registration_fee_paid ? '#10B981' : '#EF4444' 
              }]}>
                {registration.registration_fee_paid 
                  ? (registration.payment_verified ? 'Payment Verified' : 'Paid (Awaiting Verification)')
                  : 'Payment Pending'}
              </Text>
              {registration.registration_fee_amount && registration.registration_fee_amount > 0 ? (
                <Text style={[styles.paymentAmount, { color: colors.text }]}>
                  R{registration.registration_fee_amount.toLocaleString()}
                  {registration.discount_amount ? ` (Discount: R${registration.discount_amount})` : ''}
                </Text>
              ) : null}
            </View>
          </View>

          {registration.payment_reference && (
            <InfoRow icon="receipt" label="Reference" value={registration.payment_reference} />
          )}
          {registration.payment_method && (
            <InfoRow icon="card" label="Payment Method" value={registration.payment_method} />
          )}
          {registration.campaign_applied && (
            <InfoRow icon="pricetag" label="Campaign Applied" value={registration.campaign_applied} />
          )}
          {registration.proof_of_payment_url && (
            <>
              <TouchableOpacity
                style={[
                  styles.viewProofButton, 
                  { backgroundColor: popViewed ? colors.primary : '#F59E0B' }
                ]}
                onPress={() => {
                  setPopViewed(true);
                  openDocument(registration.proof_of_payment_url, 'Proof of Payment');
                }}
              >
                <Ionicons name="document-attach" size={20} color="#fff" />
                <Text style={styles.viewProofText}>
                  {popViewed ? '✓ View Proof of Payment' : '👁 View Proof of Payment'}
                </Text>
              </TouchableOpacity>

              {/* Verify Payment Button - Only enabled after viewing POP */}
              {!registration.payment_verified && registration.status === 'pending' && (
                <TouchableOpacity
                  style={[
                    styles.verifyPaymentButton, 
                    { 
                      backgroundColor: popViewed ? '#10B981' : '#6B7280',
                      opacity: popViewed ? 1 : 0.6,
                    }
                  ]}
                  onPress={handleVerifyPayment}
                  disabled={processing || !popViewed}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark" size={20} color="#fff" />
                      <Text style={styles.verifyPaymentText}>
                        {popViewed ? 'Verify & Approve' : 'View POP First to Verify'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* Show verified badge if already verified */}
              {registration.payment_verified && (
                <View style={[styles.verifiedBadge, { backgroundColor: '#10B98120' }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.verifiedText}>Payment Verified ✓</Text>
                </View>
              )}
            </>
          )}

          {/* Show verify button for non-POP payments */}
          {!registration.proof_of_payment_url && (registration.registration_fee_amount || 0) > 0 && !registration.payment_verified && registration.status === 'pending' && (
            <TouchableOpacity
              style={[styles.verifyPaymentButton, { backgroundColor: '#10B981' }]}
              onPress={handleVerifyPayment}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color="#fff" />
                  <Text style={styles.verifyPaymentText}>Confirm Paid & Approve</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </Section>

        {/* Status History */}
        <Section title="Application Status">
          <InfoRow icon="time" label="Applied On" value={formatDateTime(registration.created_at)} />
          {registration.reviewed_by && (
            <>
              <InfoRow icon="person" label="Reviewed By" value={registration.reviewed_by} />
              <InfoRow icon="calendar" label="Reviewed On" value={formatDateTime(registration.reviewed_date)} />
            </>
          )}
          {registration.rejection_reason && (
            <View style={[styles.rejectionReason, { backgroundColor: '#EF444415' }]}>
              <Ionicons name="close-circle" size={20} color="#EF4444" />
              <Text style={[styles.rejectionText, { color: '#EF4444' }]}>
                Rejection Reason: {registration.rejection_reason}
              </Text>
            </View>
          )}
          {registration.notes && (
            <InfoRow icon="document-text" label="Notes" value={registration.notes} />
          )}
        </Section>

        {/* Action Buttons (for pending) */}
        {registration.status === 'pending' && (
          <View style={styles.actionButtons}>
            {/* POP Warning */}
            {!canApprove(registration) && (
              <View style={[styles.popWarning, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="warning" size={20} color="#F59E0B" />
                <Text style={styles.popWarningText}>
                  Proof of Payment must be uploaded and verified before approval
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.approveButton,
                !canApprove(registration) && styles.disabledButton
              ]}
              onPress={handleApprove}
              disabled={processing || !canApprove(registration)}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color={canApprove(registration) ? '#fff' : '#999'} />
                  <Text style={[
                    styles.actionButtonText,
                    !canApprove(registration) && { color: '#999' }
                  ]}>
                    Approve Registration
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleReject}
              disabled={processing}
            >
              <Ionicons name="close-circle" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>Reject Registration</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Rejection Modal */}
      <Modal
        visible={showRejectionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRejectionModal(false)}
      >
        <View style={[styles.rejectionModalContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={[styles.rejectionModalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowRejectionModal(false)}>
              <Text style={[styles.rejectionModalCancel, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.rejectionModalTitle, { color: colors.text }]}>Reject Registration</Text>
            <TouchableOpacity onPress={confirmRejection}>
              <Text style={[styles.rejectionModalSubmit, { color: '#EF4444' }]}>Reject</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.rejectionModalContent}>
            <Text style={[styles.rejectionModalLabel, { color: colors.textSecondary }]}>
              Enter reason for rejecting {registration?.student_first_name}'s registration:
            </Text>
            <TextInput
              style={[styles.rejectionModalInput, { 
                backgroundColor: colors.surface, 
                color: colors.text, 
                borderColor: colors.border 
              }]}
              placeholder="Enter rejection reason..."
              placeholderTextColor={colors.textSecondary}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>
      </Modal>

      {/* Alert Modal */}
      <AlertModal
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        buttons={alertState.buttons}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonAbsolute: {
    position: 'absolute',
    left: 16,
    top: 16,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 24,
    alignItems: 'center',
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarTextLarge: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  studentNameLarge: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  ageLarge: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  statusBadgeLarge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusTextLarge: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 24,
  },
  quickAction: {
    alignItems: 'center',
    gap: 4,
  },
  quickActionText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
  },
  section: {
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 2,
  },
  documentsGrid: {
    gap: 12,
  },
  documentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  documentLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  documentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deadlineText: {
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  paymentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  paymentStatusText: {
    flex: 1,
  },
  paymentStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  viewProofButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  viewProofText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  verifyPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  verifyPaymentText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  verifiedText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectionReason: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  rejectionText: {
    flex: 1,
    fontSize: 14,
  },
  actionButtons: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  popWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  popWarningText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Rejection Modal Styles
  rejectionModalContainer: {
    flex: 1,
  },
  rejectionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  rejectionModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  rejectionModalCancel: {
    fontSize: 16,
  },
  rejectionModalSubmit: {
    fontSize: 16,
    fontWeight: '600',
  },
  rejectionModalContent: {
    padding: 16,
  },
  rejectionModalLabel: {
    fontSize: 14,
    marginBottom: 12,
  },
  rejectionModalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    minHeight: 120,
  },
});
