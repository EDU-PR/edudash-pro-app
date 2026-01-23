/**
 * NotificationItem Component
 * 
 * Renders a single notification item with icon, title, body, and read status.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Notification, NotificationType } from './types';

interface NotificationItemProps {
  notification: Notification;
  onPress: () => void;
  onMarkRead: () => void;
}

/**
 * Format relative time from date string
 */
const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Get icon config based on notification type
 */
const getIconConfig = (type: NotificationType, theme: ReturnType<typeof useTheme>['theme']) => {
  switch (type) {
    case 'message':
      return { icon: 'chatbubble', color: theme.primary, bgColor: theme.primary + '20' };
    case 'call':
      return { icon: 'call', color: theme.error, bgColor: theme.error + '20' };
    case 'announcement':
      return { icon: 'megaphone', color: theme.warning, bgColor: theme.warning + '20' };
    case 'homework':
      return { icon: 'book', color: theme.info, bgColor: theme.info + '20' };
    case 'grade':
      return { icon: 'school', color: theme.success, bgColor: theme.success + '20' };
    case 'attendance':
      return { icon: 'calendar-outline', color: '#9C27B0', bgColor: '#9C27B020' };
    case 'registration':
      return { icon: 'person-add', color: '#00BCD4', bgColor: '#00BCD420' };
    case 'billing':
      return { icon: 'card', color: '#4CAF50', bgColor: '#4CAF5020' };
    case 'calendar':
      return { icon: 'calendar', color: '#FF5722', bgColor: '#FF572220' };
    case 'birthday':
      return { icon: 'gift', color: '#E91E63', bgColor: '#E91E6320' };
    default:
      return { icon: 'notifications', color: theme.textSecondary, bgColor: theme.border };
  }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onMarkRead,
}) => {
  const { theme } = useTheme();
  const iconConfig = getIconConfig(notification.type, theme);
  
  const isUnread = !notification.read;
  const containerBg = isUnread ? theme.primary + '12' : theme.surface;
  
  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        { 
          backgroundColor: containerBg,
          borderLeftWidth: isUnread ? 3 : 0,
          borderLeftColor: isUnread ? theme.primary : 'transparent',
          opacity: isUnread ? 1 : 0.75,
        }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Unread indicator */}
      {isUnread && (
        <View style={[styles.unreadIndicator, { backgroundColor: theme.primary }]} />
      )}
      
      <View style={[
        styles.iconContainer, 
        { 
          backgroundColor: iconConfig.bgColor,
          opacity: isUnread ? 1 : 0.7,
        }
      ]}>
        <Ionicons 
          name={iconConfig.icon as keyof typeof Ionicons.glyphMap} 
          size={22} 
          color={iconConfig.color} 
        />
      </View>
      
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text 
            style={[
              styles.title, 
              { 
                color: theme.text, 
                fontWeight: isUnread ? '700' : '400',
                opacity: isUnread ? 1 : 0.8,
              }
            ]} 
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text style={[
            styles.time, 
            { 
              color: isUnread ? theme.primary : theme.textSecondary,
              fontWeight: isUnread ? '600' : '400',
            }
          ]}>
            {formatTime(notification.created_at)}
          </Text>
        </View>
        <Text 
          style={[
            styles.body, 
            { 
              color: isUnread ? theme.text : theme.textSecondary,
              fontWeight: isUnread ? '500' : '400',
            }
          ]} 
          numberOfLines={2}
        >
          {notification.body}
        </Text>
      </View>
      
      {/* Unread dot */}
      {isUnread && (
        <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  time: {
    fontSize: 12,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  unreadIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default NotificationItem;
