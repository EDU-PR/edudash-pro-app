/**
 * Styles for EnhancedUserManagement
 *
 * Extracted per WARP rules (>200 lines → separate .styles.ts).
 * Uses createStyles(theme) factory pattern.
 */

import { StyleSheet } from 'react-native';
import { ThemeColors } from '@/contexts/ThemeContext';

export const createStyles = (_theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    deniedContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    deniedTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      marginTop: 16,
      marginBottom: 8,
    },
    deniedMessage: {
      fontSize: 16,
      textAlign: 'center',
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
    },
    stat: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
    },
    statLabel: {
      fontSize: 12,
      marginTop: 4,
    },
    filtersContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.05)',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      marginLeft: 8,
      fontSize: 16,
    },
    filterPills: {
      flexDirection: 'row',
    },
    filterGroup: {
      flexDirection: 'row',
      marginRight: 16,
    },
    filterPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      marginRight: 8,
    },
    filterPillText: {
      fontSize: 12,
      fontWeight: '500',
      textTransform: 'capitalize',
    },
    selectionBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderBottomWidth: 1,
    },
    selectionText: {
      fontSize: 14,
      fontWeight: '600',
    },
    selectionActions: {
      flexDirection: 'row',
      gap: 8,
    },
    selectionButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    selectionButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    listContainer: {
      padding: 16,
    },
    userCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    selectionCheckbox: {
      marginRight: 12,
      paddingTop: 2,
    },
    userInfo: {
      flex: 1,
    },
    userHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 4,
    },
    userName: {
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
    },
    userBadges: {
      flexDirection: 'row',
      gap: 4,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      borderWidth: 1,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: '600',
    },
    userEmail: {
      fontSize: 14,
      marginBottom: 4,
    },
    organizationName: {
      fontSize: 12,
      marginBottom: 8,
    },
    userMetrics: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    metric: {
      alignItems: 'center',
    },
    metricLabel: {
      fontSize: 10,
      marginBottom: 2,
    },
    metricValue: {
      fontSize: 12,
      fontWeight: '500',
    },
    riskIndicator: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      borderWidth: 1,
    },
    riskScore: {
      fontSize: 12,
      fontWeight: 'bold',
    },
    userTags: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'wrap',
    },
    tag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    tagText: {
      fontSize: 10,
      fontWeight: '500',
    },
    moreTagsText: {
      fontSize: 10,
      fontStyle: 'italic',
    },
    quickActions: {
      flexDirection: 'column',
      gap: 8,
      marginLeft: 12,
    },
    quickAction: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(0,0,0,0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fab: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      gap: 12,
    },
    fabButton: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 64,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 16,
      marginBottom: 8,
    },
    emptyMessage: {
      fontSize: 14,
      textAlign: 'center',
    },
  });
