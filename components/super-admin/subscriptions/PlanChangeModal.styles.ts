import { StyleSheet } from 'react-native';

export interface PlanChangeTheme {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  onPrimary: string;
  border: string;
}

export function createStyles(_theme: PlanChangeTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
    },
    backButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    backButtonText: {
      fontWeight: '700',
      fontSize: 14,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      flex: 1,
      textAlign: 'center',
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      padding: 16,
    },
    summaryCard: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 16,
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 8,
    },
    summaryText: {
      fontSize: 14,
      marginBottom: 4,
    },
    summaryPrice: {
      fontSize: 16,
      fontWeight: '700',
      marginTop: 4,
    },
    billingNote: {
      fontSize: 12,
      fontStyle: 'italic',
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
      marginTop: 16,
    },
    sectionSubtitle: {
      fontSize: 12,
      fontStyle: 'italic',
      marginBottom: 12,
    },
    loadingContainer: {
      alignItems: 'center',
      padding: 32,
    },
    loadingText: {
      marginTop: 8,
      fontSize: 14,
    },
    planOption: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 12,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    planTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    planEmoji: {
      fontSize: 20,
      marginRight: 8,
    },
    planTitleText: {
      flex: 1,
    },
    planName: {
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 2,
    },
    planTierLabel: {
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    priceContainer: {
      alignItems: 'flex-end',
    },
    planPrice: {
      fontSize: 18,
      fontWeight: '700',
    },
    priceFrequency: {
      fontSize: 12,
      marginTop: -2,
    },
    planDetails: {
      fontSize: 14,
      marginBottom: 4,
    },
    planId: {
      fontSize: 12,
    },
    billingRow: {
      flexDirection: 'row',
      gap: 12,
    },
    billingOption: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
    },
    billingOptionText: {
      fontSize: 14,
      fontWeight: '600',
    },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
    },
    reasonInput: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    footer: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
      borderTopWidth: 1,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    confirmButton: {
      flex: 2,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonIcon: {
      fontSize: 16,
      marginRight: 8,
      color: '#ffffff',
    },
    successIcon: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 12,
      padding: 4,
      marginRight: 8,
    },
    errorIcon: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      borderRadius: 12,
      padding: 4,
      marginRight: 8,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: '700',
    },
    summaryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    upgradeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    upgradeBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    downgradeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    downgradeBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    changeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    changeLabel: {
      fontSize: 12,
      fontWeight: '600',
      width: 60,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      paddingTop: 8,
      marginTop: 8,
    },
    priceIncrease: {
      fontSize: 14,
      fontWeight: '700',
    },
    paymentNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      marginTop: 12,
    },
    paymentIcon: {
      fontSize: 16,
      marginRight: 8,
    },
  });
}
