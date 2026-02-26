// Styles for GeneratedPlanView - Extracted for WARP.md compliance

import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

export const createStyles = (theme: ThemeColors, insetBottom: number) =>
  StyleSheet.create({
    planContainer: {
      flex: 1,
    },
    planContent: {
      padding: 16,
      paddingBottom: insetBottom + 24,
    },

    /* ── Action buttons row ────────────────────────────────────── */
    actionRow: {
      marginBottom: 16,
    },
    actionRowContent: {
      flexDirection: 'row',
      gap: 10,
      paddingRight: 16,
    },
    actionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    actionChipPrimary: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    actionChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    actionChipTextPrimary: {
      color: '#fff',
    },

    /* ── Overview card ─────────────────────────────────────────── */
    overviewCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    overviewTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    overviewTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.text,
    },
    editToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    editToggleBtnActive: {
      backgroundColor: theme.primary,
    },
    editToggleText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: '600',
    },
    editToggleTextActive: {
      color: '#fff',
    },

    /* ── Vision quote box ──────────────────────────────────────── */
    visionQuoteBox: {
      backgroundColor: `${theme.primary}10`,
      borderLeftWidth: 4,
      borderLeftColor: theme.primary,
      borderRadius: 10,
      padding: 14,
      marginBottom: 16,
      marginTop: 8,
    },
    visionQuoteText: {
      fontSize: 15,
      color: theme.textSecondary,
      fontStyle: 'italic',
      lineHeight: 22,
    },
    visionInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 10,
      fontSize: 14,
      color: theme.text,
      backgroundColor: theme.background,
      marginBottom: 12,
      minHeight: 60,
    },

    /* ── At-a-glance row ───────────────────────────────────────── */
    glanceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    glancePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.background,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    glancePillText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },

    /* ── Stats row ─────────────────────────────────────────────── */
    overviewStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 16,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    overviewStat: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.primary,
    },
    statLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },

    /* ── Budget row ────────────────────────────────────────────── */
    budgetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    budgetText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    budgetInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      fontSize: 14,
      color: theme.text,
      backgroundColor: theme.background,
      marginLeft: 8,
    },

    /* ── Tab selector ──────────────────────────────────────────── */
    tabRow: {
      flexDirection: 'row',
      gap: 0,
      marginBottom: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
    },
    tabBtnActive: {
      backgroundColor: `${theme.primary}22`,
    },
    tabBtnText: {
      color: theme.textSecondary,
      fontWeight: '600',
      fontSize: 13,
    },
    tabBtnTextActive: {
      color: theme.primary,
    },

    /* ── Goals card ────────────────────────────────────────────── */
    goalsCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    goalsTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    goalsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    addBtnText: {
      fontSize: 13,
      color: theme.primary,
      fontWeight: '600',
    },
    goalItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 10,
    },
    goalNumberBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#10B981',
      alignItems: 'center',
      justifyContent: 'center',
    },
    goalNumberText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    goalText: {
      flex: 1,
      fontSize: 15,
      color: theme.text,
      lineHeight: 20,
    },
    goalInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 14,
      color: theme.text,
      backgroundColor: theme.background,
    },

    /* ── Upcoming Alerts ──────────────────────────────────────── */
    alertsCard: {
      backgroundColor: `${theme.primary}08`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: `${theme.primary}22`,
    },
    alertsTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 10,
    },
    alertRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: `${theme.border}66`,
    },
    alertIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    alertContent: { flex: 1 },
    alertTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    alertMeta: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 2,
    },

    /* ── Monthly grid (compact, expandable) ────────────────────── */
    termsHeader: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 12,
      marginTop: 4,
    },
    monthlyGrid: {
      gap: 10,
      marginBottom: 14,
    },
    monthlyGridCompact: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    monthTileWrapper: {
      width: '31%',
      minWidth: 100,
    },
    monthTile: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
    },
    monthTileExpanded: {
      borderColor: theme.primary,
      borderWidth: 2,
    },
    monthTileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    monthTileTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },
    monthTileBadge: {
      backgroundColor: 'rgba(255,255,255,0.4)',
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    monthTileBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#fff',
    },
    monthTileBody: {
      padding: 10,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    monthTileChevron: {
      alignItems: 'center',
      paddingVertical: 4,
    },
    monthCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
    },
    monthCardHeader: {
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    monthTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
    monthCardBody: {
      padding: 12,
      gap: 8,
    },
    monthBucket: {
      gap: 2,
    },
    monthBucketLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    monthItemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 4,
    },
    monthItem: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 18,
      flex: 1,
    },
    monthItemHoliday: {
      fontSize: 12,
      lineHeight: 18,
      flex: 1,
      color: '#10B981',
      fontWeight: '500',
    },
    monthItemFundraiser: {
      fontSize: 12,
      lineHeight: 18,
      flex: 1,
      color: '#F59E0B',
      fontWeight: '500',
    },
    monthItemEmpty: {
      fontSize: 12,
      color: `${theme.textSecondary}66`,
      lineHeight: 18,
    },
    monthBucketRow: {
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    monthBucketRowAlt: {
      backgroundColor: `${theme.background}80`,
      borderRadius: 6,
    },

    /* ── Bottom action buttons ─────────────────────────────────── */
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
  });

export const MONTH_COLORS = [
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#10B981', '#14B8A6', '#06B6D4', '#3B82F6',
];
