/**
 * Teacher Dashboard Styles — extracted from NewEnhancedTeacherDashboard.tsx
 * 
 * Keeps the main component file focused on logic and JSX.
 * All style definitions live here for maintainability and reuse.
 */

import { StyleSheet } from 'react-native';

export type LayoutMetrics = {
  isTablet: boolean;
  isSmallScreen: boolean;
  cardPadding: number;
  cardGap: number;
};

export const getLayoutMetrics = (width: number): LayoutMetrics => {
  const isTablet = width > 768;
  const isSmallScreen = width < 380;
  const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
  const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;
  return { isTablet, isSmallScreen, cardPadding, cardGap };
};

export const createTeacherDashboardStyles = (
  theme: any,
  _topInset: number,
  _bottomInset: number,
  layout: LayoutMetrics,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 20,
      paddingHorizontal: layout.cardPadding,
      paddingBottom: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    loadingText: {
      fontSize: 16,
      color: theme.textSecondary,
      marginTop: 16,
    },
    emptyText: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 8,
    },
    // ── Header ──────────────────────────────────────────────
    headerCard: {
      marginBottom: 24,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    headerGradient: {
      padding: layout.isTablet ? 24 : 18,
    },
    headerContent: {
      gap: 16,
    },
    // ── Highlights ──────────────────────────────────────────
    highlightsSection: {
      marginBottom: 24,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionHeaderTitle: {
      fontSize: layout.isTablet ? 18 : 16,
      fontWeight: '700',
      color: theme.text,
    },
    sectionHeaderHint: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    highlightsRow: {
      paddingHorizontal: 2,
    },
    highlightCard: {
      minWidth: layout.isSmallScreen ? 150 : 180,
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 12,
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.borderLight,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    highlightIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    highlightLabel: {
      fontSize: 10,
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    highlightValue: {
      fontSize: layout.isTablet ? 18 : 16,
      fontWeight: '700',
      color: theme.text,
      marginTop: 4,
    },
    highlightSub: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },
    // ── Greeting ────────────────────────────────────────────
    greetingRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    greetingEmoji: {
      fontSize: layout.isTablet ? 40 : 32,
      marginTop: 2,
    },
    greetingTextContainer: {
      flex: 1,
    },
    greeting: {
      fontSize: layout.isTablet ? 28 : layout.isSmallScreen ? 22 : 24,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: layout.isTablet ? 16 : layout.isSmallScreen ? 13 : 14,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    // ── School card ─────────────────────────────────────────
    schoolCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      borderRadius: 12,
      padding: 12,
      gap: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    schoolIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    schoolIcon: {
      fontSize: 20,
    },
    schoolTextContainer: {
      flex: 1,
    },
    schoolLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    schoolName: {
      fontSize: layout.isTablet ? 16 : 14,
      color: theme.text,
      fontWeight: '600',
    },
    tierBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    tierBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#FFFFFF',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    // ── Sections ────────────────────────────────────────────
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: layout.isTablet ? 22 : layout.isSmallScreen ? 18 : 20,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 16,
    },
    sectionTitleChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      alignSelf: 'flex-start',
      marginBottom: 10,
    },
    // ── Action sections ─────────────────────────────────────
    actionSection: {
      marginBottom: 16,
    },
    actionSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    actionSectionIcon: {
      width: 22,
      height: 22,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceVariant,
      borderWidth: 1,
      borderColor: theme.borderLight,
    },
    actionSectionTitle: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    // ── Grids ───────────────────────────────────────────────
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -layout.cardGap / 2,
    },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -layout.cardGap / 2,
    },
    // ── Error state ─────────────────────────────────────────
    retryButton: {
      marginTop: 16,
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: 14,
    },
  });
