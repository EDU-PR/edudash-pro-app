import { useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import type { SettingsSection } from '@/lib/screen-styles/super-admin-settings.styles';
import type { ShowAlertFn, UseSuperAdminSettingsReturn } from './types';
import { useSettingsActions } from './settingsActions';

export { type UseSuperAdminSettingsReturn } from './types';

export function useSuperAdminSettings(showAlert: ShowAlertFn): UseSuperAdminSettingsReturn {
  const { profile } = useAuth();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [autoBackup, setAutoBackup] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);

  const { handleSignOut, toggleMaintenanceMode, clearPlatformCache, exportPlatformData } =
    useSettingsActions(profile, showAlert, setMaintenanceMode);

  const settingsSections: SettingsSection[] = [
    {
      title: 'Platform Management',
      items: [
        { title: 'Platform Analytics', subtitle: 'View comprehensive platform metrics', icon: 'analytics', action: () => router.push('/screens/super-admin-analytics'), type: 'navigation' },
        { title: 'User Management', subtitle: 'Manage users and impersonation', icon: 'people', action: () => router.push('/screens/super-admin-users'), type: 'navigation' },
        { title: 'Subscription Management', subtitle: 'Monitor and manage subscriptions', icon: 'card', action: () => router.push('/screens/super-admin-subscriptions'), type: 'navigation' },
        { title: 'Lead Management', subtitle: 'Enterprise leads and conversions', icon: 'business', action: () => router.push('/screens/super-admin-leads'), type: 'navigation' },
      ],
    },
    {
      title: 'Content & Moderation',
      items: [
        { title: 'Content Moderation', subtitle: 'Review flagged content', icon: 'shield-checkmark', action: () => router.push('/screens/super-admin-moderation'), type: 'navigation' },
        { title: 'Platform Announcements', subtitle: 'Manage platform-wide announcements', icon: 'megaphone', action: () => router.push('/screens/super-admin-announcements'), type: 'navigation' },
        { title: 'Feature Flags', subtitle: 'Control feature rollouts', icon: 'flag', action: () => router.push('/screens/super-admin-feature-flags'), type: 'navigation' },
      ],
    },
    {
      title: 'AI & Resources',
      items: [
        { title: 'AI Quota Management', subtitle: 'Monitor and control AI usage', icon: 'flash', action: () => router.push('/screens/super-admin-ai-quotas'), type: 'navigation' },
      ],
    },
    {
      title: 'System Configuration',
      items: [
        { title: 'Maintenance Mode', subtitle: 'Platform-wide maintenance mode', icon: 'construct', action: () => toggleMaintenanceMode(!maintenanceMode), type: 'toggle', value: maintenanceMode, danger: true },
        { title: 'Debug Mode', subtitle: 'Enable detailed logging', icon: 'bug', action: () => setDebugMode(!debugMode), type: 'toggle', value: debugMode },
        { title: 'Auto Backup', subtitle: 'Automatic daily backups', icon: 'cloud-upload', action: () => setAutoBackup(!autoBackup), type: 'toggle', value: autoBackup },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { title: 'Email Notifications', subtitle: 'Receive admin email alerts', icon: 'mail', action: () => setEmailNotifications(!emailNotifications), type: 'toggle', value: emailNotifications },
        { title: 'Security Alerts', subtitle: 'High-priority security notifications', icon: 'shield', action: () => setSecurityAlerts(!securityAlerts), type: 'toggle', value: securityAlerts },
      ],
    },
    {
      title: 'Data Management',
      items: [
        { title: 'Clear Platform Cache', subtitle: 'Clear all cached data', icon: 'refresh', action: clearPlatformCache, type: 'action', danger: true },
        { title: 'Export Platform Data', subtitle: 'Generate comprehensive data export', icon: 'download', action: exportPlatformData, type: 'action' },
      ],
    },
    {
      title: 'Account',
      items: [
        { title: 'Sign Out', subtitle: 'Sign out of Super Admin panel', icon: 'log-out', action: handleSignOut, type: 'action', danger: true },
      ],
    },
  ];

  return { profile, maintenanceMode, debugMode, settingsSections };
}
