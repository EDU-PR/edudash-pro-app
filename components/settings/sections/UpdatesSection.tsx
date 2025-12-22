import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import Constants from 'expo-constants';
import type { ViewStyle, TextStyle } from 'react-native';

interface UpdatesSectionProps {
  isDownloading: boolean;
  isUpdateDownloaded: boolean;
  updateError: Error | null;
  onCheckForUpdates: () => Promise<boolean>;
  onApplyUpdate: () => Promise<void>;
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

export function UpdatesSection({
  isDownloading,
  isUpdateDownloaded,
  updateError,
  onCheckForUpdates,
  onApplyUpdate,
  styles,
}: UpdatesSectionProps) {
  const { theme } = useTheme();
  const { t } = useTranslation('common');

  // Only show on native platforms
  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.updates.title')}</Text>
      <View style={styles.settingsCard}>
        <TouchableOpacity
          style={[styles.settingItem, styles.lastSettingItem]}
          onPress={async () => {
            if (isUpdateDownloaded) {
              Alert.alert(
                t('updates.Restart App'),
                t('updates.The app will restart to apply the update. Any unsaved changes will be lost.'),
                [
                  { text: t('cancel'), style: 'cancel' },
                  { text: t('updates.Restart Now'), onPress: onApplyUpdate }
                ]
              );
            } else {
              try {
                const downloaded = await onCheckForUpdates();
                Alert.alert(
                  t('settings.updates.title'),
                  downloaded
                    ? t('settings.updates.update_downloaded_message')
                    : t('settings.updates.no_updates_message')
                );
              } catch {
                Alert.alert(t('common.error'), t('settings.updates.check_failed_message'));
              }
            }
          }}
          disabled={isDownloading}
        >
          <View style={styles.settingLeft}>
            <Ionicons
              name="cloud-download"
              size={24}
              color={theme.textSecondary}
              style={styles.settingIcon}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.updates.check_for_updates')}</Text>
              <Text style={styles.settingSubtitle}>
                {isDownloading 
                  ? t('settings.updates.downloading') 
                  : isUpdateDownloaded 
                  ? t('settings.updates.ready_to_install') 
                  : updateError 
                  ? t('settings.updates.check_failed') 
                  : t('settings.updates.current_version', { version: Constants.expoConfig?.version ?? 'n/a' })}
              </Text>
            </View>
          </View>
          {isDownloading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
