import React from 'react';
import { View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ViewStyle, TextStyle } from 'react-native';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  biometricSupported: boolean;
  biometricEnrolled: boolean;
  biometricEnabled: boolean;
  themeMode: 'light' | 'dark' | 'system';
  onToggleBiometric: () => void;
  onOpenThemeSettings: () => void;
  theme: {
    text: string;
    textSecondary: string;
    textDisabled: string;
    primary: string;
    success: string;
    modalOverlay: string;
    modalBackground: string;
    divider: string;
  };
  styles: {
    modalOverlay: ViewStyle;
    modalContent: ViewStyle;
    modalHeader: ViewStyle;
    modalTitle: TextStyle;
    settingItem: ViewStyle;
    settingLeft: ViewStyle;
    settingText: ViewStyle;
    settingTitle: TextStyle;
    settingSubtitle: TextStyle;
  };
}

export function SettingsModal({
  visible,
  onClose,
  biometricSupported,
  biometricEnrolled,
  biometricEnabled,
  themeMode,
  onToggleBiometric,
  onOpenThemeSettings,
  theme,
  styles,
}: SettingsModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('navigation.settings')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Biometric Setting */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={biometricSupported ? onToggleBiometric : () => {
              Alert.alert(
                t('settings.biometric.title', { defaultValue: 'Biometric Authentication' }),
                t('settings.biometric.not_available_desc', { defaultValue: 'Biometric authentication is not available on this device.' }),
                [{ text: t('common.ok', { defaultValue: 'OK' }) }]
              );
            }}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name={biometricEnabled ? "finger-print" : "finger-print-outline"}
                size={24}
                color={biometricSupported ? (biometricEnabled ? theme.primary : theme.textSecondary) : theme.textDisabled}
              />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>
                  {t('settings.biometric.title', { defaultValue: 'Biometric Authentication' })}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {!biometricSupported 
                    ? t('common.not_available', { defaultValue: 'Not available' }) 
                    : biometricEnabled 
                    ? t('common.enabled', { defaultValue: 'Enabled' }) 
                    : t('common.disabled', { defaultValue: 'Disabled' })}
                </Text>
              </View>
            </View>
            <Ionicons
              name={!biometricSupported ? "information-circle" : biometricEnabled ? "checkmark-circle" : "chevron-forward"}
              size={20}
              color={!biometricSupported ? theme.textDisabled : biometricEnabled ? theme.success : theme.textSecondary}
            />
          </TouchableOpacity>

          {/* Theme & Language Settings */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={onOpenThemeSettings}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="color-palette" size={24} color={theme.primary} />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>{t('settings.theme.title')} & {t('settings.language.title')}</Text>
                <Text style={styles.settingSubtitle}>
                  {themeMode === 'dark' ? t('settings.theme.dark') : themeMode === 'light' ? t('settings.theme.light') : t('settings.theme.system')}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() =>
              Alert.alert(
                t('common.coming_soon', { defaultValue: 'Coming Soon' }),
                t('settings.notifications_coming_soon_desc', { defaultValue: 'Notification settings will be available in the next update.' }),
              )
            }
          >
            <View style={styles.settingLeft}>
              <Ionicons name="notifications" size={24} color={theme.textSecondary} />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>{t('settings.notifications', { defaultValue: 'Notifications' })}</Text>
                <Text style={styles.settingSubtitle}>{t('settings.manage_alerts', { defaultValue: 'Manage your alerts' })}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          {/* Privacy & Security */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() =>
              Alert.alert(
                "Privacy & Security",
                "Your data is encrypted and stored securely. Biometric data never leaves your device.",
              )
            }
          >
            <View style={styles.settingLeft}>
              <Ionicons name="lock-closed" size={24} color={theme.textSecondary} />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>{t('settings.privacy_security.title', { defaultValue: 'Privacy & Security' })}</Text>
                <Text style={styles.settingSubtitle}>
                  {t('settings.privacy_security.info', { defaultValue: 'Data protection info' })}
                </Text>
              </View>
            </View>
            <Ionicons name="information-circle" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
