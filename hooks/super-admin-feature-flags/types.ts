/** Types for Super Admin Feature Flags hook. */

import type { Dispatch, SetStateAction } from 'react';
import type { FeatureFlag, FeatureFlagForm } from '@/lib/screen-styles/super-admin-feature-flags.styles';
import type { AlertButton } from '@/components/ui/AlertModal';

// ─── Alert Types ──────────────────────────────────────────────────────

export interface ShowAlertFn {
  (opts: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    buttons?: AlertButton[];
  }): void;
}

// ─── Fetch Result ─────────────────────────────────────────────────────

export interface FetchFlagsResult {
  data: FeatureFlag[] | null;
  error: boolean;
  useMock?: boolean;
}

// ─── Hook Return ──────────────────────────────────────────────────────

export interface UseSuperAdminFeatureFlagsReturn {
  // State
  hasAccess: boolean;
  loading: boolean;
  refreshing: boolean;
  featureFlags: FeatureFlag[];
  showCreateModal: boolean;
  showEditModal: boolean;
  selectedFlag: FeatureFlag | null;
  saving: boolean;
  formData: FeatureFlagForm;

  // Constants
  availableRoles: string[];
  environments: string[];

  // Actions
  onRefresh: () => Promise<void>;
  toggleFeatureFlag: (flag: FeatureFlag) => void;
  createFeatureFlag: () => Promise<void>;
  updateFeatureFlag: () => Promise<void>;
  deleteFeatureFlag: (flag: FeatureFlag) => void;
  resetForm: () => void;
  openEditModal: (flag: FeatureFlag) => void;
  closeModal: () => void;

  // Setters (for form binding)
  setFormData: Dispatch<SetStateAction<FeatureFlagForm>>;
  setShowCreateModal: Dispatch<SetStateAction<boolean>>;
  setShowEditModal: Dispatch<SetStateAction<boolean>>;
  setSelectedFlag: Dispatch<SetStateAction<FeatureFlag | null>>;
}

// ─── Constants ────────────────────────────────────────────────────────

export const DEFAULT_FORM: FeatureFlagForm = {
  name: '',
  key: '',
  description: '',
  is_enabled: false,
  rollout_percentage: 100,
  target_roles: [],
  environment: 'production',
};

export const AVAILABLE_ROLES = ['principal', 'teacher', 'parent', 'all'];
export const ENVIRONMENTS = ['development', 'staging', 'production'];
