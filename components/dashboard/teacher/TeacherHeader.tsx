/**
 * Teacher Dashboard Header Component
 * Mobile-responsive with hamburger menu for web mobile (< 768px)
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { getStyles, getMobileStyles } from './styles';
import { MobileNavDrawer } from '@/components/navigation/MobileNavDrawer';

interface TeacherHeaderProps {
  teacherName: string;
  role: string;
  hasActiveSeat: boolean;
  seatStatus: string;
  onMenuPress: () => void;
}

// Mobile breakpoint
const MOBILE_BREAKPOINT = 768;

export const TeacherHeader: React.FC<TeacherHeaderProps> = ({
  teacherName,
  role,
  hasActiveSeat,
  seatStatus,
  onMenuPress,
}) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isMobile = windowWidth < MOBILE_BREAKPOINT;
  
  // State for mobile nav drawer (web only)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const styles = getStyles(theme, isDark);
  const mobileStyles = getMobileStyles(theme, isDark);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Get first name only for mobile to save space
  const displayName = isMobile 
    ? teacherName.split(' ')[0] 
    : teacherName;

  // On web mobile, show hamburger; on native, don't (BottomTabBar handles nav)
  const showHamburger = Platform.OS === 'web' && isMobile;

  return (
    <>
      <View style={isMobile ? mobileStyles.header : styles.header}>
        <View style={isMobile ? mobileStyles.headerCard : styles.headerCard}>
          <View style={isMobile ? mobileStyles.headerContent : styles.headerContent}>
            {/* Left side: Hamburger (web mobile) + Greeting */}
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              {showHamburger && (
                <TouchableOpacity
                  style={mobileStyles.hamburgerButton}
                  onPress={() => setIsDrawerOpen(true)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="menu" size={22} color={theme.text} />
                </TouchableOpacity>
              )}
              
              <View style={{ flex: 1 }}>
                <View style={isMobile ? mobileStyles.headerTitleRow : styles.headerTitleRow}>
                  {!showHamburger && (
                    <Ionicons
                      name="school"
                      size={isMobile ? 16 : 20}
                      color={theme.primary}
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text style={isMobile ? mobileStyles.greeting : styles.greeting} numberOfLines={1}>
                    {getGreeting()}, {displayName}! {isMobile ? '' : '👩‍🏫'}
                  </Text>
                </View>
                
                {/* Badges - simplified on mobile */}
                <View style={isMobile ? mobileStyles.subRow : styles.subRow}>
                  <View style={isMobile ? mobileStyles.roleBadge : styles.roleBadge}>
                    <Text style={isMobile ? mobileStyles.roleBadgeText : styles.roleBadgeText}>
                      {role === "teacher" ? "Teacher" : "Teacher"}
                    </Text>
                  </View>
                  {/* Only show seat status on non-mobile or if there's an issue */}
                  {(!isMobile || !hasActiveSeat) && (
                    <View
                      style={[
                        isMobile ? mobileStyles.roleBadge : styles.roleBadge,
                        {
                          backgroundColor: hasActiveSeat
                            ? "#10B98120"
                            : seatStatus === "pending"
                              ? "#F59E0B20"
                              : "#DC262620",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          isMobile ? mobileStyles.roleBadgeText : styles.roleBadgeText,
                          {
                            color: hasActiveSeat
                              ? "#10B981"
                              : seatStatus === "pending"
                                ? "#F59E0B"
                                : "#DC2626",
                          },
                        ]}
                      >
                        {isMobile 
                          ? (hasActiveSeat ? '✓' : seatStatus === "pending" ? '⏳' : '!')
                          : `Seat: ${hasActiveSeat ? "Active" : seatStatus === "pending" ? "Pending" : "Inactive"}`
                        }
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            
            {/* Right side: Actions */}
            <View style={isMobile ? mobileStyles.headerActions : styles.headerActions}>
              <TouchableOpacity
                style={isMobile ? mobileStyles.themeToggleButton : styles.themeToggleButton}
                onPress={async () => {
                  await toggleTheme();
                  try {
                    if (Platform.OS !== 'web') {
                      if (Platform.OS === 'ios') {
                        await require('expo-haptics').impactAsync(require('expo-haptics').ImpactFeedbackStyle.Light);
                      } else {
                        require('react-native').Vibration.vibrate(15);
                      }
                    }
                  } catch {}
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={isDark ? 'sunny' : 'moon'}
                  size={isMobile ? 18 : 20}
                  color={theme.primary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={isMobile ? mobileStyles.headerMenuButton : styles.headerMenuButton}
                onPress={onMenuPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="ellipsis-vertical"
                  size={isMobile ? 20 : 24}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
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
