/**
 * PrincipalQuickActions - Styles
 */

import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;

const isDarkHex = (hex: string): boolean => {
  const match = String(hex || '').trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return false;
  const value = match[1];
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.55;
};

export const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;

export const createQuickActionsStyles = (theme: any) => {
  const isDark = isDarkHex(theme?.background);
  const tabBackground = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.62)';
  const tabBorder = isDark ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.82)';

  return StyleSheet.create({
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
      borderColor: tabBorder,
      backgroundColor: tabBackground,
    },
    groupTabActive: {
      borderColor: `${theme.primary}66`,
      backgroundColor: `${theme.primary}20`,
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
};
