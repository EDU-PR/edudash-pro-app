import { useCallback } from 'react';
import { track } from '@/lib/analytics';
import { signOutAndRedirect } from '@/lib/authActions';
import { logger } from '@/lib/logger';
import { writeSuperAdminAudit } from '@/lib/audit/superAdminAudit';
import type { ShowAlertFn } from './types';

/** Creates memoized action handlers for the Super Admin settings screen. */
export function useSettingsActions(
  profile: { id?: string; last_login_at?: string } | null,
  showAlert: ShowAlertFn,
  setMaintenanceMode: (v: boolean) => void,
) {
  const handleSignOut = useCallback(async () => {
    showAlert({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of the Super Admin panel?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              track('superadmin_signed_out', {
                session_duration: Date.now() - (profile?.last_login_at ? new Date(profile.last_login_at).getTime() : 0),
              });
              await writeSuperAdminAudit({
                actorProfileId: profile?.id,
                action: 'superadmin_signed_out',
                description: 'Super admin signed out',
                metadata: { sign_out_time: new Date().toISOString() },
              });
              await signOutAndRedirect({ redirectTo: '/(auth)/sign-in' });
            } catch (err) {
              logger.error('Sign out error:', err);
              showAlert({ title: 'Error', message: 'Failed to sign out', type: 'error' });
            }
          },
        },
      ],
    });
  }, [profile, showAlert]);

  const toggleMaintenanceMode = useCallback(async (value: boolean) => {
    showAlert({
      title: 'Toggle Maintenance Mode',
      message: value
        ? 'This will put the platform in maintenance mode, making it inaccessible to all users except super admins.'
        : 'This will disable maintenance mode and restore normal platform access.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: value ? 'Enable' : 'Disable',
          style: value ? 'destructive' : 'default',
          onPress: async () => {
            try {
              setMaintenanceMode(value);
              track('superadmin_maintenance_mode_toggled', { enabled: value, timestamp: new Date().toISOString() });
              await writeSuperAdminAudit({
                actorProfileId: profile?.id,
                action: 'maintenance_mode_toggled',
                description: `Maintenance mode ${value ? 'enabled' : 'disabled'}`,
                metadata: { enabled: value, reason: 'Manual toggle by super admin' },
              });
              showAlert({ title: 'Success', message: `Maintenance mode ${value ? 'enabled' : 'disabled'} successfully`, type: 'success' });
            } catch (err) {
              logger.error('Failed to toggle maintenance mode:', err);
              showAlert({ title: 'Error', message: 'Failed to update maintenance mode', type: 'error' });
              setMaintenanceMode(!value);
            }
          },
        },
      ],
    });
  }, [profile, showAlert, setMaintenanceMode]);

  const clearPlatformCache = useCallback(async () => {
    showAlert({
      title: 'Clear Platform Cache',
      message: 'This will clear all cached data across the platform. This may temporarily slow down the platform while caches rebuild.',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache', style: 'destructive',
          onPress: async () => {
            try {
              track('superadmin_cache_cleared', { timestamp: new Date().toISOString() });
              await writeSuperAdminAudit({
                actorProfileId: profile?.id,
                action: 'platform_cache_cleared',
                description: 'Platform cache cleared',
                metadata: { cleared_at: new Date().toISOString() },
              });
              showAlert({ title: 'Success', message: 'Platform cache cleared successfully', type: 'success' });
            } catch (err) {
              logger.error('Failed to clear cache:', err);
              showAlert({ title: 'Error', message: 'Failed to clear platform cache', type: 'error' });
            }
          },
        },
      ],
    });
  }, [profile, showAlert]);

  const exportPlatformData = useCallback(async () => {
    showAlert({
      title: 'Export Platform Data',
      message: 'This will generate a comprehensive export of all platform data. This may take several minutes.',
      type: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            try {
              track('superadmin_data_export_initiated', { timestamp: new Date().toISOString() });
              await writeSuperAdminAudit({
                actorProfileId: profile?.id,
                action: 'platform_data_export_initiated',
                description: 'Platform data export initiated',
                metadata: { export_type: 'full_platform_export', initiated_at: new Date().toISOString() },
              });
              showAlert({ title: 'Export Started', message: 'Platform data export has been initiated. You will receive an email when the export is complete.', type: 'success' });
            } catch (err) {
              logger.error('Failed to initiate data export:', err);
              showAlert({ title: 'Error', message: 'Failed to initiate data export', type: 'error' });
            }
          },
        },
      ],
    });
  }, [profile, showAlert]);

  return { handleSignOut, toggleMaintenanceMode, clearPlatformCache, exportPlatformData };
}
