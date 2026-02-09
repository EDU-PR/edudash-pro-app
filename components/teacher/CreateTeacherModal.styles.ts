/**
 * Styles for CreateTeacherModal
 * Extracted per WARP.md (StyleSheet >200 lines → separate file)
 */

import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

export const createStyles = (theme?: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: theme?.surface || '#1a1a2e',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      borderWidth: 1,
      borderColor: theme?.border || '#2a2a4a',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme?.border || '#2a2a4a',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme?.text || '#fff',
    },
    body: {
      maxHeight: 480,
    },
    bodyContent: {
      padding: 20,
      paddingBottom: 8,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme?.textSecondary || '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    typeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 6,
    },
    typeChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme?.border || '#2a2a4a',
      backgroundColor: theme?.background || '#0b1220',
    },
    typeChipActive: {
      backgroundColor: theme?.primary || '#6d28d9',
      borderColor: theme?.primary || '#6d28d9',
    },
    typeChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme?.textSecondary || '#94a3b8',
    },
    typeChipTextActive: {
      color: '#ffffff',
    },
    typeDesc: {
      fontSize: 12,
      color: theme?.textTertiary || '#64748b',
      marginBottom: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme?.text || '#fff',
      marginBottom: 6,
      marginTop: 10,
    },
    input: {
      backgroundColor: theme?.background || '#0b1220',
      borderWidth: 1,
      borderColor: theme?.border || '#2a2a4a',
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme?.text || '#fff',
    },
    multiline: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    nameRow: {
      flexDirection: 'row',
      gap: 10,
    },
    nameField: {
      flex: 1,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginTop: 16,
      padding: 14,
      borderRadius: 12,
      backgroundColor: (theme?.primary || '#6d28d9') + '12',
      borderWidth: 1,
      borderColor: (theme?.primary || '#6d28d9') + '30',
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: theme?.textSecondary || '#94a3b8',
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: theme?.border || '#2a2a4a',
    },
    cancelButton: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme?.border || '#2a2a4a',
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme?.textSecondary || '#94a3b8',
    },
    submitButton: {
      flex: 2,
      height: 48,
      borderRadius: 12,
      backgroundColor: theme?.primary || '#6d28d9',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    submitDisabled: {
      opacity: 0.5,
    },
    submitText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#ffffff',
    },
  });
