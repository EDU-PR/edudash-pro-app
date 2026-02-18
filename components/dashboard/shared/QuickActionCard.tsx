/**
 * Shared QuickActionCard Component
 * 
 * A reusable quick action button card for dashboards.
 * Used by Principal, Teacher, and Parent dashboards.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import Feedback from '@/lib/feedback';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;

export interface QuickActionCardProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
  subtitle?: string;
  badgeCount?: number;
  disabled?: boolean;
  cardWidth?: number;
  variant?: 'default' | 'glass';
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({ 
  title, 
  icon, 
  color, 
  onPress, 
  subtitle, 
  badgeCount,
  disabled = false,
  cardWidth: customCardWidth,
  variant = 'default',
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme, customCardWidth, variant);

  const handlePress = async () => {
    if (disabled) return;
    try {
      await Feedback.vibrate(10);
    } catch {
      // Vibration not supported, ignore
    }
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.actionCard, disabled && styles.actionCardDisabled]}
      onPress={handlePress}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons 
          name={icon as any} 
          size={isSmallScreen ? 20 : 24} 
          color={disabled ? theme.textSecondary : color} 
        />
        {badgeCount !== undefined && badgeCount > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.error }]}>
            <Text style={styles.badgeText}>
              {badgeCount > 99 ? '99+' : badgeCount}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.actionTitle, disabled && styles.actionTitleDisabled]}>
        {title}
      </Text>
      {subtitle && (
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      )}
    </TouchableOpacity>
  );
};

const isDarkHex = (hex: string): boolean => {
  const match = String(hex || '').trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return false;
  const value = match[1];
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.55;
};

const createStyles = (theme: any, customCardWidth?: number, variant: 'default' | 'glass' = 'default') => {
  const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;
  const isDark = isDarkHex(theme?.background);
  const glass = variant === 'glass';
  const cardBackground = glass
    ? (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.72)')
    : theme.cardBackground;
  const cardBorder = glass
    ? (isDark ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.82)')
    : 'transparent';

  return StyleSheet.create({
    actionCard: {
      backgroundColor: cardBackground,
      borderRadius: isSmallScreen ? 12 : 16,
      padding: isSmallScreen ? 12 : 16,
      alignItems: 'center',
      ...(customCardWidth ? { width: customCardWidth } : { flex: 1 }),
      marginBottom: cardGap,
      borderWidth: glass ? 1 : 0,
      borderColor: cardBorder,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: glass ? 10 : 2 },
      shadowOpacity: glass ? 0.16 : 0.06,
      shadowRadius: glass ? 16 : 6,
      elevation: glass ? 6 : 2,
      minHeight: isSmallScreen ? 90 : 110,
    },
    actionCardDisabled: {
      opacity: 0.5,
    },
    actionIcon: {
      width: isSmallScreen ? 48 : 56,
      height: isSmallScreen ? 48 : 56,
      borderRadius: isSmallScreen ? 12 : 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: isSmallScreen ? 8 : 12,
      position: 'relative',
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: cardBackground,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 13,
    },
    actionTitle: {
      fontSize: isSmallScreen ? 12 : 14,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      lineHeight: isSmallScreen ? 16 : 18,
    },
    actionTitleDisabled: {
      color: theme.textSecondary,
    },
    actionSubtitle: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 4,
    },
  });
};

export default QuickActionCard;
