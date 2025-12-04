import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { createDashboardStyles, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '@/lib/styles/dashboardTheme';

interface CollapsibleSectionProps {
  /**
   * Section title
   */
  title: string;
  
  /**
   * Optional icon name from Ionicons
   */
  icon?: keyof typeof Ionicons.glyphMap;
  
  /**
   * Optional icon color
   */
  iconColor?: string;
  
  /**
   * Optional subtitle or description
   */
  subtitle?: string;
  
  /**
   * Optional badge count
   */
  badgeCount?: number;
  
  /**
   * Initially expanded state
   */
  defaultExpanded?: boolean;
  
  /**
   * Children to render when expanded
   */
  children: React.ReactNode;
  
  /**
   * Optional callback when expanded/collapsed
   */
  onToggle?: (expanded: boolean) => void;
  
  /**
   * Optional custom header right component
   */
  headerRight?: React.ReactNode;
}

/**
 * CollapsibleSection Component
 * 
 * Reusable collapsible section with smooth expand/collapse animation.
 * Features:
 * - Icon rotation animation
 * - Optional badge count
 * - Optional subtitle
 * - Custom header right component
 * - Callback on toggle
 * 
 * @example
 * ```tsx
 * <CollapsibleSection
 *   title="Recent Activity"
 *   icon="time"
 *   iconColor="#00f5ff"
 *   badgeCount={3}
 *   defaultExpanded={true}
 * >
 *   <Text>Activity content here</Text>
 * </CollapsibleSection>
 * ```
 */
export function CollapsibleSection({
  title,
  icon,
  iconColor,
  subtitle,
  badgeCount,
  defaultExpanded = false,
  children,
  onToggle,
  headerRight,
}: CollapsibleSectionProps) {
  const { theme } = useTheme();
  const dashStyles = createDashboardStyles(theme);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [rotateAnimation] = useState(new Animated.Value(defaultExpanded ? 1 : 0));

  const toggleExpanded = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    
    // Animate icon rotation
    Animated.timing(rotateAnimation, {
      toValue: newExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    
    // Call callback if provided
    onToggle?.(newExpanded);
  };

  const rotation = rotateAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <View style={styles.container}>
      {/* Collapsible Header */}
      <TouchableOpacity
        style={[dashStyles.collapsibleHeader, styles.header]}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={dashStyles.collapsibleHeaderLeft}>
          {icon && (
            <Ionicons
              name={icon}
              size={24}
              color={iconColor || theme.primary}
            />
          )}
          <View style={styles.titleContainer}>
            <View style={styles.titleRow}>
              <Text style={[dashStyles.collapsibleHeaderTitle, styles.title]}>
                {title}
              </Text>
              {badgeCount !== undefined && badgeCount > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.error }]}>
                  <Text style={styles.badgeText}>{badgeCount}</Text>
                </View>
              )}
            </View>
            {subtitle && (
              <Text style={[dashStyles.collapsibleHeaderSubtitle, styles.subtitle]}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.headerRight}>
          {headerRight}
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Collapsible Content */}
      {expanded && (
        <View style={[dashStyles.collapsibleContent, styles.content]}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  header: {
    minHeight: 56,
  },
  titleContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
  },
  subtitle: {
    marginLeft: 0,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  content: {
    marginTop: SPACING.xs,
  },
});
