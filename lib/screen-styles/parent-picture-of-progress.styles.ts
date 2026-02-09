/**
 * Styles for parent-picture-of-progress screen.
 *
 * Extracted per WARP (StyleSheet > 200 lines → separate file).
 */

import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

export function createPictureOfProgressStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      padding: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    label: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top' as const,
    },
    dropdown: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    dropdownButton: {
      padding: 12,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    dropdownButtonText: {
      fontSize: 16,
      color: theme.text,
    },
    dropdownList: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      maxHeight: 200,
    },
    dropdownItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    dropdownItemText: {
      fontSize: 16,
      color: theme.text,
    },
    fileSection: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
    },
    fileSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 12,
    },
    fileButtons: {
      flexDirection: 'row' as const,
      gap: 12,
    },
    fileButton: {
      flex: 1,
      backgroundColor: theme.primary + '20',
      borderRadius: 8,
      padding: 12,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: theme.primary + '40',
    },
    fileButtonText: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: '500',
      marginTop: 4,
    },
    selectedFileContainer: {
      marginTop: 12,
      backgroundColor: theme.elevated,
      borderRadius: 8,
    },
    imagePreview: {
      width: '100%' as const,
      height: 200,
      borderRadius: 8,
      backgroundColor: theme.textSecondary + '20',
    },
    fileInfo: {
      padding: 12,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    fileName: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.text,
      flex: 1,
    },
    fileDetails: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    removeFileButton: {
      padding: 8,
      marginLeft: 12,
    },
    submitButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center' as const,
      marginTop: 12,
    },
    submitButtonDisabled: {
      backgroundColor: theme.textSecondary + '40',
    },
    submitButtonText: {
      color: theme.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    helpText: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
      lineHeight: 20,
    },
    // Milestone celebration styles
    milestoneBanner: {
      backgroundColor: '#FEF3C7',
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 2,
      borderColor: '#F59E0B',
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    milestoneContent: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    milestoneEmoji: {
      fontSize: 32,
      marginRight: 12,
    },
    milestoneTextContainer: {
      flex: 1,
    },
    milestoneTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#92400E',
      marginBottom: 4,
    },
    milestoneSubtitle: {
      fontSize: 14,
      color: '#B45309',
      lineHeight: 20,
    },
    // AI Suggested tags
    tagsContainer: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      marginTop: 8,
      gap: 8,
    },
    tag: {
      backgroundColor: theme.primary + '20',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.primary + '40',
    },
    tagText: {
      fontSize: 12,
      color: theme.primary,
      fontWeight: '500',
    },
    aiInsightContainer: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
      borderLeftWidth: 3,
      borderLeftColor: theme.primary,
    },
    aiInsightText: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 20,
      fontStyle: 'italic' as const,
    },
  });
}
