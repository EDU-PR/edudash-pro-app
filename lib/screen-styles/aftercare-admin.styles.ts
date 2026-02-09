/**
 * Aftercare Admin Screen — Types, constants, and styles
 */

import { StyleSheet } from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AfterCareRegistration {
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

// ─── Constants ───────────────────────────────────────────────────────────────

export const statusConfig = {
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

// ─── Styles ──────────────────────────────────────────────────────────────────

export function createStyles(theme: any) {
  return StyleSheet.create({
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
    resendEmailButton: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: '#667eea',
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
}
