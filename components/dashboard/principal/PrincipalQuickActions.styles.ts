/**
 * PrincipalQuickActions - Styles
 */

import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;

export const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;

export const createQuickActionsStyles = (theme: any) =>
  StyleSheet.create({
    coreGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: cardGap,
      marginBottom: 4,
    },
    gridItem: {
      width: isTablet ? '23%' : '48%',
      flexGrow: 1,
    },
    groupTabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 6,
      marginTop: 10,
      marginBottom: 8,
    },
    groupTab: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBackground || theme.surface,
    },
    groupTabActive: {
      borderColor: `${theme.primary}55`,
      backgroundColor: `${theme.primary}12`,
    },
    groupTabText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    groupTabTextActive: {
      color: theme.primary,
    },
    groupHint: {
      paddingHorizontal: 6,
      marginBottom: 8,
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: cardGap,
    },
  });
