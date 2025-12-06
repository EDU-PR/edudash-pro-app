/**
 * ThreadOptionsMenu Component
 * Bottom sheet with thread/chat options
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
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  Platform,
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
  isMuted?: boolean;
  contactName?: string;
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
}) => {
  const styles = StyleSheet.create({
    optionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      opacity: disabled ? 0.5 : 1,
    },
    optionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: destructive ? theme.error + '15' : theme.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    optionLabel: {
      fontSize: 16,
      color: destructive ? theme.error : theme.text,
      flex: 1,
    },
  });

  return (
    <TouchableOpacity
      style={styles.optionItem}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.optionIcon}>
        <Ionicons 
          name={icon} 
          size={22} 
          color={destructive ? theme.error : theme.primary} 
        />
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

export const ThreadOptionsMenu: React.FC<ThreadOptionsMenuProps> = ({
  visible,
  onClose,
  onChangeWallpaper,
  onMuteNotifications,
  onSearchInChat,
  onClearChat,
  onBlockUser,
  onViewContact,
  isMuted = false,
  contactName,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(400);
    }
  }, [visible, slideAnim]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 400,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onClose());
  };

  const handleOptionPress = (callback: () => void) => {
    handleClose();
    // Small delay to let the menu close animation start
    setTimeout(callback, 100);
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: insets.bottom + 16,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 2,
    },
    optionsContainer: {
      paddingTop: 8,
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 8,
      marginHorizontal: 20,
    },
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View 
              style={[
                styles.container,
                { transform: [{ translateY: slideAnim }] }
              ]}
            >
              <View style={styles.handle} />
              
              {contactName && (
                <View style={styles.header}>
                  <Text style={styles.headerTitle}>Chat Options</Text>
                  <Text style={styles.headerSubtitle}>{contactName}</Text>
                </View>
              )}
              
              <View style={styles.optionsContainer}>
                {onViewContact && (
                  <OptionItem
                    icon="person-outline"
                    label="View Contact"
                    onPress={() => handleOptionPress(onViewContact)}
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
                
                <OptionItem
                  icon="image-outline"
                  label="Change Wallpaper"
                  onPress={() => handleOptionPress(onChangeWallpaper)}
                  theme={theme}
                />
                
                <View style={styles.divider} />
                
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
                    icon="ban-outline"
                    label="Block User"
                    onPress={() => handleOptionPress(onBlockUser)}
                    destructive
                    theme={theme}
                  />
                )}
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default ThreadOptionsMenu;
