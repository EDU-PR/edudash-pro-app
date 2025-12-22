import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack } from 'expo-router';
import { BiometricAuthService } from "@/services/BiometricAuthService";
import { BiometricBackupManager } from "@/lib/BiometricBackupManager";
import { assertSupabase } from "@/lib/supabase";
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import { useThemedStyles, themedStyles, type Theme } from "@/hooks/useThemedStyles";
import { ThemeLanguageSettings } from '@/components/settings/ThemeLanguageSettings';
import { DesktopLayout } from '@/components/layout/DesktopLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolSettings } from '@/lib/hooks/useSchoolSettings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppPreferencesSafe } from '@/contexts/AppPreferencesContext';

// Extracted section components
import {
  SecuritySection,
  NotificationsSection,
  BillingSection,
  UpdatesSection,
  AboutSupportSection,
  SchoolSettingsSection,
  FeedbackTestSection,
} from '@/components/settings/sections';

// App Preferences Section - FAB & Tutorial settings
import { AppPreferencesSection } from '@/components/settings/AppPreferencesSection';

// Safe useUpdates hook that handles missing provider
const useSafeUpdates = () => {
  try {
    const { useUpdates } = require('@/contexts/UpdatesProvider');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useUpdates();
  } catch (error) {
    console.warn('[Settings] UpdatesProvider not available:', error instanceof Error ? error.message : String(error));
    return {
      isDownloading: false,
      isUpdateDownloaded: false,
      updateError: null,
      checkForUpdates: async () => {
        console.log('[Settings] Updates check not available in current environment');
        return false;
      },
      applyUpdate: async () => {
        console.log('[Settings] Update apply not available in current environment');
      },
    };
  }
};

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricTypes, setBiometricTypes] = useState<string[]>([]);
  const [biometricLastUsed, setBiometricLastUsed] = useState<string | null>(null);
  const [hasBackupMethods, setHasBackupMethods] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isDownloading, isUpdateDownloaded, updateError, checkForUpdates, applyUpdate } = useSafeUpdates();
  const schoolId = profile?.organization_id || undefined;
  const schoolSettingsQuery = useSchoolSettings(schoolId);
  
  // Feedback preferences
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const styles = useThemedStyles((theme: Theme) => ({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    section: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600' as const,
      color: theme.text,
      marginBottom: 16,
    },
    settingsCard: {
      ...themedStyles.card(theme),
      padding: 0,
      overflow: 'hidden' as const,
    },
    settingItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider,
    },
    lastSettingItem: {
      borderBottomWidth: 0,
    },
    settingLeft: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      flex: 1,
    },
    settingIcon: {
      marginRight: 16,
    },
    settingContent: {
      flex: 1,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: '500' as const,
      color: theme.text,
      marginBottom: 2,
    },
    settingSubtitle: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    settingRight: {
      marginLeft: 16,
    },
    biometricInfo: {
      backgroundColor: theme.surfaceVariant,
      padding: 12,
      marginTop: 8,
      borderRadius: 8,
    },
    biometricInfoText: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: 40,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.textSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: 8,
    },
    themeSectionContainer: {
      backgroundColor: theme.surface,
      marginHorizontal: 20,
      marginTop: 8,
      borderRadius: 12,
      overflow: 'hidden' as const,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
  }));

  // Load feedback preferences
  const loadFeedbackPrefs = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([
        AsyncStorage.getItem('pref_haptics_enabled'),
        AsyncStorage.getItem('pref_sound_enabled'),
      ]);
      setHapticsEnabled(h !== 'false');
      setSoundEnabled(s !== 'false');
    } catch { /* Storage unavailable */ }
  }, []);

  const saveHapticsPref = async (val: boolean) => {
    setHapticsEnabled(val);
    try { await AsyncStorage.setItem('pref_haptics_enabled', val ? 'true' : 'false'); } catch { /* Storage unavailable */ }
  };

  const saveSoundPref = async (val: boolean) => {
    setSoundEnabled(val);
    try { await AsyncStorage.setItem('pref_sound_enabled', val ? 'true' : 'false'); } catch { /* Storage unavailable */ }
  };

  // Load user settings and biometric information
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      
      try {
        const [capabilities, availableTypes, isEnabled] = await Promise.all([
          BiometricAuthService.checkCapabilities(),
          BiometricAuthService.getAvailableBiometricOptions(),
          BiometricAuthService.isBiometricEnabled(),
        ]);
        
        console.log('Settings: Biometric check:', { capabilities, availableTypes, isEnabled });
        
        setBiometricSupported(capabilities.isAvailable);
        setBiometricEnrolled(capabilities.isEnrolled);
        setBiometricEnabled(isEnabled);
        setBiometricTypes(availableTypes);
        setBiometricLastUsed(null);

        const backupMethods = await BiometricBackupManager.getAvailableFallbackMethods();
        setHasBackupMethods(backupMethods.hasPin || backupMethods.hasSecurityQuestions);
      } catch (error) {
        console.error("Error loading biometric info:", error);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadFeedbackPrefs();
  }, [loadSettings, loadFeedbackPrefs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSettings();
    setRefreshing(false);
  }, [loadSettings]);

  const toggleBiometric = async () => {
    if (!biometricEnrolled) {
      Alert.alert(
        t('settings.biometric_alerts.setup_required_title'),
        t('settings.biometric_alerts.setup_required_message'),
        [{ text: t('common.ok') }],
      );
      return;
    }

    try {
      const { data } = await assertSupabase().auth.getUser();
      const user = data.user;

      if (!user) {
        Alert.alert(t('common.error'), t('settings.biometric_alerts.user_not_found'));
        return;
      }

      if (biometricEnabled) {
        await BiometricAuthService.disableBiometric();
        setBiometricEnabled(false);
        Alert.alert(
          t('settings.biometric_alerts.disabled_title'),
          t('settings.biometric_alerts.disabled_message'),
        );
      } else {
        const success = await BiometricAuthService.enableBiometric(
          user.id,
          user.email || "",
        );
        if (success) {
          setBiometricEnabled(true);
          Alert.alert(
            t('settings.biometric_alerts.enabled_title'),
            t('settings.biometric_alerts.enabled_message'),
          );
        }
      }
    } catch (error) {
      console.error("Error toggling biometric:", error);
      Alert.alert(t('common.error'), t('settings.biometric_alerts.update_failed'));
    }
  };

  const isAdminRole = profile?.role === 'principal' || 
                      profile?.role === 'principal_admin' || 
                      profile?.role === 'super_admin';

  if (loading) {
    return (
      <DesktopLayout role={(profile?.role as 'teacher' | 'principal' | 'parent') || 'teacher'} title={t('navigation.settings', { defaultValue: 'Settings' })} showBackButton>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>{t('settings.loading.settings', { defaultValue: 'Loading settings...' })}</Text>
          </View>
        </View>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout role={(profile?.role as 'teacher' | 'principal' | 'parent') || 'teacher'} title={t('navigation.settings', { defaultValue: 'Settings' })} showBackButton>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
        >
          {/* Security Settings */}
          <SecuritySection
            biometric={{
              supported: biometricSupported,
              enrolled: biometricEnrolled,
              enabled: biometricEnabled,
              types: biometricTypes,
              lastUsed: biometricLastUsed,
              hasBackupMethods,
            }}
            onToggleBiometric={toggleBiometric}
            styles={styles}
          />

          {/* Notifications & Alerts */}
          <NotificationsSection
            hapticsEnabled={hapticsEnabled}
            soundEnabled={soundEnabled}
            onHapticsChange={saveHapticsPref}
            onSoundChange={saveSoundPref}
            styles={styles}
          />

          {/* Billing & Subscriptions */}
          <BillingSection styles={styles} />

          {/* Feedback test actions */}
          <FeedbackTestSection styles={styles} />

          {/* Appearance Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.appearanceLanguage')}</Text>
          </View>

          {/* Theme & Language Settings Component */}
          <View style={styles.themeSectionContainer}>
            <ThemeLanguageSettings />
          </View>

          {/* App Preferences - FAB & Tutorial */}
          <AppPreferencesSection />

          {/* School Settings - Enhanced Overview (admin only) */}
          <SchoolSettingsSection
            schoolSettingsQuery={schoolSettingsQuery}
            isVisible={isAdminRole}
            styles={styles}
          />

          {/* Updates Section */}
          <UpdatesSection
            isDownloading={isDownloading}
            isUpdateDownloaded={isUpdateDownloaded}
            updateError={updateError}
            onCheckForUpdates={checkForUpdates}
            onApplyUpdate={applyUpdate}
            styles={styles}
          />

          {/* About & Support */}
          <AboutSupportSection styles={styles} />
        </ScrollView>
      </View>
    </DesktopLayout>
  );
}
