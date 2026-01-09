/**
 * Aftercare Admin Screen (Native App)
 * 
 * Mobile screen for managing aftercare registrations.
 * Part of the K-12 School Admin flow for EduDash Pro Community School.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Linking,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

interface AfterCareRegistration {
  id: string;
  preschool_id: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  parent_phone: string;
  parent_id_number?: string;
  child_first_name: string;
  child_last_name: string;
  child_grade: string;
  child_date_of_birth?: string;
  child_allergies?: string;
  child_medical_conditions?: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  registration_fee: number;
  registration_fee_original: number;
  promotion_code?: string;
  payment_reference?: string;
  status: 'pending_payment' | 'paid' | 'enrolled' | 'cancelled' | 'waitlisted';
  payment_date?: string;
  proof_of_payment_url?: string;
  notes?: string;
  created_at: string;
}

const statusConfig = {
  pending_payment: { label: 'Pending Payment', color: '#F59E0B', icon: 'time' },
  paid: { label: 'Payment Verified', color: '#10B981', icon: 'checkmark-circle' },
  enrolled: { label: 'Enrolled', color: '#3B82F6', icon: 'school' },
  cancelled: { label: 'Cancelled', color: '#EF4444', icon: 'close-circle' },
  waitlisted: { label: 'Waitlisted', color: '#8B5CF6', icon: 'hourglass' },
};

// Workflow explanation:
// 1. pending_payment - Registration submitted, awaiting payment proof
// 2. paid - Payment verified by principal (accounts NOT yet created)
// 3. enrolled - Student enrolled, parent & student accounts CREATED
// 4. cancelled - Registration cancelled
// 5. waitlisted - On waiting list (capacity reached)

export default function AfterCareAdminScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  
  const [registrations, setRegistrations] = useState<AfterCareRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<AfterCareRegistration | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const organizationId = profile?.organization_id || profile?.preschool_id;
  
  const fetchRegistrations = useCallback(async () => {
    if (!organizationId) return;
    
    try {
      const supabase = assertSupabase();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f48af9d6-9953-4cb6-83b3-cbebe5169087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aftercare-admin.tsx:82',message:'fetchRegistrations entry',data:{organizationId,userId:profile?.id,profileRole:profile?.role,profileOrgId:profile?.organization_id,profilePreschoolId:profile?.preschool_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      // Simplified: Each principal sees only their own school's registrations
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f48af9d6-9953-4cb6-83b3-cbebe5169087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aftercare-admin.tsx:89',message:'Before aftercare query',data:{organizationId,targetPreschoolId:organizationId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      const { data, error } = await supabase
        .from('aftercare_registrations')
        .select('*')
        .eq('preschool_id', organizationId)
        .order('created_at', { ascending: false });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f48af9d6-9953-4cb6-83b3-cbebe5169087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aftercare-admin.tsx:95',message:'After aftercare query',data:{hasError:!!error,errorCode:error?.code,errorMessage:error?.message,errorDetails:error?.details,dataCount:data?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      if (error && error.code !== '42P01') {
        console.error('[AfterCareAdmin] Error:', error);
        Alert.alert('Error', 'Failed to load registrations');
        return;
      }
      
      setRegistrations(data || []);
    } catch (err) {
      console.error('[AfterCareAdmin] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId]);
  
  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);
  
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRegistrations();
  }, [fetchRegistrations]);
  
  const updateStatus = async (id: string, newStatus: AfterCareRegistration['status']) => {
    setProcessing(id);
    try {
      const supabase = assertSupabase();
      const { error } = await supabase
        .from('aftercare_registrations')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      
      if (error) throw error;
      
      // Only trigger enrollment processing when status is 'enrolled'
      // This is when parent and student accounts are created
      if (newStatus === 'enrolled') {
        try {
          const { data: enrollmentResult, error: enrollmentError } = await supabase.functions.invoke(
            'process-aftercare-enrollment',
            {
              body: { registration_id: id },
            }
          );

          if (enrollmentError) {
            console.error('[AfterCareAdmin] Enrollment processing error:', enrollmentError);
            Alert.alert(
              'Partial Success',
              `Student enrolled but account creation may have failed.\n\nError: ${enrollmentError.message || 'Unknown error'}`
            );
          } else if (enrollmentResult?.success) {
            const messages = [];
            if (enrollmentResult.data?.parent_account_created) {
              messages.push('✓ Parent account created');
            }
            if (enrollmentResult.data?.student_created) {
              messages.push('✓ Student record created');
            }
            Alert.alert(
              '🎉 Student Enrolled!',
              messages.length > 0 
                ? `${messages.join('\n')}\n\nParent will receive login details via email.`
                : 'Student has been enrolled successfully.'
            );
          } else {
            Alert.alert('Success', 'Student enrolled successfully');
          }
        } catch (enrollmentErr) {
          console.error('[AfterCareAdmin] Enrollment processing exception:', enrollmentErr);
          Alert.alert('Success', 'Student enrolled (account creation pending)');
        }
      } else if (newStatus === 'paid') {
        Alert.alert(
          'Payment Verified ✓',
          'Payment has been verified. Click "Enroll Student" when ready to create their account.'
        );
      } else if (newStatus === 'cancelled') {
        Alert.alert('Registration Cancelled', 'This registration has been cancelled.');
      } else {
        Alert.alert('Status Updated', `Status changed to ${statusConfig[newStatus].label}`);
      }
      
      // Update local state
      setRegistrations(prev => 
        prev.map(r => r.id === id ? { ...r, status: newStatus } : r)
      );
      
      if (selectedRegistration?.id === id) {
        setSelectedRegistration(prev => prev ? { ...prev, status: newStatus } : null);
      }
      
      // Refresh to get latest data
      await fetchRegistrations();
    } catch (err) {
      console.error('[AfterCareAdmin] Update error:', err);
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setProcessing(null);
    }
  };
  
  const filteredRegistrations = statusFilter === 'all' 
    ? registrations 
    : registrations.filter(r => r.status === statusFilter);
  
  const stats = {
    total: registrations.length,
    pending: registrations.filter(r => r.status === 'pending_payment').length,
    paid: registrations.filter(r => r.status === 'paid').length,
    enrolled: registrations.filter(r => r.status === 'enrolled').length,
  };
  
  const renderRegistration = ({ item }: { item: AfterCareRegistration }) => {
    const config = statusConfig[item.status];
    
    return (
      <TouchableOpacity
        style={styles.registrationCard}
        onPress={() => setSelectedRegistration(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.child_first_name[0]}{item.child_last_name[0]}
            </Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.childName}>
              {item.child_first_name} {item.child_last_name}
            </Text>
            <Text style={styles.gradeText}>Grade {item.child_grade}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.color + '20' }]}>
            <Ionicons name={config.icon as any} size={14} color={config.color} />
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>
        
        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.detailText}>
              {item.parent_first_name} {item.parent_last_name}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="receipt-outline" size={14} color={theme.textSecondary} />
            <Text style={styles.detailText}>{item.payment_reference || 'No reference'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading registrations...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#6D28D9']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Aftercare Registrations</Text>
            <Text style={styles.headerSubtitle}>EduDash Pro Community School</Text>
          </View>
        </View>
        
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.paid}</Text>
            <Text style={styles.statLabel}>Paid</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.enrolled}</Text>
            <Text style={styles.statLabel}>Enrolled</Text>
          </View>
        </View>
      </LinearGradient>
      
      {/* Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {['all', 'pending_payment', 'paid', 'enrolled', 'cancelled'].map(filter => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterTab,
              statusFilter === filter && styles.filterTabActive
            ]}
            onPress={() => setStatusFilter(filter)}
          >
            <Text style={[
              styles.filterTabText,
              statusFilter === filter && styles.filterTabTextActive
            ]}>
              {filter === 'all' ? 'All' : statusConfig[filter as keyof typeof statusConfig]?.label || filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* List */}
      <FlatList
        data={filteredRegistrations}
        keyExtractor={item => item.id}
        renderItem={renderRegistration}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color={theme.textSecondary} />
            <Text style={styles.emptyText}>No registrations found</Text>
          </View>
        }
      />
      
      {/* Detail Modal */}
      <Modal
        visible={!!selectedRegistration}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedRegistration(null)}
      >
        {selectedRegistration && (
          <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registration Details</Text>
              <TouchableOpacity onPress={() => setSelectedRegistration(null)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {/* Child Info */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Child Information</Text>
                <Text style={styles.modalText}>
                  {selectedRegistration.child_first_name} {selectedRegistration.child_last_name}
                </Text>
                <Text style={styles.modalTextSecondary}>Grade {selectedRegistration.child_grade}</Text>
                {selectedRegistration.child_allergies && (
                  <Text style={styles.modalTextSecondary}>
                    Allergies: {selectedRegistration.child_allergies}
                  </Text>
                )}
              </View>
              
              {/* Parent Info */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Parent/Guardian</Text>
                <Text style={styles.modalText}>
                  {selectedRegistration.parent_first_name} {selectedRegistration.parent_last_name}
                </Text>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedRegistration.parent_phone}`)}>
                  <Text style={styles.modalLink}>{selectedRegistration.parent_phone}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL(`mailto:${selectedRegistration.parent_email}`)}>
                  <Text style={styles.modalLink}>{selectedRegistration.parent_email}</Text>
                </TouchableOpacity>
              </View>
              
              {/* Payment Info */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Payment</Text>
                <Text style={styles.modalText}>
                  R{selectedRegistration.registration_fee.toFixed(2)}
                  {selectedRegistration.registration_fee !== selectedRegistration.registration_fee_original && (
                    <Text style={styles.strikethrough}> R{selectedRegistration.registration_fee_original.toFixed(2)}</Text>
                  )}
                </Text>
                <Text style={styles.modalTextSecondary}>
                  Reference: {selectedRegistration.payment_reference || 'N/A'}
                </Text>
                
                {/* Proof of Payment */}
                {selectedRegistration.proof_of_payment_url ? (
                  <TouchableOpacity
                    style={styles.popButton}
                    onPress={() => Linking.openURL(selectedRegistration.proof_of_payment_url!)}
                  >
                    <Ionicons name="document-attach" size={20} color="#fff" />
                    <Text style={styles.popButtonText}>View Proof of Payment</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noPopContainer}>
                    <Ionicons name="warning-outline" size={20} color="#F59E0B" />
                    <Text style={styles.noPopText}>No proof of payment uploaded</Text>
                  </View>
                )}
              </View>
              
              {/* Workflow Actions */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Actions</Text>
                
                {/* Current Status Display */}
                <View style={[styles.currentStatusBanner, { backgroundColor: statusConfig[selectedRegistration.status].color + '20' }]}>
                  <Ionicons 
                    name={statusConfig[selectedRegistration.status].icon as any} 
                    size={20} 
                    color={statusConfig[selectedRegistration.status].color} 
                  />
                  <Text style={[styles.currentStatusText, { color: statusConfig[selectedRegistration.status].color }]}>
                    Current: {statusConfig[selectedRegistration.status].label}
                  </Text>
                </View>
                
                {/* Workflow-based action buttons */}
                <View style={styles.workflowActions}>
                  
                  {/* Step 1: For pending_payment - Verify Payment */}
                  {selectedRegistration.status === 'pending_payment' && (
                    <>
                      {selectedRegistration.proof_of_payment_url ? (
                        <TouchableOpacity
                          style={[styles.workflowButton, styles.verifyPaymentButton]}
                          onPress={() => {
                            Alert.alert(
                              'Verify Payment',
                              'Have you reviewed the proof of payment and confirmed the registration fee was received?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Verify Payment',
                                  onPress: () => updateStatus(selectedRegistration.id, 'paid'),
                                },
                              ]
                            );
                          }}
                          disabled={processing === selectedRegistration.id}
                        >
                          {processing === selectedRegistration.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-done" size={20} color="#fff" />
                              <Text style={styles.workflowButtonText}>Verify Payment</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.workflowButton, styles.markAsPaidButton]}
                          onPress={() => {
                            Alert.alert(
                              'Mark as Paid (No POP)',
                              'No proof of payment was uploaded. This will bypass POP verification.\n\nConfirm you have verified payment through other means (e.g., bank statement, cash receipt)?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Confirm Payment',
                                  onPress: () => updateStatus(selectedRegistration.id, 'paid'),
                                },
                              ]
                            );
                          }}
                          disabled={processing === selectedRegistration.id}
                        >
                          {processing === selectedRegistration.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="cash-outline" size={20} color="#fff" />
                              <Text style={styles.workflowButtonText}>Mark as Paid (No POP)</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                  
                  {/* Step 2: For paid - Enroll Student (creates accounts) */}
                  {selectedRegistration.status === 'paid' && (
                    <TouchableOpacity
                      style={[styles.workflowButton, styles.enrollButton]}
                      onPress={() => {
                        Alert.alert(
                          'Enroll Student',
                          `This will:\n\n• Create parent account for ${selectedRegistration.parent_first_name}\n• Create student record for ${selectedRegistration.child_first_name}\n• Send welcome email with login details\n\nProceed with enrollment?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Enroll Student',
                              onPress: () => updateStatus(selectedRegistration.id, 'enrolled'),
                            },
                          ]
                        );
                      }}
                      disabled={processing === selectedRegistration.id}
                    >
                      {processing === selectedRegistration.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="school" size={20} color="#fff" />
                          <Text style={styles.workflowButtonText}>Enroll Student</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  
                  {/* Enrolled status - Show success state */}
                  {selectedRegistration.status === 'enrolled' && (
                    <View style={styles.enrolledBanner}>
                      <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                      <View style={styles.enrolledTextContainer}>
                        <Text style={styles.enrolledTitle}>Student Enrolled</Text>
                        <Text style={styles.enrolledSubtitle}>
                          Parent and student accounts have been created
                        </Text>
                      </View>
                    </View>
                  )}
                  
                  {/* Cancel Registration - Available for pending/paid */}
                  {(selectedRegistration.status === 'pending_payment' || selectedRegistration.status === 'paid') && (
                    <TouchableOpacity
                      style={[styles.workflowButton, styles.cancelButton]}
                      onPress={() => {
                        Alert.alert(
                          'Cancel Registration',
                          'Are you sure you want to cancel this registration? This action can be reversed.',
                          [
                            { text: 'Keep', style: 'cancel' },
                            {
                              text: 'Cancel Registration',
                              style: 'destructive',
                              onPress: () => updateStatus(selectedRegistration.id, 'cancelled'),
                            },
                          ]
                        );
                      }}
                      disabled={processing === selectedRegistration.id}
                    >
                      <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                      <Text style={[styles.workflowButtonText, { color: '#EF4444' }]}>Cancel Registration</Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* Reactivate - For cancelled registrations */}
                  {selectedRegistration.status === 'cancelled' && (
                    <TouchableOpacity
                      style={[styles.workflowButton, styles.reactivateButton]}
                      onPress={() => {
                        Alert.alert(
                          'Reactivate Registration',
                          'This will move the registration back to "Pending Payment" status.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Reactivate',
                              onPress: () => updateStatus(selectedRegistration.id, 'pending_payment'),
                            },
                          ]
                        );
                      }}
                      disabled={processing === selectedRegistration.id}
                    >
                      <Ionicons name="refresh-outline" size={20} color="#fff" />
                      <Text style={styles.workflowButtonText}>Reactivate Registration</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* Workflow Guide */}
                <View style={styles.workflowGuide}>
                  <Text style={styles.workflowGuideTitle}>Registration Workflow</Text>
                  <View style={styles.workflowStep}>
                    <View style={[styles.workflowDot, selectedRegistration.status !== 'pending_payment' && styles.workflowDotComplete]} />
                    <Text style={styles.workflowStepText}>1. Parent registers & uploads POP</Text>
                  </View>
                  <View style={styles.workflowStep}>
                    <View style={[styles.workflowDot, (selectedRegistration.status === 'paid' || selectedRegistration.status === 'enrolled') && styles.workflowDotComplete]} />
                    <Text style={styles.workflowStepText}>2. Principal verifies payment</Text>
                  </View>
                  <View style={styles.workflowStep}>
                    <View style={[styles.workflowDot, selectedRegistration.status === 'enrolled' && styles.workflowDotComplete]} />
                    <Text style={styles.workflowStepText}>3. Principal enrolls student (accounts created)</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: theme.textSecondary,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterContainer: {
    marginTop: 16,
    maxHeight: 50,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.card,
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: theme.primary,
  },
  filterTabText: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  filterTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  registrationCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8B5CF620',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  cardInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
  },
  gradeText: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalText: {
    fontSize: 17,
    color: theme.text,
    fontWeight: '500',
  },
  modalTextSecondary: {
    fontSize: 15,
    color: theme.textSecondary,
    marginTop: 4,
  },
  modalLink: {
    fontSize: 15,
    color: theme.primary,
    marginTop: 4,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: theme.textSecondary,
  },
  popButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  popButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
  },
  statusButtonActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  markAsPaidButton: {
    borderColor: '#10B981',
    backgroundColor: '#10B98110',
    marginBottom: 12,
  },
  noPopContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#F59E0B10',
    borderRadius: 8,
    marginTop: 8,
  },
  noPopText: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '500',
  },
  currentStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  currentStatusText: {
    fontSize: 15,
    fontWeight: '600',
  },
  workflowActions: {
    gap: 12,
  },
  workflowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  workflowButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  verifyPaymentButton: {
    backgroundColor: '#10B981',
  },
  markAsPaidButton: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
    marginBottom: 0,
  },
  enrollButton: {
    backgroundColor: '#3B82F6',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  reactivateButton: {
    backgroundColor: '#6B7280',
  },
  enrolledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#10B98115',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10B98130',
  },
  enrolledTextContainer: {
    flex: 1,
  },
  enrolledTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  enrolledSubtitle: {
    fontSize: 13,
    color: '#10B98180',
    marginTop: 2,
  },
  workflowGuide: {
    marginTop: 20,
    padding: 16,
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  workflowGuideTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  workflowStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  workflowDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.border,
  },
  workflowDotComplete: {
    backgroundColor: '#10B981',
  },
  workflowStepText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
});
