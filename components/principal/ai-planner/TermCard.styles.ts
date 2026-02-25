// Styles for TermCard component - Extracted for WARP.md compliance

import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/contexts/ThemeContext';

export const MEETING_TYPE_COLORS: Record<string, string> = {
  staff: '#3B82F6',
  parent: '#10B981',
  curriculum: '#8B5CF6',
  safety: '#EF4444',
  budget: '#F59E0B',
  training: '#06B6D4',
  one_on_one: '#EC4899',
  other: '#6B7280',
};

export const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    termCard: {
      backgroundColor: theme.card,
      borderRadius: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    termHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    termHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      flex: 1,
    },
    termBadge: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    termBadgeText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    termName: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
    },
    termDates: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    inlineInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 14,
      color: theme.text,
      backgroundColor: theme.background,
    },
    termContent: {
      padding: 16,
      paddingTop: 0,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    termSection: {
      marginTop: 16,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 15,
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
    editRowWithDelete: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },

    /* ── Weekly themes table ───────────────────────────────────── */
    weekItem: {
      flexDirection: 'row',
      marginBottom: 2,
      alignItems: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    weekItemAlt: {
      backgroundColor: `${theme.background}80`,
    },
    weekNumber: {
      width: 36,
      height: 28,
      borderRadius: 6,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
      flexShrink: 0,
    },
    weekNumberText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    weekDateRange: {
      fontSize: 11,
      color: theme.textSecondary,
      marginBottom: 2,
    },
    weekContent: {
      flex: 1,
    },
    weekTheme: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    weekDescription: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    weekActivities: {
      fontSize: 12,
      color: theme.primary,
      marginTop: 2,
    },
    moreItems: {
      fontSize: 13,
      color: theme.primary,
      fontStyle: 'italic',
      marginTop: 4,
    },
    emptyHint: {
      fontSize: 13,
      color: theme.textSecondary,
      fontStyle: 'italic',
    },

    /* ── Excursions ────────────────────────────────────────────── */
    excursionItem: {
      backgroundColor: theme.background,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    excursionIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#10B98120',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    excursionContent: {
      flex: 1,
    },
    excursionTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    excursionDetail: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    excursionMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    dateBadge: {
      backgroundColor: `${theme.primary}15`,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    dateBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.primary,
    },
    costTag: {
      backgroundColor: '#10B98120',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    costTagText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#10B981',
    },

    /* ── Meetings ──────────────────────────────────────────────── */
    meetingItem: {
      backgroundColor: theme.background,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    meetingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    meetingTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
      flex: 1,
    },
    meetingTypeBadge: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    meetingTypeBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: '#fff',
      textTransform: 'capitalize',
    },
    meetingDate: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 4,
    },
    typeChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 6,
      marginBottom: 4,
    },
    typeChipActive: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}22`,
    },
    typeChipText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    typeChipTextActive: {
      color: theme.primary,
      fontWeight: '600',
    },

    /* ── Special events ────────────────────────────────────────── */
    eventItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    eventText: {
      fontSize: 14,
      color: theme.text,
    },
  });
