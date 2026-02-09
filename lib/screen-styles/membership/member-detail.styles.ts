/**
 * Member Detail Screen - Styles & Types
 * Extracted from member-detail.tsx per WARP.md standards
 */
import { StyleSheet } from 'react-native';

export function createStyles(_theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    headerButton: {
      marginRight: 16,
    },
    content: {
      flex: 1,
    },
    quickActions: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 16,
      gap: 10,
    },
    quickAction: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 6,
    },
    quickActionText: {
      fontSize: 11,
      fontWeight: '600',
    },
    tabBar: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 20,
      padding: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 10,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
    },
    tabContent: {
      padding: 16,
    },
    bottomActions: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
    },
    bottomAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    bottomActionText: {
      fontSize: 14,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      fontSize: 14,
      marginTop: 12,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    errorText: {
      fontSize: 16,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 24,
    },
    retryButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    // Pending Removal Banner Styles
    pendingRemovalBanner: {
      marginHorizontal: 16,
      marginTop: 16,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
    },
    pendingRemovalContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    pendingRemovalText: {
      flex: 1,
    },
    pendingRemovalTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 4,
    },
    pendingRemovalSubtitle: {
      fontSize: 13,
    },
    pendingRemovalActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    pendingRemovalButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 8,
      gap: 6,
    },
    pendingRemovalButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
  });
}
