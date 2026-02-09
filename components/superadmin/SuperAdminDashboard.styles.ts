/**
 * SuperAdminDashboard Styles
 * Extracted from SuperAdminDashboard.tsx to comply with ≤400 line limit.
 */

import { StyleSheet } from 'react-native';

export interface SuperAdminDashboardTheme {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  textTertiary?: string;
  primary: string;
  onPrimary: string;
  success?: string;
  warning?: string;
  error?: string;
  divider: string;
}

export const createStyles = (_theme?: SuperAdminDashboardTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 20,
    },
    errorContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    errorTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 16,
      marginBottom: 8,
    },
    errorMessage: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 22,
    },
    retryButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
    },
    retryButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    card: {
      margin: 16,
      borderRadius: 12,
      borderWidth: 1,
      padding: 16,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginLeft: 8,
    },
    systemStatusContainer: {
      gap: 12,
    },
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statusLabel: {
      fontSize: 14,
      fontWeight: '500',
    },
    statusValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 6,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
    },
    statusLoadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
      gap: 12,
    },
    statusLoadingText: {
      fontSize: 14,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
      marginBottom: 16,
    },
    statItem: {
      flex: 1,
      minWidth: 80,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      textAlign: 'center',
      fontWeight: '500',
    },
    dataTimestamp: {
      fontSize: 11,
      textAlign: 'center',
      fontStyle: 'italic',
      marginTop: 8,
    },
    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    quickActionButton: {
      flex: 1,
      minWidth: 140,
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderRadius: 8,
      gap: 8,
    },
    quickActionText: {
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    activityList: {
      gap: 12,
    },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    activityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    activityContent: {
      flex: 1,
    },
    activityText: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 2,
    },
    activityTime: {
      fontSize: 12,
    },
  });

export const styles = createStyles();
