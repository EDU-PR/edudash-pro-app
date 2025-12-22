import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import InvoiceNotificationSettings from '@/components/settings/InvoiceNotificationSettings';
import type { ViewStyle, TextStyle } from 'react-native';

interface BillingSectionProps {
  styles: {
    section: ViewStyle;
    sectionTitle: TextStyle;
    settingItem: ViewStyle;
    lastSettingItem: ViewStyle;
    settingLeft: ViewStyle;
    settingIcon: ViewStyle;
    settingContent: ViewStyle;
    settingTitle: TextStyle;
    settingSubtitle: TextStyle;
    divider: ViewStyle;
  };
}

export function BillingSection({ styles }: BillingSectionProps) {
  const { theme } = useTheme();
  const { t } = useTranslation('common');

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.billing.title')}</Text>
      <View style={{ backgroundColor: theme.surface, borderRadius: 12, overflow: 'hidden' }}>
        <InvoiceNotificationSettings />
        <View style={styles.divider} />
        <TouchableOpacity
          style={[styles.settingItem, styles.lastSettingItem]}
          onPress={() => router.push('/screens/manage-subscription')}
        >
          <View style={styles.settingLeft}>
            <Ionicons name="card" size={24} color={theme.textSecondary} style={styles.settingIcon} />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.billing.manage_subscription')}</Text>
              <Text style={styles.settingSubtitle}>{t('settings.billing.manage_subscription_subtitle')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
