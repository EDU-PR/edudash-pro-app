import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotificationPreferences, type NotificationPrefs } from '@/hooks/useNotificationPreferences';
import type { ViewStyle, TextStyle } from 'react-native';

// ---------- Category config ----------
type CategoryKey = keyof Pick<
  NotificationPrefs,
  | 'homework_reminders'
  | 'attendance_alerts'
  | 'messages'
  | 'announcements'
  | 'weekly_reports'
  | 'payment_reminders'
  | 'live_class_alerts'
  | 'milestone_celebrations'
>;

const CATEGORIES: { key: CategoryKey; icon: string; labelKey: string; descKey: string }[] = [
  { key: 'homework_reminders', icon: 'book', labelKey: 'Homework Reminders', descKey: 'Get notified about new and due homework' },
  { key: 'attendance_alerts', icon: 'calendar', labelKey: 'Attendance Alerts', descKey: 'Daily attendance check-in/out alerts' },
  { key: 'messages', icon: 'chatbubbles', labelKey: 'Messages', descKey: 'New messages from teachers and school' },
  { key: 'announcements', icon: 'megaphone', labelKey: 'Announcements', descKey: 'School-wide announcements and updates' },
  { key: 'weekly_reports', icon: 'bar-chart', labelKey: 'Weekly Reports', descKey: 'Weekly learning progress summaries' },
  { key: 'payment_reminders', icon: 'card', labelKey: 'Payment Reminders', descKey: 'Upcoming and overdue payment alerts' },
  { key: 'live_class_alerts', icon: 'videocam', labelKey: 'Live Class Alerts', descKey: 'Reminders before live classes start' },
  { key: 'milestone_celebrations', icon: 'trophy', labelKey: 'Milestones', descKey: 'Celebrate your child\'s achievements' },
];

type ChannelKey = keyof Pick<NotificationPrefs, 'push_enabled' | 'email_enabled' | 'sms_enabled'>;

const CHANNELS: { key: ChannelKey; icon: string; label: string }[] = [
  { key: 'push_enabled', icon: 'notifications', label: 'Push Notifications' },
  { key: 'email_enabled', icon: 'mail', label: 'Email' },
  { key: 'sms_enabled', icon: 'chatbox-ellipses', label: 'SMS' },
];

// ---------- Props ----------
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
  const { prefs, loading, saving, error, updatePref, savePrefs } = useNotificationPreferences();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>

      {/* ── Feedback settings (existing) ── */}
      <View style={styles.settingsCard}>
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

      {/* ── Notification Preferences (new) ── */}
      <TouchableOpacity
        style={[styles.settingsCard, { marginTop: 16 }]}
        activeOpacity={0.8}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={[styles.settingItem, !expanded && styles.lastSettingItem]}>
          <View style={styles.settingLeft}>
            <Ionicons name="options" size={24} color={theme.primary} style={styles.settingIcon} />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Notification Preferences</Text>
              <Text style={styles.settingSubtitle}>Manage what notifications you receive</Text>
            </View>
          </View>
          {loading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.textSecondary}
            />
          )}
        </View>
      </TouchableOpacity>

      {expanded && !loading && (
        <>
          {/* Delivery Channels */}
          <View style={[styles.settingsCard, { marginTop: 12 }]}>
            <Text style={[styles.sectionTitle, { fontSize: 14, marginBottom: 4, paddingHorizontal: 16, paddingTop: 12 }]}>
              Delivery Channels
            </Text>
            {CHANNELS.map((ch, idx) => (
              <View
                key={ch.key}
                style={[styles.settingItem, idx === CHANNELS.length - 1 && styles.lastSettingItem]}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name={ch.icon as any} size={22} color={theme.textSecondary} style={styles.settingIcon} />
                  <Text style={styles.settingTitle}>{ch.label}</Text>
                </View>
                <Switch
                  value={prefs[ch.key] as boolean}
                  onValueChange={(v) => updatePref(ch.key, v)}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={prefs[ch.key] ? theme.onPrimary : theme.textTertiary}
                />
              </View>
            ))}
          </View>

          {/* Category toggles */}
          <View style={[styles.settingsCard, { marginTop: 12 }]}>
            <Text style={[styles.sectionTitle, { fontSize: 14, marginBottom: 4, paddingHorizontal: 16, paddingTop: 12 }]}>
              Categories
            </Text>
            {CATEGORIES.map((cat, idx) => (
              <View
                key={cat.key}
                style={[styles.settingItem, idx === CATEGORIES.length - 1 && styles.lastSettingItem]}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name={cat.icon as any} size={22} color={theme.textSecondary} style={styles.settingIcon} />
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>{cat.labelKey}</Text>
                    <Text style={styles.settingSubtitle}>{cat.descKey}</Text>
                  </View>
                </View>
                <Switch
                  value={prefs[cat.key] as boolean}
                  onValueChange={(v) => updatePref(cat.key, v)}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={prefs[cat.key] ? theme.onPrimary : theme.textTertiary}
                />
              </View>
            ))}
          </View>

          {/* Error + Save */}
          {error && (
            <Text style={[localStyles.errorText, { color: theme.error }]}>{error}</Text>
          )}

          <TouchableOpacity
            style={[localStyles.saveBtn, { backgroundColor: theme.primary }]}
            onPress={savePrefs}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <Text style={[localStyles.saveBtnText, { color: theme.onPrimary }]}>Save Preferences</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  saveBtn: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
