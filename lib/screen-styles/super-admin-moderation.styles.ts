import { StyleSheet } from 'react-native';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ModerationItem {
  id: string;
  type: 'lesson' | 'homework' | 'message' | 'comment' | 'announcement';
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_email: string;
  school_id: string;
  school_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  flags: string[];
  report_count: number;
  created_at: string;
  flagged_at: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  auto_flagged: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
}

export interface ModerationFilters {
  type: 'all' | 'lesson' | 'homework' | 'message' | 'comment' | 'announcement';
  status: 'all' | 'pending' | 'approved' | 'rejected' | 'flagged';
  severity: 'all' | 'low' | 'medium' | 'high' | 'critical';
  school: string;
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

export const getSeverityColor = (severity: string): string => {
  switch (severity) {
    case 'critical':
      return '#dc2626';
    case 'high':
      return '#ea580c';
    case 'medium':
      return '#d97706';
    case 'low':
      return '#16a34a';
    default:
      return '#6b7280';
  }
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'approved':
      return '#16a34a';
    case 'rejected':
      return '#dc2626';
    case 'flagged':
      return '#ea580c';
    case 'pending':
      return '#d97706';
    default:
      return '#6b7280';
  }
};

export const getTypeIcon = (type: string): string => {
  switch (type) {
    case 'lesson':
      return 'book';
    case 'homework':
      return 'document-text';
    case 'message':
      return 'mail';
    case 'comment':
      return 'chatbubble';
    case 'announcement':
      return 'megaphone';
    default:
      return 'document';
  }
};

// ── Styles ─────────────────────────────────────────────────────────────────────

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
    statsContainer: {
      paddingBottom: 16,
    },
    statsText: {
      color: '#9ca3af',
      fontSize: 14,
    },
    filtersContainer: {
      backgroundColor: '#1f2937',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#374151',
    },
    filterTabs: {
      marginBottom: 8,
    },
    filterTab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: '#374151',
      marginRight: 8,
    },
    filterTabActive: {
      backgroundColor: '#00f5ff',
    },
    filterTabText: {
      color: '#9ca3af',
      fontSize: 14,
      fontWeight: '500',
    },
    filterTabTextActive: {
      color: '#0b1220',
    },
    content: {
      flex: 1,
      backgroundColor: '#111827',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 64,
    },
    loadingText: {
      color: '#9ca3af',
      marginTop: 16,
    },
    itemCard: {
      backgroundColor: '#1f2937',
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: '#374151',
    },
    itemHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    itemInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    typeIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#374151',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    itemDetails: {
      flex: 1,
    },
    itemTitle: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 2,
    },
    itemAuthor: {
      color: '#9ca3af',
      fontSize: 14,
    },
    itemMeta: {
      alignItems: 'flex-end',
      gap: 4,
    },
    severityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    severityText: {
      fontSize: 10,
      fontWeight: '600',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
    },
    itemContent: {
      color: '#d1d5db',
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    itemFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    itemFlags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      flex: 1,
    },
    flagChip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: '#374151',
    },
    flagChipText: {
      color: '#9ca3af',
      fontSize: 10,
      textTransform: 'capitalize',
    },
    itemStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    reportCount: {
      color: '#ef4444',
      fontSize: 12,
      fontWeight: '500',
    },
    itemDate: {
      color: '#6b7280',
      fontSize: 12,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 64,
    },
    emptyText: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
      marginTop: 16,
    },
    emptySubText: {
      color: '#9ca3af',
      fontSize: 14,
      marginTop: 4,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: '#0b1220',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#374151',
    },
    modalTitle: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: '600',
    },
    modalContent: {
      flex: 1,
      backgroundColor: '#111827',
    },
    modalSection: {
      backgroundColor: '#1f2937',
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      padding: 16,
    },
    modalSectionTitle: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 12,
    },
    modalInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    modalInfoLabel: {
      color: '#9ca3af',
      fontSize: 14,
    },
    modalInfoValue: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '500',
    },
    contentText: {
      color: '#d1d5db',
      fontSize: 14,
      lineHeight: 20,
    },
    flagsList: {
      gap: 8,
    },
    flagItem: {
      backgroundColor: '#374151',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    flagItemText: {
      color: '#ffffff',
      fontSize: 14,
      textTransform: 'capitalize',
    },
    reviewNotesInput: {
      backgroundColor: '#374151',
      color: '#ffffff',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 8,
      fontSize: 14,
      textAlignVertical: 'top',
      minHeight: 100,
    },
    previousReview: {
      color: '#9ca3af',
      fontSize: 12,
      marginBottom: 8,
    },
    previousReviewNotes: {
      color: '#d1d5db',
      fontSize: 14,
      lineHeight: 20,
    },
    modalActions: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: '#374151',
    },
    modalActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1f2937',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#374151',
    },
    approveButton: {
      borderColor: '#16a34a',
    },
    rejectButton: {
      borderColor: '#dc2626',
    },
    modalActionText: {
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
  });
}
