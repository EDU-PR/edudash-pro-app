import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/components/ui/StyledAlert';
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
}

export function FeedbackTestSection({ styles }: FeedbackTestSectionProps) {
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const alert = useAlert();

  return (
    <View style={styles.section}>
      <View style={styles.settingsCard}>
        <TouchableOpacity
          style={[styles.settingItem, styles.lastSettingItem]}
          onPress={() => {
            alert.showWarning(
              t('settings.feedback_test_alert.title', { defaultValue: 'Feedback' }), 
              t('settings.feedback_test_alert.message', { defaultValue: 'Haptics and sound feedback are temporarily disabled.' })
            );
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
