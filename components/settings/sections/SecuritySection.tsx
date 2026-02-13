import React from 'react';
import { View, Text, TouchableOpacity, Switch, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';
import type { ViewStyle, TextStyle } from 'react-native';

interface BiometricState {
  supported: boolean;
  enrolled: boolean;
  enabled: boolean;
  types: string[];
  lastUsed: string | null;
  hasBackupMethods: boolean;
}

interface SecuritySectionProps {
  biometric: BiometricState;
  onToggleBiometric: () => void;
  onChangePassword?: () => void;
  onChangeEmail?: () => void;
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
    settingRight: ViewStyle;
    biometricInfo: ViewStyle;
    biometricInfoText: TextStyle;
  };
}

export function SecuritySection({
  biometric,
  onToggleBiometric,
  onChangePassword,
  onChangeEmail,
  styles,
}: SecuritySectionProps) {
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const { showAlert, alertProps } = useAlertModal();

  const getBiometricStatusText = () => {
    if (!biometric.supported) return t('settings.biometric.notAvailable');
    if (!biometric.enrolled) return t('settings.biometric.setupRequired');
    if (biometric.enabled && biometric.types.length > 0) {
      return `${t('settings.biometric.enabled')} (${biometric.types.join(', ')})`;
    }
    return biometric.enabled ? t('settings.biometric.enabled') : t('settings.biometric.disabled');
  };

  const getBiometricIcon = (): keyof typeof Ionicons.glyphMap => {
    if (!biometric.supported) return 'finger-print-outline';
    if (biometric.types.includes('Fingerprint')) {
      return biometric.enabled ? 'finger-print' : 'finger-print-outline';
    } else if (biometric.types.includes('Face ID')) {
      return biometric.enabled ? 'scan' : 'scan-outline';
    } else if (biometric.types.includes('Iris Scan')) {
      return biometric.enabled ? 'eye' : 'eye-outline';
    }
    return biometric.enabled ? 'finger-print' : 'finger-print-outline';
  };

  const getBiometricIconColor = () => {
    if (!biometric.supported) return theme.textDisabled;
    return biometric.enabled ? theme.success : theme.textSecondary;
  };

  const getBiometricTitle = () => {
    if (biometric.types.length > 0) {
      if (biometric.types.includes('Fingerprint')) return t('settings.biometric.fingerprint');
      if (biometric.types.includes('Face ID')) return t('settings.biometric.faceId');
      if (biometric.types.includes('Iris Scan')) return t('settings.biometric.title');
      return t('settings.biometric.title');
    }
    return t('settings.biometric.title');
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.securityPrivacy')}</Text>
      
      <View style={styles.settingsCard}>
        {/* Biometric Authentication */}
        <TouchableOpacity
          style={[styles.settingItem]}
          onPress={() => {
            if (biometric.supported && biometric.enrolled) {
              onToggleBiometric();
            } else if (!biometric.supported) {
              showAlert({
                title: t('settings.biometric.title'),
                message: t('settings.biometric.notAvailable'),
                type: 'info',
                icon: 'information-circle',
                buttons: [{ text: t('common.ok') }],
              });
            } else {
              // supported but not enrolled
              showAlert({
                title: t('settings.biometric.title'),
                message: t('settings.biometric.setupRequired'),
                type: 'warning',
                icon: 'settings-outline',
                buttons: [{ text: t('common.ok') }],
              });
            }
          }}
        >
          <View style={styles.settingLeft}>
            <Ionicons
              name={getBiometricIcon()}
              size={24}
              color={getBiometricIconColor()}
              style={styles.settingIcon}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{getBiometricTitle()}</Text>
              <Text style={styles.settingSubtitle}>
                {getBiometricStatusText()}
              </Text>
              {biometric.enabled && biometric.lastUsed && (
                <Text style={[styles.settingSubtitle, { fontSize: 12, marginTop: 2 }]}>
                  {t('settings.biometric_info.last_used', { date: new Date(biometric.lastUsed).toLocaleDateString() })}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.settingRight}>
            {biometric.supported && biometric.enrolled ? (
              <Switch
                value={biometric.enabled}
                onValueChange={onToggleBiometric}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={biometric.enabled ? theme.onPrimary : theme.textTertiary}
              />
            ) : biometric.supported && !biometric.enrolled ? (
              <TouchableOpacity onPress={() => {
                showAlert({
                  title: t('settings.biometric_alerts.setup_required_title'),
                  message: t('settings.biometric_alerts.setup_required_message'),
                  type: 'warning',
                  icon: 'settings-outline',
                  buttons: [{ text: t('common.ok') }],
                });
              }}>
                <Ionicons
                  name="settings"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            ) : (
              <Ionicons
                name="information-circle"
                size={20}
                color={theme.textDisabled}
              />
            )}
          </View>
        </TouchableOpacity>

        {/* Change Password */}
        {onChangePassword && (
          <TouchableOpacity style={styles.settingItem} onPress={onChangePassword}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="lock-closed-outline"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('account.change_password_title', { defaultValue: 'Change Password' })}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {t('account.change_password_subtitle', { defaultValue: 'Update your sign-in password' })}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Change Email */}
        {onChangeEmail && (
          <TouchableOpacity style={styles.settingItem} onPress={onChangeEmail}>
            <View style={styles.settingLeft}>
              <Ionicons
                name="mail-outline"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>
                  {t('account.change_email_title', { defaultValue: 'Change Email' })}
                </Text>
                <Text style={styles.settingSubtitle}>
                  {t('account.change_email_subtitle', { defaultValue: 'Update the email you use to sign in' })}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Privacy & Data Protection */}
        <TouchableOpacity
          style={styles.settingItem}
          onPress={() =>
            showAlert({
              title: t('settings.privacy_alert.title'),
              message: t('settings.privacy_alert.message'),
              type: 'info',
              icon: 'shield-checkmark',
              buttons: [{ text: t('common.ok') }],
            })
          }
        >
          <View style={styles.settingLeft}>
            <Ionicons
              name="lock-closed"
              size={24}
              color={theme.textSecondary}
              style={styles.settingIcon}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{t('settings.dataProtection')}</Text>
              <Text style={styles.settingSubtitle}>
                {t('settings.learnDataProtection')}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </TouchableOpacity>

        {/* Request Data Deletion */}
        <TouchableOpacity
          style={[styles.settingItem, styles.lastSettingItem]}
          onPress={() =>
            Linking.openURL('https://edudashpro.org.za/data-deletion')
          }
        >
          <View style={styles.settingLeft}>
            <Ionicons
              name="trash-outline"
              size={24}
              color={theme.error || '#ff4444'}
              style={styles.settingIcon}
            />
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, { color: theme.error || '#ff4444' }]}>
                {t('settings.requestDataDeletion', { defaultValue: 'Request Data Deletion' })}
              </Text>
              <Text style={styles.settingSubtitle}>
                {t('settings.requestDataDeletionSubtitle', { defaultValue: 'GDPR/POPIA compliant data removal' })}
              </Text>
            </View>
          </View>
          <Ionicons name="open-outline" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Biometric Info Card */}
      {biometric.supported && (
        <View style={styles.biometricInfo}>
          <Text style={styles.biometricInfoText}>
            🔒 {t('settings.biometric_info.data_local')}
            {biometric.types.length > 0 && (
              biometric.types.includes('Fingerprint') 
                ? ' ' + t('settings.biometric_info.fingerprint_secure')
                : biometric.types.includes('Face ID')
                ? ' ' + t('settings.biometric_info.face_secure')
                : ' ' + t('settings.biometric_info.available_methods', { methods: biometric.types.join(', ') })
            )}
            {biometric.hasBackupMethods && ' ' + t('settings.biometric_info.backup_available')}
            {biometric.enabled && biometric.lastUsed && (
              ' ' + t('settings.biometric_info.last_authenticated', { date: new Date(biometric.lastUsed).toLocaleDateString() })
            )}
          </Text>
        </View>
      )}

      <AlertModal {...alertProps} />
    </View>
  );
}
