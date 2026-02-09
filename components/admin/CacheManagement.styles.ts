/**
 * CacheManagement Styles
 * Extracted from CacheManagement.tsx to comply with ≤400 line limit.
 */

import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

export const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.light.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      paddingTop: 60,
      backgroundColor: 'white',
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: Colors.light.text,
    },
    closeButton: {
      padding: 8,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: Colors.light.tabIconDefault,
    },
    section: {
      marginBottom: 32,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: Colors.light.text,
      marginLeft: 8,
    },
    healthBadge: {
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    healthText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    statCard: {
      flex: 1,
      minWidth: 150,
      backgroundColor: 'white',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: Colors.light.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 14,
      color: Colors.light.tabIconDefault,
      textAlign: 'center',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'white',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    actionContent: {
      flex: 1,
      marginLeft: 12,
    },
    actionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.light.text,
      marginBottom: 2,
    },
    actionDescription: {
      fontSize: 14,
      color: Colors.light.tabIconDefault,
    },
    infoText: {
      fontSize: 14,
      color: Colors.light.tabIconDefault,
      lineHeight: 20,
      marginBottom: 12,
    },
    clearingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearingText: {
      marginTop: 16,
      fontSize: 16,
      color: Colors.light.text,
      fontWeight: '600',
    },
  });

export const styles = createStyles();
