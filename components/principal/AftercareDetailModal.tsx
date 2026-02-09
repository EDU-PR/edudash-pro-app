/** Aftercare registration detail modal — extracted from aftercare-admin.tsx */
import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EduDashSpinner from '@/components/ui/EduDashSpinner';

interface AfterCareRegistration {
  id: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  parent_phone: string;
  child_first_name: string;
  child_last_name: string;
  child_grade: string;
  child_allergies?: string;
  registration_fee: number;
  registration_fee_original: number;
  payment_reference?: string;
  proof_of_payment_url?: string;
  status: 'pending_payment' | 'paid' | 'enrolled' | 'cancelled' | 'waitlisted';
}

type ShowAlert = (cfg: {
  title: string;
  message: string;
  buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>;
}) => void;

const statusConfig = {
  pending_payment: { label: 'Pending Payment', color: '#F59E0B', icon: 'time' },
  paid: { label: 'Payment Verified', color: '#10B981', icon: 'checkmark-circle' },
  enrolled: { label: 'Enrolled', color: '#3B82F6', icon: 'school' },
  cancelled: { label: 'Cancelled', color: '#EF4444', icon: 'close-circle' },
  waitlisted: { label: 'Waitlisted', color: '#8B5CF6', icon: 'hourglass' },
};

interface Props {
  registration: AfterCareRegistration | null;
  onClose: () => void;
  processing: string | null;
  updateStatus: (id: string, status: AfterCareRegistration['status']) => void;
  resendEmail: (reg: AfterCareRegistration) => void;
  showAlert: ShowAlert;
  theme: any;
  styles: any;
  topInset: number;
}

export default function AftercareDetailModal({
  registration, onClose, processing, updateStatus,
  resendEmail, showAlert, theme, styles, topInset,
}: Props) {
  if (!registration) return null;

  const config = statusConfig[registration.status];
  const isProcessing = processing === registration.id;

  return (
    <Modal
      visible={!!registration}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { paddingTop: topInset }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Registration Details</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Child Info */}
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Child Information</Text>
            <Text style={styles.modalText}>
              {registration.child_first_name} {registration.child_last_name}
            </Text>
            <Text style={styles.modalTextSecondary}>Grade {registration.child_grade}</Text>
            {registration.child_allergies && (
              <Text style={styles.modalTextSecondary}>Allergies: {registration.child_allergies}</Text>
            )}
          </View>

          {/* Parent Info */}
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Parent/Guardian</Text>
            <Text style={styles.modalText}>
              {registration.parent_first_name} {registration.parent_last_name}
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${registration.parent_phone}`)}>
              <Text style={styles.modalLink}>{registration.parent_phone}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${registration.parent_email}`)}>
              <Text style={styles.modalLink}>{registration.parent_email}</Text>
            </TouchableOpacity>
          </View>

          {/* Payment Info */}
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Payment</Text>
            <Text style={styles.modalText}>
              R{registration.registration_fee.toFixed(2)}
              {registration.registration_fee !== registration.registration_fee_original && (
                <Text style={styles.strikethrough}> R{registration.registration_fee_original.toFixed(2)}</Text>
              )}
            </Text>
            <Text style={styles.modalTextSecondary}>
              Reference: {registration.payment_reference || 'N/A'}
            </Text>
            {registration.proof_of_payment_url ? (
              <TouchableOpacity style={styles.popButton} onPress={() => Linking.openURL(registration.proof_of_payment_url!)}>
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
            <View style={[styles.currentStatusBanner, { backgroundColor: config.color + '20' }]}>
              <Ionicons name={config.icon as any} size={20} color={config.color} />
              <Text style={[styles.currentStatusText, { color: config.color }]}>Current: {config.label}</Text>
            </View>

            <View style={styles.workflowActions}>
              {/* Pending payment actions */}
              {registration.status === 'pending_payment' && (
                <>
                  {registration.proof_of_payment_url ? (
                    <WorkflowBtn
                      style={[styles.workflowButton, styles.verifyPaymentButton]}
                      icon="checkmark-done" iconColor="#fff" label="Verify Payment"
                      isProcessing={isProcessing}
                      onPress={() => showAlert({
                        title: 'Verify Payment',
                        message: 'Have you reviewed the proof of payment and confirmed the registration fee was received?',
                        buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Verify Payment', onPress: () => updateStatus(registration.id, 'paid') }],
                      })}
                      styles={styles}
                    />
                  ) : (
                    <WorkflowBtn
                      style={[styles.workflowButton, styles.markAsPaidButton]}
                      icon="cash-outline" iconColor="#fff" label="Mark as Paid (No POP)"
                      isProcessing={isProcessing}
                      onPress={() => showAlert({
                        title: 'Mark as Paid (No POP)',
                        message: 'No proof of payment was uploaded. Confirm you have verified payment through other means?',
                        buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm Payment', onPress: () => updateStatus(registration.id, 'paid') }],
                      })}
                      styles={styles}
                    />
                  )}
                </>
              )}

              {/* Paid: Enroll */}
              {registration.status === 'paid' && (
                <WorkflowBtn
                  style={[styles.workflowButton, styles.enrollButton]}
                  icon="school" iconColor="#fff" label="Enroll Student"
                  isProcessing={isProcessing}
                  onPress={() => showAlert({
                    title: 'Enroll Student',
                    message: `This will create parent/student accounts and send welcome email. Proceed?`,
                    buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Enroll Student', onPress: () => updateStatus(registration.id, 'enrolled') }],
                  })}
                  styles={styles}
                />
              )}

              {/* Enrolled success banner */}
              {registration.status === 'enrolled' && (
                <View style={styles.enrolledBanner}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <View style={styles.enrolledTextContainer}>
                    <Text style={styles.enrolledTitle}>Student Enrolled</Text>
                    <Text style={styles.enrolledSubtitle}>Parent and student accounts have been created</Text>
                  </View>
                </View>
              )}

              {/* Cancel */}
              {(registration.status === 'pending_payment' || registration.status === 'paid') && (
                <TouchableOpacity
                  style={[styles.workflowButton, styles.cancelButton]}
                  disabled={isProcessing}
                  onPress={() => showAlert({
                    title: 'Cancel Registration',
                    message: 'Are you sure you want to cancel this registration? This action can be reversed.',
                    buttons: [{ text: 'Keep', style: 'cancel' }, { text: 'Cancel Registration', style: 'destructive', onPress: () => updateStatus(registration.id, 'cancelled') }],
                  })}
                >
                  <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                  <Text style={[styles.workflowButtonText, { color: '#EF4444' }]}>Cancel Registration</Text>
                </TouchableOpacity>
              )}

              {/* Reactivate */}
              {registration.status === 'cancelled' && (
                <WorkflowBtn
                  style={[styles.workflowButton, styles.reactivateButton]}
                  icon="refresh-outline" iconColor="#fff" label="Reactivate Registration"
                  isProcessing={isProcessing}
                  onPress={() => showAlert({
                    title: 'Reactivate Registration',
                    message: 'This will move the registration back to "Pending Payment" status.',
                    buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Reactivate', onPress: () => updateStatus(registration.id, 'pending_payment') }],
                  })}
                  styles={styles}
                />
              )}

              {/* Resend email */}
              {(registration.status === 'pending_payment' || registration.status === 'paid') && (
                <WorkflowBtn
                  style={[styles.workflowButton, styles.resendEmailButton]}
                  icon="mail-outline" iconColor="#667eea" label="Resend Confirmation Email"
                  labelColor="#667eea" spinnerColor="#667eea"
                  isProcessing={isProcessing}
                  onPress={() => showAlert({
                    title: 'Resend Confirmation Email',
                    message: `Send confirmation email to:\n${registration.parent_email}\n\nThe email includes banking details and WhatsApp group link.`,
                    buttons: [{ text: 'Cancel', style: 'cancel' }, { text: 'Send Email', onPress: () => resendEmail(registration) }],
                  })}
                  styles={styles}
                />
              )}
            </View>

            {/* Workflow Guide */}
            <View style={styles.workflowGuide}>
              <Text style={styles.workflowGuideTitle}>Registration Workflow</Text>
              {[
                { done: registration.status !== 'pending_payment', text: '1. Parent registers & uploads POP' },
                { done: registration.status === 'paid' || registration.status === 'enrolled', text: '2. Principal verifies payment' },
                { done: registration.status === 'enrolled', text: '3. Principal enrolls student (accounts created)' },
              ].map((s, i) => (
                <View key={i} style={styles.workflowStep}>
                  <View style={[styles.workflowDot, s.done && styles.workflowDotComplete]} />
                  <Text style={styles.workflowStepText}>{s.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Reusable workflow action button */
function WorkflowBtn({ style, icon, iconColor, label, labelColor, spinnerColor, isProcessing, onPress, styles }: {
  style: any; icon: string; iconColor: string; label: string;
  labelColor?: string; spinnerColor?: string;
  isProcessing: boolean; onPress: () => void; styles: any;
}) {
  return (
    <TouchableOpacity style={style} onPress={onPress} disabled={isProcessing}>
      {isProcessing ? (
        <EduDashSpinner size="small" color={spinnerColor || '#fff'} />
      ) : (
        <>
          <Ionicons name={icon as any} size={20} color={iconColor} />
          <Text style={[styles.workflowButtonText, labelColor ? { color: labelColor } : undefined]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
