/**
 * Manage Join Requests Screen
 *
 * Admin/Principal screen for reviewing and processing join requests
 * to their organization or preschool.
 *
 * @module app/screens/admin/manage-join-requests
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '@/lib/supabase';
import { InviteService, JoinRequest, JoinRequestStatus, JoinRequestType } from '@/services/InviteService';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

type TabType = 'pending' | 'approved' | 'rejected' | 'all';

interface JoinRequestWithProfile extends JoinRequest {
  requester_profile?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}

const REQUEST_TYPE_LABELS: Record<JoinRequestType, string> = {
  teacher_invite: 'Teacher Invite',
  parent_join: 'Parent Join',
  member_join: 'Member Request',
  guardian_claim: 'Guardian Claim',
  staff_invite: 'Staff Invite',
  learner_enroll: 'Learner Enrollment',
};

const STATUS_COLORS: Record<JoinRequestStatus, string> = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  expired: '#6b7280',
  cancelled: '#6b7280',
  revoked: '#ef4444',
};

export default function ManageJoinRequestsScreen() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<JoinRequestWithProfile | null>(null);

  const organizationId = profile?.organization_id || profile?.preschool_id;

  // Fetch join requests
  const {
    data: requests,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['joinRequests', organizationId, activeTab, searchQuery],
    queryFn: async () => {
      if (!organizationId) return [];

      const supabase = assertSupabase();

      let query = supabase
        .from('join_requests')
        .select(`
          *,
          requester_profile:profiles!join_requests_requester_id_fkey(
            first_name,
            last_name,
            avatar_url
          )
        `)
        .or(`organization_id.eq.${organizationId},preschool_id.eq.${organizationId}`);

      // Filter by status
      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }

      // Search filter
      if (searchQuery.trim()) {
        query = query.or(
          `requester_email.ilike.%${searchQuery}%,requester_phone.ilike.%${searchQuery}%,message.ilike.%${searchQuery}%`
        );
      }

      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;
      return (data || []) as JoinRequestWithProfile[];
    },
    enabled: !!organizationId,
  });

  // Approve request mutation
  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const result = await InviteService.approveRequest(requestId, reviewNotes || undefined);
      if (!result.success) {
        throw new Error(result.error || 'Failed to approve request');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['joinRequests'] });
      setSelectedRequest(null);
      setReviewNotes('');
      Alert.alert('Approved', 'The join request has been approved.');
    },
    onError: (err: Error) => {
      Alert.alert('Failed', err.message);
    },
  });

  // Reject request mutation
  const rejectMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const result = await InviteService.rejectRequest(requestId, reviewNotes || 'Request denied');
      if (!result.success) {
        throw new Error(result.error || 'Failed to reject request');
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['joinRequests'] });
      setSelectedRequest(null);
      setReviewNotes('');
      Alert.alert('Rejected', 'The join request has been rejected.');
    },
    onError: (err: Error) => {
      Alert.alert('Failed', err.message);
    },
  });

  const handleApprove = useCallback(
    (request: JoinRequestWithProfile) => {
      Alert.alert('Approve Request', 'Are you sure you want to approve this request?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: () => approveMutation.mutate(request.id),
        },
      ]);
    },
    [approveMutation]
  );

  const handleReject = useCallback(
    (request: JoinRequestWithProfile) => {
      setSelectedRequest(request);
    },
    []
  );

  const submitRejection = useCallback(() => {
    if (!selectedRequest) return;
    if (!reviewNotes.trim()) {
      Alert.alert('Required', 'Please provide a reason for rejection.');
      return;
    }
    rejectMutation.mutate(selectedRequest.id);
  }, [selectedRequest, reviewNotes, rejectMutation]);

  const getRequesterName = (request: JoinRequestWithProfile): string => {
    const profile = request.requester_profile;
    if (profile?.first_name || profile?.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    return request.requester_email || request.requester_phone || 'Unknown';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderTab = (tab: TabType, label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tab && styles.tabActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderRequestCard = useCallback(
    ({ item }: { item: JoinRequestWithProfile }) => {
      const isPending = item.status === 'pending';

      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.typeContainer}>
              <Text style={styles.requestType}>
                {REQUEST_TYPE_LABELS[item.request_type] || item.request_type}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: STATUS_COLORS[item.status] + '20' },
                ]}
              >
                <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
            </View>
            <Text style={styles.date}>{formatDate(item.created_at)}</Text>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.requesterName}>{getRequesterName(item)}</Text>
            {item.requester_email && (
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={14} color={theme?.textSecondary} />
                <Text style={styles.infoText}>{item.requester_email}</Text>
              </View>
            )}
            {item.requester_phone && (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={14} color={theme?.textSecondary} />
                <Text style={styles.infoText}>{item.requester_phone}</Text>
              </View>
            )}
            {item.message && (
              <View style={styles.messageContainer}>
                <Text style={styles.messageLabel}>Message:</Text>
                <Text style={styles.messageText} numberOfLines={3}>
                  {item.message}
                </Text>
              </View>
            )}
            {item.relationship && (
              <Text style={styles.relationshipText}>Relationship: {item.relationship}</Text>
            )}
          </View>

          {isPending && (
            <View style={styles.cardFooter}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => handleReject(item)}
              >
                <Ionicons name="close-circle-outline" size={18} color={theme?.error || '#ef4444'} />
                <Text style={[styles.actionText, { color: theme?.error || '#ef4444' }]}>
                  Reject
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.approveButton}
                onPress={() => handleApprove(item)}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.approveText}>Approve</Text>
              </TouchableOpacity>
            </View>
          )}

          {item.review_notes && (
            <View style={styles.reviewNotesContainer}>
              <Text style={styles.reviewNotesLabel}>Review Notes:</Text>
              <Text style={styles.reviewNotesText}>{item.review_notes}</Text>
            </View>
          )}
        </View>
      );
    },
    [styles, theme, handleApprove, handleReject]
  );

  const renderEmpty = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={64} color={theme?.textSecondary || '#888'} />
        <Text style={styles.emptyTitle}>No requests found</Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === 'pending'
            ? 'No pending requests to review'
            : `No ${activeTab} requests`}
        </Text>
      </View>
    );
  };

  const pendingCount = requests?.filter((r) => r.status === 'pending').length || 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Join Requests',
          headerShown: true,
          headerStyle: { backgroundColor: theme?.card || '#1a1a2e' },
          headerTintColor: theme?.text || '#fff',
        }}
      />

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {renderTab('pending', `Pending (${pendingCount})`)}
        {renderTab('approved', 'Approved')}
        {renderTab('rejected', 'Rejected')}
        {renderTab('all', 'All')}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme?.textSecondary || '#888'} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by email, phone, or message..."
          placeholderTextColor={theme?.textSecondary || '#888'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={theme?.textSecondary || '#888'} />
          </TouchableOpacity>
        )}
      </View>

      {/* Error State */}
      {isError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {(error as Error)?.message || 'Failed to load requests'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Requests List */}
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequestCard}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={theme?.primary || '#00f5ff'}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Rejection Modal */}
      {selectedRequest && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Request</Text>
            <Text style={styles.modalSubtitle}>
              Please provide a reason for rejecting this request:
            </Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Reason for rejection..."
              placeholderTextColor={theme?.textSecondary || '#888'}
              value={reviewNotes}
              onChangeText={setReviewNotes}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setSelectedRequest(null);
                  setReviewNotes('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmRejectButton, rejectMutation.isPending && styles.buttonDisabled]}
                onPress={submitRejection}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmRejectText}>Reject Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function createStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme?.background || '#0d0d1a',
    },
    tabsContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 8,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: theme?.card || '#1a1a2e',
    },
    tabActive: {
      backgroundColor: theme?.primary || '#00f5ff',
    },
    tabText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme?.textSecondary || '#888',
    },
    tabTextActive: {
      color: '#000',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme?.card || '#1a1a2e',
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme?.border || '#2a2a4a',
    },
    searchInput: {
      flex: 1,
      marginLeft: 8,
      fontSize: 14,
      color: theme?.text || '#fff',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    card: {
      backgroundColor: theme?.card || '#1a1a2e',
      borderRadius: 16,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme?.border || '#2a2a4a',
      overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme?.border || '#2a2a4a',
    },
    typeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    requestType: {
      fontSize: 13,
      fontWeight: '600',
      color: theme?.primary || '#00f5ff',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    date: {
      fontSize: 12,
      color: theme?.textSecondary || '#888',
    },
    cardBody: {
      padding: 16,
    },
    requesterName: {
      fontSize: 16,
      fontWeight: '700',
      color: theme?.text || '#fff',
      marginBottom: 8,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    infoText: {
      fontSize: 13,
      color: theme?.textSecondary || '#888',
      marginLeft: 6,
    },
    messageContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: theme?.background || '#0d0d1a',
      borderRadius: 8,
    },
    messageLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme?.textSecondary || '#888',
      marginBottom: 4,
    },
    messageText: {
      fontSize: 14,
      color: theme?.text || '#fff',
      lineHeight: 20,
    },
    relationshipText: {
      fontSize: 13,
      color: theme?.textSecondary || '#888',
      marginTop: 8,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme?.border || '#2a2a4a',
    },
    rejectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 6,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '600',
    },
    approveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme?.success || '#10b981',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 6,
    },
    approveText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    reviewNotesContainer: {
      padding: 16,
      backgroundColor: theme?.background || '#0d0d1a',
    },
    reviewNotesLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme?.textSecondary || '#888',
      marginBottom: 4,
    },
    reviewNotesText: {
      fontSize: 13,
      color: theme?.text || '#fff',
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme?.text || '#fff',
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme?.textSecondary || '#888',
      marginTop: 8,
      textAlign: 'center',
    },
    errorContainer: {
      alignItems: 'center',
      padding: 20,
    },
    errorText: {
      fontSize: 14,
      color: theme?.error || '#ef4444',
      textAlign: 'center',
    },
    retryButton: {
      marginTop: 12,
      paddingHorizontal: 20,
      paddingVertical: 8,
      backgroundColor: theme?.primary || '#00f5ff',
      borderRadius: 8,
    },
    retryText: {
      color: '#000',
      fontWeight: '600',
    },
    // Modal styles
    modalOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modalContent: {
      backgroundColor: theme?.card || '#1a1a2e',
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme?.text || '#fff',
      marginBottom: 8,
    },
    modalSubtitle: {
      fontSize: 14,
      color: theme?.textSecondary || '#888',
      marginBottom: 16,
    },
    notesInput: {
      backgroundColor: theme?.background || '#0d0d1a',
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      color: theme?.text || '#fff',
      height: 100,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: theme?.border || '#2a2a4a',
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 20,
      gap: 12,
    },
    cancelButton: {
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    cancelButtonText: {
      color: theme?.textSecondary || '#888',
      fontSize: 14,
      fontWeight: '600',
    },
    confirmRejectButton: {
      backgroundColor: theme?.error || '#ef4444',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
    },
    confirmRejectText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
}
