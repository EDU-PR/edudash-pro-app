// Styles for Year Plan Config Modal - Extracted for WARP.md compliance

import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

export const createStyles = (theme: ThemeColors, insetTop: number, insetBottom: number) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    modalGenerate: {
      fontSize: 16,
      color: '#8B5CF6',
      fontWeight: '600',
    },
    modalContent: {
      flex: 1,
    },
    modalContentInner: {
      padding: 16,
      paddingBottom: insetBottom + 24,
    },
    formGroup: {
      marginBottom: 24,
    },
    formLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 10,
    },
    yearSelector: {
      flexDirection: 'row',
      gap: 10,
    },
    yearOption: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    yearOptionActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    yearOptionText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    yearOptionTextActive: {
      color: '#fff',
    },
    termSelector: {
      flexDirection: 'row',
      gap: 10,
    },
    termOption: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    termOptionActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    termOptionText: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    termOptionTextActive: {
      color: '#fff',
    },
    ageGroupSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    ageGroupOption: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    ageGroupOptionActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    ageGroupOptionText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    ageGroupOptionTextActive: {
      color: '#fff',
    },
    focusAreaSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    focusAreaOption: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    focusAreaOptionActive: {
      backgroundColor: '#10B981',
      borderColor: '#10B981',
    },
    focusAreaOptionText: {
      fontSize: 13,
      color: theme.textSecondary,
    },
    focusAreaOptionTextActive: {
      color: '#fff',
    },
    togglesGroup: {
      marginBottom: 24,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    toggleInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    toggleLabel: {
      fontSize: 16,
      color: theme.text,
    },
    toggle: {
      width: 50,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.border,
      padding: 2,
    },
    toggleActive: {
      backgroundColor: theme.primary,
    },
    toggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#fff',
    },
    toggleThumbActive: {
      marginLeft: 22,
    },
    budgetSelector: {
      flexDirection: 'row',
      gap: 10,
    },
    budgetOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    budgetOptionActive: {
      backgroundColor: '#10B981',
      borderColor: '#10B981',
    },
    budgetOptionText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    budgetOptionTextActive: {
      color: '#fff',
    },
    input: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: theme.text,
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
    },
  });
