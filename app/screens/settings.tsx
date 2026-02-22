import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { Stack, router } from 'expo-router';
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
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseDeepLinkUrl } from '@/lib/utils/deepLink';
import { logger } from '@/lib/logger';
import { AlertModal, useAlertModal } from '@/components/ui/AlertModal';

const TAG = 'Settings';
import {
  NotificationPresets,
  setBadgeCount,
  checkNotificationPermissions,
  requestNotificationPermissions,
} from '@/lib/notification-test-utils';

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

import EduDashSpinner from '@/components/ui/EduDashSpinner';
let Clipboard: any = null;
try {
  Clipboard = require('expo-clipboard');
} catch {
  Clipboard = null;
}

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
        logger.debug(TAG, 'Updates check not available in current environment');
        return false;
      },
      applyUpdate: async () => {
        logger.debug(TAG, 'Update apply not available in current environment');
      },
    };
  }
};

export default function SettingsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation('common');
  const { profile, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricTypes, setBiometricTypes] = useState<string[]>([]);
  const [biometricLastUsed, setBiometricLastUsed] = useState<string | null>(null);
  const [hasBackupMethods, setHasBackupMethods] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isDownloading, isUpdateDownloaded, updateError, checkForUpdates, applyUpdate } = useSafeUpdates();
  const { showAlert, alertProps } = useAlertModal();
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
        
        logger.debug(TAG, 'Biometric check:', { capabilities, availableTypes, isEnabled });
        
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

  const handleForgotPasswordTest = useCallback(async () => {
    try {
      let url = '';
      if (Clipboard?.getStringAsync) {
        const clip = await Clipboard.getStringAsync();
        if (clip && typeof clip === 'string' && (clip.includes('http') || clip.includes('edudashpro://'))) {
          url = clip.trim();
        }
      }

      if (!url) {
        url = (await Linking.getInitialURL()) || '';
      }

      if (!url) {
        showAlert({
          title: 'Forgot Password Test',
          message: 'No URL found. Copy a reset link to your clipboard or open a recovery link first.',
          type: 'info',
        });
        return;
      }

      const parsed = parseDeepLinkUrl(url);
      logger.debug(TAG, 'ForgotPasswordTest URL:', url);
      logger.debug(TAG, 'ForgotPasswordTest Parsed:', parsed);

      showAlert({
        title: 'Forgot Password Test',
        message: `Path: ${parsed.path}\nParams: ${JSON.stringify(parsed.params, null, 2)}`,
        buttons: [
          {
            text: 'Open Callback',
            onPress: () => {
              const search = new URLSearchParams();
              Object.entries(parsed.params || {}).forEach(([key, value]) => {
                if (!key) return;
                if (value === undefined || value === null || value === '') return;
                search.set(key, String(value));
              });
              router.push(`/auth-callback${search.toString() ? `?${search.toString()}` : ''}` as any);
            },
          },
          { text: 'OK', style: 'default' },
        ],
      });
    } catch (err) {
      console.error('[Dev][ForgotPasswordTest] Error:', err);
      showAlert({
        title: 'Forgot Password Test',
        message: 'Failed to run test. Check logs for details.',
        type: 'error',
      });
    }
  }, []);

  const handleDevNotificationTest = useCallback(async () => {
    try {
      const perms = await checkNotificationPermissions();
      let granted = perms.granted;

      if (!granted && perms.canAskAgain) {
        granted = await requestNotificationPermissions();
      }

      if (!granted) {
        showAlert({
          title: 'Notifications Disabled',
          message: 'Enable notifications to run the dev test.',
          type: 'warning',
        });
        return;
      }

      await NotificationPresets.newMessage();
      await setBadgeCount(3);

      showAlert({
        title: 'Dev Test Sent',
        message: 'A test notification was scheduled and the badge was set to 3.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('[Dev][NotificationTest] Error:', err);
      showAlert({
        title: 'Dev Test Failed',
        message: err?.message || 'Unknown error',
        type: 'error',
      });
    }
  }, []);

  // ── Dev: Reset AI Quota ──────────────────────────────────────────
  const handleResetAIQuota = useCallback(async () => {
    try {
      const supabase = assertSupabase();
      const userId = user?.id;
      if (!userId) {
        showAlert({ title: 'Error', message: 'No user ID found', type: 'error' });
        return;
      }

      const { error } = await supabase
        .from('user_ai_usage')
        .update({
          exams_generated_this_month: 0,
          explanations_requested_this_month: 0,
          chat_messages_today: 0,
          chat_messages_this_month: 0,
          last_daily_reset_at: new Date().toISOString(),
          last_monthly_reset_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      showAlert({
        title: 'AI Quota Reset',
        message: 'All AI usage counters have been reset to 0. You can now test quota limits fresh.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('[Dev][ResetQuota] Error:', err);
      showAlert({ title: 'Reset Failed', message: err?.message || 'Unknown error', type: 'error' });
    }
  }, [user?.id]);

  // ── Dev: Simulate Quota Exhaustion ────────────────────────────────
  const handleSimulateQuotaExhaustion = useCallback(async () => {
    try {
      const supabase = assertSupabase();
      const userId = user?.id;
      if (!userId) {
        showAlert({ title: 'Error', message: 'No user ID found', type: 'error' });
        return;
      }

      // Set usage to exactly the limit to trigger quota_exceeded on next request
      const { error } = await supabase
        .from('user_ai_usage')
        .update({
          exams_generated_this_month: 999,
          explanations_requested_this_month: 999,
          chat_messages_today: 999,
          chat_messages_this_month: 9999,
        })
        .eq('user_id', userId);

      if (error) throw error;

      showAlert({
        title: 'Quota Exhausted (Simulated)',
        message: 'AI usage set to maximum. Any AI request should now return a 429 quota_exceeded error. Use "Reset AI Quota" to restore.',
        type: 'warning',
      });
    } catch (err: any) {
      console.error('[Dev][SimulateQuota] Error:', err);
      showAlert({ title: 'Simulation Failed', message: err?.message || 'Unknown error', type: 'error' });
    }
  }, [user?.id]);

  // ── Dev: Switch AI Tier ──────────────────────────────────────────
  const handleSwitchAITier = useCallback(async (tier: string) => {
    try {
      const supabase = assertSupabase();
      const userId = user?.id;
      if (!userId) {
        showAlert({ title: 'Error', message: 'No user ID found', type: 'error' });
        return;
      }

      const { error } = await supabase
        .from('user_ai_usage')
        .update({ current_tier: tier })
        .eq('user_id', userId);

      if (error) throw error;

      showAlert({
        title: 'Tier Changed',
        message: `AI tier set to: ${tier}. Quota limits now reflect the ${tier} tier.`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('[Dev][SwitchTier] Error:', err);
      showAlert({ title: 'Tier Change Failed', message: err?.message || 'Unknown error', type: 'error' });
    }
  }, [user?.id]);

  const handleDevEmailTest = useCallback(async () => {
    const role = profile?.role || '';
    const allowed = ['principal', 'principal_admin', 'super_admin', 'superadmin', 'teacher'];
    if (!allowed.includes(role)) {
      showAlert({
        title: 'Dev Email Test',
        message: 'Only principals, teachers, or super admins can send test emails.',
        type: 'warning',
      });
      return;
    }

    const recipient = profile?.email || user?.email;
    if (!recipient) {
      showAlert({
        title: 'Dev Email Test',
        message: 'No email found for the current user.',
        type: 'error',
      });
      return;
    }

    try {
      const { data, error } = await assertSupabase().functions.invoke('send-email', {
        body: {
          to: recipient,
          subject: 'EduDash Pro Test Email',
          body: '<p>This is a dev-only test email from the EduDash Pro app.</p>',
          confirmed: true,
          use_branded_template: true,
          preheader: 'Dev email test',
          subtitle: 'Branded template preview',
          cta: { label: 'Open EduDash Pro', url: 'https://www.edudashpro.org.za/sign-in' },
        },
      });

      if (error) {
        throw error;
      }

      showAlert({
        title: 'Dev Email Test',
        message: `Sent to ${recipient}${data?.message_id ? ` (id: ${data.message_id})` : ''}`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('[Dev][EmailTest] Error:', err);
      showAlert({
        title: 'Dev Email Test Failed',
        message: err?.message || 'Failed to send test email.',
        type: 'error',
      });
    }
  }, [profile, user]);

  const toggleBiometric = async () => {
    if (!biometricSupported) {
      showAlert({
        title: t('settings.biometric.title'),
        message: t('settings.biometric.notAvailable'),
        type: 'info',
        icon: 'information-circle',
        buttons: [{ text: t('common.ok') }],
      });
      return;
    }

    if (!biometricEnrolled) {
      showAlert({
        title: t('settings.biometric_alerts.setup_required_title'),
        message: t('settings.biometric_alerts.setup_required_message'),
        type: 'warning',
        icon: 'settings-outline',
        buttons: [{ text: t('common.ok') }],
      });
      return;
    }

    try {
      const { data } = await assertSupabase().auth.getUser();
      const user = data.user;

      if (!user) {
        showAlert({
          title: t('common.error'),
          message: t('settings.biometric_alerts.user_not_found'),
          type: 'error',
        });
        return;
      }

      if (biometricEnabled) {
        await BiometricAuthService.disableBiometric();
        setBiometricEnabled(false);
        showAlert({
          title: t('settings.biometric_alerts.disabled_title'),
          message: t('settings.biometric_alerts.disabled_message'),
          type: 'info',
          icon: 'finger-print-outline',
        });
      } else {
        const success = await BiometricAuthService.enableBiometric(
          user.id,
          user.email || "",
        );
        if (success) {
          setBiometricEnabled(true);
          showAlert({
            title: t('settings.biometric_alerts.enabled_title'),
            message: t('settings.biometric_alerts.enabled_message'),
            type: 'success',
            icon: 'finger-print',
          });
        }
      }
    } catch (error) {
      console.error("Error toggling biometric:", error);
      showAlert({
        title: t('common.error'),
        message: t('settings.biometric_alerts.update_failed'),
        type: 'error',
      });
    }
  };

  const isAdminRole = profile?.role === 'principal' || 
                      profile?.role === 'principal_admin' || 
                      profile?.role === 'super_admin';

  if (loading) {
    return (
      <DesktopLayout role={(profile?.role as 'teacher' | 'principal' | 'parent') || 'teacher'} title={t('navigation.settings', { defaultValue: 'Settings' })} showBackButton>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <View style={styles.loadingContainer}>
            <EduDashSpinner size="large" color={theme.primary} />
            <Text style={styles.loadingText}>{t('settings.loading.settings', { defaultValue: 'Loading settings...' })}</Text>
          </View>
        </SafeAreaView>
      </DesktopLayout>
    );
  }

  return (
    <DesktopLayout role={(profile?.role as 'teacher' | 'principal' | 'parent') || 'teacher'} title={t('navigation.settings', { defaultValue: 'Settings' })} showBackButton>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
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
            onChangePassword={() => router.push('/screens/change-password')}
            onChangeEmail={() => router.push('/screens/change-email')}
            styles={styles}
          />

          {__DEV__ && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dev Tools</Text>
              <View style={styles.settingsCard}>
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={() => router.push('/screens/dev-notification-tester')}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons
                      name="notifications-outline"
                      size={24}
                      color={theme.primary}
                      style={styles.settingIcon}
                    />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingTitle}>Notification Tester</Text>
                      <Text style={styles.settingSubtitle}>
                        Open dev-only notification tester
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={handleDevNotificationTest}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons
                      name="flask-outline"
                      size={24}
                      color={theme.primary}
                      style={styles.settingIcon}
                    />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingTitle}>Run Notification Test</Text>
                      <Text style={styles.settingSubtitle}>
                        Send a local test notification + badge
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="play" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={handleDevEmailTest}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons
                      name="mail-outline"
                      size={24}
                      color={theme.primary}
                      style={styles.settingIcon}
                    />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingTitle}>Send Test Email</Text>
                      <Text style={styles.settingSubtitle}>
                        Dev-only branded email test
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="play" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.settingItem, styles.lastSettingItem]}
                  onPress={handleForgotPasswordTest}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons
                      name="bug-outline"
                      size={24}
                      color={theme.primary}
                      style={styles.settingIcon}
                    />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingTitle}>Forgot Password Test</Text>
                      <Text style={styles.settingSubtitle}>
                        Parse deep link and open auth-callback (dev only)
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* AI Quota Dev Tools */}
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>AI Quota Simulation</Text>
              <View style={styles.settingsCard}>
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={handleResetAIQuota}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons name="refresh-circle-outline" size={24} color="#10B981" style={styles.settingIcon} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingTitle}>Reset AI Quota</Text>
                      <Text style={styles.settingSubtitle}>Reset all AI usage counters to 0</Text>
                    </View>
                  </View>
                  <Ionicons name="play" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={handleSimulateQuotaExhaustion}
                >
                  <View style={styles.settingLeft}>
                    <Ionicons name="warning-outline" size={24} color="#F59E0B" style={styles.settingIcon} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingTitle}>Simulate Quota Exceeded</Text>
                      <Text style={styles.settingSubtitle}>Max out all AI counters to test 429 responses</Text>
                    </View>
                  </View>
                  <Ionicons name="play" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                <View style={styles.settingItem}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="swap-horizontal-outline" size={24} color={theme.primary} style={styles.settingIcon} />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingTitle}>Switch AI Tier</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        {['free', 'trial', 'school_starter', 'school_premium', 'school_pro', 'school_enterprise'].map((tier) => (
                          <TouchableOpacity
                            key={tier}
                            onPress={() => handleSwitchAITier(tier)}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 16,
                              backgroundColor: theme.surface,
                              borderWidth: 1,
                              borderColor: theme.border,
                            }}
                          >
                            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>
                              {tier}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}

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
          <FeedbackTestSection
            styles={styles}
            hapticsEnabled={hapticsEnabled}
            soundEnabled={soundEnabled}
          />

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

        <AlertModal {...alertProps} />
      </SafeAreaView>
    </DesktopLayout>
  );
}
