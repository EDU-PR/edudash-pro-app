/**
 * Dashboard Theme System
 * 
 * Shared style system for dashboard components across the native app.
 * Provides consistent styling, spacing, and colors for all dashboard UI elements.
 * 
 * Usage:
 * ```typescript
 * import { useTheme } from '@/contexts/ThemeContext';
 * import { createDashboardStyles, SPACING, RADIUS } from '@/lib/styles/dashboardTheme';
 * 
 * const { theme } = useTheme();
 * const dashStyles = createDashboardStyles(theme);
 * 
 * <View style={dashStyles.card}>
 *   <Text style={dashStyles.sectionTitle}>My Section</Text>
 * </View>
 * ```
 */

import { StyleSheet, TextStyle, ViewStyle } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

// ============================================================================
// SPACING CONSTANTS
// ============================================================================

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ============================================================================
// BORDER RADIUS CONSTANTS
// ============================================================================

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

// ============================================================================
// FONT SIZES
// ============================================================================

export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  huge: 32,
} as const;

// ============================================================================
// FONT WEIGHTS
// ============================================================================

export const FONT_WEIGHT = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
} as const;

// ============================================================================
// SHADOW PRESETS
// ============================================================================

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 16,
  },
} as const;

// ============================================================================
// GRADIENT COLORS
// ============================================================================

export const GRADIENTS = {
  primary: ['#4F46E5', '#6366F1'],
  secondary: ['#8B5CF6', '#A78BFA'],
  success: ['#10B981', '#34D399'],
  warning: ['#F59E0B', '#FBBF24'],
  error: ['#EF4444', '#F87171'],
  purple: ['#7C3AED', '#A78BFA'],
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get status color based on status type
 */
export const getStatusColor = (
  status: 'success' | 'warning' | 'error' | 'info',
  theme: ThemeColors
): string => {
  const colors = {
    success: theme.success,
    warning: theme.warning,
    error: theme.error,
    info: theme.primary,
  };
  return colors[status];
};

/**
 * Get status background color (lighter version)
 */
export const getStatusBackgroundColor = (
  status: 'success' | 'warning' | 'error' | 'info',
  theme: ThemeColors
): string => {
  const colors = {
    success: theme.successLight,
    warning: theme.warningLight,
    error: theme.errorLight,
    info: theme.primaryLight,
  };
  return colors[status];
};

/**
 * Create opacity variant of a color
 */
export const withOpacity = (color: string, opacity: number): string => {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  // Handle rgb/rgba colors
  if (color.startsWith('rgb')) {
    return color.replace(/rgba?\(([^)]+)\)/, (_, values) => {
      const [r, g, b] = values.split(',').map((v: string) => v.trim());
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    });
  }
  return color;
};

// ============================================================================
// DASHBOARD STYLES FACTORY
// ============================================================================

/**
 * Create dashboard styles based on theme
 * Returns a comprehensive set of reusable styles for dashboard components
 */
export const createDashboardStyles = (theme: ThemeColors) => {
  return StyleSheet.create({
    // LAYOUT STYLES
    container: {
      flex: 1,
      backgroundColor: theme.background,
    } as ViewStyle,
    
    scrollContent: {
      padding: SPACING.lg,
      paddingBottom: 100,
    } as ViewStyle,
    
    section: {
      marginBottom: SPACING.xl,
    } as ViewStyle,
    
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    } as ViewStyle,
    
    sectionTitle: {
      fontSize: FONT_SIZE.xl,
      fontWeight: FONT_WEIGHT.semibold,
      color: theme.text,
    } as TextStyle,
    
    sectionSubtitle: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
      color: theme.textSecondary,
      marginTop: SPACING.xs,
    } as TextStyle,
    
    // CARD STYLES
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.lg,
      ...SHADOW.md,
    } as ViewStyle,
    
    cardCompact: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      ...SHADOW.sm,
    } as ViewStyle,
    
    cardElevated: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      ...SHADOW.lg,
    } as ViewStyle,
    
    // METRIC CARD STYLES
    metricCard: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.lg,
      borderWidth: 2,
      borderColor: theme.border,
      ...SHADOW.md,
      minWidth: '47%',
    } as ViewStyle,
    
    metricIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    } as ViewStyle,
    
    metricValue: {
      fontSize: FONT_SIZE.xxxl,
      fontWeight: FONT_WEIGHT.bold,
      color: theme.text,
      marginBottom: SPACING.xs,
    } as TextStyle,
    
    metricLabel: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semibold,
      color: theme.text,
      marginBottom: SPACING.xs,
    } as TextStyle,
    
    metricSubtext: {
      fontSize: FONT_SIZE.xs,
      color: theme.textSecondary,
    } as TextStyle,
    
    // GRID LAYOUT
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.md,
      marginBottom: SPACING.lg,
    } as ViewStyle,
    
    gridItem: {
      flex: 1,
      minWidth: '47%',
    } as ViewStyle,
    
    // BUTTON STYLES
    button: {
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    } as ViewStyle,
    
    buttonPrimary: {
      backgroundColor: theme.primary,
    } as ViewStyle,
    
    buttonSecondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.border,
    } as ViewStyle,
    
    buttonText: {
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.semibold,
      color: theme.onPrimary,
    } as TextStyle,
    
    buttonTextSecondary: {
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.semibold,
      color: theme.text,
    } as TextStyle,
    
    viewAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.sm,
    } as ViewStyle,
    
    viewAllText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.medium,
      color: theme.primary,
      marginRight: SPACING.xs,
    } as TextStyle,
    
    // BADGE STYLES
    badge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.full,
      alignSelf: 'flex-start',
    } as ViewStyle,
    
    badgeText: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semibold,
      color: '#FFFFFF',
    } as TextStyle,
    
    badgeSuccess: {
      backgroundColor: theme.success,
    } as ViewStyle,
    
    badgeWarning: {
      backgroundColor: theme.warning,
    } as ViewStyle,
    
    badgeError: {
      backgroundColor: theme.error,
    } as ViewStyle,
    
    badgeInfo: {
      backgroundColor: theme.primary,
    } as ViewStyle,
    
    // EMPTY STATE STYLES
    emptyState: {
      alignItems: 'center',
      padding: SPACING.xxl,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
    } as ViewStyle,
    
    emptyStateIcon: {
      marginBottom: SPACING.lg,
    } as ViewStyle,
    
    emptyStateTitle: {
      fontSize: FONT_SIZE.xl,
      fontWeight: FONT_WEIGHT.semibold,
      color: theme.text,
      marginBottom: SPACING.sm,
      textAlign: 'center',
    } as TextStyle,
    
    emptyStateSubtitle: {
      fontSize: FONT_SIZE.md,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: SPACING.lg,
    } as TextStyle,
    
    // LIST ITEM
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      marginBottom: SPACING.sm,
      ...SHADOW.sm,
    } as ViewStyle,
    
    listItemContent: {
      flex: 1,
      marginLeft: SPACING.md,
    } as ViewStyle,
    
    listItemTitle: {
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.semibold,
      color: theme.text,
      marginBottom: SPACING.xs,
    } as TextStyle,
    
    listItemSubtitle: {
      fontSize: FONT_SIZE.sm,
      color: theme.textSecondary,
    } as TextStyle,
    
    // DIVIDER
    divider: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: SPACING.md,
    } as ViewStyle,
    
    dividerThick: {
      height: 2,
      backgroundColor: theme.divider,
      marginVertical: SPACING.lg,
    } as ViewStyle,
    
    // AVATAR
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    
    avatarSmall: {
      width: 32,
      height: 32,
      borderRadius: 16,
    } as ViewStyle,
    
    avatarLarge: {
      width: 64,
      height: 64,
      borderRadius: 32,
    } as ViewStyle,
    
    avatarText: {
      fontSize: FONT_SIZE.lg,
      fontWeight: FONT_WEIGHT.semibold,
      color: theme.onPrimary,
    } as TextStyle,
    
    // INPUT STYLES
    input: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      fontSize: FONT_SIZE.md,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border,
    } as ViewStyle & TextStyle,
    
    inputFocused: {
      borderColor: theme.primary,
      borderWidth: 2,
    } as ViewStyle,
    
    inputError: {
      borderColor: theme.error,
    } as ViewStyle,
    
    // LOADING STATE
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.xxl,
    } as ViewStyle,
    
    loadingText: {
      fontSize: FONT_SIZE.md,
      color: theme.textSecondary,
      marginTop: SPACING.md,
    } as TextStyle,
    
    // HEADER STYLES
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.lg,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    } as ViewStyle,
    
    headerTitle: {
      fontSize: FONT_SIZE.xxl,
      fontWeight: FONT_WEIGHT.bold,
      color: theme.text,
    } as TextStyle,
    
    headerSubtitle: {
      fontSize: FONT_SIZE.sm,
      color: theme.textSecondary,
      marginTop: SPACING.xs,
    } as TextStyle,
    
    // COLLAPSIBLE SECTION
    collapsibleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: SPACING.md,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      marginBottom: SPACING.sm,
      ...SHADOW.sm,
    } as ViewStyle,
    
    collapsibleHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    } as ViewStyle,
    
    collapsibleHeaderTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: FONT_WEIGHT.semibold,
      color: theme.text,
      marginLeft: SPACING.md,
    } as TextStyle,
    
    collapsibleHeaderSubtitle: {
      fontSize: FONT_SIZE.xs,
      color: theme.textSecondary,
      marginLeft: SPACING.md,
      marginTop: SPACING.xs,
    } as TextStyle,
    
    collapsibleContent: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    } as ViewStyle,
    
    // SEARCH BAR
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.lg,
      borderWidth: 1,
      borderColor: theme.border,
    } as ViewStyle,
    
    searchInput: {
      flex: 1,
      fontSize: FONT_SIZE.md,
      color: theme.text,
      marginLeft: SPACING.sm,
    } as TextStyle,
    
    // STATUS INDICATOR
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: SPACING.xs,
    } as ViewStyle,
    
    statusDotSuccess: {
      backgroundColor: theme.success,
    } as ViewStyle,
    
    statusDotWarning: {
      backgroundColor: theme.warning,
    } as ViewStyle,
    
    statusDotError: {
      backgroundColor: theme.error,
    } as ViewStyle,
    
    // PROGRESS BAR
    progressBar: {
      height: 8,
      backgroundColor: theme.divider,
      borderRadius: RADIUS.xs,
      overflow: 'hidden',
    } as ViewStyle,
    
    progressBarFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: RADIUS.xs,
    } as ViewStyle,
  });
};

export type DashboardStyles = ReturnType<typeof createDashboardStyles>;
