/**
 * MessageHeader - A clean, modern header for messaging screens
 * Replaces RoleBasedHeader for messaging contexts
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

interface MessageHeaderProps {
  title: string;
  subtitle?: string;
  avatarIcon?: keyof typeof Ionicons.glyphMap;
  avatarColor?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  // Call buttons
  showCallButtons?: boolean;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  // Right actions
  rightActions?: React.ReactNode;
  // Online status
  isOnline?: boolean;
}

export function MessageHeader({
  title,
  subtitle,
  avatarIcon = 'person',
  avatarColor,
  showBackButton = true,
  onBackPress,
  showCallButtons = false,
  onVoiceCall,
  onVideoCall,
  rightActions,
  isOnline,
}: MessageHeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };
  
  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      paddingTop: Platform.OS === 'ios' ? insets.top : StatusBar.currentHeight || 0,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 3,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      minHeight: 56,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    avatarContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: avatarColor || theme.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      position: 'relative',
    },
    onlineIndicator: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: theme.success,
      borderWidth: 2,
      borderColor: theme.surface,
    },
    offlineIndicator: {
      backgroundColor: theme.textSecondary,
    },
    titleContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.text,
      letterSpacing: 0.2,
    },
    subtitle: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    callButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    voiceCallButton: {
      backgroundColor: theme.success + '15',
    },
    videoCallButton: {
      backgroundColor: theme.info + '15',
    },
  });
  
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {showBackButton && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
        )}
        
        <View style={styles.avatarContainer}>
          <Ionicons 
            name={avatarIcon} 
            size={24} 
            color={avatarColor || theme.primary} 
          />
          {isOnline !== undefined && (
            <View style={[
              styles.onlineIndicator, 
              !isOnline && styles.offlineIndicator
            ]} />
          )}
        </View>
        
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          )}
        </View>
        
        <View style={styles.actionsContainer}>
          {showCallButtons && (
            <>
              {onVoiceCall && (
                <TouchableOpacity 
                  style={[styles.callButton, styles.voiceCallButton]}
                  onPress={onVoiceCall}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <Ionicons name="call" size={20} color={theme.success} />
                </TouchableOpacity>
              )}
              {onVideoCall && (
                <TouchableOpacity 
                  style={[styles.callButton, styles.videoCallButton]}
                  onPress={onVideoCall}
                  hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                >
                  <Ionicons name="videocam" size={20} color={theme.info} />
                </TouchableOpacity>
              )}
            </>
          )}
          {rightActions}
        </View>
      </View>
    </View>
  );
}

/**
 * MessagesListHeader - Header for the messages list screen
 * Clean design with title + optional dropdown menu (no "new message" button — that's a FAB now)
 */
interface MessagesListHeaderProps {
  title: string;
  subtitle?: string;
  rightActionLabel?: string;
  onRightActionPress?: () => void;
  /** Dropdown menu items */
  menuItems?: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    destructive?: boolean;
  }>;
  showBackButton?: boolean;
  onBackPress?: () => void;
  /** Opens the global message search modal */
  onSearchPress?: () => void;
  /** @deprecated Use menuItems instead */
  onNewMessage?: () => void;
  /** @deprecated Use menuItems instead */
  onSettings?: () => void;
}

export function MessagesListHeader({
  title,
  subtitle,
  rightActionLabel,
  onRightActionPress,
  menuItems,
  showBackButton = true,
  onBackPress,
  onSearchPress,
  onNewMessage,
  onSettings,
}: MessagesListHeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [showMenu, setShowMenu] = React.useState(false);
  
  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  // Build menu from either new menuItems prop or legacy onSettings/onNewMessage
  const resolvedMenu = React.useMemo(() => {
    if (menuItems && menuItems.length > 0) return menuItems;
    const legacy: typeof menuItems = [];
    if (onNewMessage) legacy.push({ icon: 'create-outline', label: 'New Message', onPress: onNewMessage });
    if (onSettings) legacy.push({ icon: 'settings-outline', label: 'Settings', onPress: onSettings });
    return legacy;
  }, [menuItems, onNewMessage, onSettings]);
  
  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      paddingTop: Platform.OS === 'ios' ? insets.top : StatusBar.currentHeight || 0,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 56,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
      marginLeft: -8,
    },
    titleContainer: {
      flex: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 2,
    },
    menuButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.elevated,
    },
    rightActionButton: {
      minWidth: 52,
      height: 34,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      backgroundColor: theme.elevated,
      marginRight: resolvedMenu.length > 0 ? 8 : 0,
    },
    rightActionText: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    // Dropdown menu
    menuOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
    },
    menuBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    menuDropdown: {
      position: 'absolute',
      top: (Platform.OS === 'ios' ? insets.top : StatusBar.currentHeight || 0) + 52,
      right: 12,
      backgroundColor: theme.surface,
      borderRadius: 14,
      minWidth: 200,
      paddingVertical: 6,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
        },
        android: {
          elevation: 12,
        },
      }),
      borderWidth: 1,
      borderColor: theme.border,
      zIndex: 1001,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 16,
      gap: 12,
    },
    menuItemText: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.text,
    },
    menuItemTextDestructive: {
      color: theme.error || '#ef4444',
    },
    menuSeparator: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 4,
      marginHorizontal: 12,
    },
  });
  
  return (
    <>
      <View style={styles.container}>
        <View style={styles.content}>
          {showBackButton && (
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          )}
          
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && (
              <Text style={styles.subtitle}>{subtitle}</Text>
            )}
          </View>
          
          {onSearchPress && (
            <TouchableOpacity
              style={styles.menuButton}
              onPress={onSearchPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="search-outline" size={20} color={theme.text} />
            </TouchableOpacity>
          )}

          {!!rightActionLabel && onRightActionPress && (
            <TouchableOpacity
              style={styles.rightActionButton}
              onPress={onRightActionPress}
              activeOpacity={0.85}
            >
              <Text style={styles.rightActionText}>{rightActionLabel}</Text>
            </TouchableOpacity>
          )}

          {resolvedMenu.length > 0 && (
            <TouchableOpacity 
              style={styles.menuButton}
              onPress={() => setShowMenu(prev => !prev)}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Dropdown Menu – rendered outside header so it can overlap content */}
      {showMenu && (
        <View style={styles.menuOverlay} pointerEvents="box-none">
          <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setShowMenu(false)} />
          <View style={styles.menuDropdown}>
            {resolvedMenu.map((item, i) => (
              <React.Fragment key={item.label}>
                {i > 0 && item.destructive && <View style={styles.menuSeparator} />}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    item.onPress();
                  }}
                  activeOpacity={0.6}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.destructive ? (theme.error || '#ef4444') : theme.textSecondary}
                  />
                  <Text style={[styles.menuItemText, item.destructive && styles.menuItemTextDestructive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </View>
      )}
    </>
  );
}
