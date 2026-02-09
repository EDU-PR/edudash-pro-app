import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { ViewStyle, TextStyle } from 'react-native';
import type { ParentAlertApi } from '@/components/ui/parentAlert';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  biometricSupported: boolean;
  biometricEnrolled: boolean;
  biometricEnabled: boolean;
  themeMode: 'light' | 'dark' | 'system';
  onToggleBiometric: () => void;
  onOpenThemeSettings: () => void;
  onOpenSettings?: () => void;
  onOpenOrgSwitcher?: () => void;
  onOpenChangeEmail?: () => void;
  onOpenChangePassword?: () => void;
  hasMultipleOrgs?: boolean;
  showAlert?: ParentAlertApi;
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
  onOpenSettings,
  onOpenOrgSwitcher,
  onOpenChangeEmail,
  onOpenChangePassword,
  hasMultipleOrgs,
  showAlert,
  theme,
  styles,
}: SettingsModalProps) {
  const { t } = useTranslation();
  const showSettingsAlert = (
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info',
  ) => {
    showAlert?.({
      title,
      message,
      type,
      buttons: [{ text: t('common.ok', { defaultValue: 'OK' }) }],
    });
  };

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
              showSettingsAlert(
                t('settings.biometric.title', { defaultValue: 'Biometric Authentication' }),
                t('settings.biometric.not_available_desc', { defaultValue: 'Biometric authentication is not available on this device.' }),
                'warning',
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

          {/* Organization Switcher - show if callback provided */}
          {onOpenOrgSwitcher && (
            <TouchableOpacity
              style={styles.settingItem}
              onPress={onOpenOrgSwitcher}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="business" size={24} color={theme.primary} />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>
                    {hasMultipleOrgs 
                      ? t('settings.switch_organization', { defaultValue: 'Switch Organization' })
                      : t('settings.my_organizations', { defaultValue: 'My Organizations' })}
                  </Text>
                  <Text style={styles.settingSubtitle}>
                    {hasMultipleOrgs
                      ? t('settings.switch_organization_desc', { defaultValue: 'Switch between schools & organizations' })
                      : t('settings.view_memberships', { defaultValue: 'View your memberships' })}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Full Settings Screen */}
          {onOpenSettings && (
            <TouchableOpacity style={styles.settingItem} onPress={onOpenSettings}>
              <View style={styles.settingLeft}>
                <Ionicons name="settings-outline" size={24} color={theme.primary} />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>
                    {t('settings.open_full_settings', { defaultValue: 'Open Settings' })}
                  </Text>
                  <Text style={styles.settingSubtitle}>
                    {t('settings.open_full_settings_desc', { defaultValue: 'Manage notifications, preferences, billing, and app settings' })}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Change Email */}
          {onOpenChangeEmail && (
            <TouchableOpacity style={styles.settingItem} onPress={onOpenChangeEmail}>
              <View style={styles.settingLeft}>
                <Ionicons name="mail-outline" size={24} color={theme.primary} />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>
                    {t('account.change_email_title', { defaultValue: 'Change Email' })}
                  </Text>
                  <Text style={styles.settingSubtitle}>
                    {t('account.change_email_subtitle', {
                      defaultValue: 'Update the email you use to sign in',
                    })}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Change Password */}
          {onOpenChangePassword && (
            <TouchableOpacity style={styles.settingItem} onPress={onOpenChangePassword}>
              <View style={styles.settingLeft}>
                <Ionicons name="lock-closed-outline" size={24} color={theme.primary} />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>
                    {t('account.change_password_title', { defaultValue: 'Change Password' })}
                  </Text>
                  <Text style={styles.settingSubtitle}>
                    {t('account.change_password_subtitle', {
                      defaultValue: 'Update the password you use to sign in',
                    })}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Notifications */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() =>
              showSettingsAlert(
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
              showSettingsAlert(
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
