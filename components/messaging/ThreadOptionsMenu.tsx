/**
 * ThreadOptionsMenu Component
 * Dropdown menu from top-right with thread/chat options
 * - View contact
 * - Search in conversation
 * - Mute notifications
 * - Change wallpaper
 * - Clear chat
 * - Block user
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

interface ThreadOptionsMenuProps {
  visible: boolean;
  onClose: () => void;
  onChangeWallpaper: () => void;
  onMuteNotifications?: () => void;
  onSearchInChat?: () => void;
  onClearChat?: () => void;
  onBlockUser?: () => void;
  onViewContact?: () => void;
  onExportChat?: () => void;
  onMediaLinksAndDocs?: () => void;
  onStarredMessages?: () => void;
  onDisappearingMessages?: () => void;
  onAddShortcut?: () => void;
  onReport?: () => void;
  isMuted?: boolean;
  isBlocked?: boolean;
  disappearingLabel?: string;
  contactName?: string;
  isGroup?: boolean;
  participantCount?: number;
  onGroupInfo?: () => void;
  onTogglePin?: () => void;
  isPinned?: boolean;
  onSetNotificationMode?: (mode: 'all' | 'mentions' | 'muted') => void;
  notificationMode?: 'all' | 'mentions' | 'muted';
}

interface OptionItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  theme: any;
}

const OptionItem: React.FC<OptionItemProps> = ({ 
  icon, 
  label, 
  onPress, 
  destructive = false,
  disabled = false,
  theme,
}) => (
  <TouchableOpacity
    style={[optionStyles.item, disabled && optionStyles.disabled]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
  >
    <View style={[optionStyles.icon, { backgroundColor: destructive ? theme.error + '15' : theme.primary + '15' }]}>
      <Ionicons 
        name={icon} 
        size={20} 
        color={destructive ? theme.error : theme.primary} 
      />
    </View>
    <Text style={[optionStyles.label, { color: destructive ? theme.error : theme.text }]}>{label}</Text>
  </TouchableOpacity>
);

const optionStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  label: {
    fontSize: 15,
    flex: 1,
  },
});

const MENU_WIDTH = 260;

export const ThreadOptionsMenu: React.FC<ThreadOptionsMenuProps> = ({
  visible,
  onClose,
  onChangeWallpaper,
  onMuteNotifications,
  onSearchInChat,
  onClearChat,
  onBlockUser,
  onViewContact,
  onExportChat,
  onMediaLinksAndDocs,
  onStarredMessages,
  onDisappearingMessages,
  onAddShortcut,
  onReport,
  isMuted = false,
  isBlocked = false,
  disappearingLabel,
  contactName,
  isGroup = false,
  participantCount,
  onGroupInfo,
  onTogglePin,
  isPinned = false,
  onSetNotificationMode,
  notificationMode = 'all',
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 12,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const handleOptionPress = (callback: () => void) => {
    handleClose();
    setTimeout(callback, 100);
  };

  const { height: screenHeight } = Dimensions.get('window');

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Animated.View
          style={[
            styles.menuContainer,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              top: insets.top + 8,
              maxHeight: screenHeight * 0.7,
              opacity: opacityAnim,
              transform: [
                { scale: scaleAnim },
                {
                  translateX: scaleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [MENU_WIDTH / 2, 0],
                  }),
                },
                {
                  translateY: scaleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {(contactName || isGroup) && (
            <View style={[styles.header, { borderBottomColor: theme.border }]}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                {isGroup ? 'Group Options' : 'Chat Options'}
              </Text>
              {(contactName || (isGroup && participantCount != null)) && (
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                  {isGroup && participantCount != null
                    ? `${contactName || 'Group'} · ${participantCount} participant${participantCount !== 1 ? 's' : ''}`
                    : contactName}
                </Text>
              )}
            </View>
          )}
          
          <ScrollView
            style={styles.scrollContainer}
            showsVerticalScrollIndicator={true}
            bounces={false}
          >
            {isGroup && (onGroupInfo || participantCount != null) && (
              <OptionItem
                icon="people-outline"
                label={participantCount != null ? `Group info (${participantCount})` : 'Group info'}
                onPress={() => handleOptionPress(onGroupInfo ?? (() => {}))}
                theme={theme}
              />
            )}
            {onViewContact && !isGroup && (
              <OptionItem
                icon="person-outline"
                label="View Contact"
                onPress={() => handleOptionPress(onViewContact)}
                theme={theme}
              />
            )}
            
            {onMediaLinksAndDocs && (
              <OptionItem
                icon="images-outline"
                label="Media, Links, and Docs"
                onPress={() => handleOptionPress(onMediaLinksAndDocs)}
                theme={theme}
              />
            )}
            
            {onSearchInChat && (
              <OptionItem
                icon="search-outline"
                label="Search in Conversation"
                onPress={() => handleOptionPress(onSearchInChat)}
                theme={theme}
              />
            )}
            
            {onMuteNotifications && (
              <OptionItem
                icon={isMuted ? "notifications-outline" : "notifications-off-outline"}
                label={isMuted ? "Unmute Notifications" : "Mute Notifications"}
                onPress={() => handleOptionPress(onMuteNotifications)}
                theme={theme}
              />
            )}
            
            {onDisappearingMessages && (
              <OptionItem
                icon="timer-outline"
                label={disappearingLabel ? `Disappearing (${disappearingLabel})` : 'Disappearing Messages'}
                onPress={() => handleOptionPress(onDisappearingMessages)}
                theme={theme}
              />
            )}
            
            <OptionItem
              icon="image-outline"
              label="Change Wallpaper"
              onPress={() => handleOptionPress(onChangeWallpaper)}
              theme={theme}
            />
            
            {onStarredMessages && (
              <OptionItem
                icon="star-outline"
                label="Starred Messages"
                onPress={() => handleOptionPress(onStarredMessages)}
                theme={theme}
              />
            )}
            
            {onExportChat && (
              <OptionItem
                icon="download-outline"
                label="Export Chat"
                onPress={() => handleOptionPress(onExportChat)}
                theme={theme}
              />
            )}
            
            {onAddShortcut && (
              <OptionItem
                icon="add-circle-outline"
                label="Add Shortcut"
                onPress={() => handleOptionPress(onAddShortcut)}
                theme={theme}
              />
            )}

            {onTogglePin && (
              <OptionItem
                icon={isPinned ? 'pin' : 'pin-outline'}
                label={isPinned ? 'Unpin Conversation' : 'Pin Conversation'}
                onPress={() => handleOptionPress(onTogglePin)}
                theme={theme}
              />
            )}

            {onSetNotificationMode && (
              <>
                <OptionItem
                  icon={notificationMode === 'all' ? 'notifications' : 'notifications-outline'}
                  label="All Notifications"
                  onPress={() => handleOptionPress(() => onSetNotificationMode('all'))}
                  disabled={notificationMode === 'all'}
                  theme={theme}
                />
                <OptionItem
                  icon="at-outline"
                  label="Mentions Only"
                  onPress={() => handleOptionPress(() => onSetNotificationMode('mentions'))}
                  disabled={notificationMode === 'mentions'}
                  theme={theme}
                />
                <OptionItem
                  icon="notifications-off-outline"
                  label="Mute Conversation"
                  onPress={() => handleOptionPress(() => onSetNotificationMode('muted'))}
                  disabled={notificationMode === 'muted'}
                  theme={theme}
                />
              </>
            )}
            
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            
            {onReport && (
              <OptionItem
                icon="flag-outline"
                label="Report User"
                onPress={() => handleOptionPress(onReport)}
                destructive
                theme={theme}
              />
            )}
            
            {onClearChat && (
              <OptionItem
                icon="trash-outline"
                label="Clear Chat"
                onPress={() => handleOptionPress(onClearChat)}
                destructive
                theme={theme}
              />
            )}
            
            {onBlockUser && (
              <OptionItem
                icon={isBlocked ? 'lock-open-outline' : 'ban-outline'}
                label={isBlocked ? 'Unblock User' : 'Block User'}
                onPress={() => handleOptionPress(onBlockUser)}
                destructive={!isBlocked}
                theme={theme}
              />
            )}
          </ScrollView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  menuContainer: {
    position: 'absolute',
    right: 12,
    width: MENU_WIDTH,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
      },
    }),
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  divider: {
    height: 1,
    marginVertical: 6,
    marginHorizontal: 16,
  },
});

export default ThreadOptionsMenu;
