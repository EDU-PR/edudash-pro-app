import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { createDashboardStyles, SPACING } from '@/lib/styles/dashboardTheme';

interface DashboardSectionProps {
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
   * Optional subtitle
   */
  subtitle?: string;
  
  /**
   * Optional "View All" button
   */
  showViewAll?: boolean;
  
  /**
   * Optional "View All" text (default: "View All")
   */
  viewAllText?: string;
  
  /**
   * Optional onViewAll handler
   */
  onViewAll?: () => void;
  
  /**
   * Optional custom header right component
   */
  headerRight?: React.ReactNode;
  
  /**
   * Section content
   */
  children: React.ReactNode;
  
  /**
   * Optional custom styles
   */
  style?: ViewStyle;
}

/**
 * DashboardSection Component
 * 
 * Standard section wrapper with consistent spacing and optional header actions.
 * 
 * @example
 * ```tsx
 * <DashboardSection
 *   title="Recent Activity"
 *   icon="time"
 *   iconColor="#00f5ff"
 *   subtitle="Last 7 days"
 *   showViewAll
 *   onViewAll={() => navigation.navigate('AllActivity')}
 * >
 *   <ActivityList items={recentActivity} />
 * </DashboardSection>
 * ```
 */
export function DashboardSection({
  title,
  icon,
  iconColor,
  subtitle,
  showViewAll = false,
  viewAllText = 'View All',
  onViewAll,
  headerRight,
  children,
  style,
}: DashboardSectionProps) {
  const { theme } = useTheme();
  const dashStyles = createDashboardStyles(theme);

  return (
    <View style={[dashStyles.section, styles.section, style]}>
      {/* Section Header */}
      <View style={dashStyles.sectionHeader}>
        <View style={styles.headerLeft}>
          {icon && (
            <Ionicons
              name={icon}
              size={24}
              color={iconColor || theme.primary}
              style={styles.icon}
            />
          )}
          <View style={styles.titleContainer}>
            <Text style={dashStyles.sectionTitle}>{title}</Text>
            {subtitle && (
              <Text style={dashStyles.sectionSubtitle}>{subtitle}</Text>
            )}
          </View>
        </View>

        {/* Header Right Actions */}
        <View style={styles.headerRight}>
          {headerRight}
          {showViewAll && onViewAll && (
            <TouchableOpacity
              style={dashStyles.viewAllButton}
              onPress={onViewAll}
              activeOpacity={0.7}
            >
              <Text style={dashStyles.viewAllText}>{viewAllText}</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Section Content */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    // Additional section-specific styles if needed
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: SPACING.sm,
  },
  titleContainer: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
});
