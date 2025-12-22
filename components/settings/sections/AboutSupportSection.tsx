import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import type { ViewStyle, TextStyle } from 'react-native';

interface AboutSupportSectionProps {
  styles: {
    section: ViewStyle;
    sectionTitle: TextStyle;
    settingsCard: ViewStyle;
    settingItem: ViewStyle;
    lastSettingItem: ViewStyle;
    settingLeft: ViewStyle;
    settingIcon: ViewStyle;
    settingContent: ViewStyle;
    settingTitle: TextStyle;
    settingSubtitle: TextStyle;
  };
}

export function AboutSupportSection({ styles }: AboutSupportSectionProps) {
  const { theme } = useTheme();
  const { t } = useTranslation('common');

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.aboutSupport')}</Text>
      
      <View style={styles.settingsCard}>
        <TouchableOpacity
          style={[styles.settingItem]}
          onPress={() =>
            Alert.alert(
              t('settings.about_alert.title'),
              t('settings.about_alert.message'),
              [{ text: t('common.ok') }]
            )
          }
        >
          <View style={styles.settingLeft}>
            <Ionicons
              name="information-circle"
              size={24}
              color={theme.textSecondary}
              style={styles.settingIcon}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.about_app.title')}</Text>
              <Text style={styles.settingSubtitle}>{t('settings.about_app.subtitle')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingItem]}
          onPress={() =>
            Alert.alert(
              t('settings.help_alert.title'),
              t('settings.help_alert.message'),
              [{ text: t('common.ok') }]
            )
          }
        >
          <View style={styles.settingLeft}>
            <Ionicons
              name="help-circle"
              size={24}
              color={theme.textSecondary}
              style={styles.settingIcon}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.help_support.title')}</Text>
              <Text style={styles.settingSubtitle}>{t('settings.help_support.subtitle')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingItem, styles.lastSettingItem]}
          onPress={() => router.push('/screens/account')}
        >
          <View style={styles.settingLeft}>
            <Ionicons
              name="person-circle"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.account_settings.title')}</Text>
              <Text style={styles.settingSubtitle}>{t('settings.account_settings.subtitle')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
