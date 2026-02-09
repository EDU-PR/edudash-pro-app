import { StyleSheet } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────

export interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

export interface SettingsItem {
  title: string;
  subtitle?: string;
  icon: string;
  action: () => void;
  type: 'navigation' | 'toggle' | 'action';
  value?: boolean;
  danger?: boolean;
  beta?: boolean;
}

// ─── Pure Helpers ─────────────────────────────────────────────────────────

/** Check if user is super admin (handles role normalization) */
export function isSuperAdmin(role?: string | null): boolean {
  if (!role) return false;
  const normalizedRole = String(role).trim().toLowerCase();
  return normalizedRole === 'superadmin' || normalizedRole === 'super_admin';
}

// ─── Styles ───────────────────────────────────────────────────────────────

export function createStyles(_theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0b1220',
    },
    deniedContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0b1220',
    },
    deniedText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
    },
    header: {
      backgroundColor: '#0b1220',
      paddingHorizontal: 16,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
    },
    backButton: {
      padding: 8,
    },
    title: {
      color: '#ffffff',
      fontSize: 20,
      fontWeight: '700',
    },
    placeholder: {
      width: 40,
    },
    adminInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: '#1f2937',
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: '#374151',
    },
    adminAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#374151',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    adminDetails: {
      flex: 1,
    },
    adminName: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    adminRole: {
      color: '#00f5ff',
      fontSize: 12,
      fontWeight: '500',
    },
    statusIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#10b981',
    },
    statusText: {
      color: '#10b981',
      fontSize: 12,
      fontWeight: '500',
    },
    content: {
      flex: 1,
      backgroundColor: '#111827',
    },
    section: {
      marginBottom: 32,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 12,
      marginLeft: 4,
    },
    settingsItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#1f2937',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: '#374151',
    },
    settingsItemLast: {
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#374151',
    },
    settingsItemDanger: {
      backgroundColor: '#7f1d1d10',
    },
    settingsItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    settingsItemIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: '#374151',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    settingsItemIconDanger: {
      backgroundColor: '#7f1d1d20',
    },
    settingsItemText: {
      flex: 1,
    },
    settingsItemTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    settingsItemTitle: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 2,
    },
    settingsItemTitleDanger: {
      color: '#ef4444',
    },
    settingsItemSubtitle: {
      color: '#9ca3af',
      fontSize: 14,
    },
    betaBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: '#f59e0b20',
    },
    betaBadgeText: {
      color: '#f59e0b',
      fontSize: 10,
      fontWeight: '600',
    },
    settingsItemRight: {
      marginLeft: 16,
    },
    platformStatus: {
      marginHorizontal: 16,
      marginBottom: 24,
      backgroundColor: '#1f2937',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: '#374151',
    },
    platformStatusTitle: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 16,
    },
    statusGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    statusCard: {
      flex: 1,
      minWidth: 80,
      alignItems: 'center',
      gap: 8,
    },
    statusCardIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    statusCardIconGreen: {
      backgroundColor: '#10b98120',
    },
    statusCardIconYellow: {
      backgroundColor: '#f59e0b20',
    },
    statusCardLabel: {
      color: '#9ca3af',
      fontSize: 11,
      textAlign: 'center',
    },
    statusCardValue: {
      color: '#ffffff',
      fontSize: 12,
      fontWeight: '500',
      textAlign: 'center',
    },
    versionInfo: {
      marginHorizontal: 16,
      marginBottom: 32,
      alignItems: 'center',
      gap: 4,
    },
    versionText: {
      color: '#6b7280',
      fontSize: 12,
    },
  });
}
