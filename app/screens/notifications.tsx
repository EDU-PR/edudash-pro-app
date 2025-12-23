/**
 * Notifications Screen
 * 
 * Displays all notifications for the user including:
 * - Message notifications
 * - Call notifications (missed calls)
 * - System notifications
 * - School announcements
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assertSupabase } from '@/lib/supabase';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { useAlert } from '@/components/ui/StyledAlert';
import { useMarkCallsSeen } from '@/hooks/useMissedCalls';
import { useMarkAnnouncementsSeen } from '@/hooks/useNotificationCount';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATIONS_LAST_SEEN_KEY = 'notifications_last_seen_at';
const READ_NOTIFICATIONS_KEY = 'read_notifications';

// Helper to get set of read notification IDs
const getReadNotificationIds = async (userId: string): Promise<Set<string>> => {
  try {
    const key = `${READ_NOTIFICATIONS_KEY}_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Set(parsed);
    }
  } catch (e) {
    console.error('[getReadNotificationIds] Error:', e);
  }
  return new Set();
};

// Helper to mark a notification as read
const markNotificationRead = async (userId: string, notificationId: string): Promise<void> => {
  try {
    const key = `${READ_NOTIFICATIONS_KEY}_${userId}`;
    const existing = await getReadNotificationIds(userId);
    existing.add(notificationId);
    // Keep only last 500 entries to prevent infinite growth
    const arr = Array.from(existing).slice(-500);
    await AsyncStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    console.error('[markNotificationRead] Error:', e);
  }
};

// Helper to mark all notifications as read
const markAllNotificationsRead = async (userId: string, notificationIds: string[]): Promise<void> => {
  try {
    const key = `${READ_NOTIFICATIONS_KEY}_${userId}`;
    const existing = await getReadNotificationIds(userId);
    notificationIds.forEach(id => existing.add(id));
    const arr = Array.from(existing).slice(-500);
    await AsyncStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    console.error('[markAllNotificationsRead] Error:', e);
  }
};

// Helper to delete notifications by type
const deleteNotificationsByType = async (userId: string, notifications: Notification[], types: string[]): Promise<void> => {
  try {
    const key = `${READ_NOTIFICATIONS_KEY}_${userId}`;
    const existing = await getReadNotificationIds(userId);
    // Mark notifications of specified types as deleted by adding them to read set
    notifications
      .filter(n => types.includes(n.type))
      .forEach(n => existing.add(n.id));
    const arr = Array.from(existing).slice(-500);
    await AsyncStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    console.error('[deleteNotificationsByType] Error:', e);
  }
};

interface Notification {
  id: string;
  type: 'message' | 'call' | 'announcement' | 'system' | 'homework' | 'grade';
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  created_at: string;
  sender_name?: string;
}

// Custom Header Component
const ScreenHeader: React.FC<{
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
}> = ({ title, subtitle, onBack, rightAction }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      <TouchableOpacity 
        style={styles.headerBackButton} 
        onPress={onBack || (() => router.back())}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </TouchableOpacity>
      
      <View style={styles.headerTitleContainer}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
      
      {rightAction ? (
        <TouchableOpacity 
          style={styles.headerRightButton} 
          onPress={rightAction.onPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={rightAction.icon} size={24} color={theme.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerRightButton} />
      )}
    </View>
  );
};

// Notification Item Component
const NotificationItem: React.FC<{
  notification: Notification;
  onPress: () => void;
  onMarkRead: () => void;
}> = ({ notification, onPress, onMarkRead }) => {
  const { theme } = useTheme();
  
  const getIconConfig = () => {
    switch (notification.type) {
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
      default:
        return { icon: 'notifications', color: theme.textSecondary, bgColor: theme.border };
    }
  };
  
  const iconConfig = getIconConfig();
  
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
  
  // Enhanced styling for read/unread distinction
  const isUnread = !notification.read;
  const containerBg = isUnread 
    ? theme.primary + '12' // Stronger unread background
    : theme.surface;
  const borderColor = isUnread ? theme.primary + '40' : 'transparent';
  
  return (
    <TouchableOpacity 
      style={[
        itemStyles.container, 
        { 
          backgroundColor: containerBg,
          borderLeftWidth: isUnread ? 3 : 0,
          borderLeftColor: isUnread ? theme.primary : 'transparent',
          opacity: isUnread ? 1 : 0.75, // Slightly dim read notifications
        }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Unread indicator - larger and more visible */}
      {isUnread && (
        <View style={[itemStyles.unreadIndicator, { backgroundColor: theme.primary }]} />
      )}
      
      <View style={[
        itemStyles.iconContainer, 
        { 
          backgroundColor: iconConfig.bgColor,
          opacity: isUnread ? 1 : 0.7,
        }
      ]}>
        <Ionicons name={iconConfig.icon as keyof typeof Ionicons.glyphMap} size={22} color={iconConfig.color} />
      </View>
      
      <View style={itemStyles.content}>
        <View style={itemStyles.topRow}>
          <Text 
            style={[
              itemStyles.title, 
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
            itemStyles.time, 
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
            itemStyles.body, 
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
      
      {/* Unread dot - larger and pulsing */}
      {isUnread && (
        <View style={[itemStyles.unreadDot, { backgroundColor: theme.primary }]} />
      )}
    </TouchableOpacity>
  );
};

// Hook to fetch notifications
const useNotifications = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const client = assertSupabase();
      
      // Get set of read notification IDs from local storage
      const readIds = await getReadNotificationIds(user.id);
      
      // Try to fetch from notifications table if it exists
      try {
        const { data, error } = await client
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (!error && data) {
          // Mark as read if in our local read set
          return data.map(n => ({
            ...n,
            read: n.read || readIds.has(n.id),
          })) as Notification[];
        }
      } catch {
        // Table might not exist, fall back to composite notifications
      }
      
      // Fallback: Build notifications from various sources
      const notifications: Notification[] = [];
      
      // Get unread messages
      try {
        const { data: threads } = await client
          .from('message_threads')
          .select(`
            id,
            updated_at,
            message_participants!inner(user_id, last_read_at),
            messages(content, created_at, sender:profiles!sender_id(first_name, last_name))
          `)
          .eq('message_participants.user_id', user.id)
          .gt('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('updated_at', { ascending: false })
          .limit(10);
        
        threads?.forEach((thread: any) => {
          const lastMessage = thread.messages?.[0];
          if (lastMessage) {
            const senderName = lastMessage.sender 
              ? `${lastMessage.sender.first_name} ${lastMessage.sender.last_name}`.trim()
              : 'Someone';
            const notifId = `msg-${thread.id}`;
            
            // Check if message is read - either by last_read_at or local storage
            const participant = Array.isArray(thread.message_participants) 
              ? thread.message_participants[0] 
              : thread.message_participants;
            const lastReadAt = participant?.last_read_at;
            const messageTime = new Date(lastMessage.created_at).getTime();
            const readTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;
            const isReadByDb = lastReadAt && readTime >= messageTime;
            
            notifications.push({
              id: notifId,
              type: 'message',
              title: `New message from ${senderName}`,
              body: lastMessage.content?.substring(0, 100) || 'New message',
              data: { threadId: thread.id },
              read: isReadByDb || readIds.has(notifId),
              created_at: lastMessage.created_at,
              sender_name: senderName,
            });
          }
        });
      } catch (e) {
        console.log('[Notifications] Error fetching messages:', e);
      }
      
      // Get missed calls
      try {
        const { data: calls } = await client
          .from('active_calls')
          .select('*, caller:profiles!caller_id(first_name, last_name)')
          .eq('callee_id', user.id)
          .or('status.eq.missed,and(status.eq.ended,duration_seconds.is.null),and(status.eq.ended,duration_seconds.eq.0)')
          .order('started_at', { ascending: false })
          .limit(10);
        
        calls?.forEach((call: any) => {
          const callerName = call.caller 
            ? `${call.caller.first_name} ${call.caller.last_name}`.trim()
            : 'Unknown';
          const notifId = `call-${call.call_id}`;
          notifications.push({
            id: notifId,
            type: 'call',
            title: `Missed ${call.call_type || 'voice'} call`,
            body: `You missed a ${call.call_type || 'voice'} call from ${callerName}`,
            data: { callerId: call.caller_id, callType: call.call_type },
            read: readIds.has(notifId),
            created_at: call.started_at,
            sender_name: callerName,
          });
        });
      } catch (e) {
        console.log('[Notifications] Error fetching calls:', e);
      }
      
      // Sort by date
      notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return notifications;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30, // 30 seconds
  });
};

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const alert = useAlert();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  
  const { data: notifications = [], isLoading, refetch } = useNotifications();
  
  // Hooks to mark categories as seen
  const { mutate: markCallsSeen } = useMarkCallsSeen();
  const { mutate: markAnnouncementsSeen } = useMarkAnnouncementsSeen();
  
  // Mark all notifications as seen when screen mounts
  useEffect(() => {
    const markAllAsSeen = async () => {
      markCallsSeen();
      markAnnouncementsSeen();
      // Also update last seen for messages (handled by message_participants.last_read_at)
    };
    markAllAsSeen();
  }, [markCallsSeen, markAnnouncementsSeen]);
  
  // Unread count
  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read).length
  , [notifications]);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  
  // Mark a single notification as read
  const handleMarkRead = useCallback(async (notificationId: string) => {
    if (!user?.id) return;
    
    // Mark in local storage
    await markNotificationRead(user.id, notificationId);
    
    // Invalidate query to refetch with updated read status
    queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
  }, [user?.id, queryClient]);
  
  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    if (!user?.id) return;
    
    const allIds = notifications.map(n => n.id);
    await markAllNotificationsRead(user.id, allIds);
    
    markCallsSeen();
    markAnnouncementsSeen();
    
    // Invalidate all related queries
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['missed-calls-count'] });
    queryClient.invalidateQueries({ queryKey: ['unread-announcements-count'] });
    queryClient.invalidateQueries({ queryKey: ['parent', 'unread-count'] });
  }, [user?.id, notifications, queryClient, markCallsSeen, markAnnouncementsSeen]);
  
  const handleNotificationPress = useCallback(async (notification: Notification) => {
    // Mark as read first
    if (user?.id && !notification.read) {
      await markNotificationRead(user.id, notification.id);
      queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
    }
    
    // Navigate based on type
    switch (notification.type) {
      case 'message':
        if (notification.data?.threadId) {
          router.push({
            pathname: '/screens/parent-message-thread',
            params: { threadId: notification.data.threadId },
          });
        } else {
          router.push('/screens/parent-messages');
        }
        break;
      case 'call':
        router.push('/screens/calls');
        break;
      case 'homework':
        router.push('/screens/homework');
        break;
      case 'grade':
        router.push('/screens/grades');
        break;
      case 'announcement':
        router.push('/screens/announcements');
        break;
      default:
        // Stay on current screen
        break;
    }
  }, [user?.id, queryClient]);
  
  // Clear call notifications
  const handleClearCallNotifications = useCallback(async () => {
    if (!user?.id) return;
    
    Alert.alert(
      t('notifications.clearCallNotifications', { defaultValue: 'Clear Call Notifications' }),
      t('notifications.clearCallNotificationsConfirm', { defaultValue: 'This will remove all call notifications from the list.' }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.clear', { defaultValue: 'Clear' }),
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete call notifications from the list
              await deleteNotificationsByType(user.id, notifications, ['call']);
              markCallsSeen();
              await refetch();
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
              queryClient.invalidateQueries({ queryKey: ['missed-calls-count'] });
            } catch (error) {
              console.error('[ClearCallNotifications] Error:', error);
              Alert.alert(t('common.error', { defaultValue: 'Error' }), t('notifications.clearError', { defaultValue: 'Failed to clear. Please try again.' }));
            }
          }
        }
      ]
    );
  }, [user?.id, t, refetch, queryClient, markCallsSeen, notifications]);
  
  // Mark all messages as read
  const handleMarkMessagesRead = useCallback(async () => {
    if (!user?.id) return;
    
    Alert.alert(
      t('notifications.markMessagesRead', { defaultValue: 'Clear Message Notifications' }),
      t('notifications.markMessagesReadConfirm', { defaultValue: 'This will remove all message notifications from the list.' }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.clear', { defaultValue: 'Clear' }),
          onPress: async () => {
            try {
              // Delete message notifications
              await deleteNotificationsByType(user.id, notifications, ['message']);
              
              // Also mark message threads as read in database
              const client = assertSupabase();
              await client
                .from('message_participants')
                .update({ last_read_at: new Date().toISOString() })
                .eq('user_id', user.id);
              
              await refetch();
              queryClient.invalidateQueries({ queryKey: ['parent', 'threads'] });
              queryClient.invalidateQueries({ queryKey: ['parent', 'unread-count'] });
            } catch (error) {
              console.error('[ClearMessages] Error:', error);
              Alert.alert(t('common.error', { defaultValue: 'Error' }), t('notifications.clearError', { defaultValue: 'Failed to clear. Please try again.' }));
            }
          }
        }
      ]
    );
  }, [user?.id, t, refetch, queryClient, notifications]);
  
  const handleClearAll = useCallback(() => {
    alert.showConfirm(
      t('notifications.clearAll', { defaultValue: 'Clear All Notifications' }),
      t('notifications.clearAllConfirm', { defaultValue: 'Are you sure you want to clear all notifications? This cannot be undone.' }),
      async () => {
        // Mark all as read/seen
        markCallsSeen();
        markAnnouncementsSeen();
        
        // Update message read status
        if (user?.id) {
          try {
            const client = assertSupabase();
            await client
              .from('message_participants')
              .update({ last_read_at: new Date().toISOString() })
              .eq('user_id', user.id);
          } catch (error) {
            console.error('[ClearAll] Error updating messages:', error);
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['missed-calls-count'] });
        queryClient.invalidateQueries({ queryKey: ['unread-announcements-count'] });
        queryClient.invalidateQueries({ queryKey: ['parent', 'unread-count'] });
      }
    );
  }, [alert, t, queryClient, user?.id, markCallsSeen, markAnnouncementsSeen]);
  
  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader 
          title={t('notifications.title', { defaultValue: 'Notifications' })}
        />
        <View style={styles.loadingContainer}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={styles.skeletonItem}>
              <SkeletonLoader width="100%" height={80} borderRadius={12} />
            </View>
          ))}
        </View>
      </View>
    );
  }
  
  // Empty state
  if (notifications.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader 
          title={t('notifications.title', { defaultValue: 'Notifications' })}
        />
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.primary + '15' }]}>
            <Ionicons name="notifications-off-outline" size={48} color={theme.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t('notifications.empty', { defaultValue: 'No Notifications' })}
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            {t('notifications.emptyDesc', { defaultValue: "You're all caught up! Check back later for updates." })}
          </Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader 
        title={t('notifications.title', { defaultValue: 'Notifications' })}
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        rightAction={{
          icon: 'ellipsis-vertical',
          onPress: () => {
            Alert.alert(
              t('notifications.options', { defaultValue: 'Notification Options' }),
              t('notifications.optionsDesc', { defaultValue: 'Choose an action' }),
              [
                { 
                  text: t('notifications.markAllRead', { defaultValue: 'Mark All as Read' }), 
                  onPress: handleMarkAllRead
                },
                { 
                  text: t('notifications.markMessagesRead', { defaultValue: 'Clear Message Notifications' }), 
                  onPress: handleMarkMessagesRead,
                  style: 'destructive'
                },
                { 
                  text: t('notifications.clearCallNotifications', { defaultValue: 'Clear Call Notifications' }), 
                  onPress: handleClearCallNotifications,
                  style: 'destructive'
                },
                { 
                  text: t('notifications.clearAll', { defaultValue: 'Clear All Notifications' }), 
                  style: 'destructive', 
                  onPress: handleClearAll 
                },
                { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
              ]
            );
          }
        }}
      />
      
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={() => handleNotificationPress(item)}
            onMarkRead={() => handleMarkRead(item.id)}
          />
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRightButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 16,
  },
  skeletonItem: {
    marginBottom: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    padding: 16,
  },
});

const itemStyles = StyleSheet.create({
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
    // Add shadow/glow effect for unread dot
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
});
