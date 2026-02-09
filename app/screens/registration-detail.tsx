/** Registration Detail Screen — shows full registration details and approval actions */
import React from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { AlertModal } from '@/components/ui/AlertModal';
import EduDashSpinner from '@/components/ui/EduDashSpinner';
import {
  useRegistrationDetail,
  calculateAge, formatDate, formatDateTime, getStatusColor,
  openDocument, callGuardian, emailGuardian, whatsAppGuardian, canApprove,
} from '@/hooks/registration-detail';

export default function RegistrationDetailScreen() {
  const { theme, isDark } = useTheme();
  const colors = theme;
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const styles = screenStyles;

  const {
    registration, loading, processing, error,
    popViewed, setPopViewed,
    showRejectionModal, setShowRejectionModal,
    rejectionReason, setRejectionReason,
    alertState, hideAlert, showAlert,
    handleApprove, handleReject, confirmRejection, handleVerifyPayment,
  } = useRegistrationDetail(id);

  // --- Local sub-components --- //

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );

  const InfoRow = ({ icon, label, value, onPress }: {
    icon: string; label: string; value: string | undefined; onPress?: () => void;
  }) => (
    <TouchableOpacity style={styles.infoRow} onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
        <Ionicons name={icon as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{value || 'N/A'}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
    </TouchableOpacity>
  );

  const DocumentButton = ({ icon, label, url, uploaded }: {
    icon: string; label: string; url?: string; uploaded: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.documentButton, { backgroundColor: uploaded ? colors.primary + '10' : colors.background }, !uploaded && { borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' as const }]}
      onPress={() => openDocument(url, label, showAlert)}
    >
      <Ionicons name={icon as any} size={24} color={uploaded ? colors.primary : colors.textSecondary} />
      <Text style={[styles.documentLabel, { color: uploaded ? colors.primary : colors.textSecondary }]}>{label}</Text>
      <View style={[styles.documentStatus, { backgroundColor: uploaded ? '#10B98120' : '#F59E0B20' }]}>
        <Ionicons name={uploaded ? 'checkmark-circle' : 'time'} size={14} color={uploaded ? '#10B981' : '#F59E0B'} />
        <Text style={{ color: uploaded ? '#10B981' : '#F59E0B', fontSize: 11, marginLeft: 4 }}>
          {uploaded ? 'Uploaded' : 'Pending'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const callG = () => registration && callGuardian(registration.guardian_phone);
  const emailG = () => registration && emailGuardian(registration.guardian_email);
  const whatsG = () => registration && whatsAppGuardian(registration.guardian_phone);

  // --- Early returns --- //

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <EduDashSpinner size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !registration) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Error' }} />
        <Ionicons name="warning" size={64} color="#EF4444" />
        <Text style={[styles.errorText, { color: colors.text }]}>{error || 'Registration not found'}</Text>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={isDark ? ['#1E3A5F', '#0F172A'] : ['#3B82F6', '#1D4ED8']}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <TouchableOpacity style={styles.backButtonAbsolute} onPress={() => router.back()}>
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
            {calculateAge(registration.student_dob)} old \u2022 {registration.student_gender || 'N/A'}
          </Text>
          <View style={[styles.statusBadgeLarge, { backgroundColor: getStatusColor(registration.status) }]}>
            <Text style={styles.statusTextLarge}>{registration.status.toUpperCase()}</Text>
          </View>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction} onPress={callG}>
              <Ionicons name="call" size={20} color="#fff" />
              <Text style={styles.quickActionText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={whatsG}>
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={styles.quickActionText}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={emailG}>
              <Ionicons name="mail" size={20} color="#fff" />
              <Text style={styles.quickActionText}>Email</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Guardian */}
        <Section title="Guardian Information">
          <InfoRow icon="person" label="Name" value={registration.guardian_name} />
          <InfoRow icon="call" label="Phone" value={registration.guardian_phone} onPress={callG} />
          <InfoRow icon="mail" label="Email" value={registration.guardian_email} onPress={emailG} />
          <InfoRow icon="location" label="Address" value={registration.guardian_address} />
          {registration.guardian_id_number && (
            <InfoRow icon="card" label="ID Number" value={registration.guardian_id_number} />
          )}
        </Section>

        {/* Student */}
        <Section title="Student Information">
          <InfoRow icon="calendar" label="Date of Birth" value={formatDate(registration.student_dob)} />
          <InfoRow icon="person" label="Gender" value={registration.student_gender} />
          {registration.student_id_number && (
            <InfoRow icon="card" label="ID Number" value={registration.student_id_number} />
          )}
        </Section>

        {/* Medical */}
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
            <DocumentButton icon="document-text" label="Birth Certificate"
              url={registration.student_birth_certificate_url}
              uploaded={!!registration.student_birth_certificate_url} />
            <DocumentButton icon="medical" label="Clinic Card"
              url={registration.student_clinic_card_url}
              uploaded={!!registration.student_clinic_card_url} />
            <DocumentButton icon="card" label="Guardian ID"
              url={registration.guardian_id_document_url}
              uploaded={!!registration.guardian_id_document_url} />
          </View>
          {registration.documents_deadline && (
            <Text style={[styles.deadlineText, { color: colors.textSecondary }]}>
              Documents deadline: {formatDate(registration.documents_deadline)}
            </Text>
          )}
        </Section>

        {/* Payment */}
        <Section title="Payment Information">
          <View style={[styles.paymentStatus, { backgroundColor: registration.registration_fee_paid ? '#10B98115' : '#EF444415' }]}>
            <Ionicons
              name={registration.registration_fee_paid ? 'checkmark-circle' : 'close-circle'}
              size={32}
              color={registration.registration_fee_paid ? '#10B981' : '#EF4444'}
            />
            <View style={styles.paymentStatusText}>
              <Text style={[styles.paymentStatusTitle, { color: registration.registration_fee_paid ? '#10B981' : '#EF4444' }]}>
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
                style={[styles.viewProofButton, { backgroundColor: popViewed ? colors.primary : '#F59E0B' }]}
                onPress={() => { setPopViewed(true); openDocument(registration.proof_of_payment_url, 'Proof of Payment', showAlert); }}
              >
                <Ionicons name="document-attach" size={20} color="#fff" />
                <Text style={styles.viewProofText}>
                  {popViewed ? '\u2713 View Proof of Payment' : '\ud83d\udc41 View Proof of Payment'}
                </Text>
              </TouchableOpacity>
              {!registration.payment_verified && registration.status === 'pending' && (
                <TouchableOpacity
                  style={[styles.verifyPaymentButton, { backgroundColor: popViewed ? '#10B981' : '#6B7280', opacity: popViewed ? 1 : 0.6 }]}
                  onPress={handleVerifyPayment}
                  disabled={processing || !popViewed}
                >
                  {processing ? (
                    <EduDashSpinner size="small" color="#fff" />
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
              {registration.payment_verified && (
                <View style={[styles.verifiedBadge, { backgroundColor: '#10B98120' }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.verifiedText}>Payment Verified \u2713</Text>
                </View>
              )}
            </>
          )}
          {!registration.proof_of_payment_url && (registration.registration_fee_amount || 0) > 0
            && !registration.payment_verified && registration.status === 'pending' && (
            <TouchableOpacity
              style={[styles.verifyPaymentButton, { backgroundColor: '#10B981' }]}
              onPress={handleVerifyPayment}
              disabled={processing}
            >
              {processing ? (
                <EduDashSpinner size="small" color="#fff" />
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

        {/* Action Buttons (pending only) */}
        {registration.status === 'pending' && (
          <View style={styles.actionButtons}>
            {!canApprove(registration) && (
              <View style={[styles.popWarning, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="warning" size={20} color="#F59E0B" />
                <Text style={styles.popWarningText}>
                  Proof of Payment must be uploaded and verified before approval
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton, !canApprove(registration) && styles.disabledButton]}
              onPress={handleApprove}
              disabled={processing || !canApprove(registration)}
            >
              {processing ? (
                <EduDashSpinner size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color={canApprove(registration) ? '#fff' : '#999'} />
                  <Text style={[styles.actionButtonText, !canApprove(registration) && { color: '#999' }]}>
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
              style={[styles.rejectionModalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
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

const screenStyles = StyleSheet.create({
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
