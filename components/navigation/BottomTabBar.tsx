import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 360;
const isShortScreen = SCREEN_HEIGHT < 700;
const isCompact = isSmallScreen || isShortScreen;

interface TabItem {
  id: string;
  label: string;
  icon: string;
  activeIcon: string;
  route: string;
  roles?: string[];
}

const TAB_ITEMS: TabItem[] = [
  // Parent tabs
  { 
    id: 'parent-dashboard', 
    label: 'Home', 
    icon: 'home-outline', 
    activeIcon: 'home', 
    route: '/screens/parent-dashboard', 
    roles: ['parent'] 
  },
  { 
    id: 'parent-children', 
    label: 'Children', 
    icon: 'heart-outline', 
    activeIcon: 'heart', 
    route: '/screens/parent-children', 
    roles: ['parent'] 
  },
  { 
    id: 'parent-messages', 
    label: 'Messages', 
    icon: 'chatbubble-outline', 
    activeIcon: 'chatbubble', 
    route: '/screens/parent-messages', 
    roles: ['parent'] 
  },
  { 
    id: 'parent-calendar', 
    label: 'Calendar', 
    icon: 'calendar-outline', 
    activeIcon: 'calendar', 
    route: '/screens/calendar', 
    roles: ['parent'] 
  },
  { 
    id: 'parent-settings', 
    label: 'Settings', 
    icon: 'settings-outline', 
    activeIcon: 'settings', 
    route: '/screens/settings', 
    roles: ['parent'] 
  },
  
  // Teacher tabs
  { 
    id: 'teacher-dashboard', 
    label: 'Home', 
    icon: 'home-outline', 
    activeIcon: 'home', 
    route: '/screens/teacher-dashboard', 
    roles: ['teacher'] 
  },
  { 
    id: 'students', 
    label: 'Students', 
    icon: 'people-outline', 
    activeIcon: 'people', 
    route: '/screens/student-management', 
    roles: ['teacher'] 
  },
  { 
    id: 'teacher-messages', 
    label: 'Messages', 
    icon: 'chatbubble-outline', 
    activeIcon: 'chatbubble', 
    route: '/screens/teacher-message-list', 
    roles: ['teacher'] 
  },
  { 
    id: 'teacher-calendar', 
    label: 'Calendar', 
    icon: 'calendar-outline', 
    activeIcon: 'calendar', 
    route: '/screens/calendar', 
    roles: ['teacher'] 
  },
  { 
    id: 'teacher-settings', 
    label: 'Settings', 
    icon: 'settings-outline', 
    activeIcon: 'settings', 
    route: '/screens/settings', 
    roles: ['teacher'] 
  },
  
  // Principal tabs
  { 
    id: 'principal-dashboard', 
    label: 'Home', 
    icon: 'home-outline', 
    activeIcon: 'home', 
    route: '/screens/principal-dashboard', 
    roles: ['principal', 'principal_admin'] 
  },
  { 
    id: 'principal-students', 
    label: 'Students', 
    icon: 'people-outline', 
    activeIcon: 'people', 
    route: '/screens/student-management', 
    roles: ['principal', 'principal_admin'] 
  },
  { 
    id: 'principal-messages', 
    label: 'Messages', 
    icon: 'chatbubble-outline', 
    activeIcon: 'chatbubble', 
    route: '/screens/teacher-messages', 
    roles: ['principal', 'principal_admin'] 
  },
  { 
    id: 'principal-reports', 
    label: 'Reports', 
    icon: 'document-text-outline', 
    activeIcon: 'document-text', 
    route: '/screens/teacher-reports', 
    roles: ['principal', 'principal_admin'] 
  },
  { 
    id: 'principal-settings', 
    label: 'Settings', 
    icon: 'settings-outline', 
    activeIcon: 'settings', 
    route: '/screens/settings', 
    roles: ['principal', 'principal_admin'] 
  },
];

export function BottomTabBar() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Determine user role
  const userRole = (profile?.role as string) || 'parent';
  
  // Filter tabs by role
  const visibleTabs = TAB_ITEMS.filter(
    item => !item.roles || item.roles.includes(userRole)
  );

  // Check if current route matches tab
  const isActive = (route: string) => {
    return pathname === route || pathname?.startsWith(route);
  };

  // Don't show on auth/onboarding/landing screens or message threads
  const shouldHide = 
    !pathname ||
    pathname === '/' ||
    pathname.includes('/(auth)') ||
    pathname.includes('/sign-in') ||
    pathname.includes('/register') ||
    pathname.includes('/landing') ||
    pathname.includes('/onboarding') ||
    pathname.includes('/auth-callback') ||
    pathname.includes('/invite/') ||
    pathname.includes('/parent-message-thread') ||
    pathname.includes('/teacher-message-thread') ||
    pathname.includes('/message-thread');

  if (shouldHide) {
    return null;
  }

  // Safety check: if no tabs are visible, don't render
  if (visibleTabs.length === 0) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      paddingBottom: Math.max(insets.bottom, 4),
      paddingTop: isCompact ? 4 : 6,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: -1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 4,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: isCompact ? 2 : 4,
      minHeight: isCompact ? 44 : 50,
    },
    iconContainer: {
      marginBottom: isCompact ? 1 : 2,
    },
    label: {
      fontSize: isCompact ? 9 : 10,
      fontWeight: '600',
      color: theme.textSecondary,
      marginTop: 1,
    },
    labelActive: {
      color: theme.primary,
    },
  });

  return (
    <View style={styles.container}>
      {visibleTabs.map((tab) => {
        const active = isActive(tab.route);
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => router.push(tab.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={(active ? tab.activeIcon : tab.icon) as any}
                size={isCompact ? 20 : 22}
                color={active ? theme.primary : theme.textSecondary}
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {t(`navigation.${tab.label.toLowerCase()}`, { defaultValue: tab.label })}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
