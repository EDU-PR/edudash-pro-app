/**
 * Shared CollapsibleSection Component
 * 
 * A reusable collapsible section with animated expand/collapse.
 * Used by Principal, Teacher, and Parent dashboards.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  interpolate
} from 'react-native-reanimated';
import Feedback from '@/lib/feedback';

const { width } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 380;

export interface CollapsibleSectionProps {
  title: string;
  sectionId: string;
  icon?: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  onToggle?: (sectionId: string, isCollapsed: boolean) => void;
  /** Optional action button label shown in header */
  actionLabel?: string;
  /** Optional action button press handler */
  onActionPress?: () => void;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
  title, 
  sectionId,
  icon,
  children, 
  defaultCollapsed = false,
  onToggle,
  actionLabel,
  onActionPress,
}) => {
  const { theme } = useTheme();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const rotation = useSharedValue(defaultCollapsed ? 0 : 1);
  const contentOpacity = useSharedValue(defaultCollapsed ? 0 : 1);

  const styles = createStyles(theme);

  // Sync with external collapsed state (from parent component)
  useEffect(() => {
    if (defaultCollapsed !== collapsed) {
      setCollapsed(defaultCollapsed);
      rotation.value = withTiming(defaultCollapsed ? 0 : 1, { duration: 200 });
      contentOpacity.value = withTiming(defaultCollapsed ? 0 : 1, { duration: 200 });
    }
  }, [defaultCollapsed]);

  const toggleCollapse = useCallback(() => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    rotation.value = withTiming(newCollapsed ? 0 : 1, { duration: 200 });
    contentOpacity.value = withTiming(newCollapsed ? 0 : 1, { duration: 200 });
    
    try {
      Feedback.vibrate(5);
    } catch {
      // Vibration not supported, ignore
    }
    
    if (onToggle) {
      onToggle(sectionId, newCollapsed);
    }
  }, [collapsed, sectionId, onToggle, rotation, contentOpacity]);

  const animatedChevronStyle = useAnimatedStyle(() => {
    const rotate = interpolate(rotation.value, [0, 1], [0, 90]);
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
    };
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleCollapse}
        activeOpacity={0.7}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
      >
        <View style={styles.headerLeft}>
          {icon && (
            // Check if icon is an Ionicons name (lowercase start) or emoji/text
            typeof icon === 'string' && icon.length > 0 && /^[a-z]/.test(icon) ? (
              <Ionicons name={icon as any} size={18} color={theme.primary} style={{ marginRight: 4 }} />
            ) : (
              <Text style={styles.headerIcon}>{icon}</Text>
            )
          )}
          <View style={[styles.headerChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {actionLabel && onActionPress && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation?.();
                onActionPress();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.actionText, { color: theme.primary }]}>{actionLabel}</Text>
            </TouchableOpacity>
          )}
          <Animated.View style={animatedChevronStyle}>
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={theme.textSecondary} 
            />
          </Animated.View>
        </View>
      </TouchableOpacity>
      <Animated.View style={animatedContentStyle}>
        {/* Always render children but control visibility with display/height */}
        <View style={collapsed ? styles.hiddenContent : undefined}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: any) => {
  return StyleSheet.create({
    container: {
      marginBottom: 24,
    },
    hiddenContent: {
      height: 0,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 4,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerIcon: {
      fontSize: 18,
      marginRight: 4,
    },
    headerChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    headerTitle: {
      fontSize: isTablet ? 22 : isSmallScreen ? 18 : 20,
      fontWeight: '600',
      color: theme.text,
    },
    actionButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    actionText: {
      fontSize: isSmallScreen ? 12 : 14,
      fontWeight: '600',
    },
  });
};

export default CollapsibleSection;
