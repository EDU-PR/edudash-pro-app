import { StyleSheet } from 'react-native';

/**
 * Main layout styles for PrincipalDashboardV2 (header, scroll, section blocks).
 */
export const createStyles = (theme: any, insetTop: number, insetBottom: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: {
      paddingTop: insetTop + 12,
      paddingBottom: Math.max(insetBottom, 8),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 6,
    },
    headerLeft: { flex: 1 },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    greeting: { fontSize: 18, fontWeight: '800', color: theme.text },
    headerMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    schoolName: { fontSize: 14, fontWeight: '800', color: theme.textSecondary },
    manageButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    manageButtonText: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.primary,
    },
    updatedAt: { fontSize: 11, color: theme.textTertiary, marginTop: 4 },
    layoutControlsWrap: {
      marginTop: 8,
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    layoutControlsTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textSecondary,
      marginBottom: 8,
    },
    layoutControlsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    layoutControlButton: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.primary + '55',
      backgroundColor: theme.primary + '14',
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    layoutControlButtonDisabled: {
      opacity: 0.5,
    },
    layoutControlButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
    },
    sectionBlock: {
      paddingHorizontal: 16,
      marginTop: 4,
    },
    sectionBody: {
      paddingTop: 12,
      gap: 12,
    },
    loadingText: { textAlign: 'center', color: theme.textSecondary, marginTop: 8 },
  });

/**
 * Shared styles used by section components (DailyOps, AdmissionsCashflow, LearnersSection).
 * Call once per render with the current theme.
 */
export const createSectionStyles = (theme: any) =>
  StyleSheet.create({
    sectionBody: {
      paddingTop: 12,
      gap: 12,
    },
    sectionDescriptor: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.textSecondary,
      paddingHorizontal: 2,
    },
    card: {
      padding: 14,
      borderRadius: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inlineSectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 10,
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    linkText: {
      color: theme.primary,
      fontWeight: '700',
      fontSize: 12,
    },
    metricGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      marginBottom: 4,
    },
    progressLabel: { fontSize: 12, color: theme.textSecondary },
    progressValue: { fontSize: 12, color: theme.textSecondary },
    uniformNote: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 10,
      lineHeight: 18,
    },
    uniformBreakdownRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    uniformStatusPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    uniformPaidPill: {
      backgroundColor: theme.success + '1c',
      borderColor: theme.success + '44',
    },
    uniformPendingPill: {
      backgroundColor: theme.warning + '1c',
      borderColor: theme.warning + '44',
    },
    uniformUnpaidPill: {
      backgroundColor: theme.error + '1c',
      borderColor: theme.error + '44',
    },
    uniformStatusPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.text,
    },
    uniformActionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
    },
    uniformActionButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.primary + '55',
      backgroundColor: theme.primary + '12',
      opacity: 1,
    },
    uniformActionPrimary: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    uniformActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
    },
    uniformActionPrimaryText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#fff',
    },
    loadingText: { textAlign: 'center', color: theme.textSecondary, marginTop: 8 },
    emptyText: { textAlign: 'center', color: theme.textSecondary, marginVertical: 8 },
  });
