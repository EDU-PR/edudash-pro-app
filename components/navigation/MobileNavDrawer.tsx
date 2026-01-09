/**
 * MobileNavDrawer - Slide-out navigation drawer for web mobile
 * Shows navigation items when hamburger menu is pressed on mobile web
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOutAndRedirect } from '@/lib/authActions';
import { getRoleDisplayName } from '@/lib/roleUtils';
import { getNavDrawerStyles, DRAWER_WIDTH } from './MobileNavDrawer.styles';
import Constants from 'expo-constants';

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
const getDefaultNavItems = (role: string, memberType?: string): NavItem[] => {
  // Check if user is CEO/President (member_type from organization membership)
  if (memberType === 'ceo' || memberType === 'chief_executive_officer' || memberType === 'president') {
    return [
      { id: 'home', label: 'President Dashboard', icon: 'business', route: '/screens/membership/ceo-dashboard' },
      { id: 'regional', label: 'Regional Managers', icon: 'people', route: '/screens/membership/regional-managers' },
      { id: 'members', label: 'All Members', icon: 'person-circle', route: '/screens/membership/members' },
      { id: 'finance', label: 'Financial Reports', icon: 'trending-up', route: '/screens/membership/finance' },
      { id: 'analytics', label: 'Analytics', icon: 'analytics', route: '/screens/membership/analytics' },
      { id: 'strategy', label: 'Strategic Plan', icon: 'bulb', route: '/screens/membership/strategy' },
      { id: 'governance', label: 'Governance', icon: 'shield-checkmark', route: '/screens/membership/governance' },
      { id: 'id-card', label: 'My ID Card', icon: 'card', route: '/screens/membership/id-card' },
      { id: 'account', label: 'Account', icon: 'person-circle', route: '/screens/account' },
      { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/membership/settings' },
    ];
  }
  
  // Check if user is Youth President or Youth Executive (Deputy, Secretary, Treasurer)
  if (memberType === 'youth_president' || memberType === 'youth_deputy' || 
      memberType === 'youth_secretary' || memberType === 'youth_treasurer') {
    const isPresident = memberType === 'youth_president';
    return [
      { id: 'home', label: 'Youth Dashboard', icon: 'people', route: '/screens/membership/youth-president-dashboard' },
      { id: 'members', label: 'Youth Members', icon: 'person-circle', route: '/screens/membership/members-list' },
      { id: 'events', label: 'Events', icon: 'calendar', route: '/screens/membership/events' },
      { id: 'programs', label: 'Programs', icon: 'school', route: '/screens/membership/programs' },
      ...(isPresident ? [{ id: 'invite', label: 'Recruit Members', icon: 'person-add', route: '/screens/membership/youth-invite-code' }] : []),
      { id: 'budget', label: 'Budget Requests', icon: 'wallet', route: '/screens/membership/budget-requests' },
      { id: 'announcements', label: 'Announcements', icon: 'megaphone', route: '/screens/membership/announcements' },
      { id: 'reports', label: 'Reports', icon: 'bar-chart', route: '/screens/membership/reports' },
      ...(isPresident ? [{ id: 'approvals', label: 'Approvals', icon: 'checkmark-circle', route: '/screens/membership/pending-approvals' }] : []),
      { id: 'id-card', label: 'My ID Card', icon: 'card', route: '/screens/membership/id-card' },
      { id: 'account', label: 'Account', icon: 'person-circle', route: '/screens/account' },
      { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/membership/settings' },
    ];
  }
  
  // Check if user is other Youth wing member (coordinator, facilitator, mentor, member)
  if (memberType?.startsWith('youth_')) {
    return [
      { id: 'home', label: 'Youth Dashboard', icon: 'people', route: '/screens/membership/youth-president-dashboard' },
      { id: 'members', label: 'Youth Members', icon: 'person-circle', route: '/screens/membership/members-list' },
      { id: 'events', label: 'Events', icon: 'calendar', route: '/screens/membership/events' },
      { id: 'programs', label: 'Programs', icon: 'school', route: '/screens/membership/programs' },
      { id: 'id-card', label: 'My ID Card', icon: 'card', route: '/screens/membership/id-card' },
      { id: 'account', label: 'Account', icon: 'person-circle', route: '/screens/account' },
      { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/membership/settings' },
    ];
  }

  // Check if user is Regional Manager
  if (memberType === 'regional_manager' || memberType === 'provincial_manager') {
    return [
      { id: 'home', label: 'Regional Dashboard', icon: 'map', route: '/screens/membership/dashboard' },
      { id: 'members', label: 'Members', icon: 'people', route: '/screens/membership/members-list' },
      { id: 'approvals', label: 'Approvals', icon: 'checkmark-circle', route: '/screens/membership/pending-approvals' },
      { id: 'events', label: 'Events', icon: 'calendar', route: '/screens/membership/events' },
      { id: 'reports', label: 'Reports', icon: 'bar-chart', route: '/screens/membership/reports' },
      { id: 'invite', label: 'Invite Members', icon: 'person-add', route: '/screens/membership/regional-invite-code' },
      { id: 'id-card', label: 'My ID Card', icon: 'card', route: '/screens/membership/id-card' },
      { id: 'account', label: 'Account', icon: 'person-circle', route: '/screens/account' },
      { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/membership/settings' },
    ];
  }

  // Check if user is Branch Manager
  if (memberType === 'branch_manager') {
    return [
      { id: 'home', label: 'Branch Dashboard', icon: 'git-branch', route: '/screens/membership/dashboard' },
      { id: 'members', label: 'Members', icon: 'people', route: '/screens/membership/members-list' },
      { id: 'approvals', label: 'Approvals', icon: 'checkmark-circle', route: '/screens/membership/pending-approvals' },
      { id: 'events', label: 'Events', icon: 'calendar', route: '/screens/membership/events' },
      { id: 'invite', label: 'Invite Members', icon: 'person-add', route: '/screens/membership/branch-manager-invite-code' },
      { id: 'id-card', label: 'My ID Card', icon: 'card', route: '/screens/membership/id-card' },
      { id: 'account', label: 'Account', icon: 'person-circle', route: '/screens/account' },
      { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/membership/settings' },
    ];
  }

  // Check if user is Women's League member
  if (memberType?.startsWith('women_')) {
    const isLeader = ['women_president', 'women_deputy', 'women_secretary', 'women_treasurer'].includes(memberType);
    return [
      { id: 'home', label: "Women's League", icon: 'flower', route: '/screens/membership/womens-league-dashboard' },
      { id: 'members', label: 'Members', icon: 'people', route: '/screens/membership/members-list' },
      { id: 'events', label: 'Events', icon: 'calendar', route: '/screens/membership/events' },
      { id: 'programs', label: 'Programs', icon: 'heart', route: '/screens/membership/programs' },
      ...(isLeader ? [{ id: 'approvals', label: 'Approvals', icon: 'checkmark-circle', route: '/screens/membership/pending-approvals' }] : []),
      ...(isLeader ? [{ id: 'invite', label: 'Invite Members', icon: 'person-add', route: '/screens/membership/womens-invite-code' }] : []),
      { id: 'id-card', label: 'My ID Card', icon: 'card', route: '/screens/membership/id-card' },
      { id: 'account', label: 'Account', icon: 'person-circle', route: '/screens/account' },
      { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/membership/settings' },
    ];
  }

  // Check if user is Veterans League member
  if (memberType?.startsWith('veterans_')) {
    const isLeader = ['veterans_president', 'veterans_coordinator'].includes(memberType);
    return [
      { id: 'home', label: 'Veterans League', icon: 'medal', route: '/screens/membership/veterans-league-dashboard' },
      { id: 'members', label: 'Members', icon: 'people', route: '/screens/membership/members-list' },
      { id: 'events', label: 'Events', icon: 'calendar', route: '/screens/membership/events' },
      { id: 'heritage', label: 'Heritage', icon: 'book', route: '/screens/membership/heritage' },
      ...(isLeader ? [{ id: 'approvals', label: 'Approvals', icon: 'checkmark-circle', route: '/screens/membership/pending-approvals' }] : []),
      ...(isLeader ? [{ id: 'invite', label: 'Invite Members', icon: 'person-add', route: '/screens/membership/veterans-invite-code' }] : []),
      { id: 'id-card', label: 'My ID Card', icon: 'card', route: '/screens/membership/id-card' },
      { id: 'account', label: 'Account', icon: 'person-circle', route: '/screens/account' },
      { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/membership/settings' },
    ];
  }
  
  switch (role) {
    case 'teacher':
      return [
        { id: 'home', label: 'Dashboard', icon: 'home', route: '/screens/teacher-dashboard' },
        { id: 'students', label: 'Students', icon: 'people', route: '/screens/student-management' },
        { id: 'classes', label: 'Classes', icon: 'school', route: '/screens/class-teacher-management' },
        { id: 'messages', label: 'Messages', icon: 'chatbubble', route: '/screens/teacher-message-list' },
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
        { id: 'classes', label: 'Classes', icon: 'school', route: '/screens/class-teacher-management' },
        { id: 'attendance', label: 'Attendance', icon: 'checkmark-circle', route: '/screens/attendance' },
        { id: 'messages', label: 'Messages', icon: 'chatbubble', route: '/screens/teacher-message-list' },
        { id: 'financials', label: 'Financials', icon: 'cash', route: '/screens/financial-dashboard' },
        { id: 'campaigns', label: 'Campaigns', icon: 'megaphone', route: '/screens/campaigns' },
        { id: 'reports', label: 'Reports', icon: 'analytics', route: '/screens/teacher-reports' },
        { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/settings' },
      ];
    case 'admin':
      return [
        { id: 'home', label: 'Dashboard', icon: 'home', route: '/screens/org-admin-dashboard' },
        { id: 'programs', label: 'Programs', icon: 'school', route: '/screens/org-admin/programs' },
        { id: 'cohorts', label: 'Cohorts', icon: 'people', route: '/screens/org-admin/cohorts' },
        { id: 'instructors', label: 'Team', icon: 'briefcase', route: '/screens/org-admin/instructors' },
        { id: 'enrollments', label: 'Enrollments', icon: 'list', route: '/screens/org-admin/enrollments' },
        { id: 'certifications', label: 'Certifications', icon: 'ribbon', route: '/screens/org-admin/certifications' },
        { id: 'placements', label: 'Placements', icon: 'business', route: '/screens/org-admin/placements' },
        { id: 'invoices', label: 'Invoices', icon: 'document-text', route: '/screens/org-admin/invoices' },
        { id: 'data-import', label: 'Data Import', icon: 'cloud-upload', route: '/screens/org-admin/data-import' },
        { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/org-admin/settings' },
      ];
    case 'student':
    case 'learner':
      return [
        { id: 'home', label: 'Dashboard', icon: 'home', route: '/screens/learner-dashboard' },
        { id: 'programs', label: 'My Programs', icon: 'school', route: '/screens/learner/programs' },
        { id: 'assignments', label: 'Assignments', icon: 'document-text', route: '/screens/learner/submissions' },
        { id: 'ai-help', label: 'Assignment Help', icon: 'help-circle', route: '/screens/ai-homework-helper' },
        { id: 'portfolio', label: 'Portfolio', icon: 'folder', route: '/screens/learner/portfolio' },
        { id: 'account', label: 'Account', icon: 'person-circle', route: '/screens/account' },
        { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/settings' },
      ];
    case 'super_admin':
    case 'superadmin':
      return [
        { id: 'home', label: 'Dashboard', icon: 'shield-checkmark', route: '/screens/super-admin-dashboard' },
        { id: 'ai-command', label: 'AI Command Center', icon: 'flash', route: '/screens/super-admin-ai-command-center' },
        { id: 'users', label: 'User Management', icon: 'people', route: '/screens/super-admin-users' },
        { id: 'admin-mgmt', label: 'Admin Management', icon: 'people-circle', route: '/screens/super-admin-admin-management' },
        { id: 'onboarding', label: 'School Onboarding', icon: 'school', route: '/screens/super-admin/school-onboarding-wizard' },
        { id: 'ai-quotas', label: 'AI Quotas', icon: 'hardware-chip', route: '/screens/super-admin-ai-quotas' },
        { id: 'moderation', label: 'Content Moderation', icon: 'shield', route: '/screens/super-admin-moderation' },
        { id: 'announcements', label: 'Announcements', icon: 'megaphone', route: '/screens/super-admin-announcements' },
        { id: 'monitoring', label: 'System Monitoring', icon: 'analytics', route: '/screens/super-admin-system-monitoring' },
        { id: 'whatsapp', label: 'WhatsApp Hub', icon: 'logo-whatsapp', route: '/screens/super-admin-whatsapp' },
        { id: 'system-test', label: 'System Tests', icon: 'checkmark-circle', route: '/screens/super-admin-system-test' },
        { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/settings' },
      ];
    default:
      return [
        { id: 'home', label: 'Home', icon: 'home', route: '/' },
        { id: 'settings', label: 'Settings', icon: 'settings', route: '/screens/settings' },
      ];
  }
};

export function MobileNavDrawer({ isOpen, onClose, navItems }: MobileNavDrawerProps) {
  const { theme, isDark } = useTheme();
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  const userRole = (profile?.role as string) || 'parent';
  // Get member_type from organization_membership for CEO detection
  const memberType = profile?.organization_membership?.member_type;
  const items = navItems || getDefaultNavItems(userRole, memberType);
  
  // Get display role - prioritize member_type for membership organizations
  const displayRole = memberType 
    ? (memberType === 'ceo' || memberType === 'president' ? 'President' : 
       memberType.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
    : getRoleDisplayName(userRole);
  
  // Get display name with fallback chain: full_name -> first_name + last_name -> email -> 'Guest'
  const displayName = profile?.full_name 
    || (profile?.first_name && profile?.last_name 
        ? `${profile.first_name} ${profile.last_name}` 
        : profile?.first_name || profile?.email?.split('@')[0] || 'Guest');
  
  // Get avatar URL for profile picture
  const avatarUrl = profile?.avatar_url;

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

  const styles = getNavDrawerStyles(theme, isDark, insets);

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
                {avatarUrl ? (
                  <Image 
                    source={{ uri: avatarUrl }} 
                    style={{ width: 40, height: 40, borderRadius: 20 }} 
                  />
                ) : (
                  <Ionicons name="person" size={20} color={theme.primary} />
                )}
              </View>
              <View style={styles.userText}>
                <Text style={styles.userName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.userRole}>{displayRole}</Text>
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
                  name={(active || item.icon.startsWith('logo-') ? item.icon : `${item.icon}-outline`) as any}
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

        {/* Sign Out Button - Above divider */}
        <View style={styles.signOutSection}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
        
        {/* Footer - Below divider with branding */}
        <View style={styles.footer}>
          <Text style={styles.brandText}>Powered by EduDash Pro</Text>
          <Text style={styles.versionText}>v{Constants.expoConfig?.version || '1.0.0'}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default MobileNavDrawer;
