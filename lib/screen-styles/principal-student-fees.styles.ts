/**
 * Styles for the StudentFeeManagement screen.
 * Extracted per WARP.md § StyleSheet >200 lines.
 */
import { StyleSheet } from 'react-native';

export const createStyles = (theme: any, isDark: boolean, insets: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: insets.bottom + 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.textSecondary,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginTop: 16,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  studentCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.primary,
  },
  studentDetails: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
  },
  studentMeta: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
  parentNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  parentNoticeText: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  parentInviteButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.primary + '15',
  },
  parentInviteText: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  enrollmentRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  enrollmentLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  enrollmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.primary + '15',
  },
  enrollmentButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.primary,
  },
  changeClassButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.primary + '10',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  changeClassText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 12,
  },
  emptyFees: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyFeesText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 8,
  },
  emptyFeesHint: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  generateFeesButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.primary + '20',
  },
  generateFeesText: {
    color: theme.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  openFeeSetupButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.textSecondary + '20',
  },
  openFeeSetupText: {
    color: theme.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  feeCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  feeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  feeDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  feeDueDate: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  feeAmounts: {
    backgroundColor: theme.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  amountLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  amountValue: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
  },
  finalAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  waiverNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  waiverNoteText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  feeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  waiveButton: {
    backgroundColor: '#6B7280' + '15',
  },
  waiveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  adjustButton: {
    backgroundColor: theme.primary + '15',
  },
  adjustButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  paidButton: {
    backgroundColor: theme.success + '15',
  },
  paidButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.success,
  },
  receiptButton: {
    backgroundColor: theme.primary + '12',
  },
  receiptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
  },
  unpaidButton: {
    backgroundColor: theme.warning + '15',
  },
  unpaidButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.warning,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: insets.bottom + 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 20,
  },
  waiveTypeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  waiveTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
  },
  waiveTypeButtonActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  waiveTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  waiveTypeTextActive: {
    color: theme.primary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  classFeeHintText: {
    marginTop: 8,
    fontSize: 12,
    color: theme.textSecondary,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  classOptions: {
    marginBottom: 20,
  },
  classOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.background,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  classOptionSelected: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  classOptionText: {
    fontSize: 16,
    color: theme.text,
  },
  classOptionTextSelected: {
    fontWeight: '600',
    color: theme.primary,
  },
});
