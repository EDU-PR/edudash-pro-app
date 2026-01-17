// Banner displayed when no active subscription exists

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface NoSubscriptionBannerProps {
  onStartFreeTrial: () => Promise<void>;
  theme: any;
  isDark: boolean;
}

export function NoSubscriptionBanner({ onStartFreeTrial, theme, isDark }: NoSubscriptionBannerProps) {
  const { t } = useTranslation();
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  return (
    <View style={styles.bannerCard}>
      <Text style={styles.bannerTitle}>
        {t('seat_management.no_subscription_title', { defaultValue: 'No Active Subscription' })}
      </Text>
      <Text style={styles.bannerText}>
        {t('seat_management.no_subscription_text', {
          defaultValue: 'No active subscription found for this school.',
        })}
      </Text>
      <Text style={styles.bannerSubtext}>
        {t('seat_management.free_trial_hint', {
          defaultValue:
            'You can start a free 14-day trial with limited seats. You can assign or revoke seats anytime.',
        })}
      </Text>
      <View style={styles.contactButtonsRow}>
        <TouchableOpacity style={[styles.contactBtn, styles.contactBtnPrimary]} onPress={onStartFreeTrial}>
          <Ionicons name="flash" size={16} color={theme.onPrimary} />
          <Text style={styles.contactBtnText}>
            {t('seat_management.start_free_trial', { defaultValue: 'Start Free Trial (14 days)' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) =>
  StyleSheet.create({
    bannerCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.warning,
    },
    bannerTitle: {
      color: theme.warning,
      fontWeight: '800',
      fontSize: 16,
      marginBottom: 8,
    },
    bannerText: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 8,
    },
    bannerSubtext: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      fontStyle: 'italic',
    },
    contactButtonsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    contactBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
    },
    contactBtnPrimary: {
      backgroundColor: theme.primary,
    },
    contactBtnText: {
      color: theme.onPrimary,
      fontWeight: '800',
    },
  });
