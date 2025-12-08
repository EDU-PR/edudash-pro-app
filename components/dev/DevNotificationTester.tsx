/**
 * Dev Notification Tester
 * 
 * A developer panel for testing push notifications
 * Only shows in __DEV__ mode
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  NotificationPresets,
  runNotificationTestSuite,
  setBadgeCount,
  clearAllNotifications,
  cancelAllScheduled,
  getPendingNotifications,
  checkNotificationPermissions,
  requestNotificationPermissions,
} from '@/lib/notification-test-utils';
import * as Notifications from 'expo-notifications';

interface NotificationButton {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: [string, string];
  action: () => Promise<void> | void;
}

export const DevNotificationTester: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<{ granted: boolean; status: string } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [currentBadge, setCurrentBadge] = useState(0);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    const perms = await checkNotificationPermissions();
    setPermissions(perms);
    
    const pending = await getPendingNotifications();
    setPendingCount(pending.length);

    const badge = await Notifications.getBadgeCountAsync();
    setCurrentBadge(badge);
  };

  const runAction = async (key: string, action: () => Promise<void> | void) => {
    setLoading(key);
    try {
      await action();
      await loadStatus();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Unknown error');
    }
    setLoading(null);
  };

  const presetButtons: NotificationButton[] = [
    {
      label: 'New Message',
      icon: 'chatbubble',
      color: ['#3b82f6', '#2563eb'],
      action: NotificationPresets.newMessage,
    },
    {
      label: 'Homework Assigned',
      icon: 'book',
      color: ['#8b5cf6', '#7c3aed'],
      action: NotificationPresets.homeworkAssigned,
    },
    {
      label: 'Homework Graded',
      icon: 'checkmark-done',
      color: ['#10b981', '#059669'],
      action: NotificationPresets.homeworkGraded,
    },
    {
      label: 'Progress Report',
      icon: 'stats-chart',
      color: ['#f59e0b', '#d97706'],
      action: NotificationPresets.reportReady,
    },
    {
      label: 'Announcement',
      icon: 'megaphone',
      color: ['#ec4899', '#db2777'],
      action: NotificationPresets.announcement,
    },
    {
      label: 'Reminder',
      icon: 'alarm',
      color: ['#06b6d4', '#0891b2'],
      action: NotificationPresets.reminder,
    },
    {
      label: 'Payment Due',
      icon: 'card',
      color: ['#ef4444', '#dc2626'],
      action: NotificationPresets.paymentReminder,
    },
    {
      label: 'Attendance',
      icon: 'people',
      color: ['#14b8a6', '#0d9488'],
      action: NotificationPresets.attendanceAlert,
    },
  ];

  if (!__DEV__) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="notifications" size={24} color="#06b6d4" />
          <Text style={styles.headerTitle}>Notification Tester</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Permissions:</Text>
            <View style={[styles.statusBadge, { backgroundColor: permissions?.granted ? '#10b981' : '#ef4444' }]}>
              <Text style={styles.statusBadgeText}>
                {permissions?.granted ? 'Granted' : permissions?.status || 'Unknown'}
              </Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Pending Scheduled:</Text>
            <Text style={styles.statusValue}>{pendingCount}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Badge Count:</Text>
            <Text style={styles.statusValue}>{currentBadge}</Text>
          </View>
          
          {!permissions?.granted && (
            <TouchableOpacity
              style={styles.requestPermBtn}
              onPress={() => runAction('perms', requestNotificationPermissions)}
            >
              {loading === 'perms' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={18} color="#fff" />
                  <Text style={styles.requestPermText}>Request Permissions</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => runAction('suite', runNotificationTestSuite)}
          >
            <LinearGradient colors={['#06b6d4', '#0891b2']} style={styles.quickActionGradient}>
              {loading === 'suite' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="play" size={20} color="#fff" />
              )}
            </LinearGradient>
            <Text style={styles.quickActionLabel}>Run Test Suite</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => runAction('clear', clearAllNotifications)}
          >
            <LinearGradient colors={['#64748b', '#475569']} style={styles.quickActionGradient}>
              {loading === 'clear' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="trash" size={20} color="#fff" />
              )}
            </LinearGradient>
            <Text style={styles.quickActionLabel}>Clear All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => runAction('cancel', cancelAllScheduled)}
          >
            <LinearGradient colors={['#f59e0b', '#d97706']} style={styles.quickActionGradient}>
              {loading === 'cancel' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="close-circle" size={20} color="#fff" />
              )}
            </LinearGradient>
            <Text style={styles.quickActionLabel}>Cancel Scheduled</Text>
          </TouchableOpacity>
        </View>

        {/* Badge Control */}
        <Text style={styles.sectionTitle}>Badge Control</Text>
        <View style={styles.badgeRow}>
          {[0, 1, 3, 5, 10, 99].map((num) => (
            <TouchableOpacity
              key={num}
              style={[styles.badgeBtn, currentBadge === num && styles.badgeBtnActive]}
              onPress={() => runAction(`badge-${num}`, () => setBadgeCount(num))}
            >
              {loading === `badge-${num}` ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.badgeBtnText, currentBadge === num && styles.badgeBtnTextActive]}>
                  {num}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Preset Notifications */}
        <Text style={styles.sectionTitle}>Send Test Notification</Text>
        <View style={styles.presetsGrid}>
          {presetButtons.map((btn, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.presetBtn}
              onPress={() => runAction(`preset-${idx}`, btn.action)}
            >
              <LinearGradient colors={btn.color} style={styles.presetGradient}>
                {loading === `preset-${idx}` ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name={btn.icon} size={22} color="#fff" />
                )}
              </LinearGradient>
              <Text style={styles.presetLabel} numberOfLines={1}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color="#64748b" />
          <Text style={styles.infoText}>
            Notifications will appear in the status bar and notification drawer.
            Make sure the app is backgrounded to see the full effect.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statusLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  requestPermBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  requestPermText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  quickActionGradient: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  badgeBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  badgeBtnActive: {
    backgroundColor: '#06b6d4',
    borderColor: '#06b6d4',
  },
  badgeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
  },
  badgeBtnTextActive: {
    color: '#fff',
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  presetBtn: {
    width: '22%',
    alignItems: 'center',
    gap: 6,
  },
  presetGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
});

export default DevNotificationTester;
