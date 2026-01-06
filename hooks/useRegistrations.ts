/**
 * useRegistrations Hook
 * 
 * Manages state and business logic for principal registration reviews.
 * Supports both registration_requests (EduSitePro sync) and child_registration_requests (in-app).
 * Extracted from principal-registrations.tsx per WARP.md file size standards.
 */

import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';

// Types
export interface Registration {
  id: string;
  organization_id: string;
  organization_name?: string;
  edusite_id?: string;
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
  source?: 'edusite' | 'in-app';
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
          parent:profiles!parent_id(first_name, last_name, email, phone)
        `)
        .eq('preschool_id', organizationId)
        .order('created_at', { ascending: false });

      if (edusiteError && edusiteError.code !== '42P01') {
        console.warn('⚠️ [Registrations] EduSite fetch error:', edusiteError);
      }
      if (inAppError && inAppError.code !== '42P01') {
        console.warn('⚠️ [Registrations] In-app fetch error:', inAppError);
      }

      // Transform in-app registrations to match Registration interface
      const transformedInApp: Registration[] = (inAppData || []).map((item: any) => ({
        id: item.id,
        organization_id: item.preschool_id,
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
        // Payment - in-app doesn't require payment upfront
        registration_fee_paid: true,
        payment_verified: true,
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

      // Combine and sort by created_at
      const combined = [...transformedEdusite, ...transformedInApp].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      console.log('✅ [Registrations] Found:', combined.length, 'total registrations', 
        `(${transformedEdusite.length} EduSite, ${transformedInApp.length} in-app)`);
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

  // Check if registration can be approved (needs POP for EduSite, always true for in-app)
  const canApprove = (item: Registration): boolean => {
    // In-app registrations don't require proof of payment upfront
    if (item.source === 'in-app') return true;
    // EduSite registrations need proof of payment
    return !!item.proof_of_payment_url;
  };

  // Approve registration
  const handleApprove = (registration: Registration) => {
    const isInApp = registration.source === 'in-app';
    
    Alert.alert(
      'Approve Registration',
      `Approve registration for ${registration.student_first_name} ${registration.student_last_name}?${isInApp ? '\n\nThis will create a student profile.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
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

                // Create student record in students table
                const { data: newStudent, error: studentError } = await supabase
                  .from('students')
                  .insert({
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

                // Update parent's preschool_id if not set
                if (regData.parent_id) {
                  await supabase
                    .from('profiles')
                    .update({ preschool_id: regData.preschool_id })
                    .eq('id', regData.parent_id)
                    .is('preschool_id', null);
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
                      registration_id: registration.id,
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
                // Original EduSite flow
                const { error: updateError } = await supabase
                  .from('registration_requests')
                  .update({
                    status: 'approved',
                    reviewed_by: user?.id,
                    reviewed_date: new Date().toISOString(),
                  })
                  .eq('id', registration.id);

                if (updateError) throw updateError;

                // Call sync function to create accounts and send email
                const { error: syncError } = await supabase.functions.invoke('sync-registration-to-edudash', {
                  body: { registration_id: registration.id },
                });

                if (syncError) {
                  setSuccessModal({
                    visible: true,
                    title: 'Partial Success',
                    message: 'Registration approved, but account creation may have failed. Please contact admin.',
                    icon: 'warning',
                  });
                } else {
                  setSuccessModal({
                    visible: true,
                    title: 'Success',
                    message: '✅ Registration approved!\n\n✉️ Welcome email sent\n👤 Parent account created\n👶 Student profile created',
                    icon: 'checkmark-circle',
                  });
                }
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
                      user_ids: [registration.organization_id], // parent_id stored for in-app
                      registration_id: registration.id,
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
              };
              
              if (verify) {
                updateData.registration_fee_paid = true;
              }

              const { error } = await supabase
                .from('registration_requests')
                .update(updateData)
                .eq('id', registration.id);

              if (error) throw error;

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
