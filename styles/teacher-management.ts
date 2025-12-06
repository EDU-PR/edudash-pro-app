/**
 * Teacher Management Styles
 * 
 * Shared styles for teacher management screens and components.
 * Extracted from app/screens/teacher-management.tsx per WARP.md standards.
 */

import { StyleSheet } from 'react-native';

export interface TeacherManagementTheme {
  background?: string;
  surface?: string;
  surfaceVariant?: string;
  cardBackground?: string;
  border?: string;
  primary?: string;
  text?: string;
  textSecondary?: string;
  shadow?: string;
  success?: string;
  error?: string;
  inputBackground?: string;
  inputBorder?: string;
  inputText?: string;
}

export const createTeacherManagementStyles = (theme?: TeacherManagementTheme) =>
  StyleSheet.create({
    // Container styles
    container: {
      flex: 1,
      backgroundColor: theme?.background || '#f8fafc',
    },
    contentContainer: {
      flex: 1,
    },

    // Tab Navigation
    tabsContainer: {
      backgroundColor: theme?.surface || 'white',
      borderBottomWidth: 1,
      borderBottomColor: theme?.border || '#e5e7eb',
      paddingVertical: 8,
    },
    tabsContent: {
      paddingHorizontal: 20,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginRight: 8,
      borderRadius: 20,
      backgroundColor: theme?.surfaceVariant || '#f9fafb',
    },
    activeTab: {
      backgroundColor: theme?.primary || '#2563eb',
    },
    tabText: {
      marginLeft: 6,
      fontSize: 13,
      fontWeight: '600',
      color: theme?.textSecondary || '#6b7280',
    },
    activeTabText: {
      color: 'white',
    },

    // Section Containers
    sectionContainer: {
      flex: 1,
      backgroundColor: theme?.background || '#f8fafc',
    },
    profileContent: {
      paddingBottom: 160,
    },
    overviewContainer: {
      flex: 1,
    },
    sectionHeader: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      backgroundColor: theme?.surface || 'white',
      borderBottomWidth: 1,
      borderBottomColor: theme?.border || '#f3f4f6',
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme?.text || '#333',
      marginBottom: 4,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: theme?.textSecondary || '#6b7280',
    },

    // List Content
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
    },

    // Empty State
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme?.text || '#333',
      marginTop: 16,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: theme?.textSecondary || '#666',
      textAlign: 'center',
      maxWidth: 260,
      lineHeight: 20,
    },
    emptyButton: {
      backgroundColor: theme?.primary || '#007AFF',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 20,
    },
    emptyButtonText: {
      color: 'white',
      fontWeight: '600',
      fontSize: 15,
    },

    // Floating Action Button
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme?.primary || '#007AFF',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme?.shadow || '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
      zIndex: 1000,
    },

    // Buttons
    btn: {
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
    },
    btnPrimary: {
      backgroundColor: theme?.primary || '#00f5ff',
    },
    btnPrimaryText: {
      color: '#000',
      fontWeight: '800',
    },
    btnDanger: {
      backgroundColor: theme?.error || '#ff0080',
    },
    btnDangerText: {
      color: '#000',
      fontWeight: '800',
    },

    // Seat Usage Header
    seatUsageHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme?.surface || 'white',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme?.border || '#f3f4f6',
      marginBottom: 8,
    },
    seatUsageInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    seatUsageText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme?.text || '#333',
      marginLeft: 8,
    },
    overLimitBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fef2f2',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginLeft: 12,
    },
    overLimitText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#dc2626',
      marginLeft: 4,
    },
    refreshButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme?.surfaceVariant || '#f9fafb',
    },
  });

export default createTeacherManagementStyles;
