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
  Alert,
  Dimensions,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';

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

  // Check if registration can be approved (needs POP)
  const canApprove = (reg: Registration): boolean => {
    return !!reg.proof_of_payment_url;
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
        
        const { data, error: fetchError } = await supabase
          .from('registration_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        
        setRegistration(data);
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
      Alert.alert('Not Available', `${name} has not been uploaded yet.`);
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open document');
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

  // Approve registration
  const handleApprove = async () => {
    if (!registration) return;
    
    Alert.alert(
      'Approve Registration',
      `Approve registration for ${registration.student_first_name} ${registration.student_last_name}?\n\nThis will:\n• Create parent account\n• Create student profile\n• Send welcome email`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setProcessing(true);
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

              // Call sync function
              const { error: syncError } = await supabase.functions.invoke('sync-registration-to-edudash', {
                body: { registration_id: registration.id },
              });

              if (syncError) {
                Alert.alert(
                  'Partial Success',
                  'Registration approved, but account creation may have failed. Please contact admin.',
                  [{ text: 'OK', onPress: () => router.back() }]
                );
              } else {
                Alert.alert(
                  'Success',
                  '✅ Registration approved!\n\n✉️ Welcome email sent\n👤 Parent account created\n👶 Student profile created',
                  [{ text: 'OK', onPress: () => router.back() }]
                );
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to approve registration');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  // Reject registration
  const handleReject = () => {
    if (!registration) return;
    
    Alert.prompt(
      'Reject Registration',
      `Enter reason for rejecting ${registration.student_first_name}'s registration:`,
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

            setProcessing(true);
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

              Alert.alert('Rejected', 'Registration has been rejected.', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to reject registration');
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  // Verify payment
  const handleVerifyPayment = async () => {
    if (!registration) return;
    
    Alert.alert(
      'Verify Payment',
      'Confirm that the payment has been received and verified?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          onPress: async () => {
            setProcessing(true);
            try {
              const supabase = assertSupabase();
              
              const { error } = await supabase
                .from('registration_requests')
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
              
              Alert.alert('Success', 'Payment has been verified');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to verify payment');
            } finally {
              setProcessing(false);
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
              {registration.registration_fee_amount && (
                <Text style={[styles.paymentAmount, { color: colors.text }]}>
                  R{registration.registration_fee_amount.toLocaleString()}
                  {registration.discount_amount ? ` (Discount: R${registration.discount_amount})` : ''}
                </Text>
              )}
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
            <TouchableOpacity
              style={[styles.viewProofButton, { backgroundColor: colors.primary }]}
              onPress={() => openDocument(registration.proof_of_payment_url, 'Proof of Payment')}
            >
              <Ionicons name="document-attach" size={20} color="#fff" />
              <Text style={styles.viewProofText}>View Proof of Payment</Text>
            </TouchableOpacity>
          )}

          {/* Verify Payment Button */}
          {registration.registration_fee_paid && !registration.payment_verified && registration.status === 'pending' && (
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
                  <Text style={styles.verifyPaymentText}>Verify Payment</Text>
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
                  Proof of Payment is required before you can approve this registration
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
    </View>
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
});
