import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

export const createStyles = (theme?: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme?.text || '#111827',
    },
    sectionSubtitle: {
      fontSize: 14,
      color: theme?.textSecondary || '#6b7280',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme?.inputBackground || '#f9fafb',
      borderWidth: 1,
      borderColor: theme?.inputBorder || '#d1d5db',
      borderRadius: 12,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 14,
      color: theme?.inputText || '#111827',
    },
    radiusChips: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    radiusChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme?.border || '#334155',
      backgroundColor: theme?.surface || '#0f172a',
    },
    radiusChipActive: {
      backgroundColor: '#4F46E5',
      borderColor: '#4F46E5',
    },
    radiusChipText: {
      color: theme?.textSecondary || '#9ca3af',
      fontWeight: '700',
      fontSize: 12,
    },
    radiusChipTextActive: {
      color: '#fff',
      fontWeight: '800',
    },
    refreshButton: {
      backgroundColor: theme?.primary || '#4F46E5',
      padding: 10,
      borderRadius: 12,
    },
    listContent: {
      paddingBottom: 16,
    },
    candidateCard: {
      backgroundColor: theme?.cardBackground || 'white',
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme?.border || '#f3f4f6',
    },
    candidateHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    candidateInfo: {
      flex: 1,
    },
    candidateName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme?.text || '#111827',
      marginBottom: 2,
    },
    candidateEmail: {
      fontSize: 13,
      color: theme?.textSecondary || '#6b7280',
      marginBottom: 2,
    },
    candidateDetails: {
      fontSize: 12,
      color: theme?.textSecondary || '#9ca3af',
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
    },
    ratingStars: {
      flexDirection: 'row',
      marginRight: 6,
    },
    ratingText: {
      color: theme?.text || '#0f172a',
      fontSize: 12,
      fontWeight: '600',
    },
    ratingEmpty: {
      color: theme?.textSecondary || '#94a3b8',
      fontSize: 12,
      marginTop: 6,
    },
    inviteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#4F46E5',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      gap: 6,
    },
    inviteButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    referencesButton: {
      marginTop: 12,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#F1F5F9',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    referencesText: {
      color: '#0f172a',
      fontSize: 12,
      fontWeight: '600',
    },
    revokeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#fee2e2',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
    },
    revokeButtonText: {
      color: '#dc2626',
      fontWeight: '700',
      fontSize: 13,
    },
    inviteActionsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      flexWrap: 'wrap',
    },
    inviteActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },
    inviteActionText: {
      fontSize: 12,
      fontWeight: '700',
    },
    emptyText: {
      fontSize: 14,
      color: theme?.textSecondary || '#6b7280',
      textAlign: 'center',
      paddingVertical: 24,
    },
  });
