/**
 * SimpleHeader - A minimal header for sub-screens
 * 
 * Features:
 * - Back button on the left
 * - Centered title
 * - Optional right action
 * - Safe area aware
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { navigateBack } from '@/lib/navigation';

interface SimpleHeaderProps {
  title: string;
  onBackPress?: () => void;
  rightAction?: React.ReactNode;
  showBackButton?: boolean;
}

export function SimpleHeader({ 
  title, 
  onBackPress, 
  rightAction,
  showBackButton = true 
}: SimpleHeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      navigateBack();
    }
  };

  return (
    <View style={[
      styles.container,
      { 
        paddingTop: insets.top + 8,
        backgroundColor: theme.surface,
        borderBottomColor: theme.divider,
      }
    ]}>
      <View style={styles.content}>
        {/* Left - Back button */}
        <View style={styles.leftSection}>
          {showBackButton && (
            <TouchableOpacity
              onPress={handleBackPress}
              style={styles.backButton}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons 
                name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} 
                size={24} 
                color={theme.text} 
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Center - Title */}
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {/* Right - Optional action */}
        <View style={styles.rightSection}>
          {rightAction}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    minHeight: 44,
  },
  leftSection: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  titleSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  rightSection: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});

export default SimpleHeader;
