import type { SettingsSection } from '@/lib/screen-styles/super-admin-settings.styles';
import type { AlertButton } from '@/components/ui/AlertModal';

// ── Alert callback ─────────────────────────────────────────────────────────

export interface ShowAlertFn {
  (opts: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    buttons?: AlertButton[];
  }): void;
}

// ── Hook return type ───────────────────────────────────────────────────────

export interface UseSuperAdminSettingsReturn {
  profile: { id?: string; role?: string; email?: string; last_login_at?: string } | null;
  maintenanceMode: boolean;
  debugMode: boolean;
  settingsSections: SettingsSection[];
}
