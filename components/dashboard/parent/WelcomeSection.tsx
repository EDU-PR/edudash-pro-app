import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { getGreeting } from '@/lib/dashboard/parentDashboardHelpers';
import TierBadge from '@/components/ui/TierBadge';
import { MobileNavDrawer } from '@/components/navigation/MobileNavDrawer';

interface WelcomeSectionProps {
  userName: string;
  subtitle: string;
  isDark: boolean;
  onThemeToggle: () => Promise<void>;
  showTierBadge?: boolean;
  tierBadgePlacement?: 'subtitle-inline' | 'header-right';
  tierBadgeSize?: 'sm' | 'md';
}

// Mobile breakpoint
const MOBILE_BREAKPOINT = 768;

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({ 
  userName, 
  subtitle, 
  isDark,
  onThemeToggle,
  showTierBadge = true,
  tierBadgePlacement = 'subtitle-inline',
          tierBadgeSize="md"
}) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < MOBILE_BREAKPOINT;
  
  // State for mobile nav drawer (web only)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Get first name only for mobile to save space
  const displayName = isMobile 
    ? userName.split(' ')[0] 
    : userName;

  // On web mobile, show hamburger; on native, don't (BottomTabBar handles nav)
  const showHamburger = Platform.OS === 'web' && isMobile;

  const handleThemeToggle = async () => {
    await onThemeToggle();
    try { 
      if (Platform.OS !== 'web') {
        // Use platform-appropriate haptics
        if (Platform.OS === 'ios') {
          await require('expo-haptics').impactAsync(require('expo-haptics').ImpactFeedbackStyle.Light);
        } else {
          require('react-native').Vibration.vibrate(15);
        }
      }
    } catch {}
  };

  const styles = StyleSheet.create({
    welcomeSection: {
      backgroundColor: theme.primary,
      paddingHorizontal: isMobile ? 12 : 20,
      paddingVertical: isMobile ? 12 : 16,
      marginBottom: 8,
    },
    welcomeHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    hamburgerButton: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    greeting: {
      fontSize: isMobile ? 16 : 18,
      fontWeight: '600',
      color: theme.onPrimary,
    },
    welcomeSubtitle: {
      fontSize: isMobile ? 12 : 14,
      color: theme.onPrimary,
      opacity: 0.9,
      marginTop: isMobile ? 2 : 4,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isMobile ? 4 : 8,
    },
    themeToggleButton: {
      width: isMobile ? 32 : 36,
      height: isMobile ? 32 : 36,
      borderRadius: isMobile ? 16 : 18,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    tierBadgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: isMobile ? 4 : 6,
    },
  });

  return (
    <>
      <View style={styles.welcomeSection}>
        <View style={styles.welcomeHeader}>
          <View style={styles.headerLeft}>
            {showHamburger && (
              <TouchableOpacity
                style={styles.hamburgerButton}
                onPress={() => setIsDrawerOpen(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="menu" size={22} color={theme.onPrimary} />
              </TouchableOpacity>
            )}
            
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting} numberOfLines={1}>
                {getGreeting(t)}, {displayName}! {isMobile ? '' : '👋'}
              </Text>
              {!isMobile && <Text style={styles.welcomeSubtitle}>{subtitle}</Text>}
              
              {/* TierBadge - Inline placement below subtitle (hide on mobile for space) */}
              {showTierBadge && tierBadgePlacement === 'subtitle-inline' && !isMobile && (
                <View style={styles.tierBadgeContainer}>
                  <TierBadge size={tierBadgeSize} showManageButton={false} />
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.themeToggleButton}
              onPress={handleThemeToggle}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons 
                name={isDark ? 'sunny' : 'moon'} 
                size={isMobile ? 16 : 18} 
                color={theme.primary} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Mobile Nav Drawer - only on web */}
      {Platform.OS === 'web' && (
        <MobileNavDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
        />
      )}
    </>
  );
};
