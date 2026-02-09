import type {
  Organization,
  OrganizationStats,
  OrganizationType,
  OrganizationStatus,
} from '@/lib/screen-styles/super-admin-organizations.styles';

/** The showAlert signature from useAlertModal */
export type ShowAlertFn = (config: {
  title: string;
  message?: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
}) => void;

/** Parameters accepted by the orchestrator hook */
export interface UseSuperAdminOrganizationsParams {
  showAlert: ShowAlertFn;
}

/** Return type of the orchestrator hook */
export interface UseSuperAdminOrganizationsReturn {
  // Data
  organizations: Organization[];
  filteredOrgs: Organization[];
  stats: OrganizationStats | null;

  // Loading / UI state
  loading: boolean;
  refreshing: boolean;
  updatingSubscription: boolean;

  // Filters
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedType: OrganizationType;
  setSelectedType: (t: OrganizationType) => void;
  selectedStatus: OrganizationStatus;
  setSelectedStatus: (s: OrganizationStatus) => void;

  // Selected org / modals
  selectedOrg: Organization | null;
  setSelectedOrg: (org: Organization | null) => void;
  showDetailModal: boolean;
  setShowDetailModal: (v: boolean) => void;
  showActionsModal: boolean;
  setShowActionsModal: (v: boolean) => void;

  // Actions
  onRefresh: () => Promise<void>;
  handleOrgPress: (org: Organization) => void;
  handleOrgAction: (action: string) => void;
  openTierPicker: (org: Organization) => void;
  openStatusPicker: (org: Organization) => void;
}
