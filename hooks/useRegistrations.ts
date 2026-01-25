/**
 * useRegistrations Hook
 * 
 * Manages state and business logic for principal registration reviews.
 * Supports both registration_requests (EduSitePro sync) and child_registration_requests (in-app).
 * Extracted from principal-registrations.tsx per WARP.md file size standards.
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';

// Types
export interface Registration {
  id: string;
  organization_id: string;
  organization_name?: string;
  edusite_id?: string;
  parent_id?: string; // For in-app registrations - the parent's profile ID
  // Guardian info
  guardian_name: string;
  guardian_email: string;
  guardian_phone: string;
  guardian_address?: string;
  // Student info
  student_first_name: string;
  student_last_name: string;
  student_dob: string;
  student_gender?: string;
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
  proof_of_payment_url?: string;
  campaign_applied?: string;
  discount_amount?: number;
  // Status
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewed_date?: string;
  rejection_reason?: string;
  created_at: string;
  // Source tracking
  source?: 'edusite' | 'in-app' | 'aftercare';
  // Additional fields from child_registration_requests
  medical_info?: string;
  dietary_requirements?: string;
  special_needs?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export interface SuccessModalState {
  visible: boolean;
  title: string;
  message: string;
  icon?: string;
}

export interface UseRegistrationsReturn {
  // Data
  registrations: Registration[];
  filteredRegistrations: Registration[];
  // State
  loading: boolean;
  refreshing: boolean;
  syncing: boolean;
  processing: string | null;
  error: string | null;
  // Filters
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  // Modal
  successModal: SuccessModalState;
  setSuccessModal: React.Dispatch<React.SetStateAction<SuccessModalState>>;
  // Actions
  fetchRegistrations: () => Promise<void>;
  onRefresh: () => void;
  handleSyncWithEduSite: () => Promise<void>;
  handleApprove: (registration: Registration) => void;
  handleReject: (registration: Registration) => void;
  handleVerifyPayment: (registration: Registration, verify: boolean) => void;
  // Helpers
  canApprove: (registration: Registration) => boolean;
  // Feature flags
  usesEdusiteSync: boolean;
  // Stats
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  // Payment reminders
  sendPaymentReminder: (registration: Registration) => void;
  sendingReminder: string | null;
}

export function useRegistrations(): UseRegistrationsReturn {
  const { user, profile } = useAuth();
  const organizationId = profile?.preschool_id || profile?.organization_id;

  // Schools that DON'T use EduSite sync (EduDash Pro platform schools)
  const EDUDASH_COMMUNITY_SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
  const EDUDASH_MAIN_SCHOOL_ID = '00000000-0000-0000-0000-000000000003';
  
  // Check if this school uses EduSite sync
  const usesEdusiteSync = organizationId && 
    organizationId !== EDUDASH_COMMUNITY_SCHOOL_ID && 
    organizationId !== EDUDASH_MAIN_SCHOOL_ID;

  // State
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [error, setError] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  
  // Success modal state
  const [successModal, setSuccessModal] = useState<SuccessModalState>({
    visible: false,
    title: '',
    message: '',
  });

  // Fetch registrations from both tables
  const fetchRegistrations = useCallback(async () => {
    if (!organizationId) {
      console.log('⏳ [Registrations] Waiting for organizationId...');
      return;
    }

    try {
      setError(null);
      const supabase = assertSupabase();
      
      console.log('📍 [Registrations] Fetching for organization:', organizationId);

      // Fetch from registration_requests (EduSitePro sync)
      const { data: edusiteData, error: edusiteError } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      // Fetch from child_registration_requests (in-app submissions)
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
        .eq('preschool_id', organizationId)
        .order('created_at', { ascending: false });

      // Fetch from aftercare_registrations (web and native aftercare submissions)
      // EduDash Pro schools query both Community and Main school registrations
      // Simplified: Each principal sees only their own school's registrations
      const { data: aftercareData, error: aftercareError } = await supabase
        .from('aftercare_registrations')
        .select('*')
        .eq('preschool_id', organizationId)
        .order('created_at', { ascending: false });

      if (edusiteError && edusiteError.code !== '42P01') {
        console.warn('⚠️ [Registrations] EduSite fetch error:', edusiteError);
      }
      if (inAppError && inAppError.code !== '42P01') {
        console.warn('⚠️ [Registrations] In-app fetch error:', inAppError);
      }
      if (aftercareError && aftercareError.code !== '42P01') {
        console.warn('⚠️ [Registrations] Aftercare fetch error:', aftercareError);
      }

      // Transform in-app registrations to match Registration interface
      const transformedInApp: Registration[] = (inAppData || []).map((item: any) => ({
        id: item.id,
        organization_id: item.preschool_id,
        parent_id: item.parent_id, // Map parent_id for notifications
        // Guardian info from joined parent profile
        guardian_name: item.parent 
          ? `${item.parent.first_name || ''} ${item.parent.last_name || ''}`.trim() 
          : 'Parent',
        guardian_email: item.parent?.email || '',
        guardian_phone: item.parent?.phone || '',
        // Student info
        student_first_name: item.child_first_name,
        student_last_name: item.child_last_name,
        student_dob: item.child_birth_date,
        student_gender: item.child_gender,
        // Documents - in-app doesn't require documents
        documents_uploaded: true,
        // Payment - use actual values from DB
        registration_fee_amount: item.registration_fee_amount || 0,
        registration_fee_paid: item.registration_fee_paid || false,
        payment_verified: item.payment_verified || false,
        payment_method: item.payment_method,
        proof_of_payment_url: item.proof_of_payment_url,
        // Status
        status: item.status,
        reviewed_by: item.reviewed_by,
        reviewed_date: item.reviewed_at,
        rejection_reason: item.rejection_reason,
        created_at: item.created_at,
        // Source tracking
        source: 'in-app' as const,
        // Additional fields
        medical_info: item.medical_info,
        dietary_requirements: item.dietary_requirements,
        special_needs: item.special_needs,
        emergency_contact_name: item.emergency_contact_name,
        emergency_contact_phone: item.emergency_contact_phone,
      }));

      // Add source to EduSite registrations
      const transformedEdusite: Registration[] = (edusiteData || []).map((item: any) => ({
        ...item,
        source: 'edusite' as const,
      }));

      // Transform aftercare registrations to match Registration interface
      // Map aftercare statuses: pending_payment/waitlisted → pending, paid/enrolled → approved, cancelled → rejected
      const mapAftercareStatus = (status: string): 'pending' | 'approved' | 'rejected' => {
        if (status === 'paid' || status === 'enrolled') return 'approved';
        if (status === 'cancelled') return 'rejected';
        return 'pending'; // pending_payment, waitlisted
      };

      const transformedAftercare: Registration[] = (aftercareData || []).map((item: any) => ({
        id: item.id,
        organization_id: item.preschool_id,
        // Guardian info
        guardian_name: `${item.parent_first_name || ''} ${item.parent_last_name || ''}`.trim(),
        guardian_email: item.parent_email || '',
        guardian_phone: item.parent_phone || '',
        // Student info
        student_first_name: item.child_first_name,
        student_last_name: item.child_last_name,
        student_dob: item.child_date_of_birth || '',
        student_gender: undefined, // Aftercare doesn't have gender field
        // Documents
        documents_uploaded: true,
        // Payment info
        payment_reference: item.payment_reference,
        registration_fee_amount: item.registration_fee || 0,
        registration_fee_paid: item.status === 'paid' || item.status === 'enrolled',
        payment_verified: item.status === 'paid' || item.status === 'enrolled',
        payment_method: undefined, // Aftercare doesn't store payment_method
        proof_of_payment_url: item.proof_of_payment_url,
        campaign_applied: item.promotion_code,
        discount_amount: item.registration_fee_original && item.registration_fee 
          ? item.registration_fee_original - item.registration_fee 
          : 0,
        // Status - map aftercare statuses to Registration statuses
        status: mapAftercareStatus(item.status),
        reviewed_by: undefined, // Aftercare doesn't track reviewer
        reviewed_date: item.payment_date || item.updated_at,
        rejection_reason: item.status === 'cancelled' ? 'Cancelled' : undefined,
        created_at: item.created_at,
        // Source tracking
        source: 'aftercare' as const,
        // Additional fields - map aftercare fields
        medical_info: item.child_medical_conditions,
        dietary_requirements: item.child_allergies, // Aftercare uses allergies field
        special_needs: undefined,
        emergency_contact_name: item.emergency_contact_name,
        emergency_contact_phone: item.emergency_contact_phone,
      }));

      // Combine and sort by created_at
      const combined = [...transformedEdusite, ...transformedInApp, ...transformedAftercare].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      console.log('✅ [Registrations] Found:', combined.length, 'total registrations', 
        `(${transformedEdusite.length} EduSite, ${transformedInApp.length} in-app, ${transformedAftercare.length} aftercare)`);
      setRegistrations(combined);
    } catch (err: any) {
      console.error('❌ [Registrations] Error:', err);
      setError(err.message || 'Failed to load registrations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);

  // Initial fetch
  useEffect(() => {
    if (organizationId) {
      fetchRegistrations();
    }
  }, [organizationId, fetchRegistrations]);

  // Refresh data when screen comes back into focus (e.g., after viewing detail page)
  useFocusEffect(
    useCallback(() => {
      if (organizationId) {
        console.log('🔄 [Registrations] Screen focused, refreshing data...');
        fetchRegistrations();
      }
    }, [organizationId, fetchRegistrations])
  );

  // Filter registrations when search/filter changes
  useEffect(() => {
    let filtered = registrations;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.guardian_name?.toLowerCase().includes(term) ||
        r.guardian_email?.toLowerCase().includes(term) ||
        r.student_first_name?.toLowerCase().includes(term) ||
        r.student_last_name?.toLowerCase().includes(term) ||
        r.guardian_phone?.includes(term)
      );
    }

    setFilteredRegistrations(filtered);
  }, [registrations, statusFilter, searchTerm]);

  // Pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Sync with EduSite
  const handleSyncWithEduSite = async () => {
    if (!organizationId) return;
    
    setSyncing(true);
    try {
      const supabase = assertSupabase();
      
      // Call the sync edge function
      const { data, error: syncError } = await supabase.functions.invoke('sync-registrations-from-edusite', {
        body: { organization_id: organizationId },
      });

      if (syncError) throw syncError;

      Alert.alert(
        'Sync Complete',
        data?.message || `Synced ${data?.count || 0} registrations from EduSitePro`,
        [{ text: 'OK', onPress: fetchRegistrations }]
      );
    } catch (err: any) {
      console.error('❌ [Registrations] Sync error:', err);
      Alert.alert('Sync Failed', err.message || 'Failed to sync with EduSitePro');
    } finally {
      setSyncing(false);
    }
  };

  // Check if registration can be approved
  // Updated: Allow approval if POP is uploaded (verification is recommended but not required)
  const canApprove = (item: Registration): boolean => {
    // Already approved items shouldn't show approve button
    if (item.status !== 'pending') {
      return false;
    }
    
    // Aftercare registrations: can approve if POP is uploaded
    if (item.source === 'aftercare') {
      // If there's a fee, need proof of payment
      if (item.registration_fee_amount && item.registration_fee_amount > 0) {
        return !!item.proof_of_payment_url;
      }
      return true;
    }
    
    // EduSite registrations need proof of payment verified
    if (item.source === 'edusite') {
      return !!item.proof_of_payment_url && !!item.payment_verified;
    }
    
    // In-app registrations with registration fee need POP uploaded + verified
    if (item.registration_fee_amount && item.registration_fee_amount > 0) {
      return !!item.proof_of_payment_url && !!item.payment_verified;
    }
    
    // In-app registrations without fee can be approved directly
    return true;
  };

  // Approve registration
  const handleApprove = (registration: Registration) => {
    const isInApp = registration.source === 'in-app';
    const hasUnverifiedPayment = registration.proof_of_payment_url && !registration.payment_verified;
    
    // Build the confirmation message
    let message = `Approve registration for ${registration.student_first_name} ${registration.student_last_name}?`;
    if (isInApp) {
      message += '\n\nThis will create a student profile.';
    }
    if (hasUnverifiedPayment) {
      message += '\n\n⚠️ Note: Payment has not been verified yet. Consider clicking "Verify" first to confirm the payment.';
    }
    
    Alert.alert(
      'Approve Registration',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: hasUnverifiedPayment ? 'Approve Anyway' : 'Approve',
          onPress: async () => {
            setProcessing(registration.id);
            try {
              const supabase = assertSupabase();
              
              if (isInApp) {
                // First, fetch the full registration data with parent info
                const { data: regData, error: regError } = await supabase
                  .from('child_registration_requests')
                  .select('*, parent:profiles!parent_id(id, first_name, last_name)')
                  .eq('id', registration.id)
                  .single();

                if (regError) throw regError;

                // Generate student_id code for new student
                let studentIdCode: string;
                try {
                  // Get org name for prefix
                  const { data: org } = await supabase
                    .from('preschools')
                    .select('name')
                    .eq('id', regData.preschool_id)
                    .single();

                  // Use first 3 letters of org name as code (e.g., YOU for Young Eagles)
                  const orgCode = org?.name?.substring(0, 3).toUpperCase() || 'STU';
                  const year = new Date().getFullYear().toString().slice(-2);

                  // Count existing students to generate next number
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

                // Create student record in students table
                const { data: newStudent, error: studentError } = await supabase
                  .from('students')
                  .insert({
                    student_id: studentIdCode,
                    first_name: regData.child_first_name,
                    last_name: regData.child_last_name,
                    date_of_birth: regData.child_birth_date,
                    gender: regData.child_gender,
                    medical_conditions: regData.medical_info,
                    allergies: regData.dietary_requirements,
                    notes: regData.special_needs ? `Special needs: ${regData.special_needs}` : regData.notes,
                    emergency_contact_name: regData.emergency_contact_name,
                    emergency_contact_phone: regData.emergency_contact_phone,
                    parent_id: regData.parent_id,
                    guardian_id: regData.parent_id,
                    preschool_id: regData.preschool_id,
                    is_active: true,
                    status: 'active',
                  })
                  .select('id')
                  .single();

                if (studentError) throw studentError;

                // Auto-assign monthly fees for the new student
                try {
                  // Get tuition fee structure for this school
                  const { data: feeStructure } = await supabase
                    .from('fee_structures')
                    .select('id, amount')
                    .eq('preschool_id', regData.preschool_id)
                    .eq('fee_type', 'tuition')
                    .eq('is_active', true)
                    .single();

                  if (feeStructure) {
                    // Create fee for current month and next month
                    const now = new Date();
                    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    
                    const feesToInsert = [currentMonth, nextMonth].map(date => ({
                      student_id: newStudent.id,
                      fee_structure_id: feeStructure.id,
                      amount: feeStructure.amount,
                      final_amount: feeStructure.amount,
                      due_date: date.toISOString().split('T')[0],
                      status: 'pending',
                      amount_outstanding: feeStructure.amount,
                    }));

                    await supabase.from('student_fees').insert(feesToInsert);
                    console.log('✅ Auto-assigned monthly fees for new student');
                  }
                } catch (feeErr) {
                  console.warn('Failed to auto-assign fees (non-critical):', feeErr);
                }

                // Ensure the parent is linked to this school via a secure RPC.
                // Direct profile updates are blocked by RLS for principals.
                if (regData.parent_id) {
                  try {
                    await supabase.rpc('link_profile_to_school', {
                      p_target_profile_id: regData.parent_id,
                      p_school_id: regData.preschool_id,
                      p_role: 'parent',
                    });
                  } catch (linkErr) {
                    console.warn('[Registrations] Parent linkage RPC warning:', linkErr);
                  }
                }

                // Update child_registration_requests table with student_id reference
                const { error: updateError } = await supabase
                  .from('child_registration_requests')
                  .update({
                    status: 'approved',
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString(),
                  })
                  .eq('id', registration.id);

                if (updateError) throw updateError;

                // Send notification to parent
                try {
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
                } catch (notifErr) {
                  console.warn('Failed to send approval notification:', notifErr);
                }

                setSuccessModal({
                  visible: true,
                  title: 'Success',
                  message: '✅ Registration approved!\n\n👶 Student profile created\n👤 Linked to parent\n📱 Parent notified',
                  icon: 'checkmark-circle',
                });
              } else {
                // EduSite flow - create student and link to parent (or create parent if needed)
                const { data: regData, error: regFetchError } = await supabase
                  .from('registration_requests')
                  .select('*')
                  .eq('id', registration.id)
                  .single();

                if (regFetchError) throw regFetchError;

                // Check if parent already exists by email
                let parentId: string | null = null;
                const { data: existingParent } = await supabase
                  .from('profiles')
                  .select('id, organization_id, preschool_id')
                  .eq('email', regData.guardian_email)
                  .maybeSingle();

                if (existingParent) {
                  parentId = existingParent.id;
                  // ALWAYS update parent's organization to match registration
                  // This fixes cases where parent was created with placeholder org
                  const needsOrgUpdate = !existingParent.organization_id || 
                    existingParent.organization_id !== regData.organization_id ||
                    existingParent.preschool_id !== regData.organization_id;
                  
                  if (needsOrgUpdate) {
                    console.log(`[Approve] Linking parent ${parentId} to school ${regData.organization_id}`);
                    try {
                      await supabase.rpc('link_profile_to_school', {
                        p_target_profile_id: parentId,
                        p_school_id: regData.organization_id,
                        p_role: 'parent',
                      });
                    } catch (linkErr) {
                      console.warn('[Approve] Parent linkage RPC warning:', linkErr);
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

                // Create student record
                const { data: newStudent, error: studentError } = await supabase
                  .from('students')
                  .insert({
                    student_id: studentIdCode,
                    first_name: regData.student_first_name,
                    last_name: regData.student_last_name,
                    date_of_birth: regData.student_dob,
                    gender: regData.student_gender,
                    parent_id: parentId,
                    guardian_id: parentId,
                    preschool_id: regData.organization_id,
                    is_active: true,
                    status: 'active',
                    emergency_contact_name: regData.guardian_name,
                    emergency_contact_phone: regData.guardian_phone,
                  })
                  .select('id')
                  .single();

                if (studentError) throw studentError;

                // Auto-assign tuition fees
                try {
                  const { data: feeStructure } = await supabase
                    .from('fee_structures')
                    .select('id, amount')
                    .eq('preschool_id', regData.organization_id)
                    .eq('fee_type', 'tuition')
                    .eq('is_active', true)
                    .single();

                  if (feeStructure) {
                    const now = new Date();
                    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                    
                    const feesToInsert = [currentMonth, nextMonth].map(date => ({
                      student_id: newStudent.id,
                      fee_structure_id: feeStructure.id,
                      amount: feeStructure.amount,
                      final_amount: feeStructure.amount,
                      due_date: date.toISOString().split('T')[0],
                      status: 'pending',
                      amount_outstanding: feeStructure.amount,
                    }));

                    await supabase.from('student_fees').insert(feesToInsert);
                  }
                } catch (feeErr) {
                  console.warn('Failed to auto-assign fees:', feeErr);
                }

                // Update registration with student/parent IDs
                const { error: updateError } = await supabase
                  .from('registration_requests')
                  .update({
                    status: 'approved',
                    reviewed_by: user?.id,
                    reviewed_date: new Date().toISOString(),
                    edudash_student_id: newStudent.id,
                    edudash_parent_id: parentId,
                  })
                  .eq('id', registration.id);

                if (updateError) throw updateError;

                // Send notification if parent exists
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

                setSuccessModal({
                  visible: true,
                  title: 'Success',
                  message: `✅ Registration approved!\n\n👶 Student profile created (${studentIdCode})\n${parentId ? '👤 Linked to parent\n📱 Parent notified' : '⚠️ Parent account not found - they need to register'}`,
                  icon: 'checkmark-circle',
                });
              }

              fetchRegistrations();
            } catch (err: any) {
              console.error('Error approving registration:', err);
              Alert.alert('Error', err.message || 'Failed to approve registration');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };

  // Reject registration
  const handleReject = (registration: Registration) => {
    const isInApp = registration.source === 'in-app';
    
    Alert.prompt(
      'Reject Registration',
      `Enter reason for rejecting ${registration.student_first_name} ${registration.student_last_name}'s registration:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (reason?: string) => {
            if (!reason?.trim()) {
              Alert.alert('Error', 'Please provide a rejection reason');
              return;
            }

            setProcessing(registration.id);
            try {
              const supabase = assertSupabase();
              
              if (isInApp) {
                // Update child_registration_requests table
                const { error } = await supabase
                  .from('child_registration_requests')
                  .update({
                    status: 'rejected',
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString(),
                    rejection_reason: reason,
                  })
                  .eq('id', registration.id);

                if (error) throw error;

                // Send notification to parent
                try {
                  await supabase.functions.invoke('notifications-dispatcher', {
                    body: {
                      event_type: 'child_registration_rejected',
                      user_ids: registration.parent_id ? [registration.parent_id] : [],
                      parent_id: registration.parent_id,
                      registration_id: registration.id,
                      preschool_id: registration.organization_id,
                      child_name: `${registration.student_first_name} ${registration.student_last_name}`,
                      rejection_reason: reason,
                    },
                  });
                } catch (notifErr) {
                  console.warn('Failed to send rejection notification:', notifErr);
                }
              } else {
                // Original EduSite flow
                const { error } = await supabase
                  .from('registration_requests')
                  .update({
                    status: 'rejected',
                    reviewed_by: user?.id,
                    reviewed_date: new Date().toISOString(),
                    rejection_reason: reason,
                  })
                  .eq('id', registration.id);

                if (error) throw error;
              }

              Alert.alert('Rejected', 'Registration has been rejected.');
              fetchRegistrations();
            } catch (err: any) {
              console.error('Error rejecting registration:', err);
              Alert.alert('Error', err.message || 'Failed to reject registration');
            } finally {
              setProcessing(null);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  // Verify payment
  const handleVerifyPayment = async (registration: Registration, verify: boolean) => {
    const isInApp = registration.source === 'in-app';
    
    Alert.alert(
      verify ? 'Verify Payment' : 'Remove Payment Verification',
      `${verify ? 'Verify' : 'Remove verification for'} payment for ${registration.student_first_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verify ? 'Verify' : 'Remove',
          onPress: async () => {
            setProcessing(registration.id);
            try {
              const supabase = assertSupabase();
              
              const updateData: any = {
                payment_verified: verify,
                payment_verified_by: verify ? user?.id : null,
                payment_verified_at: verify ? new Date().toISOString() : null,
              };
              
              if (verify) {
                updateData.registration_fee_paid = true;
              }

              // Update the correct table based on source
              const tableName = isInApp ? 'child_registration_requests' : 'registration_requests';
              
              const { error } = await supabase
                .from(tableName)
                .update(updateData)
                .eq('id', registration.id);

              if (error) throw error;

              // ALSO update the students table so parent dashboard reflects correct payment status
              // Parent dashboard reads from students table, not registration_requests
              const studentUpdateData: any = {
                payment_verified: verify,
                payment_date: verify ? new Date().toISOString() : null,
              };
              if (verify) {
                studentUpdateData.registration_fee_paid = true;
              }
              
              // Update student by matching preschool + name (organization_id maps to preschool_id)
              console.log('[VerifyPayment] Updating students table for:', {
                preschool_id: registration.organization_id,
                first_name: registration.student_first_name,
                last_name: registration.student_last_name,
              });
              
              const { data: studentData, error: studentError } = await supabase
                .from('students')
                .update(studentUpdateData)
                .eq('preschool_id', registration.organization_id)
                .ilike('first_name', registration.student_first_name)
                .ilike('last_name', registration.student_last_name)
                .select();

              if (studentError) {
                console.error('[VerifyPayment] Error updating students table:', studentError);
              } else if (!studentData || studentData.length === 0) {
                console.warn('[VerifyPayment] No matching student found in students table');
                Alert.alert(
                  'Partial Success', 
                  `Payment ${verify ? 'verified' : 'verification removed'} in registration records.\n\nNote: No matching student record found. The parent's dashboard may not reflect this change until the student is synced.`
                );
                fetchRegistrations();
                return;
              } else {
                console.log('[VerifyPayment] Successfully updated', studentData.length, 'student(s)');
              }

              Alert.alert('Success', `Payment ${verify ? 'verified' : 'verification removed'}`);
              fetchRegistrations();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to update payment status');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };

  // Send payment reminder email
  const sendPaymentReminder = async (registration: Registration) => {
    Alert.alert(
      'Send Payment Reminder',
      `Send a payment reminder email to ${registration.guardian_name} (${registration.guardian_email})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Reminder',
          onPress: async () => {
            setSendingReminder(registration.id);
            try {
              const supabase = assertSupabase();
              
              // Get school name for the email
              const { data: orgData } = await supabase
                .from('organizations')
                .select('name')
                .eq('id', registration.organization_id)
                .single();
              
              const schoolName = orgData?.name || 'Our School';
              const feeAmount = registration.registration_fee_amount || 200;
              const discountAmount = registration.discount_amount || 0;
              const finalAmount = feeAmount - discountAmount;
              const paymentReference = registration.payment_reference || `REG-${registration.id.slice(0, 8).toUpperCase()}`;

              // Fetch banking details for the school/preschool
              const { data: primaryBank } = await supabase
                .from('organization_bank_accounts')
                .select('bank_name, account_name, account_number, account_number_masked, branch_code, swift_code')
                .eq('organization_id', registration.organization_id)
                .eq('is_primary', true)
                .maybeSingle();

              let bankDetails = primaryBank;
              if (!bankDetails) {
                const { data: anyBank } = await supabase
                  .from('organization_bank_accounts')
                  .select('bank_name, account_name, account_number, account_number_masked, branch_code, swift_code')
                  .eq('organization_id', registration.organization_id)
                  .eq('is_active', true)
                  .limit(1);
                bankDetails = anyBank?.[0];
              }

              if (!bankDetails) {
                const { data: paymentMethod } = await supabase
                  .from('organization_payment_methods')
                  .select('bank_name, account_name, account_number, branch_code')
                  .eq('organization_id', registration.organization_id)
                  .eq('method_name', 'bank_transfer')
                  .maybeSingle();
                bankDetails = paymentMethod as any;
              }

              const accountNumber = bankDetails?.account_number || bankDetails?.account_number_masked || 'Contact school';
              const branchCode = bankDetails?.branch_code || '';
              const swiftCode = (bankDetails as any)?.swift_code || '';
              const bankName = bankDetails?.bank_name || 'Contact school';
              const accountName = bankDetails?.account_name || schoolName;

              const appBaseUrl = process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://app.edudashpro.org.za';
              const popUploadUrl = `${appBaseUrl}/screens/parent-pop-upload?ref=${encodeURIComponent(paymentReference)}&amount=${encodeURIComponent(finalAmount.toFixed(2))}`;
              
              // Create email body
              const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
      <p style="margin: 0 0 20px 0; font-size: 15px; color: #555; line-height: 1.6;">
        This is a friendly reminder that we have not yet received proof of payment for <strong>${registration.student_first_name} ${registration.student_last_name}'s</strong> registration at ${schoolName}.
      </p>

      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Payment Details</h3>
        <table style="width: 100%; font-size: 14px; color: #555;">
          <tr>
            <td style="padding: 8px 0;">Student Name:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${registration.student_first_name} ${registration.student_last_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">Registration Fee:</td>
            <td style="padding: 8px 0; text-align: right;">R${feeAmount.toFixed(2)}</td>
          </tr>
          ${discountAmount > 0 ? `
          <tr>
            <td style="padding: 8px 0;">Discount:</td>
            <td style="padding: 8px 0; text-align: right; color: #10B981;">-R${discountAmount.toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr style="border-top: 2px solid #ddd;">
            <td style="padding: 12px 0; font-weight: 700; color: #333;">Amount Due:</td>
            <td style="padding: 12px 0; text-align: right; font-weight: 700; color: #333; font-size: 18px;">R${finalAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">Payment Reference:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600;">${paymentReference}</td>
          </tr>
        </table>
      </div>

      <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #333;">School Banking Details</h3>
        <table style="width: 100%; font-size: 14px; color: #555;">
          <tr>
            <td style="padding: 6px 0;">Bank:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">${bankName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0;">Account Name:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">${accountName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0;">Account Number:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">${accountNumber}</td>
          </tr>
          ${branchCode ? `
          <tr>
            <td style="padding: 6px 0;">Branch Code:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">${branchCode}</td>
          </tr>
          ` : ''}
          ${swiftCode ? `
          <tr>
            <td style="padding: 6px 0;">SWIFT Code:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600;">${swiftCode}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <p style="margin: 20px 0; font-size: 15px; color: #555; line-height: 1.6;">
        Please upload your proof of payment via the EduDash Pro app or respond to this email with the payment receipt attached.
      </p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${popUploadUrl}" style="display: inline-block; padding: 12px 20px; background: #4F46E5; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Upload Proof of Payment
        </a>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #888;">
          If the button doesn’t open, use your app and select Upload POP, then enter the reference above.
        </p>
      </div>

      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; color: #856404;">
          <strong>⚠️ Important:</strong> Registration is only complete once payment has been received and verified.
        </p>
      </div>

      <p style="margin: 20px 0 0 0; font-size: 15px; color: #555;">
        If you have already made the payment, please disregard this message. For any questions, please contact us.
      </p>

      <p style="margin: 30px 0 0 0; font-size: 15px; color: #555;">
        Warm regards,<br>
        <strong>${schoolName}</strong>
      </p>
    </div>
    
    <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
      <p style="margin: 0; font-size: 12px; color: #888;">
        This email was sent via EduDash Pro
      </p>
    </div>
  </div>
</body>
</html>
              `.trim();

              // Send email via Edge Function
              const { data, error } = await supabase.functions.invoke('send-email', {
                body: {
                  to: registration.guardian_email,
                  subject: `Payment Reminder: ${registration.student_first_name}'s Registration at ${schoolName}`,
                  body: emailBody,
                  is_html: true,
                  confirmed: true,
                },
              });

              if (error) {
                throw new Error(error.message || 'Failed to send email');
              }

              if (!data?.success) {
                throw new Error(data?.error || 'Email sending failed');
              }

              // Log the reminder in the database
              try {
                await supabase
                  .from('registration_requests')
                  .update({
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', registration.id);
              } catch {
                // Non-fatal - logging failed but email was sent
              }

              Alert.alert(
                'Reminder Sent ✓',
                `Payment reminder email has been sent to ${registration.guardian_email}`
              );
            } catch (err: any) {
              console.error('Error sending payment reminder:', err);
              Alert.alert('Error', err.message || 'Failed to send payment reminder');
            } finally {
              setSendingReminder(null);
            }
          },
        },
      ]
    );
  };

  // Stats
  const pendingCount = registrations.filter(r => r.status === 'pending').length;
  const approvedCount = registrations.filter(r => r.status === 'approved').length;
  const rejectedCount = registrations.filter(r => r.status === 'rejected').length;

  return {
    // Data
    registrations,
    filteredRegistrations,
    // State
    loading,
    refreshing,
    syncing,
    processing,
    error,
    sendingReminder,
    // Filters
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    // Modal
    successModal,
    setSuccessModal,
    // Actions
    fetchRegistrations,
    onRefresh,
    handleSyncWithEduSite,
    handleApprove,
    handleReject,
    handleVerifyPayment,
    sendPaymentReminder,
    // Helpers
    canApprove,
    // Feature flags
    usesEdusiteSync,
    // Stats
    pendingCount,
    approvedCount,
    rejectedCount,
  };
}
