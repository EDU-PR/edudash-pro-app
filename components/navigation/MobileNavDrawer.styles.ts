/**
 * MobileNavDrawer Styles
 * Responsive: Desktop (>1024) = fixed sidebar, Tablet (768-1024) = overlay drawer,
 * Mobile (<768) = near-full-width overlay drawer.
 */
import { StyleSheet, Dimensions, Platform } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';

export type DrawerMode = 'desktop' | 'tablet' | 'mobile';

const DESKTOP_WIDTH = 280;
const TABLET_WIDTH = 320;
const MOBILE_MARGIN = 56;

export function getDrawerMode(): DrawerMode {
  const { width } = Dimensions.get('window');
  if (width > 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

export function getDrawerWidth(mode: DrawerMode): number {
  const { width } = Dimensions.get('window');
  switch (mode) {
    case 'desktop':
      return DESKTOP_WIDTH;
    case 'tablet':
      return TABLET_WIDTH;
    case 'mobile':
      return width - MOBILE_MARGIN;
  }
}

export { DESKTOP_WIDTH as DRAWER_WIDTH };

const webCursor = Platform.OS === 'web' ? { cursor: 'pointer' as const } : {};

export const getNavDrawerStyles = (
  theme: any,
  isDark: boolean,
  insets: EdgeInsets,
  mode: DrawerMode = getDrawerMode(),
) => {
  const drawerWidth = getDrawerWidth(mode);
  const isDesktop = mode === 'desktop';

  return StyleSheet.create({
    container: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 99999,
      ...(isDesktop
        ? { position: 'relative', width: drawerWidth, height: '100%' }
        : {}),
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.88)' : 'rgba(0, 0, 0, 0.7)',
      ...(isDesktop ? { display: 'none' } : {}),
    },
    overlayPressable: {
      flex: 1,
    },
    drawer: {
      position: isDesktop ? 'relative' : 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      width: drawerWidth,
      backgroundColor: theme.surface,
      opacity: 1,
      paddingTop: isDesktop ? 0 : insets.top,
      ...(isDesktop
        ? { borderRightWidth: 1, borderRightColor: theme.border }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 2, height: 0 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 20,
          }),
      ...(Platform.OS === 'web'
        ? { willChange: 'transform' as any }
        : {}),
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
      ...webCursor,
      ...(isDesktop ? { display: 'none' } : {}),
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
      ...webCursor,
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
    signOutSection: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingBottom: Math.max(insets.bottom, 16),
      alignItems: 'center',
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
      width: '100%',
      ...webCursor,
    },
    signOutText: {
      marginLeft: 10,
      fontSize: 15,
      fontWeight: '600',
      color: theme.error,
    },
    brandText: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      opacity: 0.8,
    },
    versionText: {
      fontSize: 10,
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      opacity: 0.6,
    },
  });
};
