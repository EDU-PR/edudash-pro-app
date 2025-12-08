/**
 * SubPageHeader Component
 * 
 * Simple, minimal header for sub-pages with back arrow navigation.
 * Use this on all non-dashboard screens for consistent navigation UX.
 * 
 * For main dashboards, the header is part of DesktopLayout.
 * 
 * @example
 * ```tsx
 * <SubPageHeader 
 *   title="Homework"
 *   subtitle="Due this week"
 *   rightAction={{ icon: 'add-outline', onPress: () => {} }}
 * />
 * ```
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { navigateBack } from '@/lib/navigation';
import { useCelebration } from '@/hooks/useCelebration';

export interface SubPageHeaderProps {
  /** Page title - required */
  title: string;
  /** Optional subtitle shown below title */
  subtitle?: string;
  /** Custom back handler - defaults to navigateBack() */
  onBack?: () => void;
  /** Optional right action button */
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    label?: string; // Accessibility label
  };
  /** Optional additional right element (e.g., badge, switch) */
  rightElement?: React.ReactNode;
  /** Whether to show the back button - defaults to true */
  showBackButton?: boolean;
  /** Background color override */
  backgroundColor?: string;
  /** Text color override */
  textColor?: string;
}

export function SubPageHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  rightElement,
  showBackButton = true,
  backgroundColor,
  textColor,
}: SubPageHeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { lightHaptic } = useCelebration();
  
  const handleBack = () => {
    lightHaptic();
    if (onBack) {
      onBack();
    } else {
      navigateBack();
    }
  };

  const handleRightAction = () => {
    lightHaptic();
    rightAction?.onPress();
  };

  const bgColor = backgroundColor || theme.surface;
  const txtColor = textColor || theme.text;

  return (
    <View 
      style={[
        styles.container, 
        { 
          paddingTop: insets.top + 8,
          backgroundColor: bgColor,
          borderBottomColor: theme.border,
        }
      ]}
    >
      {/* Back Button */}
      {showBackButton ? (
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons 
            name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} 
            size={24} 
            color={txtColor} 
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.backButton} />
      )}

      {/* Title Section */}
      <View style={styles.titleContainer}>
        <Text 
          style={[styles.title, { color: txtColor }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>
        {subtitle && (
          <Text 
            style={[styles.subtitle, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right Section */}
      <View style={styles.rightSection}>
        {rightElement}
        {rightAction && (
          <TouchableOpacity
            style={styles.rightButton}
            onPress={handleRightAction}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={rightAction.label || 'Action'}
          >
            <Ionicons 
              name={rightAction.icon} 
              size={24} 
              color={txtColor} 
            />
          </TouchableOpacity>
        )}
        {!rightAction && !rightElement && <View style={styles.rightButton} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    textAlign: 'center',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 44,
  },
  rightButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

/**
 * Convenience export for inline header styling
 */
export const subPageHeaderStyles = styles;
