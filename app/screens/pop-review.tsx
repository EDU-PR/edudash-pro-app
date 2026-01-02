/**
 * POP Review Screen
 * 
 * Allows principals/admins to view, approve, or reject Proof of Payment submissions.
 * Shows pending POP uploads from parents with ability to view documents and take action.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { useUpdatePOPStatus } from '@/hooks/usePOPUploads';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { getPOPFileUrl, POPUploadType } from '@/lib/popUpload';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
interface POPUpload {
  id: string;
  student_id: string;
  uploaded_by: string;
  preschool_id: string;
  upload_type: string;
  title: string;
  description?: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  payment_amount?: number;
  payment_method?: string;
  payment_date?: string;
  payment_reference?: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  student?: {
    first_name: string;
    last_name: string;
    student_code?: string;
  };
  uploader?: {
    first_name: string;
    last_name: string;
    email?: string;
  };
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function POPReviewScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const updatePOPStatus = useUpdatePOPStatus();
  
  // State
  const [uploads, setUploads] = useState<POPUpload[]>([]);
  const [filteredUploads, setFilteredUploads] = useState<POPUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [selectedUpload, setSelectedUpload] = useState<POPUpload | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });

  const organizationId = profile?.preschool_id || profile?.organization_id;

  // Fetch POP uploads
  const fetchUploads = useCallback(async () => {
    if (!organizationId) {
      setError('Organization not found');
      setLoading(false);
      return;
    }

    try {
      const supabase = assertSupabase();
      
      // Fetch POP uploads with student data (avoid FK join for profiles)
      const { data, error: fetchError } = await supabase
        .from('pop_uploads')
        .select(`
          *,
          student:students (
            first_name,
            last_name,
            student_code
          )
        `)
        .eq('preschool_id', organizationId)
        .eq('upload_type', 'proof_of_payment')
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching POP uploads:', fetchError);
        setError(fetchError.message);
      } else {
        // Fetch uploader profiles separately to avoid FK constraint issues
        const uploadsWithProfiles = await Promise.all((data || []).map(async (upload) => {
          if (upload.uploaded_by) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('id', upload.uploaded_by)
              .single();
            return { ...upload, uploader: profileData };
          }
          return upload;
        }));
        setUploads(uploadsWithProfiles);
        setError(null);
      }
    } catch (err: any) {
      console.error('Failed to fetch POP uploads:', err);
      setError(err.message || 'Failed to load payment uploads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  // Filter uploads
  useEffect(() => {
    let filtered = uploads;
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(u => u.status === statusFilter);
    }
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(u => 
        u.student?.first_name?.toLowerCase().includes(search) ||
        u.student?.last_name?.toLowerCase().includes(search) ||
        u.uploader?.first_name?.toLowerCase().includes(search) ||
        u.uploader?.last_name?.toLowerCase().includes(search) ||
        u.payment_reference?.toLowerCase().includes(search) ||
        u.title?.toLowerCase().includes(search)
      );
    }
    
    setFilteredUploads(filtered);
  }, [uploads, statusFilter, searchTerm]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUploads();
  };

  const handleApprove = async (upload: POPUpload) => {
    Alert.alert(
      'Approve Payment',
      `Are you sure you want to approve this payment proof from ${upload.uploader?.first_name || 'the parent'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setProcessing(upload.id);
            try {
              await updatePOPStatus.mutateAsync({
                uploadId: upload.id,
                status: 'approved',
                reviewNotes: 'Payment verified and approved',
              });
              
              setSuccessMessage({
                title: 'Payment Approved! ✅',
                message: `The payment from ${upload.uploader?.first_name || 'the parent'} has been approved. They will be notified.`,
              });
              setShowSuccessModal(true);
              
              // Refresh the list
              fetchUploads();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to approve payment');
            } finally {
              setProcessing(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = (upload: POPUpload) => {
    setSelectedUpload(upload);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedUpload) return;
    
    if (!rejectReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for rejection');
      return;
    }

    setProcessing(selectedUpload.id);
    setShowRejectModal(false);
    
    try {
      await updatePOPStatus.mutateAsync({
        uploadId: selectedUpload.id,
        status: 'rejected',
        reviewNotes: rejectReason,
      });
      
      setSuccessMessage({
        title: 'Payment Rejected',
        message: `The payment proof has been rejected. The parent will be notified to resubmit.`,
      });
      setShowSuccessModal(true);
      
      // Refresh the list
      fetchUploads();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reject payment');
    } finally {
      setProcessing(null);
      setSelectedUpload(null);
    }
  };

  const viewDocument = async (upload: POPUpload) => {
    try {
      const url = await getPOPFileUrl('proof_of_payment', upload.file_path);
      if (url) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Could not retrieve document URL');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to open document');
    }
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return 'N/A';
    return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (date?: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      case 'needs_revision': return '#F59E0B';
      default: return '#6366F1';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      case 'needs_revision': return 'alert-circle';
      default: return 'time';
    }
  };

  const renderUploadItem = ({ item }: { item: POPUpload }) => {
    const isProcessing = processing === item.id;
    const studentName = item.student 
      ? `${item.student.first_name} ${item.student.last_name}` 
      : 'Unknown Student';
    const uploaderName = item.uploader 
      ? `${item.uploader.first_name} ${item.uploader.last_name}` 
      : 'Unknown';

    return (
      <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
              <Ionicons name={getStatusIcon(item.status) as any} size={16} color={getStatusColor(item.status)} />
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
            <Text style={[styles.dateText, { color: theme.textSecondary }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => viewDocument(item)} style={styles.viewButton}>
            <Ionicons name="document-text" size={20} color={theme.primary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Ionicons name="person" size={16} color={theme.textSecondary} />
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Student:</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{studentName}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Ionicons name="person-circle" size={16} color={theme.textSecondary} />
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Submitted by:</Text>
            <Text style={[styles.infoValue, { color: theme.text }]}>{uploaderName}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Ionicons name="cash" size={16} color={theme.textSecondary} />
            <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Amount:</Text>
            <Text style={[styles.infoValue, { color: theme.success, fontWeight: '600' }]}>
              {formatAmount(item.payment_amount)}
            </Text>
          </View>
          
          {item.payment_reference && (
            <View style={styles.infoRow}>
              <Ionicons name="barcode" size={16} color={theme.textSecondary} />
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Reference:</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{item.payment_reference}</Text>
            </View>
          )}
        </View>

        {/* Actions for pending items */}
        {item.status === 'pending' && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton, { borderColor: theme.error }]}
              onPress={() => handleReject(item)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={theme.error} />
              ) : (
                <>
                  <Ionicons name="close" size={18} color={theme.error} />
                  <Text style={[styles.actionButtonText, { color: theme.error }]}>Reject</Text>
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton, { backgroundColor: theme.success }]}
              onPress={() => handleApprove(item)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={[styles.actionButtonText, { color: '#fff' }]}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Review notes for processed items */}
        {item.review_notes && item.status !== 'pending' && (
          <View style={[styles.reviewNotes, { backgroundColor: theme.surface }]}>
            <Text style={[styles.reviewNotesLabel, { color: theme.textSecondary }]}>Review Notes:</Text>
            <Text style={[styles.reviewNotesText, { color: theme.text }]}>{item.review_notes}</Text>
          </View>
        )}
      </View>
    );
  };

  const styles = createStyles(theme, insets);

  // Count pending
  const pendingCount = uploads.filter(u => u.status === 'pending').length;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Payment Reviews',
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 8 }}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          ),
        }}
      />
      
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header Stats */}
        <View style={[styles.statsBar, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.primary }]}>{pendingCount}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pending</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.success }]}>
              {uploads.filter(u => u.status === 'approved').length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Approved</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.error }]}>
              {uploads.filter(u => u.status === 'rejected').length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Rejected</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.cardBackground }]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by name, reference..."
            placeholderTextColor={theme.textSecondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm ? (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterTab,
                statusFilter === filter && { backgroundColor: theme.primary },
              ]}
              onPress={() => setStatusFilter(filter)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: statusFilter === filter ? '#fff' : theme.textSecondary },
                ]}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading payment uploads...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="warning-outline" size={48} color={theme.error} />
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.primary }]} onPress={fetchUploads}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredUploads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color={theme.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {statusFilter === 'pending' 
                ? 'No pending payments to review' 
                : 'No payment uploads found'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredUploads}
            renderItem={renderUploadItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
            }
          />
        )}
      </View>

      {/* Reject Modal */}
      <Modal visible={showRejectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Reject Payment</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Please provide a reason for rejection
            </Text>
            <TextInput
              style={[styles.reasonInput, { 
                backgroundColor: theme.surface, 
                color: theme.text, 
                borderColor: theme.border 
              }]}
              placeholder="Enter reason..."
              placeholderTextColor={theme.textSecondary}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, { borderColor: theme.border }]}
                onPress={() => setShowRejectModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalRejectButton, { backgroundColor: theme.error }]}
                onPress={confirmReject}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title={successMessage.title}
        message={successMessage.message}
        buttonText="Done"
        onClose={() => setShowSuccessModal(false)}
      />
    </>
  );
}

const createStyles = (theme: any, insets: { top: number; bottom: number }) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    statsBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingVertical: 16,
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: 12,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
    },
    statLabel: {
      fontSize: 12,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 32,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
    },
    filterTabs: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
    },
    filterTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: 'transparent',
    },
    filterTabText: {
      fontSize: 14,
      fontWeight: '500',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    errorText: {
      marginTop: 12,
      fontSize: 16,
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyText: {
      marginTop: 16,
      fontSize: 16,
      textAlign: 'center',
    },
    listContent: {
      padding: 16,
      paddingBottom: insets.bottom + 20,
    },
    card: {
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
      overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 12,
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    dateText: {
      fontSize: 12,
    },
    viewButton: {
      padding: 8,
    },
    cardContent: {
      paddingHorizontal: 12,
      paddingBottom: 12,
      gap: 8,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    infoLabel: {
      fontSize: 13,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '500',
      flex: 1,
    },
    cardActions: {
      flexDirection: 'row',
      padding: 12,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,0,0,0.1)',
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 8,
      gap: 6,
    },
    rejectButton: {
      borderWidth: 1,
      backgroundColor: 'transparent',
    },
    approveButton: {
      borderWidth: 0,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    reviewNotes: {
      margin: 12,
      marginTop: 0,
      padding: 10,
      borderRadius: 8,
    },
    reviewNotesLabel: {
      fontSize: 12,
      marginBottom: 4,
    },
    reviewNotesText: {
      fontSize: 13,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      borderRadius: 16,
      padding: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
    },
    modalSubtitle: {
      fontSize: 14,
      marginBottom: 16,
    },
    reasonInput: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      fontSize: 14,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    modalCancelButton: {
      borderWidth: 1,
    },
    modalRejectButton: {},
    modalButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
  });
