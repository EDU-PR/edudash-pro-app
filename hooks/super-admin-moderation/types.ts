import type { ModerationItem, ModerationFilters } from '@/lib/screen-styles/super-admin-moderation.styles';
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

export interface UseSuperAdminModerationReturn {
  profile: { id?: string; role?: string; email?: string } | null;
  loading: boolean;
  refreshing: boolean;
  filteredItems: ModerationItem[];
  filters: ModerationFilters;
  setFilters: React.Dispatch<React.SetStateAction<ModerationFilters>>;
  showDetailModal: boolean;
  setShowDetailModal: (v: boolean) => void;
  selectedItem: ModerationItem | null;
  setSelectedItem: (item: ModerationItem | null) => void;
  reviewNotes: string;
  setReviewNotes: (v: string) => void;
  processing: boolean;
  onRefresh: () => Promise<void>;
  openDetail: (item: ModerationItem) => void;
  closeDetail: () => void;
  moderateItem: (item: ModerationItem, action: 'approve' | 'reject' | 'flag') => Promise<void>;
}

// ── Severity sort order ────────────────────────────────────────────────────

export const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};
