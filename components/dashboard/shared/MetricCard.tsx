/**
 * Shared MetricCard Component
 * 
 * A reusable metric display card for dashboards.
 * Used by Principal, Teacher, and Parent dashboards.
 * Supports glow animation for attention-needing items and badge counters.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;

export interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: 'up' | 'down' | 'stable' | 'good' | 'excellent' | 'warning' | 'attention' | 'needs_attention' | 'low' | 'high';
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
  valueColor?: string;
  cardWidth?: number;
  /** Show glow animation (e.g., for unread messages, missed calls) */
  glow?: boolean;
  /** Optional badge count (shown on icon) */
  badge?: number;
  /** Priority level for visual indicator - 🔴 urgent, 🟡 important, 🟢 informational */
  priority?: 'urgent' | 'important' | 'informational';
}

export const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  icon, 
  color, 
  trend, 
  onPress,
  size = 'medium',
  valueColor,
  cardWidth: customCardWidth,
  glow = false,
  badge,
  priority,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme, customCardWidth);
  
  // Animated value for glow effect
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  // Start glow animation when glow prop is true
  useEffect(() => {
    if (glow) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [glow, glowAnim]);
  
  // Interpolate glow values
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.4],
  });
  
  const shadowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 20],
  });

  const getTrendColor = (trendType: string) => {
    switch (trendType) {
      case 'up': case 'good': case 'excellent': case 'stable': 
        return { color: theme.success };
      case 'warning': case 'attention': case 'high': 
        return { color: theme.warning };
      case 'down': case 'low': case 'needs_attention': 
        return { color: theme.error };
      default: 
        return { color: theme.textSecondary };
    }
  };

  const getTrendIcon = (trendType: string): string => {
    switch (trendType) {
      case 'up': case 'good': case 'excellent': return '↗️';
      case 'down': case 'low': return '↘️';
      case 'warning': case 'attention': case 'needs_attention': return '⚠️';
      default: return '➡️';
    }
  };

  const getTrendText = (trendType: string): string => {
    const trendLabels: Record<string, string> = {
      up: 'Up',
      down: 'Down',
      good: 'Good',
      excellent: 'Excellent',
      warning: 'Warning',
      attention: 'Attention',
      needs_attention: 'Needs attention',
      low: 'Low',
      stable: 'Stable',
      high: 'High',
    };
    return trendLabels[trendType] || trendType;
  };

  // Priority indicator colors and labels
  const getPriorityInfo = (priorityLevel?: 'urgent' | 'important' | 'informational') => {
    switch (priorityLevel) {
      case 'urgent':
        return { color: '#DC2626', label: 'Urgent', icon: '🔴' };
      case 'important':
        return { color: '#F59E0B', label: 'Important', icon: '🟡' };
      case 'informational':
        return { color: '#10B981', label: 'Info', icon: '🟢' };
      default:
        return null;
    }
  };

  const priorityInfo = getPriorityInfo(priority);

  return (
    <Animated.View
      style={[
        glow && {
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: glowOpacity,
          shadowRadius: shadowRadius,
          elevation: 8,
        },
      ]}
    >
      <TouchableOpacity
        style={[
          styles.metricCard,
          size === 'large' && styles.metricCardLarge,
          size === 'small' && styles.metricCardSmall,
          glow && { borderWidth: 1, borderColor: color + '40' },
          priorityInfo && { borderLeftWidth: 3, borderLeftColor: priorityInfo.color },
        ]}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.7}
      >
        <View style={styles.metricContent}>
          {/* Priority indicator pill */}
          {priorityInfo && (
            <View style={[styles.priorityPill, { backgroundColor: priorityInfo.color + '15' }]}>
              <Text style={[styles.priorityText, { color: priorityInfo.color }]}>
                {priorityInfo.icon} {priorityInfo.label}
              </Text>
            </View>
          )}
          <View style={styles.metricHeader}>
            <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
              <Ionicons 
                name={icon as any} 
                size={isSmallScreen ? (size === 'large' ? 24 : 20) : (size === 'large' ? 28 : 24)} 
                color={color} 
              />
              {/* Badge counter */}
              {badge !== undefined && badge > 0 && (
                <View style={[styles.badge, { backgroundColor: color }]}>
                  <Text style={styles.badgeText}>
                    {badge > 99 ? '99+' : badge}
                  </Text>
                </View>
              )}
            </View>
            {trend && (
              <View style={styles.trendContainer}>
                <Text style={[styles.trendText, getTrendColor(trend)]}>
                  {getTrendIcon(trend)} {getTrendText(trend)}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.metricValue, valueColor && { color: valueColor }]}>
            {value}
          </Text>
          <Text style={styles.metricTitle}>{title}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const createStyles = (theme: any, customCardWidth?: number) => {
  const cardPadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
  const cardGap = isTablet ? 12 : isSmallScreen ? 6 : 8;
  const containerWidth = width - (cardPadding * 2);
  const defaultCardWidth = isTablet ? (containerWidth - (cardGap * 3)) / 4 : (containerWidth - cardGap) / 2;
  const cardWidth = customCardWidth || defaultCardWidth;

  // Fixed 3-column layout for small cards (Quick Actions)
  // Calculate to ensure exactly 3 cards fit per row with proper spacing
  const smallCardWidth = isTablet 
    ? (width - 80) / 5 
    : Math.floor((width - (cardPadding * 2) - (cardGap * 4)) / 3);

  return StyleSheet.create({
    metricCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: isSmallScreen ? 12 : 16,
      padding: isSmallScreen ? 14 : 18,
      width: cardWidth,
      marginHorizontal: cardGap / 2,
      marginBottom: cardGap,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
      minHeight: isSmallScreen ? 110 : 130,
    },
    metricCardLarge: {
      width: isTablet ? (width - 60) / 2 : width - (cardPadding * 2),
    },
    metricCardSmall: {
      width: smallCardWidth,
      padding: isSmallScreen ? 8 : 12,
      minHeight: isSmallScreen ? 80 : 100,
    },
    metricContent: {
      alignItems: 'flex-start',
      flex: 1,
    },
    metricHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      width: '100%',
      marginBottom: isSmallScreen ? 10 : 14,
    },
    iconContainer: {
      width: isSmallScreen ? 44 : 52,
      height: isSmallScreen ? 44 : 52,
      borderRadius: isSmallScreen ? 12 : 14,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    badge: {
      position: 'absolute',
      top: -6,
      right: -6,
      minWidth: isSmallScreen ? 18 : 20,
      height: isSmallScreen ? 18 : 20,
      borderRadius: isSmallScreen ? 9 : 10,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: theme.cardBackground,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: isSmallScreen ? 10 : 11,
      fontWeight: '700',
    },
    priorityPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: isSmallScreen ? 6 : 8,
      paddingVertical: isSmallScreen ? 2 : 3,
      borderRadius: 4,
      marginBottom: 8,
    },
    priorityText: {
      fontSize: isSmallScreen ? 9 : 10,
      fontWeight: '600',
    },
    trendContainer: {
      backgroundColor: theme.surface,
      paddingHorizontal: isSmallScreen ? 6 : 8,
      paddingVertical: isSmallScreen ? 3 : 4,
      borderRadius: 6,
      maxWidth: '100%',
    },
    trendText: {
      fontSize: isSmallScreen ? 10 : 11,
      fontWeight: '600',
      lineHeight: isSmallScreen ? 12 : 14,
    },
    metricValue: {
      fontSize: isSmallScreen ? 24 : isTablet ? 36 : 32,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 6,
      lineHeight: isSmallScreen ? 28 : isTablet ? 40 : 36,
    },
    metricTitle: {
      fontSize: isSmallScreen ? 13 : isTablet ? 16 : 15,
      color: theme.textSecondary,
      fontWeight: '500',
      lineHeight: isSmallScreen ? 18 : isTablet ? 22 : 20,
      textAlign: 'left',
    },
  });
};

export default MetricCard;
