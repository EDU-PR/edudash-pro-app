/**
 * useRegistrations Hook
 * 
 * Manages state and business logic for principal registration reviews.
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
  // Stats
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export function useRegistrations(): UseRegistrationsReturn {
  const { user, profile } = useAuth();
  const organizationId = profile?.preschool_id || profile?.organization_id;

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

  // Fetch registrations
  const fetchRegistrations = useCallback(async () => {
    if (!organizationId) {
      console.log('⏳ [Registrations] Waiting for organizationId...');
      return;
    }

    try {
      setError(null);
      const supabase = assertSupabase();
      
      console.log('📍 [Registrations] Fetching for organization:', organizationId);

      const { data, error: fetchError } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        // Handle table not existing
        if (fetchError.code === '42P01' || fetchError.message?.includes('does not exist')) {
          console.log('ℹ️ [Registrations] Table not found - data needs to sync from EduSitePro');
          setRegistrations([]);
          setFilteredRegistrations([]);
          return;
        }
        throw fetchError;
      }

      console.log('✅ [Registrations] Found:', data?.length || 0, 'registrations');
      setRegistrations(data || []);
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

  // Check if registration can be approved (needs POP)
  const canApprove = (item: Registration): boolean => {
    // Must have proof of payment uploaded to approve
    return !!item.proof_of_payment_url;
  };

  // Approve registration
  const handleApprove = (registration: Registration) => {
    Alert.alert(
      'Approve Registration',
      `Approve registration for ${registration.student_first_name} ${registration.student_last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessing(registration.id);
            try {
              const supabase = assertSupabase();
              
              const { error: updateError } = await supabase
                .from('registration_requests')
                .update({
                  status: 'approved',
                  reviewed_by: user?.email,
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
              
              const { error } = await supabase
                .from('registration_requests')
                .update({
                  status: 'rejected',
                  reviewed_by: user?.email,
                  reviewed_date: new Date().toISOString(),
                  rejection_reason: reason,
                })
                .eq('id', registration.id);

              if (error) throw error;

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
    // Stats
    pendingCount,
    approvedCount,
    rejectedCount,
  };
}
