/**
 * Shared CollapsibleSection Component
 * 
 * A reusable collapsible section with animated expand/collapse.
 * Used by Principal, Teacher, and Parent dashboards.
 */

import React, { useState, useCallback } from 'react';
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
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
  title, 
  sectionId,
  icon,
  children, 
  defaultCollapsed = false,
  onToggle,
}) => {
  const { theme } = useTheme();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const rotation = useSharedValue(defaultCollapsed ? 0 : 1);
  const contentHeight = useSharedValue(defaultCollapsed ? 0 : 1);

  const styles = createStyles(theme);

  const toggleCollapse = useCallback(() => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    rotation.value = withTiming(newCollapsed ? 0 : 1, { duration: 200 });
    contentHeight.value = withTiming(newCollapsed ? 0 : 1, { duration: 200 });
    
    try {
      Feedback.vibrate(5);
    } catch {
      // Vibration not supported, ignore
    }
    
    if (onToggle) {
      onToggle(sectionId, newCollapsed);
    }
  }, [collapsed, sectionId, onToggle, rotation, contentHeight]);

  const animatedChevronStyle = useAnimatedStyle(() => {
    const rotate = interpolate(rotation.value, [0, 1], [0, 90]);
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: contentHeight.value,
      maxHeight: contentHeight.value === 0 ? 0 : undefined,
      overflow: 'hidden' as const,
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
            <Text style={styles.headerIcon}>{icon}</Text>
          )}
          <View style={[styles.headerChip, { borderColor: theme.primary, backgroundColor: theme.surface }]}>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
        </View>
        <Animated.View style={animatedChevronStyle}>
          <Ionicons 
            name="chevron-forward" 
            size={20} 
            color={theme.textSecondary} 
          />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View style={animatedContentStyle}>
        {!collapsed && children}
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: any) => {
  return StyleSheet.create({
    container: {
      marginBottom: 24,
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
  });
};

export default CollapsibleSection;
