import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ThemeLanguageSettings } from '@/components/settings/ThemeLanguageSettings';
import type { ViewStyle, TextStyle } from 'react-native';

interface ThemeSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  theme: {
    text: string;
    background: string;
    surface: string;
    divider: string;
  };
  styles: {
    themeSettingsModal: ViewStyle;
    themeSettingsHeader: ViewStyle;
    themeSettingsTitle: TextStyle;
  };
}

export function ThemeSettingsModal({
  visible,
  onClose,
  theme,
  styles,
}: ThemeSettingsModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.themeSettingsModal}>
        <View style={styles.themeSettingsHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.themeSettingsTitle}>
            {t('settings.theme.title')} & {t('settings.language.title')}
          </Text>
        </View>
        <ThemeLanguageSettings />
      </View>
    </Modal>
  );
}
