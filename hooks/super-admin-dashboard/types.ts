import type {
  DashboardStats,
  RecentAlert,
  SystemStatus,
  FeatureFlag,
  QuickAction,
} from '@/lib/screen-styles/super-admin-dashboard.styles';
import type { SuperAdminAIControlState } from '@/services/superadmin/SuperAdminAIControl';
import type { AlertButton } from '@/components/ui/AlertModal';

// Re-export for consumer convenience
export type { DashboardStats, RecentAlert, SystemStatus, FeatureFlag, QuickAction };

export type AlertSeverity = 'high' | 'medium' | 'low';

/** Password-confirmation modal state exposed to the screen for rendering */
export interface PasswordModalState {
  visible: boolean;
  message: string;
  value: string;
  error: string | null;
  submitting: boolean;
}

/** Result returned by the standalone fetchDashboardData function */
export interface DashboardFetchResult {
  stats: DashboardStats;
  systemStatus: SystemStatus;
  alerts: RecentAlert[];
  featureFlags: FeatureFlag[];
}

/** Signature of the showAlert helper injected from useAlertModal */
export type ShowAlertFn = (opts: {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  buttons?: AlertButton[];
}) => void;

/** Full return type of useSuperAdminDashboard */
export interface UseSuperAdminDashboardReturn {
  // Auth
  user: any;
  profile: any;
  authLoading: boolean;
  profileLoading: boolean;

  // Dashboard data
  loading: boolean;
  refreshing: boolean;
  dashboardStats: DashboardStats | null;
  systemStatus: SystemStatus | null;
  recentAlerts: RecentAlert[];
  featureFlags: FeatureFlag[];
  quickActions: QuickAction[];

  // AI control
  aiControl: SuperAdminAIControlState | null;
  aiControlLoading: boolean;
  isOwner: boolean;
  isOwnerUnclaimed: boolean;
  canEditAIControl: boolean;
  highRiskAvailable: boolean;
  ownerStatusText: string;
  claimOwnership: () => Promise<void>;
  updateAIControl: (patch: Partial<SuperAdminAIControlState>) => Promise<void>;
  applyAutonomyPreset: (preset: 'lockdown' | 'assistant' | 'copilot' | 'full') => Promise<void>;

  // Password modal
  passwordModal: PasswordModalState;
  setPasswordValue: (v: string) => void;
  closePasswordModal: (confirmed: boolean) => void;
  handlePasswordConfirm: () => Promise<void>;

  // Handlers
  onRefresh: () => Promise<void>;
  handleQuickAction: (action: QuickAction) => void;

  // Helpers
  getAlertColor: (severity: AlertSeverity) => string;
  formatAlertTime: (timestamp: string) => string;
}
