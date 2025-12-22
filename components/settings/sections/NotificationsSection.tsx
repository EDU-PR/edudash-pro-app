import React from 'react';
import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import type { ViewStyle, TextStyle } from 'react-native';

interface NotificationsSectionProps {
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  onHapticsChange: (value: boolean) => void;
  onSoundChange: (value: boolean) => void;
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

export function NotificationsSection({
  hapticsEnabled,
  soundEnabled,
  onHapticsChange,
  onSoundChange,
  styles,
}: NotificationsSectionProps) {
  const { theme } = useTheme();
  const { t } = useTranslation('common');

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>
      
      <View style={styles.settingsCard}>
        {/* Haptic feedback */}
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="pulse" size={24} color={theme.textSecondary} style={styles.settingIcon} />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.feedback.vibration_title')}</Text>
              <Text style={styles.settingSubtitle}>{t('settings.feedback.vibration_subtitle')}</Text>
            </View>
          </View>
          <Switch
            value={hapticsEnabled}
            onValueChange={onHapticsChange}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={hapticsEnabled ? theme.onPrimary : theme.textTertiary}
          />
        </View>

        {/* Sound alerts */}
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Ionicons name="volume-high" size={24} color={theme.textSecondary} style={styles.settingIcon} />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.feedback.sound_title')}</Text>
              <Text style={styles.settingSubtitle}>{t('settings.feedback.sound_subtitle')}</Text>
            </View>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={onSoundChange}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={soundEnabled ? theme.onPrimary : theme.textTertiary}
          />
        </View>

        {/* Advanced Sound Alert Settings */}
        <View style={[styles.settingItem, styles.lastSettingItem]}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            onPress={() => router.push('/screens/sound-alert-settings')}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="musical-notes" size={24} color={theme.textSecondary} style={styles.settingIcon} />
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{t('settings.feedback.advanced_sound_title')}</Text>
                <Text style={styles.settingSubtitle}>{t('settings.feedback.advanced_sound_subtitle')}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
