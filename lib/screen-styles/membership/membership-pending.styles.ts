/**
 * Styles, types, and helpers for MembershipPendingScreen
 */
import { StyleSheet } from 'react-native';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MembershipStatus {
  status: 'pending' | 'pending_verification' | 'active' | 'suspended' | 'revoked';
  memberType: string;
  organizationName: string;
  regionName?: string;
  requestedAt: string;
  message?: string;
}

// ── Pure Helpers ───────────────────────────────────────────────────────────────

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const getMemberTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    youth_member: 'Youth Member',
    youth_president: 'Youth President',
    youth_secretary: 'Youth Secretary',
    youth_coordinator: 'Youth Coordinator',
    learner: 'Learner',
    member: 'Member',
  };
  return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// ── Styles ─────────────────────────────────────────────────────────────────────

export function createStyles(_theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    loadingText: {
      fontSize: 14,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    header: {
      alignItems: 'center',
      marginBottom: 24,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: 20,
      lineHeight: 20,
    },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 16,
      overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
    },
    cardContent: {
      padding: 16,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    detailLabel: {
      fontSize: 14,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '500',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
    },
    infoStep: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    stepNumber: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepNumberText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
    },
    stepText: {
      fontSize: 14,
      flex: 1,
    },
    refreshHint: {
      fontSize: 12,
      textAlign: 'center',
      marginBottom: 16,
    },
    actions: {
      gap: 12,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
    },
    actionButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
