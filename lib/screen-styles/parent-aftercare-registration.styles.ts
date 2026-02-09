/**
 * Aftercare Registration — extracted StyleSheet factory
 * Uses createXxxStyles(theme) pattern per WARP convention.
 */

import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

export function createAftercareRegistrationStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { flexGrow: 1, padding: 16, gap: 12, paddingBottom: 32 },
    label: { color: theme.text, fontWeight: '600', marginTop: 6 },
    input: { backgroundColor: theme.surface, borderRadius: 10, padding: 12, color: theme.text, borderWidth: 1, borderColor: theme.border },
    inputError: { borderColor: theme.error },
    hint: { color: theme.textSecondary, fontSize: 12, marginBottom: 4 },
    error: { color: theme.error, fontSize: 12, marginTop: 4 },
    section: { marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
    sectionTitle: { color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 8 },
    btn: { backgroundColor: theme.primary, padding: 14, borderRadius: 10, alignItems: 'center' as const, marginTop: 16 },
    btnText: { color: theme.onPrimary, fontWeight: '800' as const },
    headerTint: { backgroundColor: theme.background },
    dateButton: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
    },
    dateButtonText: { color: theme.text, fontSize: 16 },
    dateButtonPlaceholder: { color: theme.textSecondary, fontSize: 16 },
    gradeRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, marginTop: 8 },
    gradeButton: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      minWidth: 60,
      alignItems: 'center' as const,
    },
    gradeButtonActive: {
      backgroundColor: theme.primary + '20',
      borderColor: theme.primary,
    },
    gradeButtonText: { color: theme.text, fontWeight: '500' as const },
    gradeButtonTextActive: { color: theme.primary, fontWeight: '600' as const },
    paymentMethodRow: { flexDirection: 'row' as const, gap: 8, marginTop: 8 },
    paymentMethodButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center' as const,
    },
    paymentMethodButtonActive: {
      backgroundColor: theme.primary + '20',
      borderColor: theme.primary,
    },
    paymentMethodButtonText: { color: theme.text, fontWeight: '500' as const },
    paymentMethodButtonTextActive: { color: theme.primary, fontWeight: '600' as const },
    checkboxRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: 8 },
    checkbox: {
      width: 24,
      height: 24,
      borderWidth: 2,
      borderColor: theme.border,
      borderRadius: 4,
      marginRight: 8,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    checkboxActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    infoBanner: {
      backgroundColor: theme.primary + '15',
      borderRadius: 10,
      padding: 12,
      marginTop: 8,
      borderLeftWidth: 4,
      borderLeftColor: theme.primary,
    },
    priceBox: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 16,
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
  });
}
