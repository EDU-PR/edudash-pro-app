/**
 * Principal Registrations Screen
 * 
 * Allows principals to view, search, approve/reject child registration requests.
 * Data comes from registration_requests table (synced from EduSitePro).
 * Feature-flagged: Only active when registrations_enabled is true.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { assertSupabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types
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

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function PrincipalRegistrationsScreen() {
  const { theme, isDark } = useTheme();
  const colors = theme; // Alias for compatibility
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Feature flag check
  const flags = getFeatureFlagsSync();
  const isEnabled = flags.registrations_enabled !== false; // Default true for principals
  
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

  const organizationId = profile?.preschool_id || profile?.organization_id;

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
  const handleApprove = async (registration: Registration) => {
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
                Alert.alert(
                  'Partial Success',
                  'Registration approved, but account creation may have failed. Please contact admin.'
                );
              } else {
                Alert.alert(
                  'Success',
                  '✅ Registration approved!\n\n✉️ Welcome email sent to parent\n👤 Parent account created\n👶 Student profile created'
                );
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

  // View registration detail
  const viewDetail = (registration: Registration) => {
    router.push({
      pathname: '/screens/registration-detail',
      params: { id: registration.id },
    } as any);
  };

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
      return `${months}m`;
    }
    return `${years}y ${months}m`;
  };

  // Format date
  const formatDate = (date: string): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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

  // Get status icon
  const getStatusIcon = (status: Registration['status']): string => {
    switch (status) {
      case 'approved': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      case 'pending': return 'time';
      default: return 'help-circle';
    }
  };

  // Stats
  const pendingCount = registrations.filter(r => r.status === 'pending').length;
  const approvedCount = registrations.filter(r => r.status === 'approved').length;
  const rejectedCount = registrations.filter(r => r.status === 'rejected').length;

  // Render registration card
  const renderRegistration = ({ item }: { item: Registration }) => {
    const isProcessing = processing === item.id;
    
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface }]}
        onPress={() => viewDetail(item)}
        disabled={isProcessing}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.studentInfo}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {item.student_first_name?.[0]}{item.student_last_name?.[0]}
              </Text>
            </View>
            <View style={styles.nameContainer}>
              <Text style={[styles.studentName, { color: colors.text }]}>
                {item.student_first_name} {item.student_last_name}
              </Text>
              <Text style={[styles.age, { color: colors.textSecondary }]}>
                Age: {calculateAge(item.student_dob)} • {item.student_gender || 'N/A'}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Ionicons name={getStatusIcon(item.status) as any} size={14} color={getStatusColor(item.status)} />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Guardian Info */}
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{item.guardian_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{item.guardian_phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]} numberOfLines={1}>
              {item.guardian_email}
            </Text>
          </View>
        </View>

        {/* Payment & Documents Status */}
        <View style={styles.statusRow}>
          <View style={[
            styles.statusChip,
            { backgroundColor: item.registration_fee_paid ? '#10B98120' : '#EF444420' }
          ]}>
            <Ionicons 
              name={item.registration_fee_paid ? 'checkmark-circle' : 'close-circle'} 
              size={14} 
              color={item.registration_fee_paid ? '#10B981' : '#EF4444'} 
            />
            <Text style={{ 
              color: item.registration_fee_paid ? '#10B981' : '#EF4444',
              fontSize: 12,
              marginLeft: 4,
            }}>
              {item.registration_fee_paid 
                ? (item.payment_verified ? 'Payment Verified' : 'Paid (Unverified)')
                : 'Unpaid'}
            </Text>
          </View>
          <View style={[
            styles.statusChip,
            { backgroundColor: item.documents_uploaded ? '#10B98120' : '#F59E0B20' }
          ]}>
            <Ionicons 
              name={item.documents_uploaded ? 'document-text' : 'document-outline'} 
              size={14} 
              color={item.documents_uploaded ? '#10B981' : '#F59E0B'} 
            />
            <Text style={{ 
              color: item.documents_uploaded ? '#10B981' : '#F59E0B',
              fontSize: 12,
              marginLeft: 4,
            }}>
              {item.documents_uploaded ? 'Docs Uploaded' : 'Docs Pending'}
            </Text>
          </View>
        </View>

        {/* Fee Info */}
        {item.registration_fee_amount && (
          <View style={[styles.feeRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>Registration Fee:</Text>
            <Text style={[styles.feeAmount, { color: colors.text }]}>
              R{item.registration_fee_amount.toLocaleString()}
              {item.discount_amount ? ` (-R${item.discount_amount})` : ''}
            </Text>
          </View>
        )}

        {/* Applied Date */}
        <Text style={[styles.dateText, { color: colors.textSecondary }]}>
          Applied: {formatDate(item.created_at)}
        </Text>

        {/* POP Warning */}
        {item.status === 'pending' && !canApprove(item) && (
          <View style={[styles.popWarning, { backgroundColor: '#F59E0B20' }]}>
            <Ionicons name="warning" size={16} color="#F59E0B" />
            <Text style={styles.popWarningText}>
              Proof of Payment required before approval
            </Text>
          </View>
        )}

        {/* Action Buttons (for pending) */}
        {item.status === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.actionButton, 
                styles.approveButton,
                !canApprove(item) && styles.disabledButton
              ]}
              onPress={() => handleApprove(item)}
              disabled={isProcessing || !canApprove(item)}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={18} color={canApprove(item) ? '#fff' : '#999'} />
                  <Text style={[styles.actionButtonText, !canApprove(item) && { color: '#999' }]}>
                    Approve
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReject(item)}
              disabled={isProcessing}
            >
              <Ionicons name="close" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
            {!item.payment_verified && item.registration_fee_paid && (
              <TouchableOpacity
                style={[styles.actionButton, styles.verifyButton]}
                onPress={() => handleVerifyPayment(item, true)}
                disabled={isProcessing}
              >
                <Ionicons name="shield-checkmark" size={18} color="#fff" />
                <Text style={styles.actionButtonText}>Verify</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Feature flag disabled state
  if (!isEnabled) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Registrations' }} />
        <View style={styles.disabledContainer}>
          <Ionicons name="lock-closed" size={64} color={colors.textSecondary} />
          <Text style={[styles.disabledTitle, { color: colors.text }]}>
            Registrations Not Available
          </Text>
          <Text style={[styles.disabledText, { color: colors.textSecondary }]}>
            This feature is currently disabled. Please contact support.
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{ 
          title: 'Registrations',
          headerShown: false, // We handle our own header with safe area
        }} 
      />

      {/* Header with Stats */}
      <LinearGradient
        colors={isDark ? ['#1E3A5F', '#0F172A'] : ['#3B82F6', '#1D4ED8']}
        style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
      >
        {/* Header Row with Back + Title + Sync */}
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Registration Requests</Text>
            <Text style={styles.headerSubtitle}>Review and approve parent applications</Text>
          </View>
          <TouchableOpacity 
            style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
            onPress={handleSyncWithEduSite}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="sync" size={18} color="#fff" />
                <Text style={styles.syncButtonText}>Sync</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{approvedCount}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{rejectedCount}</Text>
            <Text style={styles.statLabel}>Rejected</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Search & Filter */}
      <View style={[styles.filterContainer, { backgroundColor: colors.surface }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.background }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name, email, phone..."
            placeholderTextColor={colors.textSecondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Status Filter Tabs */}
        <View style={styles.filterTabs}>
          {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterTab,
                statusFilter === status && { backgroundColor: colors.primary },
              ]}
              onPress={() => setStatusFilter(status)}
            >
              <Text style={[
                styles.filterTabText,
                { color: statusFilter === status ? '#fff' : colors.textSecondary },
              ]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {status === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading registrations...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#EF4444" />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={fetchRegistrations}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredRegistrations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons 
            name={statusFilter === 'pending' ? 'checkmark-done-circle' : 'document-text-outline'} 
            size={64} 
            color={colors.textSecondary} 
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {statusFilter === 'pending' 
              ? 'No Pending Registrations'
              : searchTerm 
                ? 'No Matching Registrations'
                : 'No Registrations Found'}
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {statusFilter === 'pending'
              ? 'All registrations have been processed'
              : 'Registration requests will appear here when parents apply'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredRegistrations}
          renderItem={renderRegistration}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  disabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  disabledTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  disabledText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerGradient: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerBackButton: {
    padding: 8,
    marginLeft: -8,
    marginTop: -4,
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  filterContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  nameContainer: {
    marginLeft: 12,
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '700',
  },
  age: {
    fontSize: 13,
    marginTop: 2,
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
  section: {
    gap: 6,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
  },
  feeLabel: {
    fontSize: 13,
  },
  feeAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    marginTop: 8,
  },
  popWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  popWarningText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
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
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  verifyButton: {
    backgroundColor: '#3B82F6',
  },
  disabledButton: {
    backgroundColor: '#6B728080',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
