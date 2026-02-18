import { StyleSheet } from 'react-native';
import { normalizeTierName, getTierDisplayName } from '@/lib/tiers';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type OrganizationType = 'preschool' | 'k12' | 'skills' | 'org' | 'all';
export type OrganizationStatus = 'active' | 'pending' | 'suspended' | 'inactive' | 'all';

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  /** Raw source type value (e.g. combined, community_school, skills_development) */
  organization_type_raw?: string | null;
  status: OrganizationStatus;
  contact_email: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  student_count: number;
  teacher_count: number;
  active_student_count?: number;
  active_teacher_count?: number;
  subscription_tier?: string;
  subscription_status?: string;
  created_at: string;
  last_active_at?: string;
  principal_name?: string;
  principal_email?: string;
  logo_url?: string;
  is_verified: boolean;
  metadata?: Record<string, any>;
  subscription_plan_id?: string | null;
}

export interface OrganizationStats {
  total: number;
  preschools: number;
  k12_schools: number;
  skills_centers: number;
  other_orgs: number;
  active: number;
  pending: number;
  suspended: number;
  verified: number;
  with_subscription: number;
}

// ──────────────────────────────────────────────
// Theme & Colors
// ──────────────────────────────────────────────

export const theme = {
  background: '#0a0a0f',
  card: '#1a1a2e',
  cardHover: '#252540',
  primary: '#6366f1',
  primaryLight: '#818cf8',
  secondary: '#10b981',
  text: '#ffffff',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  border: '#374151',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

export const statusColors: Record<string, string> = {
  active: '#10b981',
  pending: '#f59e0b',
  suspended: '#ef4444',
  inactive: '#6b7280',
};

export const typeColors: Record<string, string> = {
  preschool: '#8b5cf6',
  k12: '#3b82f6',
  skills: '#f59e0b',
  org: '#10b981',
};

// ──────────────────────────────────────────────
// Pure Helper Functions
// ──────────────────────────────────────────────

export const getEntityMeta = (org: Organization) => {
  const idParts = org.id.split('_');
  const sourceType = idParts[0];
  const actualId = idParts.slice(1).join('_');
  const entityType =
    sourceType === 'preschool' ? 'preschool' : sourceType === 'school' ? 'school' : 'organization';
  return { entityType, actualId };
};

export const formatTierLabel = (tier?: string | null) => {
  if (!tier) return 'Free';
  const normalized = normalizeTierName(tier);
  return `${getTierDisplayName(normalized)} (${normalized.replace(/_/g, ' ')})`;
};

export const formatStatusLabel = (status?: string | null) => {
  if (!status) return 'active';
  return status.replace(/_/g, ' ');
};

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

export function createStyles(t: typeof theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: t.textSecondary,
      marginTop: 12,
      fontSize: 16,
    },
    listContent: {
      padding: 16,
      paddingBottom: 100,
    },
    statsContainer: {
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: t.background,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    headerButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: t.text,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    statCard: {
      flex: 1,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: '700',
      color: t.text,
    },
    statLabel: {
      fontSize: 12,
      color: t.textSecondary,
      marginTop: 4,
    },
    filtersContainer: {
      marginBottom: 16,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.card,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    searchInput: {
      flex: 1,
      marginLeft: 12,
      fontSize: 16,
      color: t.text,
    },
    filterScroll: {
      marginBottom: 8,
    },
    filterChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: t.card,
      marginRight: 8,
      borderWidth: 1,
      borderColor: t.border,
    },
    filterChipActive: {
      backgroundColor: t.primary,
      borderColor: t.primary,
    },
    filterChipText: {
      color: t.textSecondary,
      fontSize: 14,
    },
    filterChipTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    resultsHeader: {
      marginBottom: 12,
    },
    resultsCount: {
      color: t.textSecondary,
      fontSize: 14,
    },
    orgCard: {
      flex: 1,
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 16,
      margin: 4,
      borderWidth: 1,
      borderColor: t.border,
    },
    orgHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    orgTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    typeBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    typeBadgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    orgName: {
      fontSize: 18,
      fontWeight: '600',
      color: t.text,
      marginBottom: 12,
    },
    orgDetails: {
      gap: 6,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      color: t.textSecondary,
      fontSize: 13,
      flex: 1,
    },
    orgFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    actionButton: {
      padding: 8,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: t.text,
      marginTop: 16,
    },
    emptyText: {
      fontSize: 14,
      color: t.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    emptyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 24,
      gap: 8,
    },
    emptyButtonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 16,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: t.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '85%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: t.text,
      flex: 1,
    },
    modalBody: {
      padding: 20,
    },
    modalSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: t.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
    },
    modalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border + '40',
    },
    modalLabel: {
      fontSize: 14,
      color: t.textSecondary,
    },
    modalValue: {
      fontSize: 14,
      color: t.text,
      fontWeight: '500',
      maxWidth: '60%',
      textAlign: 'right',
    },
    modalValueCompact: {
      fontSize: 13,
      color: t.text,
      fontWeight: '500',
      textAlign: 'right',
      flexShrink: 1,
    },
    modalInlineActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      maxWidth: '70%',
    },
    modalLinkButton: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.primary + '55',
      backgroundColor: t.primary + '1f',
    },
    modalLinkText: {
      color: t.primaryLight,
      fontSize: 12,
      fontWeight: '700',
    },
    editLabel: {
      color: t.textSecondary,
      fontSize: 13,
      marginBottom: 6,
    },
    editInput: {
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.background,
      borderRadius: 12,
      color: t.text,
      fontSize: 15,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginBottom: 12,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border + '35',
    },
    editFooter: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      paddingBottom: 20,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: t.border + '40',
      backgroundColor: t.card,
    },
    editCancelBtn: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      backgroundColor: t.background,
    },
    editCancelText: {
      color: t.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    editSaveBtn: {
      flex: 1,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      backgroundColor: t.primary,
    },
    editSaveBtnDisabled: {
      opacity: 0.65,
    },
    editSaveText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
      marginBottom: 40,
    },
    modalButtonRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
    },
    modalActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      gap: 8,
    },
    modalActionText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    actionsOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    actionsContent: {
      backgroundColor: t.card,
      borderRadius: 20,
      padding: 20,
      width: '100%',
      maxWidth: 340,
    },
    memberModalContent: {
      backgroundColor: t.card,
      borderRadius: 20,
      padding: 20,
      width: '100%',
      maxWidth: 420,
      maxHeight: '86%',
    },
    memberModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    membersLoading: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
      gap: 8,
    },
    membersList: {
      maxHeight: 360,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.border + '35',
      gap: 10,
    },
    memberTextWrap: {
      flex: 1,
    },
    memberName: {
      color: t.text,
      fontSize: 14,
      fontWeight: '600',
    },
    memberSecondary: {
      color: t.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    memberStatusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    memberStatusText: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    emptyMembers: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    memberActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    memberSecondaryBtn: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.background,
    },
    memberSecondaryBtnText: {
      color: t.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    memberPrimaryBtn: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.primary,
    },
    memberPrimaryBtnText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    actionsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: t.text,
      textAlign: 'center',
    },
    actionsSubtitle: {
      fontSize: 14,
      color: t.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 20,
    },
    actionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: t.background,
      marginBottom: 8,
      gap: 12,
    },
    actionItemText: {
      fontSize: 16,
      fontWeight: '500',
    },
    cancelButton: {
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    cancelButtonText: {
      color: t.textSecondary,
      fontSize: 16,
      fontWeight: '500',
    },
  });
}
