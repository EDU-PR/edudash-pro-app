import type { SettingsSection } from '@/lib/screen-styles/super-admin-settings.styles';

// ── Alert callback ─────────────────────────────────────────────────────────

export interface ShowAlertFn {
  (opts: {
    title: string;
    message: string;
    type?: string;
    buttons?: Array<{ text: string; style?: string; onPress?: () => void | Promise<void> }>;
  }): void;
}

// ── Hook return type ───────────────────────────────────────────────────────

export interface UseSuperAdminSettingsReturn {
  profile: { id?: string; role?: string; email?: string; last_login_at?: string } | null;
  maintenanceMode: boolean;
  debugMode: boolean;
  settingsSections: SettingsSection[];
}
