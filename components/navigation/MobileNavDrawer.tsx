/**
 * MobileNavDrawer - Slide-out navigation drawer for web mobile
 * Shows navigation items when hamburger menu is pressed on mobile web
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOutAndRedirect } from '@/lib/authActions';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  badge?: number;
}

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  navItems?: NavItem[];
}

// Default nav items by role
const getDefaultNavItems = (role: string): NavItem[] => {
  switch (role) {
    case 'teacher':
      return [
        { id: 'home', label: 'Dashboard', icon: 'home', route: '/screens/teacher-dashboard' },
        { id: 'students', label: 'Students', icon: 'people', route: '/screens/student-management' },
        { id: 'classes', label: 'Classes', icon: 'school', route: '/screens/class-details' },
        { id: 'messages', label: 'Messages', icon: 'chatbubble', route: '/screens/teacher-messages' },
        { id: 'calendar', label: 'Calendar', icon: 'calendar', route: '/screens/calendar' },
        { id: 'reports', label: 'Reports', icon: 'document-text', route: '/screens/teacher-reports' },
        { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/settings' },
      ];
    case 'parent':
      return [
        { id: 'home', label: 'Dashboard', icon: 'home', route: '/screens/parent-dashboard' },
        { id: 'children', label: 'Children', icon: 'heart', route: '/screens/parent-children' },
        { id: 'messages', label: 'Messages', icon: 'chatbubble', route: '/screens/parent-messages' },
        { id: 'calendar', label: 'Calendar', icon: 'calendar', route: '/screens/calendar' },
        { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/settings' },
      ];
    case 'principal':
    case 'principal_admin':
      return [
        { id: 'home', label: 'Dashboard', icon: 'home', route: '/screens/principal-dashboard' },
        { id: 'students', label: 'Students', icon: 'people', route: '/screens/student-management' },
        { id: 'teachers', label: 'Teachers', icon: 'briefcase', route: '/screens/teacher-management' },
        { id: 'registrations', label: 'Registrations', icon: 'person-add', route: '/screens/principal-registrations' },
        { id: 'classes', label: 'Classes', icon: 'school', route: '/screens/class-details' },
        { id: 'attendance', label: 'Attendance', icon: 'checkmark-circle', route: '/screens/attendance' },
        { id: 'messages', label: 'Messages', icon: 'chatbubble', route: '/screens/teacher-messages' },
        { id: 'financials', label: 'Financials', icon: 'cash', route: '/screens/financial-dashboard' },
        { id: 'campaigns', label: 'Campaigns', icon: 'megaphone', route: '/screens/campaigns' },
        { id: 'reports', label: 'Reports', icon: 'analytics', route: '/screens/teacher-reports' },
        { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/settings' },
      ];
    default:
      return [
        { id: 'home', label: 'Home', icon: 'home', route: '/' },
        { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/settings' },
      ];
  }
};

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.8, 300);

export function MobileNavDrawer({ isOpen, onClose, navItems }: MobileNavDrawerProps) {
  const { theme, isDark } = useTheme();
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const userRole = (profile?.role as string) || 'parent';
  const items = navItems || getDefaultNavItems(userRole);

  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOpen, slideAnim, fadeAnim]);

  const handleNavPress = (route: string) => {
    onClose();
    // Small delay to allow drawer animation to start
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  };

  const handleSignOut = async () => {
    onClose();
    // Use centralized sign out for proper session cleanup
    await signOutAndRedirect({ redirectTo: '/(auth)/sign-in' });
  };

  const isActive = (route: string) => {
    return pathname === route || pathname?.startsWith(route);
  };

  if (!isOpen && Platform.OS === 'web') {
    // On web, don't render when closed to avoid z-index issues
    return null;
  }

  const styles = getStyles(theme, isDark, insets);

  return (
    <View style={styles.container} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Overlay */}
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={styles.overlayPressable} onPress={onClose} />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Header */}
        <View style={styles.drawerHeader}>
          <View style={styles.headerContent}>
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={20} color={theme.primary} />
              </View>
              <View style={styles.userText}>
                <Text style={styles.userName} numberOfLines={1}>
                  {profile?.full_name || 'User'}
                </Text>
                <Text style={styles.userRole}>{userRole}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Navigation Items */}
        <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
          {items.map((item) => {
            const active = isActive(item.route);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => handleNavPress(item.route)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={(active ? item.icon : `${item.icon}-outline`) as any}
                  size={20}
                  color={active ? theme.primary : theme.textSecondary}
                />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {item.label}
                </Text>
                {item.badge && item.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
          <Text style={styles.brandText}>Powered by EduDash Pro</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const getStyles = (theme: any, isDark: boolean, insets: any) =>
  StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9999,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    overlayPressable: {
      flex: 1,
    },
    drawer: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      width: DRAWER_WIDTH,
      backgroundColor: theme.surface,
      paddingTop: insets.top,
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 20,
    },
    drawerHeader: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    userText: {
      marginLeft: 12,
      flex: 1,
    },
    userName: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    userRole: {
      fontSize: 12,
      color: theme.textSecondary,
      textTransform: 'capitalize',
      marginTop: 2,
    },
    closeButton: {
      padding: 4,
    },
    navList: {
      flex: 1,
      paddingTop: 8,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginHorizontal: 8,
      borderRadius: 8,
    },
    navItemActive: {
      backgroundColor: theme.primary + '12',
    },
    navLabel: {
      marginLeft: 12,
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
      flex: 1,
    },
    navLabelActive: {
      color: theme.primary,
      fontWeight: '600',
    },
    badge: {
      backgroundColor: theme.error,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingBottom: Math.max(insets.bottom, 16),
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.error + '15',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.error + '30',
    },
    signOutText: {
      marginLeft: 10,
      fontSize: 15,
      fontWeight: '600',
      color: theme.error,
    },
    brandText: {
      fontSize: 11,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 12,
      opacity: 0.7,
    },
  });

export default MobileNavDrawer;
