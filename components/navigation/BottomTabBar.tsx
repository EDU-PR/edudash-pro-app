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
  
  // Org Admin tabs (Skills Development, Tertiary, etc.)
  { 
    id: 'org-admin-dashboard', 
    label: 'Home',
    icon: 'home-outline', 
    activeIcon: 'home', 
    route: '/screens/org-admin-dashboard', 
    roles: ['admin'] 
  },
  { 
    id: 'org-admin-programs', 
    label: 'Programs',
    icon: 'school-outline', 
    activeIcon: 'school', 
    route: '/screens/org-admin/programs', 
    roles: ['admin'] 
  },
  { 
    id: 'org-admin-enrollments', 
    label: 'Enroll',
    icon: 'person-add-outline', 
    activeIcon: 'person-add', 
    route: '/screens/org-admin/enrollments', 
    roles: ['admin'] 
  },
  { 
    id: 'org-admin-instructors', 
    label: 'Team',
    icon: 'people-outline', 
    activeIcon: 'people', 
    route: '/screens/org-admin/instructors', 
    roles: ['admin'] 
  },
  { 
    id: 'org-admin-settings', 
    label: 'Settings',
    icon: 'settings-outline', 
    activeIcon: 'settings', 
    route: '/screens/org-admin/settings', 
    roles: ['admin'] 
  },
  
  // Student/Learner tabs - Use learner-dashboard for both (students with org_id should use learner-dashboard)
  { 
    id: 'learner-dashboard', 
    label: 'Home',
    icon: 'home-outline', 
    activeIcon: 'home', 
    route: '/screens/learner-dashboard', 
    roles: ['student', 'learner'] 
  },
  { 
    id: 'student-programs', 
    label: 'Programs',
    icon: 'school-outline', 
    activeIcon: 'school', 
    route: '/screens/learner/programs', 
    roles: ['student', 'learner'] 
  },
  { 
    id: 'student-submissions', 
    label: 'Work',
    icon: 'document-text-outline', 
    activeIcon: 'document-text', 
    route: '/screens/learner/submissions', 
    roles: ['student', 'learner'] 
  },
  { 
    id: 'learner-messages', 
    label: 'Messages',
    icon: 'chatbubble-outline', 
    activeIcon: 'chatbubble', 
    route: '/screens/learner/messages', 
    roles: ['student', 'learner'] 
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
    route: '/screens/principal-messages', 
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

  // CEO / National Admin tabs (Soil of Africa)
  { 
    id: 'ceo-dashboard', 
    label: 'Home',
    icon: 'home-outline', 
    activeIcon: 'home', 
    route: '/screens/membership/ceo-dashboard', 
    roles: ['national_admin'] 
  },
  { 
    id: 'ceo-regions', 
    label: 'Regions',
    icon: 'map-outline', 
    activeIcon: 'map', 
    route: '/screens/membership/regional-managers', 
    roles: ['national_admin'] 
  },
  { 
    id: 'ceo-finance', 
    label: 'Finance',
    icon: 'wallet-outline', 
    activeIcon: 'wallet', 
    route: '/screens/membership/finance', 
    roles: ['national_admin'] 
  },
  { 
    id: 'ceo-members', 
    label: 'Members',
    icon: 'people-outline', 
    activeIcon: 'people', 
    route: '/screens/membership/members', 
    roles: ['national_admin'] 
  },
  { 
    id: 'ceo-settings', 
    label: 'Settings',
    icon: 'settings-outline', 
    activeIcon: 'settings', 
    route: '/screens/settings', 
    roles: ['national_admin'] 
  },

  // Youth President tabs (Youth Wing)
  { 
    id: 'youth-dashboard', 
    label: 'Home',
    icon: 'home-outline', 
    activeIcon: 'home', 
    route: '/screens/membership/youth-president-dashboard', 
    roles: ['youth_president'] 
  },
  { 
    id: 'youth-members', 
    label: 'Members',
    icon: 'people-outline', 
    activeIcon: 'people', 
    route: '/screens/membership/members-list', 
    roles: ['youth_president'] 
  },
  { 
    id: 'youth-events', 
    label: 'Events',
    icon: 'calendar-outline', 
    activeIcon: 'calendar', 
    route: '/screens/membership/events', 
    roles: ['youth_president'] 
  },
  { 
    id: 'youth-approvals', 
    label: 'Approvals',
    icon: 'checkmark-circle-outline', 
    activeIcon: 'checkmark-circle', 
    route: '/screens/membership/pending-approvals', 
    roles: ['youth_president'] 
  },
  { 
    id: 'youth-settings', 
    label: 'Settings',
    icon: 'settings-outline', 
    activeIcon: 'settings', 
    route: '/screens/membership/settings', 
    roles: ['youth_president'] 
  },

  // Regional Manager tabs
  { 
    id: 'regional-dashboard', 
    label: 'Home',
    icon: 'home-outline', 
    activeIcon: 'home', 
    route: '/screens/membership/dashboard', 
    roles: ['regional_manager'] 
  },
  { 
    id: 'regional-members', 
    label: 'Members',
    icon: 'people-outline', 
    activeIcon: 'people', 
    route: '/screens/membership/members-list', 
    roles: ['regional_manager'] 
  },
  { 
    id: 'regional-approvals', 
    label: 'Approvals',
    icon: 'checkmark-circle-outline', 
    activeIcon: 'checkmark-circle', 
    route: '/screens/membership/pending-approvals', 
    roles: ['regional_manager'] 
  },
  { 
    id: 'regional-events', 
    label: 'Events',
    icon: 'calendar-outline', 
    activeIcon: 'calendar', 
    route: '/screens/membership/events', 
    roles: ['regional_manager'] 
  },
  { 
    id: 'regional-settings', 
    label: 'Settings',
    icon: 'settings-outline', 
    activeIcon: 'settings', 
    route: '/screens/membership/settings', 
    roles: ['regional_manager'] 
  },

  // Women's League tabs
  { 
    id: 'women-dashboard', 
    label: 'Home',
    icon: 'home-outline', 
    activeIcon: 'home', 
    route: '/screens/membership/women-dashboard', 
    roles: ['women_league'] 
  },
  { 
    id: 'women-members', 
    label: 'Members',
    icon: 'people-outline', 
    activeIcon: 'people', 
    route: '/screens/membership/members-list', 
    roles: ['women_league'] 
  },
  { 
    id: 'women-events', 
    label: 'Events',
    icon: 'calendar-outline', 
    activeIcon: 'calendar', 
    route: '/screens/membership/events', 
    roles: ['women_league'] 
  },
  { 
    id: 'women-approvals', 
    label: 'Approvals',
    icon: 'checkmark-circle-outline', 
    activeIcon: 'checkmark-circle', 
    route: '/screens/membership/pending-approvals', 
    roles: ['women_league'] 
  },
  { 
    id: 'women-settings', 
    label: 'Settings',
    icon: 'settings-outline', 
    activeIcon: 'settings', 
    route: '/screens/membership/settings', 
    roles: ['women_league'] 
  },

  // Veterans League tabs
  { 
    id: 'veterans-dashboard', 
    label: 'Home',
    icon: 'home-outline', 
    activeIcon: 'home', 
    route: '/screens/membership/veterans-dashboard', 
    roles: ['veterans_league'] 
  },
  { 
    id: 'veterans-members', 
    label: 'Members',
    icon: 'people-outline', 
    activeIcon: 'people', 
    route: '/screens/membership/members-list', 
    roles: ['veterans_league'] 
  },
  { 
    id: 'veterans-events', 
    label: 'Events',
    icon: 'calendar-outline', 
    activeIcon: 'calendar', 
    route: '/screens/membership/events', 
    roles: ['veterans_league'] 
  },
  { 
    id: 'veterans-approvals', 
    label: 'Approvals',
    icon: 'checkmark-circle-outline', 
    activeIcon: 'checkmark-circle', 
    route: '/screens/membership/pending-approvals', 
    roles: ['veterans_league'] 
  },
  { 
    id: 'veterans-settings', 
    label: 'Settings',
    icon: 'settings-outline', 
    activeIcon: 'settings', 
    route: '/screens/membership/settings', 
    roles: ['veterans_league'] 
  },
];

export function BottomTabBar() {
  const { theme } = useTheme();
  const { profile, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Hide navigation bar if user is not authenticated
  if (!user || !profile) {
    return null;
  }
  
  // Hide bottom nav on full-screen / immersive experiences (e.g. Dash AI assistant)
  if (
    typeof pathname === 'string' &&
    (pathname.includes('/screens/dash-assistant') ||
      pathname.includes('dash-assistant') ||
      pathname.startsWith('/screens/ai-') ||
      pathname.includes('/screens/worksheet-viewer') ||
      pathname.includes('/screens/lesson-viewer'))
  ) {
    return null;
  }

  // Determine user role - check for CEO/national_admin from organization membership
  const userRole = (profile?.role as string) || 'parent';
  const memberType = (profile as any)?.organization_membership?.member_type || (profile as any)?.member_type;
  const orgRole = (profile as any)?.organization_membership?.role;
  
  // Check if user is CEO (member_type === 'ceo' or role === 'national_admin')
  const isCEO = memberType === 'ceo' || memberType === 'president' || orgRole === 'national_admin';
  
  // Check if user is Youth President or Executive (all youth leadership roles)
  const isYouthLeader = memberType === 'youth_president' || 
                        memberType === 'youth_deputy' || 
                        memberType === 'youth_secretary' || 
                        memberType === 'youth_treasurer';
  
  // Check if user is Regional Manager
  const isRegionalManager = memberType === 'regional_manager' || 
                            memberType === 'provincial_manager' ||
                            orgRole === 'regional_admin';
  
  // Check if user is Women's League member
  const isWomensLeague = memberType?.startsWith('women_');
  
  // Check if user is Veterans League member
  const isVeteransLeague = memberType?.startsWith('veterans_');
  
  // Filter tabs by role - special member types get their dedicated tabs
  const visibleTabs = TAB_ITEMS.filter(item => {
    if (!item.roles) return false; // Require explicit role assignment
    
    // If user is CEO, ONLY show CEO tabs (national_admin role)
    if (isCEO) {
      return item.roles.includes('national_admin');
    }
    
    // If user is Youth Leader, ONLY show youth president tabs
    if (isYouthLeader) {
      return item.roles.includes('youth_president');
    }
    
    // If user is Regional Manager, ONLY show regional manager tabs
    if (isRegionalManager) {
      return item.roles.includes('regional_manager');
    }
    
    // If user is Women's League, ONLY show women's league tabs
    if (isWomensLeague) {
      return item.roles.includes('women_league');
    }
    
    // If user is Veterans League, ONLY show veterans league tabs
    if (isVeteransLeague) {
      return item.roles.includes('veterans_league');
    }
    
    // Otherwise, filter by profile role (exclude special membership tabs)
    return item.roles.includes(userRole) && 
           !item.roles.includes('national_admin') && 
           !item.roles.includes('youth_president') &&
           !item.roles.includes('regional_manager') &&
           !item.roles.includes('women_league') &&
           !item.roles.includes('veterans_league');
  });

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
    pathname.includes('org-onboarding') ||
    pathname.includes('principal-onboarding') ||
    pathname.includes('school-registration') ||
    pathname.includes('parent-child-registration') ||
    pathname.includes('learner-registration') ||
    pathname.includes('parent-registration') ||
    pathname.includes('teacher-registration') ||
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
