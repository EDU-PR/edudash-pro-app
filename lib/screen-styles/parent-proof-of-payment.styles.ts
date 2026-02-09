/**
 * Styles for ProofOfPaymentScreen
 * Extracted from parent-proof-of-payment.tsx
 */
import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

export function createProofOfPaymentStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: { padding: 20 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 12 },
    label: { fontSize: 16, fontWeight: '500', color: theme.text, marginBottom: 8 },
    autoMonthRow: { marginBottom: 16 },
    autoMonthText: { fontSize: 13, color: theme.textSecondary, marginBottom: 4 },
    input: {
      backgroundColor: theme.surface, borderRadius: 8, padding: 12,
      fontSize: 16, color: theme.text, borderWidth: 1, borderColor: theme.border, marginBottom: 16,
    },
    textArea: { height: 80, textAlignVertical: 'top' as const },
    datePickerButton: {
      backgroundColor: theme.surface, borderRadius: 8, padding: 12,
      flexDirection: 'row' as const, alignItems: 'center' as const,
      justifyContent: 'space-between' as const, borderWidth: 1, borderColor: theme.border, marginBottom: 16,
    },
    datePickerText: { fontSize: 16, color: theme.text },
    dropdown: {
      backgroundColor: theme.surface, borderRadius: 8,
      borderWidth: 1, borderColor: theme.border, marginBottom: 16,
    },
    dropdownButton: {
      padding: 12, flexDirection: 'row' as const,
      alignItems: 'center' as const, justifyContent: 'space-between' as const,
    },
    dropdownButtonText: { fontSize: 16, color: theme.text },
    dropdownList: { borderTopWidth: 1, borderTopColor: theme.border },
    dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
    dropdownItemText: { fontSize: 16, color: theme.text },
    fileSection: {
      backgroundColor: theme.surface, borderRadius: 12, padding: 16, marginBottom: 24,
    },
    fileSectionTitle: { fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 12 },
    fileButtons: { flexDirection: 'row' as const, gap: 12 },
    fileButton: {
      flex: 1, backgroundColor: theme.primary + '20', borderRadius: 8,
      padding: 12, alignItems: 'center' as const, borderWidth: 1, borderColor: theme.primary + '40',
    },
    fileButtonText: { color: theme.primary, fontSize: 14, fontWeight: '500', marginTop: 4 },
    categoryRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
    categoryChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
    categoryChipText: { fontSize: 12, fontWeight: '600' },
    selectedFileContainer: {
      marginTop: 12, padding: 12, backgroundColor: theme.elevated,
      borderRadius: 8, flexDirection: 'row' as const, alignItems: 'center' as const,
    },
    filePreview: {
      width: 60, height: 60, borderRadius: 8, marginRight: 12,
      backgroundColor: theme.textSecondary + '20',
    },
    fileInfo: { flex: 1 },
    fileName: { fontSize: 16, fontWeight: '500', color: theme.text, marginBottom: 4 },
    fileDetails: { fontSize: 12, color: theme.textSecondary },
    removeFileButton: { padding: 8 },
    submitButton: {
      backgroundColor: theme.primary, borderRadius: 8, padding: 16, alignItems: 'center' as const, marginTop: 12,
    },
    submitButtonDisabled: { backgroundColor: theme.textSecondary + '40' },
    submitButtonText: { color: theme.onPrimary, fontSize: 16, fontWeight: '600' },
    errorText: { color: theme.error, fontSize: 14, marginTop: 4 },
  });
}
