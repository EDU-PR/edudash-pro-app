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
 */
interface MessagesListHeaderProps {
  title: string;
  subtitle?: string;
  onNewMessage?: () => void;
  onSettings?: () => void;
  showBackButton?: boolean;
  onBackPress?: () => void;
}

export function MessagesListHeader({
  title,
  subtitle,
  onNewMessage,
  onSettings,
  showBackButton = true,
  onBackPress,
}: MessagesListHeaderProps) {
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
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.elevated,
    },
    newMessageButton: {
      backgroundColor: theme.primary,
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
        
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
        </View>
        
        <View style={styles.actionsContainer}>
          {onSettings && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={onSettings}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
            </TouchableOpacity>
          )}
          {onNewMessage && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.newMessageButton]}
              onPress={onNewMessage}
            >
              <Ionicons name="create-outline" size={20} color={theme.onPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
