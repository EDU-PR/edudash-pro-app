/**
 * NotificationMenu Component
 * 
 * Modal dropdown menu with notification actions:
 * - Mark all as read
 * - Clear message notifications
 * - Clear call notifications
 * - Clear all notifications
 */

import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';

interface NotificationMenuProps {
  visible: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
  onClearMessages: () => void;
  onClearCalls: () => void;
  onClearAll: () => void;
}

export const NotificationMenu: React.FC<NotificationMenuProps> = ({
  visible,
  onClose,
  onMarkAllRead,
  onClearMessages,
  onClearCalls,
  onClearAll,
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  
  const handleAction = (action: () => void) => {
    onClose();
    action();
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={[
          styles.container, 
          { backgroundColor: theme.surface, borderColor: theme.border }
        ]}>
          {/* Mark All as Read */}
          <TouchableOpacity 
            style={styles.item} 
            onPress={() => handleAction(onMarkAllRead)}
          >
            <Ionicons 
              name="checkmark-done" 
              size={20} 
              color={theme.primary} 
              style={styles.icon} 
            />
            <Text style={[styles.text, { color: theme.text }]}>
              {t('notifications.markAllRead', { defaultValue: 'Mark All as Read' })}
            </Text>
          </TouchableOpacity>
          
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          {/* Clear Messages */}
          <TouchableOpacity 
            style={styles.item} 
            onPress={() => handleAction(onClearMessages)}
          >
            <Ionicons 
              name="chatbubble-outline" 
              size={20} 
              color={theme.warning || '#f59e0b'} 
              style={styles.icon} 
            />
            <Text style={[styles.text, { color: theme.text }]}>
              {t('notifications.markMessagesRead', { defaultValue: 'Clear Message Notifications' })}
            </Text>
          </TouchableOpacity>
          
          {/* Clear Calls */}
          <TouchableOpacity 
            style={styles.item} 
            onPress={() => handleAction(onClearCalls)}
          >
            <Ionicons 
              name="call-outline" 
              size={20} 
              color={theme.warning || '#f59e0b'} 
              style={styles.icon} 
            />
            <Text style={[styles.text, { color: theme.text }]}>
              {t('notifications.clearCallNotifications', { defaultValue: 'Clear Call Notifications' })}
            </Text>
          </TouchableOpacity>
          
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          {/* Clear All */}
          <TouchableOpacity 
            style={styles.item} 
            onPress={() => handleAction(onClearAll)}
          >
            <Ionicons 
              name="trash-outline" 
              size={20} 
              color={theme.error} 
              style={styles.icon} 
            />
            <Text style={[styles.text, { color: theme.error }]}>
              {t('notifications.clearAll', { defaultValue: 'Clear All Notifications' })}
            </Text>
          </TouchableOpacity>
          
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          {/* Cancel */}
          <TouchableOpacity 
            style={styles.item} 
            onPress={onClose}
          >
            <Ionicons 
              name="close" 
              size={20} 
              color={theme.textSecondary} 
              style={styles.icon} 
            />
            <Text style={[styles.text, { color: theme.textSecondary }]}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 16,
  },
  container: {
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 240,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  icon: {
    marginRight: 12,
  },
  text: {
    fontSize: 15,
    fontWeight: '500',
  },
  divider: {
    height: 1,
  },
});

export default NotificationMenu;
