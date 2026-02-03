import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/components/ui/StyledAlert';
import * as Haptics from 'expo-haptics';
import { sendTestNotification } from '@/lib/notification-test-utils';
import type { ViewStyle, TextStyle } from 'react-native';

interface FeedbackTestSectionProps {
  styles: {
    section: ViewStyle;
    settingsCard: ViewStyle;
    settingItem: ViewStyle;
    lastSettingItem: ViewStyle;
    settingLeft: ViewStyle;
    settingIcon: ViewStyle;
    settingContent: ViewStyle;
    settingTitle: TextStyle;
    settingSubtitle: TextStyle;
  };
  hapticsEnabled?: boolean;
  soundEnabled?: boolean;
}

export function FeedbackTestSection({
  styles,
  hapticsEnabled = true,
  soundEnabled = true,
}: FeedbackTestSectionProps) {
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const alert = useAlert();

  return (
    <View style={styles.section}>
      <View style={styles.settingsCard}>
        <TouchableOpacity
          style={[styles.settingItem, styles.lastSettingItem]}
          onPress={async () => {
            if (!hapticsEnabled && !soundEnabled) {
              alert.showWarning(
                t('settings.feedback_test_alert.title', { defaultValue: 'Feedback' }),
                t('settings.feedback_test_alert.message', { defaultValue: 'Haptics and sound feedback are disabled in your settings.' })
              );
              return;
            }

            try {
              if (hapticsEnabled) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch {
              // Non-fatal: device may not support haptics
            }

            try {
              if (soundEnabled) {
                await sendTestNotification({
                  title: t('settings.feedback_test_alert.title', { defaultValue: 'Feedback' }),
                  body: t('settings.feedback_test_alert.message', { defaultValue: 'Test sound played.' }),
                  sound: true,
                });
              }
            } catch (err) {
              console.warn('[FeedbackTest] Failed to play sound test:', err);
              if (Platform.OS === 'web') {
                alert.show(
                  t('settings.feedback_test_alert.title', { defaultValue: 'Feedback' }),
                  t('settings.feedback_test_alert.message', { defaultValue: 'Sound test is not available on web. Please test on the mobile app.' }),
                  [{ text: 'OK' }],
                  { type: 'info' }
                );
              }
            }
          }}
        >
          <View style={styles.settingLeft}>
            <Ionicons name="play" size={24} color={theme.textSecondary} style={styles.settingIcon} />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.feedback.test_title')}</Text>
              <Text style={styles.settingSubtitle}>{t('settings.feedback.test_subtitle')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
