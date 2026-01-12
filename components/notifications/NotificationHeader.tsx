/**
 * NotificationHeader Component
 * 
 * Renders a screen header with back button, title, subtitle, and optional right action.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

interface NotificationHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: { 
    icon: keyof typeof Ionicons.glyphMap; 
    onPress: () => void;
  };
}

export const NotificationHeader: React.FC<NotificationHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[
      styles.header, 
      { 
        paddingTop: insets.top + 8, 
        backgroundColor: theme.surface, 
        borderBottomColor: theme.border,
      }
    ]}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={onBack || (() => router.back())}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </TouchableOpacity>
      
      <View style={styles.titleContainer}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
      
      {rightAction ? (
        <TouchableOpacity 
          style={styles.rightButton} 
          onPress={rightAction.onPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={rightAction.icon} size={24} color={theme.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.rightButton} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  rightButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NotificationHeader;
