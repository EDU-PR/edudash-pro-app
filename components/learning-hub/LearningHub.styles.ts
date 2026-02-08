/**
 * LearningHub Styles — Extracted per WARP.md standards
 * 
 * Dynamic StyleSheet factory for the Learning Hub screen.
 * Accepts theme and insets for responsive design.
 */

import { StyleSheet } from 'react-native';

export const createLearningHubStyles = (theme: any, topInset: number, bottomInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      paddingTop: topInset + 16,
      paddingHorizontal: 16,
      paddingBottom: bottomInset + 40,
      gap: 16,
    },
    header: {
      gap: 6,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingText: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.text,
    },
    // ─── Info Card ────────────────────────────────────────
    infoCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
    },
    infoTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.text,
    },
    infoText: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.textSecondary,
    },
    // ─── Usage Card ──────────────────────────────────────
    usageCard: {
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
    },
    usageRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 2,
    },
    usageLabel: {
      fontSize: 14,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    usageValue: {
      fontSize: 14,
      color: theme.text,
      fontWeight: '700',
    },
    usageBar: {
      height: 7,
      backgroundColor: theme.elevated,
      borderRadius: 999,
      overflow: 'hidden',
      marginBottom: 4,
    },
    usageFill: {
      height: 7,
      backgroundColor: theme.primary,
    },
    // ─── Activity Card ───────────────────────────────────
    activityCard: {
      borderRadius: 18,
      overflow: 'hidden',
      elevation: 3,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.14,
      shadowRadius: 6,
    },
    activityGradient: {
      padding: 16,
      gap: 12,
    },
    activityHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },
    activityTitleBlock: {
      flex: 1,
      gap: 4,
    },
    activityTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#fff',
    },
    activitySubtitle: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.88)',
    },
    durationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    durationText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    lockBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    lockBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    tag: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    tagText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    startRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    startText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.surface,
    },
    refreshText: {
      fontSize: 13,
      fontWeight: '700',
    },
    // ─── Modal ───────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalCard: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      gap: 12,
      maxHeight: '92%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.text,
      flex: 1,
    },
    modalSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    modalProgressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: theme.elevated,
      overflow: 'hidden',
    },
    modalProgressFill: {
      height: 8,
      backgroundColor: theme.primary,
    },
    stepTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.text,
    },
    stepPrompt: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.textSecondary,
    },
    // ─── Path Board ──────────────────────────────────────
    boardCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 12,
      backgroundColor: theme.background,
      gap: 8,
    },
    boardTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.text,
    },
    boardLegend: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    boardGrid: {
      gap: 6,
      alignSelf: 'center',
      marginTop: 4,
      marginBottom: 2,
    },
    boardRow: {
      flexDirection: 'row',
      gap: 6,
    },
    boardCell: {
      width: 56,
      height: 56,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boardGlyph: {
      fontSize: 22,
    },
    boardTrail: {
      position: 'absolute',
      bottom: 4,
      right: 6,
      fontSize: 10,
      color: theme.textSecondary,
      fontWeight: '700',
    },
    // ─── Preview Card ────────────────────────────────────
    previewCard: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 10,
      gap: 4,
    },
    previewCardSuccess: {
      backgroundColor: '#DCFCE7',
      borderColor: '#16A34A',
    },
    previewCardError: {
      backgroundColor: '#FEE2E2',
      borderColor: '#DC2626',
    },
    previewTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: '#1F2937',
    },
    previewSequence: {
      fontSize: 14,
      fontWeight: '800',
      color: '#1F2937',
    },
    previewText: {
      fontSize: 12,
      lineHeight: 17,
      color: '#374151',
    },
    // ─── Options ─────────────────────────────────────────
    optionsList: {
      gap: 8,
      marginTop: 2,
    },
    optionChip: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.elevated,
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    optionChipActive: {
      borderColor: theme.primary,
      backgroundColor: `${theme.primary}22`,
    },
    optionBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: `${theme.primary}22`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionBadgeText: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    optionText: {
      flex: 1,
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    optionTextActive: {
      color: theme.primary,
    },
    // ─── Feedback ────────────────────────────────────────
    feedbackCard: {
      borderRadius: 10,
      borderWidth: 1,
      padding: 10,
      marginTop: 2,
    },
    feedbackInfo: {
      borderColor: theme.border,
      backgroundColor: theme.elevated,
    },
    feedbackSuccess: {
      borderColor: '#16A34A',
      backgroundColor: '#DCFCE7',
    },
    feedbackError: {
      borderColor: '#DC2626',
      backgroundColor: '#FEE2E2',
    },
    feedbackText: {
      color: '#1F2937',
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '700',
    },
    // ─── Buttons ─────────────────────────────────────────
    aiHintButton: {
      borderRadius: 12,
      backgroundColor: theme.primary,
      paddingVertical: 11,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    aiHintText: {
      color: theme.onPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    nextButton: {
      borderRadius: 12,
      backgroundColor: theme.success,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextButtonDisabled: {
      opacity: 0.7,
    },
    nextButtonText: {
      color: theme.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
  });
