// Styles for Activity Form Modal - Extracted for WARP.md compliance

import { StyleSheet } from 'react-native';

export const createStyles = (theme: any, insetBottom: number) =>
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
    modalCancel: {
      fontSize: 16,
      color: theme.textSecondary,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    modalSave: {
      fontSize: 16,
      color: theme.primary,
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
      marginBottom: 20,
    },
    formLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 8,
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
    typeSelector: {
      flexDirection: 'row',
      gap: 8,
    },
    typeOption: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    durationRow: {
      flexDirection: 'row',
      gap: 8,
    },
    durationOption: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    durationOptionActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    durationOptionText: {
      fontSize: 16,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    durationOptionTextActive: {
      color: '#fff',
    },
    domainsSelector: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    domainOption: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    domainOptionText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    addItemRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    addItemButton: {
      backgroundColor: theme.primary,
      width: 48,
      height: 48,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 8,
      padding: 12,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    addedItemText: {
      flex: 1,
      fontSize: 14,
      color: theme.text,
    },
    stepItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    stepNumberText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    stepText: {
      fontSize: 15,
      color: theme.text,
      lineHeight: 20,
    },
  });
